import axios from "axios";
import RSSParser from "rss-parser";
import fs from "fs";
import path from "path";
import FormData from "form-data";
import dotenv from "dotenv";
import { getSetting } from "../lib/context";

dotenv.config();

const POLLINATIONS_BASE = "https://image.pollinations.ai/prompt";
const POSTS_DB = path.resolve(__dirname, "../posted.json");

const DEFAULT_RSS = "https://news.google.com/rss/search?q=technology&hl=en-US&gl=US&ceid=US:en";
const DEFAULT_MAX_PER_RUN = 10;
const MANUAL_RUN_POLL_MS = 30_000; // poll DB for manual run trigger

type PostedDB = { urls: string[] };

function loadPosted(): PostedDB {
  try {
    return JSON.parse(fs.readFileSync(POSTS_DB, "utf8"));
  } catch {
    return { urls: [] };
  }
}
function savePosted(db: PostedDB) {
  try {
    fs.writeFileSync(POSTS_DB, JSON.stringify(db, null, 2));
  } catch (e) {
    console.error("posted.json yozishda xatolik:", e);
  }
}

async function loadConfig() {
  // Read from DB settings if available, otherwise fallback to env
  const rss = (await getSetting("RSS_URL")) || process.env.RSS_URL || DEFAULT_RSS;
  const telegramToken = (await getSetting("TELEGRAM_BOT_TOKEN")) || process.env.TELEGRAM_BOT_TOKEN || "";
  const telegramChat = (await getSetting("TELEGRAM_CHAT")) || process.env.TELEGRAM_CHAT || "";
  const googleAiKey = (await getSetting("GOOGLE_AI_STUDIO_KEY")) || process.env.GOOGLE_AI_STUDIO_KEY || "";
  const pollinationsModel = (await getSetting("POLLINATIONS_MODEL")) || process.env.POLLINATIONS_MODEL || "flux";
  const maxPerRunRaw = (await getSetting("MAX_PER_RUN")) || process.env.MAX_PER_RUN;
  const maxPerRun = Number(maxPerRunRaw) || DEFAULT_MAX_PER_RUN;

  return {
    rss,
    telegramToken,
    telegramChat,
    googleAiKey,
    pollinationsModel,
    maxPerRun
  };
}

async function fetchNews(rssUrl: string): Promise<RSSParser.Output["items"]> {
  const parser = new RSSParser();
  const feed = await parser.parseURL(rssUrl);
  return feed.items || [];
}

async function generateImage(prompt: string, model = "flux"): Promise<Buffer> {
  const url = `${POLLINATIONS_BASE}/${encodeURIComponent(prompt)}`;
  const params = {
    width: 1024,
    height: 768,
    model,
    seed: Math.floor(Math.random() * 100000),
    nologo: "true",
  };
  const res = await axios.get(url, { params, responseType: "arraybuffer", timeout: 120_000 });
  return Buffer.from(res.data);
}

async function callGoogleAIForCaption(googleKey: string, title: string, link: string, summary?: string): Promise<string> {
  if (!googleKey) {
    // Fallback template (Uzbek)
    const emoji = "🤖📰✨";
    return `${emoji} ${title}\n\n${summary ? summary + "\n\n" : ""}Batafsil: ${link}\n\n#texnologiya`;
  }

  try {
    // Placeholder Vertex AI / Generative endpoint — adjust if you use different endpoint/format
    const prompt = `Siz telegram kanal uchun qisqa, jozibador va emoji bilan to‘ldirilgan post yozasiz. Til: Uzbek. Sarlavha: ${title}. Link: ${link}. Qisqacha: ${summary || ""}. Uzunlik 2-3 jumla. Qo‘shing emoji va chaqiruv (eng ko‘p 2 emoji).`;
    const endpoint = process.env.GOOGLE_AI_STUDIO_ENDPOINT || "https://us-central1-aiplatform.googleapis.com/v1/projects/PROJECT_ID/locations/us-central1/publishers/google/models/text-bison:generate";

    const res = await axios.post(
      endpoint,
      { prompt },
      { headers: { Authorization: `Bearer ${googleKey}` }, timeout: 30_000 }
    );

    // Try common shaped responses, fallback to raw
    if (res.data) {
      if (typeof res.data === "string") return res.data;
      // generative APIs often return text in various fields
      if ((res.data as any).text) return (res.data as any).text;
      if ((res.data as any).candidates && (res.data as any).candidates[0]) return (res.data as any).candidates[0].content || JSON.stringify(res.data).slice(0, 1000);
      if ((res.data as any).result && (res.data as any).result.output && Array.isArray((res.data as any).result.output)) {
        // Vertex Ai generative response shape
        const outputs = (res.data as any).result.output;
        const firstText = outputs.find((o: any) => o.type === "text");
        if (firstText) return firstText.text || firstText.content || JSON.stringify(firstText);
      }
      return JSON.stringify(res.data).slice(0, 1000);
    }

    return `${title}\n${link}`;
  } catch (err) {
    console.error("Google AI call failed, using fallback:", err);
    return `${title}\n${link}`;
  }
}

