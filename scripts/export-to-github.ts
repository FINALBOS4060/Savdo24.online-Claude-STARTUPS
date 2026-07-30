import { PrismaClient, type User, type Startup, type Payment } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { simpleGit, SimpleGit } from 'simple-git';
import dotenv from 'dotenv';
import { decryptSecret } from '../src/lib/crypto';
import { fileURLToPath } from 'url';

dotenv.config();

const prisma = new PrismaClient();

async function getSetting(key: string): Promise<string | null> {
  try {
    const dbSetting = await prisma.setting.findUnique({ where: { key } });
    if (dbSetting) {
      try {
        const decrypted = decryptSecret(dbSetting.value);
        return decrypted;
      } catch (decryptErr) {
        return dbSetting.value; // Fallback if not encrypted
      }
    }
  } catch (err) {
    // Suppress if Setting table doesn't exist yet
  }
  return process.env[key] || null;
}

export async function exportToGithub() {
  console.log("=== Starting Weekly Data Export to GitHub ===");

  const GITHUB_TOKEN = await getSetting("BACKUP_GITHUB_TOKEN");
  const GITHUB_REPO = await getSetting("BACKUP_GITHUB_REPO"); // e.g. "https://github.com/username/savdo24-backups.git"
  const rawEmail = await getSetting("BACKUP_GITHUB_EMAIL");
  const GITHUB_EMAIL = rawEmail || 'backup-bot@savdo24.online';
  const rawName = await getSetting("BACKUP_GITHUB_NAME");
  const GITHUB_NAME = rawName || 'Savdo24 Backup Bot';

  if (!GITHUB_TOKEN || !GITHUB_REPO) {
    console.error("Error: BACKUP_GITHUB_TOKEN or BACKUP_GITHUB_REPO is not configured in settings or .env!");
    console.log("Skipping export to private GitHub repository.");
    await prisma.$disconnect();
    return;
  }

  const tempDir = path.join('/tmp', 'savdo24-github-export');

  try {
    console.log("Fetching and sanitizing database tables...");

    // 1. Fetch Users - strictly excluding email, password, tokens, etc.
    const rawUsers = await prisma.user.findMany();
    const sanitizedUsers = rawUsers.map((user: User) => ({
      id: user.id,
      role: user.role,
      verified: user.verified,
      joinDate: user.joinDate,
      walletConnected: user.walletConnected,
      averageRating: user.averageRating,
      totalReviews: user.totalReviews
    }));

    // 2. Fetch Startups - excluding personal contact information
    const rawStartups = await prisma.startup.findMany();
    const sanitizedStartups = rawStartups.map((s: Startup) => {
      // MUHIM: agar bironta yozuvning techStack maydoni yaroqsiz JSON bo'lsa,
      // himoyasiz JSON.parse butun eksportni (users/payments jadvallari bilan
      // birga) to'xtatib qo'yardi. Endi bitta buzuq yozuv faqat shu yozuv
      // uchun 0 qiymat bilan almashtiriladi, qolgan barcha ma'lumotlar
      // baribir muvaffaqiyatli eksport qilinadi.
      let techStackCount = 0;
      try {
        const parsed = JSON.parse(s.techStack || "[]");
        techStackCount = Array.isArray(parsed) ? parsed.length : 0;
      } catch {
        techStackCount = 0;
      }
      return {
        id: s.id,
        category: s.category,
        price: s.price,
        listingType: s.listingType,
        soldStatus: s.soldStatus,
        status: s.status,
        proposalsCount: s.proposalsCount,
        dateCreated: s.dateCreated,
        techStack: techStackCount, // length for stats
      };
    });

    // 3. Fetch Payments - excluding callback tokens
    const rawPayments = await prisma.payment.findMany();
    const sanitizedPayments = rawPayments.map((p: Payment) => ({
      id: p.id,
      amount: p.amount,
      status: p.status,
      currency: p.currency,
      createdAt: p.createdAt,
      platformFeeAmount: p.platformFeeAmount,
      sellerPayoutAmount: p.sellerPayoutAmount,
      userId: p.userId,
      startupId: p.startupId
    }));

    const exportData = {
      usersCount: sanitizedUsers.length,
      startupsCount: sanitizedStartups.length,
      paymentsCount: sanitizedPayments.length,
      users: sanitizedUsers,
      startups: sanitizedStartups,
      payments: sanitizedPayments,
      exportedAt: new Date().toISOString()
    };

    console.log("Database tables sanitized. Preparing local repository...");

    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
    fs.mkdirSync(tempDir, { recursive: true });

    // Build authenticated repo URL
    // e.g., https://<token>@github.com/username/savdo24-backups.git
    const authRepoUrl = GITHUB_REPO.replace("https://", `https://${GITHUB_TOKEN}@`);

    console.log("Cloning private backup repository...");
    const git: SimpleGit = simpleGit();
    
    // Check if we can clone or we initialize it
    try {
      await git.clone(authRepoUrl, tempDir, ['--depth', '1']);
      console.log("Repository cloned successfully.");
    } catch (cloneErr) {
      console.log("Clone failed (repo might be empty or new). Initializing local git instead...");
      await git.cwd(tempDir);
      await git.init();
      await git.addRemote('origin', authRepoUrl);
    }

    // Change directory to the cloned repo
    const localGit = simpleGit(tempDir);
    await localGit.addConfig('user.email', GITHUB_EMAIL);
    await localGit.addConfig('user.name', GITHUB_NAME);

    // Write sanitized JSON data
    const dataFilePath = path.join(tempDir, 'data-stats.json');
    fs.writeFileSync(dataFilePath, JSON.stringify(exportData, null, 2));
    console.log("Sanitized stats data written to data-stats.json.");

    // Commit and push
    await localGit.add('data-stats.json');
    const status = await localGit.status();

    // MUHIM: `git add`dan keyin yangi fayl `not_added`dan emas, `staged`ga
    // o'tadi — avval faqat modified/not_added tekshirilgani uchun eng birinchi
    // eksport (yangi fayl) hech qachon commit qilinmasdi — status.staged bilan
    // tuzatildi.
    if (status.staged.length > 0) {
      console.log("Changes detected. Committing backup stats...");
      await localGit.commit(`Weekly sanitized statistics backup: ${new Date().toISOString()}`);
      
      console.log("Pushing changes to remote repository...");
      try {
        await localGit.push('origin', 'main');
      } catch (pushErr) {
        // Fallback to master if main doesn't exist yet
        console.log("Pushing to 'main' failed. Trying 'master' branch...");
        await localGit.push('origin', 'master');
      }
      console.log("🎉 Weekly stats successfully exported and pushed to private GitHub repository!");
    } else {
      console.log("No statistical changes detected since last export. Skipping commit.");
    }

  } catch (err: any) {
    console.error("Export to GitHub failed with error:", err.message || err);
  } finally {
    // MUHIM: tempDir ichida GITHUB_TOKEN o'rnatilgan remote URL (.git/config da)
    // saqlanadi. Xato yuz berib catch blokiga o'tib ketilsa ham, bu papka
    // diskda (token bilan birga) qolib ketmasligi uchun tozalash har doim
    // (muvaffaqiyatli yoki xato bo'lsa ham) shu yerda bajariladi.
    if (fs.existsSync(tempDir)) {
      try {
        fs.rmSync(tempDir, { recursive: true, force: true });
        console.log("Temporary workspace cleaned up.");
      } catch (cleanupErr) {
        console.error("Failed to clean up temporary workspace (may contain a GitHub token):", cleanupErr);
      }
    }
    await prisma.$disconnect();
  }
}

// MUHIM (70-band): bu skript hech qachon avtomatik ishga tushmasdi — server.ts'da
// hech qanday cron.schedule uni chaqirmasdi, faqat "npm run export-github" orqali
// qo'lda ishga tushirilishi mumkin edi ("Weekly" deb yozilgan bo'lsa ham). Endi
// server.ts haftalik cron orqali dynamic import qiladi; shu sabab bu yerda ham
// backup-db.ts'dagi kabi faqat to'g'ridan-to'g'ri CLI orqali ishga tushirilganda
// avtomatik chaqiriladi, import qilinganda emas.
const nodePath = process.argv[1] ? path.resolve(process.argv[1]) : '';
let modulePath = '';
try {
  modulePath = fileURLToPath(import.meta.url);
} catch {
  // import.meta.url mavjud emas (bundle qilingan CJS) — to'g'ridan-to'g'ri CLI emas.
}
if (nodePath && modulePath && nodePath === modulePath) {
  exportToGithub();
}
