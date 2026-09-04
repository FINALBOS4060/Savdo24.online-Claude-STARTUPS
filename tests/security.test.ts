import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import { prisma } from '../server';
import { setupTestDatabase, cleanupTestDatabase, generateTestToken, testFetch } from './test-utils';

const API_BASE = 'http://localhost:3000/api';

let buyerUser: any;
let sellerUser: any;
let testStartup: any;
let testConversation: any;
let buyerToken: string;

before(async () => {
  setupTestDatabase();

  const hashedPw = await bcrypt.hash('Password123', 10);

  buyerUser = await prisma.user.create({
    data: {
      email: `security-buyer-${Date.now()}@example.com`,
      password: hashedPw,
      name: 'Security Buyer',
      role: 'Xaridor',
      emailVerified: true,
      joinDate: new Date('2026-01-01'),
      avatarUrl: 'https://example.com/avatar.png',
      resetToken: 'sensitive-reset-token-123',
      verificationToken: 'sensitive-verification-token-123',
      telegramLinkCode: 'sensitive-telegram-code-123'
    }
  });

  sellerUser = await prisma.user.create({
    data: {
      email: `security-seller-${Date.now()}@example.com`,
      password: hashedPw,
      name: 'Security Seller',
      role: 'Sotuvchi',
      emailVerified: true,
      joinDate: new Date('2026-01-01'),
      avatarUrl: 'https://example.com/avatar.png',
      resetToken: 'sensitive-reset-token-456',
      verificationToken: 'sensitive-verification-token-456',
      telegramLinkCode: 'sensitive-telegram-code-456'
    }
  });

  buyerToken = generateTestToken(buyerUser);

  testStartup = await prisma.startup.create({
    data: {
      id: `security-startup-${Date.now()}`,
      name: 'Security Test Startup',
      slogan: 'Secure service',
      description: 'Desc',
      longDescription: 'Long desc',
      category: 'startups',
      price: 100.00,
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

  testConversation = await prisma.conversation.create({
    data: {
      startupId: testStartup.id,
      buyerId: buyerUser.id,
      sellerId: sellerUser.id
    }
  });
});

after(async () => {
  if (testConversation) {
    await prisma.conversation.delete({ where: { id: testConversation.id } }).catch(() => {});
  }
  if (testStartup) {
    await prisma.startup.delete({ where: { id: testStartup.id } }).catch(() => {});
  }
  if (buyerUser) {
    await prisma.user.delete({ where: { id: buyerUser.id } }).catch(() => {});
  }
  if (sellerUser) {
    await prisma.user.delete({ where: { id: sellerUser.id } }).catch(() => {});
  }
  await cleanupTestDatabase();
  await prisma.$disconnect();
});

test('GET /api/conversations should never contain password, resetToken, or verificationToken in user details', async () => {
  const res = await testFetch(`${API_BASE}/conversations`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${buyerToken}`
    }
  });

  assert.equal(res.status, 200);
  const data = await res.json();

  // Assert conversation was fetched
  assert.ok(Array.isArray(data));
  assert.ok(data.length > 0);

  const stringified = JSON.stringify(data);

  // Assert that sensitive fields are completely absent or null/empty
  assert.equal(stringified.includes('sensitive-reset-token-123'), false, 'Buyer reset token must not be exposed');
  assert.equal(stringified.includes('sensitive-reset-token-456'), false, 'Seller reset token must not be exposed');
  assert.equal(stringified.includes('sensitive-verification-token-123'), false, 'Buyer verification token must not be exposed');
  assert.equal(stringified.includes('sensitive-verification-token-456'), false, 'Seller verification token must not be exposed');
  assert.equal(stringified.includes('sensitive-telegram-code-123'), false, 'Buyer telegram code must not be exposed');
  assert.equal(stringified.includes('sensitive-telegram-code-456'), false, 'Seller telegram code must not be exposed');

  // Also check that the schema fields are not keys in any nested User objects returned
  const conv = data.find((c: any) => c.id === testConversation.id);
  assert.ok(conv);
  assert.ok(conv.buyer);
  assert.ok(conv.seller);

  const forbiddenKeys = ['password', 'resetToken', 'resetTokenExpiry', 'verificationToken', 'telegramLinkCode', 'googleId'];
  for (const key of forbiddenKeys) {
    assert.equal(conv.buyer.hasOwnProperty(key), false, `Buyer object must not contain key: ${key}`);
    assert.equal(conv.seller.hasOwnProperty(key), false, `Seller object must not contain key: ${key}`);
  }
});
