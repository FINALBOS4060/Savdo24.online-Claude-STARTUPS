import axios from "axios";
import RSSParser from "rss-parser";
import fs from "fs";
import path from "path";
import FormData from "form-data";
import dotenv from "dotenv";

dotenv.config();

const RSS_URL = process.env.RSS_URL || "https://news.google.com/rss/search?q=technology&hl=en-US&gl=US&ceid=US:en";
const POLLINATIONS_BASE = "https://image.pollinations.ai/prompt";
const POSTS_DB = path.resolve(__dirname, "../posted.json");

const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN!;
const TELEGRAM_CHAT = process.env.TELEGRAM_CHAT_ID!; // e.g. @yourchannel or -1001234567890
const GOOGLE_AI_KEY = process.env.GOOGLE_AI_STUDIO_KEY || "";

const MAX_PER_RUN = Number(process.env.MAX_PER_RUN || "10");

type PostedDB = { urls: string[] };

function loadPosted(): PostedDB {
  try {
    return JSON.parse(fs.readFileSync(POSTS_DB, "utf8"));
  } catch {
    return { urls: [] };
  }
}
function savePosted(db: PostedDB) {
  fs.writeFileSync(POSTS_DB, JSON.stringify(db, null, 2));
}

async function fetchNews(): Promise<RSSParser.Output["items"]> {
  const parser = new RSSParser();
  const feed = await parser.parseURL(RSS_URL);
  return feed.items || [];
}

async function generateImage(prompt: string): Promise<Buffer> {
  const url = `${POLLINATIONS_BASE}/${encodeURIComponent(prompt)}`;
  const params = {
    width: 1024,
    height: 768,
    model: "flux",
    seed: Math.floor(Math.random() * 100000),
    nologo: "true",
  };
  const res = await axios.get(url, { params, responseType: "arraybuffer", timeout: 120_000 });
  return Buffer.from(res.data);
}

async function callGoogleAIForCaption(title: string, link: string, summary?: string): Promise<string> {
  // GENERIC placeholder: moslashtiring (Vertex AI / Generative API endpoint va body talabiga qarab)
  if (!GOOGLE_AI_KEY) {
    // Fallback: oddiy shablon (Uzbekcha)
    const emoji = "🤖📰✨";
    return `${emoji} ${title}\n\n${summary ? summary + "\n\n" : ""}Batafsil: ${link}\n\n#texnologiya`;
  }

  try {
    const prompt = `Siz telegram kanal uchun qisqa, jozibador va emoji bilan to‘ldirilgan post yozasiz. Til: Uzbek. Sarlavha: ${title}. Link: ${link}. Qisqacha: ${summary || ""}. Uzunlik 2-3 jumla. Qo‘shing emoji va chaqiruv (eng ko‘p 2 emoji).`;
    const endpoint = "https://us-central1-aiplatform.googleapis.com/v1/projects/PROJECT_ID/locations/us-central1/publishers/google/models/text-bison:generate"; // O'zgartiring
    const res = await axios.post(
      endpoint,
      { prompt },
      { headers: { Authorization: `Bearer ${GOOGLE_AI_KEY}` }, timeout: 30_000 }
    );
    if (res.data && typeof res.data === "object") {
      return (res.data as any).text || JSON.stringify(res.data).slice(0, 1000);
    }
    return `${title}\n${link}`;
  } catch (err) {
    console.error("Google AI call failed, using fallback:", err);
    return `${title}\n${link}`;
  }
}

async function sendToTelegram(photoBuffer: Buffer, caption: string) {
  const url = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendPhoto`;
  const form = new FormData();
  form.append("chat_id", TELEGRAM_CHAT);
  form.append("photo", photoBuffer, { filename: "image.jpg" });
  form.append("caption", caption);
  form.append("parse_mode", "HTML");
  const headers = form.getHeaders();
  await axios.post(url, form, { headers, timeout: 60_000 });
}

async function processRun() {
  console.log("Boshlanmoqda:", new Date().toISOString());
  const posted = loadPosted();
  const items = await fetchNews();
  let count = 0;

  for (const it of items) {
    if (count >= MAX_PER_RUN) break;
    const link = it.link || (it.guid as string) || "";
    if (!link) continue;
    if (posted.urls.includes(link)) continue;

    const title = it.title || "Yangilik";
    const summary = it.contentSnippet || it.content || "";

    const caption = await callGoogleAIForCaption(title, link, summary);

    const imagePrompt = `${title}. ${summary ? summary.slice(0, 120) : ""} — tech news photography, cinematic, high detail, 4k, editorial style`;
    let imgBuffer: Buffer;
    try {
      imgBuffer = await generateImage(imagePrompt);
    } catch (e) {
      console.error("Rasm generatsiya xatosi, fallback rasm bilan davom etilmoqda", e);
      imgBuffer = Buffer.from("");
    }

    try {
      await sendToTelegram(imgBuffer, caption);
      posted.urls.push(link);
      savePosted(posted);
      console.log("Yuborildi:", title);
      count++;
    } catch (e) {
      console.error("Telegramga yuborishda xatolik:", e);
    }

    await new Promise((r) => setTimeout(r, 2000));
  }

  console.log("Run tugadi. Yuborilganlar:", count);
}

// Ishga tushirish: qo'llab-quvvatlaymiz "--once" bayroqchasini workflow yoki one-shot ishlatish uchun
(async () => {
  const once = process.argv.includes("--once");
  if (once) {
    await processRun();
    process.exit(0);
  }

  await processRun();
  const intervalMs = 144 * 60 * 1000; // 144 minutes = 2h24m
  setInterval(processRun, intervalMs);
})();
