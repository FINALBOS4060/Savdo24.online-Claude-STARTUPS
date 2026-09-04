import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { prisma } from '../server';
import { setupTestDatabase, cleanupTestDatabase, generateTestToken, testFetch } from './test-utils';

const API_BASE = 'http://localhost:3000/api';

let buyerUser: any;
let sellerUser: any;
let strangerUser: any;
let adminUser: any;

let buyerToken: string;
let sellerToken: string;
let strangerToken: string;
let adminToken: string;

let testStartup: any;

before(async () => {
  setupTestDatabase();

  const hashedPw = await bcrypt.hash('Password123', 10);

  buyerUser = await prisma.user.create({
    data: {
      email: `escrow-buyer-${Date.now()}@example.com`,
      password: hashedPw,
      name: 'Escrow Buyer',
      role: 'Xaridor',
      emailVerified: true,
      joinDate: new Date('2026-01-01'),
      avatarUrl: 'https://example.com/avatar.png'
    }
  });

  sellerUser = await prisma.user.create({
    data: {
      email: `escrow-seller-${Date.now()}@example.com`,
      password: hashedPw,
      name: 'Escrow Seller',
      role: 'Sotuvchi',
      emailVerified: true,
      joinDate: new Date('2026-01-01'),
      avatarUrl: 'https://example.com/avatar.png'
    }
  });

  strangerUser = await prisma.user.create({
    data: {
      email: `escrow-stranger-${Date.now()}@example.com`,
      password: hashedPw,
      name: 'Escrow Stranger',
      role: 'Xaridor',
      emailVerified: true,
      joinDate: new Date('2026-01-01'),
      avatarUrl: 'https://example.com/avatar.png'
    }
  });

  adminUser = await prisma.user.create({
    data: {
      email: `escrow-admin-${Date.now()}@example.com`,
      password: hashedPw,
      name: 'Escrow Admin',
      role: 'Admin',
      emailVerified: true,
      joinDate: new Date('2026-01-01'),
      avatarUrl: 'https://example.com/avatar.png'
    }
  });

  buyerToken = generateTestToken(buyerUser);
  sellerToken = generateTestToken(sellerUser);
  strangerToken = generateTestToken(strangerUser);
  adminToken = generateTestToken(adminUser);

  testStartup = await prisma.startup.create({
    data: {
      id: `escrow-startup-${Date.now()}`,
      name: 'Escrow Test Startup',
      slogan: 'Secure escrow service',
      description: 'Desc',
      longDescription: 'Long desc',
      category: 'startups',
      price: 500.00,
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

    const escrows = await prisma.escrowPayment.findMany({ where: { paymentId: { in: paymentIds } } });
    const escrowIds = escrows.map((e: any) => e.id);

    if (escrowIds.length > 0) {
      await prisma.disputeResolution.deleteMany({ where: { escrowId: { in: escrowIds } } }).catch(() => {});
      await prisma.escrowPayment.deleteMany({ where: { id: { in: escrowIds } } }).catch(() => {});
    }

    await prisma.dispute.deleteMany({ where: { paymentId: { in: paymentIds } } }).catch(() => {});
    await prisma.payment.deleteMany({ where: { startupId: testStartup.id } }).catch(() => {});
    await prisma.startup.delete({ where: { id: testStartup.id } }).catch(() => {});
  }

  const userIds = [buyerUser?.id, sellerUser?.id, strangerUser?.id, adminUser?.id].filter(Boolean);
  if (userIds.length > 0) {
    await prisma.user.deleteMany({ where: { id: { in: userIds } } }).catch(() => {});
  }

  await cleanupTestDatabase();
});

test('1) faqat xaridor (buyer) o\'z tranzaksiyasini release qila olishi, boshqa userlar release qila olmasligi', async () => {
  const paymentId = 'PAY-ESCROW-1-' + crypto.randomBytes(4).toString('hex');
  await prisma.payment.create({
    data: {
      id: paymentId,
      amount: 500.00,
      status: 'completed',
      currency: 'USDT',
      userId: buyerUser.id,
      startupId: testStartup.id,
      callbackToken: 'token123',
      gateway: 'coingate'
    }
  });

  const escrow = await prisma.escrowPayment.create({
    data: {
      paymentId,
      status: 'held',
      holdEndDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    }
  });

  // Attempt 1: Stranger tries to release -> Expect 403 Forbidden
  const strangerRes = await testFetch(`${API_BASE}/escrow/release`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${strangerToken}`
    },
    body: JSON.stringify({ paymentId })
  });
  assert.equal(strangerRes.status, 403);

  const dbEscrowAfterStranger = await prisma.escrowPayment.findUnique({ where: { id: escrow.id } });
  assert.equal(dbEscrowAfterStranger.status, 'held');

  // Attempt 2: Seller tries to release -> Expect 403 Forbidden
  const sellerRes = await testFetch(`${API_BASE}/escrow/release`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${sellerToken}`
    },
    body: JSON.stringify({ paymentId })
  });
  assert.equal(sellerRes.status, 403);

  const dbEscrowAfterSeller = await prisma.escrowPayment.findUnique({ where: { id: escrow.id } });
  assert.equal(dbEscrowAfterSeller.status, 'held');

  // Attempt 3: Buyer tries to release -> Expect 200 OK
  const buyerRes = await testFetch(`${API_BASE}/escrow/release`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${buyerToken}`
    },
    body: JSON.stringify({ paymentId })
  });
  assert.equal(buyerRes.status, 200);
  const buyerData = await buyerRes.json();
  assert.equal(buyerData.success, true);

  const dbEscrowAfterBuyer = await prisma.escrowPayment.findUnique({ where: { id: escrow.id } });
  assert.equal(dbEscrowAfterBuyer.status, 'released');
});

test('2) dispute ochilgandan keyin pul faqat admin tomonidan hal qilinishi, oddiy release orqali chiqarib bo\'lmasligi', async () => {
  const paymentId = 'PAY-ESCROW-2-' + crypto.randomBytes(4).toString('hex');
  await prisma.payment.create({
    data: {
      id: paymentId,
      amount: 500.00,
      status: 'completed',
      currency: 'USDT',
      userId: buyerUser.id,
      startupId: testStartup.id,
      callbackToken: 'token456',
      gateway: 'coingate'
    }
  });

  const escrow = await prisma.escrowPayment.create({
    data: {
      paymentId,
      status: 'held',
      holdEndDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    }
  });

  // Buyer opens a dispute
  const disputeRes = await testFetch(`${API_BASE}/escrow/dispute`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${buyerToken}`
    },
    body: JSON.stringify({
      paymentId,
      reason: 'Loyiha topshirilmadi, nizo ochyapman.',
      evidence: ['https://example.com/proof.png']
    })
  });

  assert.equal(disputeRes.status, 200);

  const dbEscrowAfterDispute = await prisma.escrowPayment.findUnique({ where: { id: escrow.id } });
  assert.equal(dbEscrowAfterDispute.status, 'disputed');

  // Now buyer attempts standard release -> Must fail because status is disputed
  const buyerReleaseRes = await testFetch(`${API_BASE}/escrow/release`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${buyerToken}`
    },
    body: JSON.stringify({ paymentId })
  });
  assert.equal(buyerReleaseRes.ok, false);
  assert.equal(buyerReleaseRes.status, 400);

  // Get dispute resolution record created for admin
  const disputeResolution = await prisma.disputeResolution.findFirst({
    where: { escrowId: escrow.id }
  });
  assert.ok(disputeResolution);
  assert.equal(disputeResolution.resolution, 'pending');

  // Admin resolves the dispute via admin endpoint
  const adminResolveRes = await testFetch(`${API_BASE}/admin/escrow-disputes/${disputeResolution.id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminToken}`
    },
    body: JSON.stringify({
      resolution: 'released',
      adminNote: 'Admin muammoni hal qildi va mablag\'ni release qildi.'
    })
  });

  assert.equal(adminResolveRes.status, 200);

  const dbEscrowFinal = await prisma.escrowPayment.findUnique({ where: { id: escrow.id } });
  assert.equal(dbEscrowFinal.status, 'released');
});
