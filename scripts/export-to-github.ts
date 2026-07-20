import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { simpleGit, SimpleGit } from 'simple-git';
import dotenv from 'dotenv';
import { decryptSecret } from '../src/lib/crypto';

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

async function exportToGithub() {
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

  try {
    console.log("Fetching and sanitizing database tables...");

    // 1. Fetch Users - strictly excluding email, password, tokens, etc.
    const rawUsers = await prisma.user.findMany();
    const sanitizedUsers = rawUsers.map(user => ({
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
    const sanitizedStartups = rawStartups.map(s => ({
      id: s.id,
      category: s.category,
      price: s.price,
      listingType: s.listingType,
      soldStatus: s.soldStatus,
      status: s.status,
      proposalsCount: s.proposalsCount,
      dateCreated: s.dateCreated,
      techStack: JSON.parse(s.techStack || "[]").length, // length for stats
    }));

    // 3. Fetch Payments - excluding callback tokens
    const rawPayments = await prisma.payment.findMany();
    const sanitizedPayments = rawPayments.map(p => ({
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

    const tempDir = path.join('/tmp', 'savdo24-github-export');
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
    
    if (status.modified.length > 0 || status.not_added.length > 0) {
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

    // Clean up temporary workspace
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
      console.log("Temporary workspace cleaned up.");
    }

  } catch (err: any) {
    console.error("Export to GitHub failed with error:", err.message || err);
  } finally {
    await prisma.$disconnect();
  }
}

exportToGithub();
