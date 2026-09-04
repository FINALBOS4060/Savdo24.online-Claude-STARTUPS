import { Request, Response, NextFunction } from "express";
import path from "path";
import fs from "fs";
import { escapeHtml } from "./pure-helpers";
import { logger } from "./logger";

const botAgents = [
  "facebookexternalhit",
  "TelegramBot",
  "Twitterbot",
  "slackbot",
  "LinkedInBot",
  "WhatsApp",
  "Googlebot",
  "Bingbot"
];

export function createBotMetaHandler(prisma: any, getSetting: (key: string) => Promise<string | null>) {
  return async function handleStartupBotMeta(req: Request, res: Response, next: NextFunction) {
    const userAgent = req.headers["user-agent"] || "";
    const isBot = botAgents.some(bot => userAgent.toLowerCase().includes(bot.toLowerCase()));

    if (!isBot && process.env.NODE_ENV !== "production") {
      return next();
    }

    try {
      const { id } = req.params;
      const startup = await prisma.startup.findUnique({ where: { id } });

      if (!startup) {
        return next();
      }

      const distPath = path.join(process.cwd(), "dist");
      const indexPath = process.env.NODE_ENV === "production" 
        ? path.join(distPath, "index.html")
        : path.join(process.cwd(), "index.html");

      if (!fs.existsSync(indexPath)) {
        return next();
      }

      let html = fs.readFileSync(indexPath, "utf8");
      const appUrl = await getSetting("APP_URL") || "https://savdo24.online";

      const rawTitle = `${startup.name} — Savdo24`;
      const rawDescription = (startup.description || "").substring(0, 160);
      let rawImage = startup.image || "https://savdo24.online/og-image.png";
      if (rawImage.startsWith("/")) {
        rawImage = `${appUrl}${rawImage}`;
      }
      const rawUrl = `${appUrl}/startup/${id}`;

      const title = escapeHtml(rawTitle);
      const description = escapeHtml(rawDescription);
      const image = escapeHtml(rawImage);
      const url = escapeHtml(rawUrl);

      // Replace Title
      html = html.replace(/<title>.*?<\/title>/g, `<title>${title}</title>`);
      
      // Replace Meta Description
      html = html.replace(/<meta name="description" content=".*?" \/>/g, `<meta name="description" content="${description}" />`);
      
      // Replace OG Tags
      html = html.replace(/<meta property="og:url" content=".*?" \/>/g, `<meta property="og:url" content="${url}" />`);
      html = html.replace(/<meta property="og:title" content=".*?" \/>/g, `<meta property="og:title" content="${title}" />`);
      html = html.replace(/<meta property="og:description" content=".*?" \/>/g, `<meta property="og:description" content="${description}" />`);
      html = html.replace(/<meta property="og:image" content=".*?" \/>/g, `<meta property="og:image" content="${image}" />`);

      // Replace Twitter Tags
      html = html.replace(/<meta property="twitter:url" content=".*?" \/>/g, `<meta property="twitter:url" content="${url}" />`);
      html = html.replace(/<meta property="twitter:title" content=".*?" \/>/g, `<meta property="twitter:title" content="${title}" />`);
      html = html.replace(/<meta property="twitter:description" content=".*?" \/>/g, `<meta property="twitter:description" content="${description}" />`);
      html = html.replace(/<meta property="twitter:image" content=".*?" \/>/g, `<meta property="twitter:image" content="${image}" />`);

      res.send(html);
    } catch (err: unknown) {
      logger.error({ err }, "SEO Bot Meta Inject error");
      next();
    }
  };
}
