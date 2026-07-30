import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import { prisma } from '../server';
import { setupTestDatabase, cleanupTestDatabase, generateTestToken, testFetch } from './test-utils';

const API_BASE = 'http://localhost:3000/api';

let referrerUser: any;
let refereeUser: any;
let referrerToken: string;
let referral: any;
let reward1: any;
let reward2: any;

before(async () => {
  setupTestDatabase();

  const hashedPassword = await bcrypt.hash('Password123', 10);

  referrerUser = await prisma.user.create({
    data: {
      email: `ref-referrer-${Date.now()}@example.com`,
      password: hashedPassword,
      name: 'Referrer User',
      role: 'Xaridor',
      emailVerified: true,
      joinDate: '2026',
      avatarUrl: 'https://example.com/avatar.png'
    }
  });

  refereeUser = await prisma.user.create({
    data: {
      email: `ref-referee-${Date.now()}@example.com`,
      password: hashedPassword,
      name: 'Referee User',
      role: 'Xaridor',
      emailVerified: true,
      joinDate: '2026',
      avatarUrl: 'https://example.com/avatar.png'
    }
  });

  referrerToken = generateTestToken(referrerUser);

  // Create a referral record
  referral = await prisma.referral.create({
    data: {
      referrerId: referrerUser.id,
      refereeId: refereeUser.id,
      code: `REFTEST${Date.now()}`,
      discountPercent: 10,
      commissionPercent: 10,
      isActive: true
    }
  });

  // Create two earned referral rewards with decimal values (e.g., 5.00 and 3.00)
  reward1 = await prisma.referralReward.create({
    data: {
      referralId: referral.id,
      paymentId: `pay-1-${Date.now()}`,
      rewardAmount: 5.00,
      status: 'earned'
    }
  });

  reward2 = await prisma.referralReward.create({
    data: {
      referralId: referral.id,
      paymentId: `pay-2-${Date.now()}`,
      rewardAmount: 3.00,
      status: 'earned'
    }
  });
});

after(async () => {
  const referralId = referral?.id;
  if (referralId) {
    await prisma.referralReward.deleteMany({ where: { referralId } }).catch(() => {});
    await prisma.referral.delete({ where: { id: referralId } }).catch(() => {});
  }
  const userIds = [referrerUser?.id, refereeUser?.id].filter(Boolean);
  if (userIds.length > 0) {
    await prisma.user.deleteMany({ where: { id: { in: userIds } } }).catch(() => {});
  }
  await cleanupTestDatabase();
  await prisma.$disconnect();
});

test('GET /api/referrals/my-stats returns numeric totalEarned and correctly sums decimal rewards (e.g., 5.00 + 3.00 = 8.00)', async () => {
  const res = await testFetch(`${API_BASE}/referrals/my-stats`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${referrerToken}`
    }
  });

  assert.equal(res.status, 200);
  const data = await res.json();
  
  assert.equal(typeof data.totalEarned, 'number', 'totalEarned must be a number type, not a string');
  assert.equal(data.totalEarned, 8.00, 'totalEarned must equal 8 (5.00 + 3.00)');
});
