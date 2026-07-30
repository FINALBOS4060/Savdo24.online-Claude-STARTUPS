import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import { prisma } from '../server';
import { setupTestDatabase, cleanupTestDatabase, generateTestToken, testFetch } from './test-utils';

const API_BASE = 'http://localhost:3000/api';

let buyerUser: any;
let sellerUser: any;
let buyerToken: string;
let testStartup: any;

before(async () => {
  setupTestDatabase();

  const hashedPassword = await bcrypt.hash('Password123', 10);

  buyerUser = await prisma.user.create({
    data: {
      email: `payment-buyer-${Date.now()}@example.com`,
      password: hashedPassword,
      name: 'Payment Buyer',
      role: 'Xaridor',
      emailVerified: true,
      joinDate: '2026',
      avatarUrl: 'https://example.com/avatar.png'
    }
  });

  sellerUser = await prisma.user.create({
    data: {
      email: `payment-seller-${Date.now()}@example.com`,
      password: hashedPassword,
      name: 'Payment Seller',
      role: 'Sotuvchi',
      emailVerified: true,
      joinDate: '2026',
      avatarUrl: 'https://example.com/avatar.png'
    }
  });

  buyerToken = generateTestToken(buyerUser);

  testStartup = await prisma.startup.create({
    data: {
      id: `startup-pay-${Date.now()}`,
      name: 'Payment Test Startup',
      slogan: 'Awesome product',
      description: 'Short desc',
      longDescription: 'Long desc',
      category: 'startups',
      price: 250.00,
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
    await prisma.payment.deleteMany({ where: { startupId: testStartup.id } }).catch(() => {});
    await prisma.startup.delete({ where: { id: testStartup.id } }).catch(() => {});
  }
  const userIds = [buyerUser?.id, sellerUser?.id].filter(Boolean);
  if (userIds.length > 0) {
    await prisma.user.deleteMany({ where: { id: { in: userIds } } }).catch(() => {});
  }
  await cleanupTestDatabase();
});

test('1) yangi to\'lov yaratilganda status "pending" bo\'lib boshlanishi', async () => {
  const res = await testFetch(`${API_BASE}/payments/create`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${buyerToken}`
    },
    body: JSON.stringify({ startupId: testStartup.id })
  });

  assert.equal(res.status, 201);
  const data = await res.json();
  assert.equal(data.status, 'pending');

  const paymentInDb = await prisma.payment.findUnique({ where: { id: data.id } });
  assert.ok(paymentInDb);
  assert.equal(paymentInDb.status, 'pending');
});

test('2) frontend\'dan yuborilgan to\'lov summasi server tomonidan bazadagi haqiqiy narx bilan solishtirilishi (frontend summasi directly ishonilmaydi)', async () => {
  // Try sending a fake amount (1.00 USDT) instead of true price (250.00 USDT)
  const res = await testFetch(`${API_BASE}/payments/create`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${buyerToken}`
    },
    body: JSON.stringify({ startupId: testStartup.id, amount: 1.00 })
  });

  assert.equal(res.status, 201);
  const data = await res.json();
  // Server must return real amount (250), NOT fake 1.00
  assert.equal(Number(data.amount), 250);

  const paymentInDb = await prisma.payment.findUnique({ where: { id: data.id } });
  assert.ok(paymentInDb);
  assert.equal(Number(paymentInDb.amount), 250);
});

test('3) bir xil user+startup uchun yangi pending to\'lov yaratilganda, avvalgi eski pending to\'lov "cancelled" holatiga o\'tishi', async () => {
  // Create first pending payment
  const res1 = await testFetch(`${API_BASE}/payments/create`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${buyerToken}`
    },
    body: JSON.stringify({ startupId: testStartup.id })
  });

  assert.equal(res1.status, 201);
  const data1 = await res1.json();
  const payment1Id = data1.id;

  const payment1Before = await prisma.payment.findUnique({ where: { id: payment1Id } });
  assert.equal(payment1Before.status, 'pending');

  // Create second pending payment for same user and startup
  const res2 = await testFetch(`${API_BASE}/payments/create`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${buyerToken}`
    },
    body: JSON.stringify({ startupId: testStartup.id })
  });

  assert.equal(res2.status, 201);
  const data2 = await res2.json();
  const payment2Id = data2.id;

  assert.notEqual(payment1Id, payment2Id);

  // Check payment 2 is pending
  const payment2Db = await prisma.payment.findUnique({ where: { id: payment2Id } });
  assert.equal(payment2Db.status, 'pending');

  // Check payment 1 was automatically updated to cancelled
  const payment1After = await prisma.payment.findUnique({ where: { id: payment1Id } });
  assert.equal(payment1After.status, 'cancelled');
});
