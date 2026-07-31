import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { prisma } from '../server';
import { setupTestDatabase, cleanupTestDatabase, generateTestToken, testFetch } from './test-utils';

const API_BASE = 'http://localhost:3000/api';

let referrerUser: any;
let refereeUser: any;
let sellerUser: any;
let referrerToken: string;
let refereeToken: string;
let referral: any;
let reward1: any;
let reward2: any;
let testStartup: any;

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

  sellerUser = await prisma.user.create({
    data: {
      email: `ref-seller-${Date.now()}@example.com`,
      password: hashedPassword,
      name: 'Seller User',
      role: 'Sotuvchi',
      emailVerified: true,
      joinDate: '2026',
      avatarUrl: 'https://example.com/avatar.png'
    }
  });

  referrerToken = generateTestToken(referrerUser);
  refereeToken = generateTestToken(refereeUser);

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

  // Create test startup
  testStartup = await prisma.startup.create({
    data: {
      id: `startup-ref-${Date.now()}`,
      name: 'Referral Test Startup',
      slogan: 'Best deal',
      description: 'Short desc',
      longDescription: 'Long desc',
      category: 'startups',
      price: 1000.00,
      listingType: 'To\'liq loyiha (manba kodi bilan)',
      techStack: '[]',
      soldStatus: 'sotuvda',
      status: 'active',
      image: 'https://example.com/image.png',
      gallery: '[]',
      team: '[]',
      milestones: '[]',
      userId: sellerUser.id
    }
  });
});

after(async () => {
  if (testStartup?.id) {
    const payments = await prisma.payment.findMany({ where: { startupId: testStartup.id } });
    const paymentIds = payments.map((p: any) => p.id);
    await prisma.referralReward.deleteMany({ where: { paymentId: { in: paymentIds } } }).catch(() => {});
    await prisma.payment.deleteMany({ where: { startupId: testStartup.id } }).catch(() => {});
    await prisma.startup.delete({ where: { id: testStartup.id } }).catch(() => {});
  }

  const referralId = referral?.id;
  if (referralId) {
    await prisma.referralReward.deleteMany({ where: { referralId } }).catch(() => {});
    await prisma.referral.delete({ where: { id: referralId } }).catch(() => {});
  }
  const userIds = [referrerUser?.id, refereeUser?.id, sellerUser?.id].filter(Boolean);
  if (userIds.length > 0) {
    await prisma.user.deleteMany({ where: { id: { in: userIds } } }).catch(() => {});
  }
  await cleanupTestDatabase();
  await prisma.$disconnect();
});

test('1) GET /api/referrals/my-stats returns numeric totalEarned and correctly sums decimal rewards (e.g., 5.00 + 3.00 = 8.00)', async () => {
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

test('2) Referral reward is correctly calculated and saved when referee completes payment via webhook', async () => {
  // 1. Create payment order with referral code
  const createRes = await testFetch(`${API_BASE}/payments/create`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${refereeToken}`
    },
    body: JSON.stringify({
      startupId: testStartup.id,
      referralCode: referral.code
    })
  });

  assert.equal(createRes.status, 201);
  const paymentOrder = await createRes.json();
  
  // Verify a discount was applied
  assert.equal(paymentOrder.discountType, 'referral');
  assert.equal(Number(paymentOrder.discountPercent), Number(referral.discountPercent));

  const expectedAmount = Number(testStartup.price) * (1 - Number(referral.discountPercent) / 100);
  assert.equal(Number(paymentOrder.amount), expectedAmount);

  // 2. Simulate payment completion via webhook
  const webhookRes = await testFetch(`${API_BASE}/payments/webhook?token=${paymentOrder.id}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      order_id: paymentOrder.id,
      status: 'completed',
      price_amount: expectedAmount,
      price_currency: 'USDT',
      id: `coingate-id-${crypto.randomBytes(4).toString('hex')}`
    })
  });

  assert.equal(webhookRes.status, 200);
  const webhookData = await webhookRes.json();
  assert.equal(webhookData.success, true);

  // 3. Verify in DB that referral reward was created with correct amount
  const dbReward = await prisma.referralReward.findFirst({
    where: { paymentId: paymentOrder.id }
  });

  assert.ok(dbReward);
  assert.equal(dbReward.status, 'earned');
  
  const expectedRewardAmount = expectedAmount * Number(referral.commissionPercent) / 100;
  assert.equal(Number(dbReward.rewardAmount), expectedRewardAmount);
});