async function sendToTelegram(telegramToken: string, chatId: string, photoBuffer: Buffer | null, caption: string) {
  if (!telegramToken || !chatId) throw new Error("Telegram token yoki chat id topilmadi.");

  if (photoBuffer && photoBuffer.length > 0) {
    const url = `https://api.telegram.org/bot${telegramToken}/sendPhoto`;
    const form = new FormData();
    form.append("chat_id", chatId);
    form.append("photo", photoBuffer, { filename: "image.jpg" });
    form.append("caption", caption);
    form.append("parse_mode", "HTML");
    const headers = form.getHeaders();
    await axios.post(url, form, { headers, timeout: 60_000 });
  } else {
    // send as text message if no image
    const url = `https://api.telegram.org/bot${telegramToken}/sendMessage`;
    await axios.post(url, { chat_id: chatId, text: caption, parse_mode: "HTML" }, { timeout: 30_000 });
  }
}

let lastManualRunValue: string | null = null;
let isRunning = false;

async function processRun() {
  if (isRunning) return; // avoid overlapping runs
  isRunning = true;
  console.log("Bot run boshlanmoqda:", new Date().toISOString());

  const cfg = await loadConfig();
  const posted = loadPosted();
  const items = await fetchNews(cfg.rss);
  let count = 0;

  for (const it of items) {
    if (count >= cfg.maxPerRun) break;
    const link = it.link || (it.guid as string) || "";
    if (!link) continue;
    if (posted.urls.includes(link)) continue;

    const title = it.title || "Yangilik";
    const summary = it.contentSnippet || it.content || "";

    const caption = await callGoogleAIForCaption(cfg.googleAiKey, title, link, summary);

    // Image prompt: title + short descriptor
    const imagePrompt = `${title}. ${summary ? summary.slice(0, 120) : ""} — tech news photography, cinematic, high detail, 4k, editorial style`;
    let imgBuffer: Buffer | null = null;
    try {
      imgBuffer = await generateImage(imagePrompt, cfg.pollinationsModel);
    } catch (e) {
      console.error("Rasm generatsiya xatosi, fallback rasm bilan davom etilmoqda", e);
      imgBuffer = null;
    }

    try {
      await sendToTelegram(cfg.telegramToken, cfg.telegramChat, imgBuffer, caption);
      posted.urls.push(link);
      savePosted(posted);
      console.log("Yuborildi:", title);
      count++;
    } catch (e) {
      console.error("Telegramga yuborishda xatolik:", e);
    }

    // small delay between items to reduce burst
    await new Promise((r) => setTimeout(r, 2000));
  }

  console.log("Run tugadi. Yuborilganlar:", count);
  isRunning = false;
}

async function checkManualRunTrigger() {
  try {
    const val = await getSetting("BOT_MANUAL_RUN_REQUEST");
    if (val && val !== lastManualRunValue) {
      console.log("Manual run trigger detected:", val);
      lastManualRunValue = val;
      await processRun();
    }
  } catch (e) {
    console.error("Manual run tekshirishda xatolik:", e);
  }
}

// Entrypoint: one-shot (--once) or interval
(async () => {
  const once = process.argv.includes("--once");
  if (once) {
    await processRun();
    process.exit(0);
  }

  // First run immediately
  await processRun();

  // Poll for manual run trigger
  setInterval(checkManualRunTrigger, MANUAL_RUN_POLL_MS);

  // Also schedule periodic runs based on env or default interval (144 minutes)
  const intervalMinutes = Number(process.env.SCHEDULE_INTERVAL_MINUTES) || 144;
  const intervalMs = intervalMinutes * 60 * 1000;
  setInterval(async () => {
    try {
      await processRun();
    } catch (e) {
      console.error("Scheduled run error:", e);
    }
  }, intervalMs);
})();
