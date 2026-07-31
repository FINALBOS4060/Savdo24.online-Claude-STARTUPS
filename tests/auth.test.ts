import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma, JWT_SECRET } from '../server';
import { setupTestDatabase, cleanupTestDatabase, generateExpiredToken, testFetch } from './test-utils';

const API_BASE = 'http://localhost:3000/api';

before(() => {
  setupTestDatabase();
});

after(async () => {
  await cleanupTestDatabase();
  await prisma.$disconnect().catch(() => {});
  setTimeout(() => process.exit(0), 100);
});

test('1) to\'g\'ri parol bilan login muvaffaqiyatli bo\'lishi', async () => {
  const email = `login-success-${Date.now()}@example.com`;
  const password = 'TestPassword123';
  const hashedPassword = await bcrypt.hash(password, 10);

  const createdUser = await prisma.user.create({
    data: {
      email,
      password: hashedPassword,
      name: 'Login Test User',
      role: 'Xaridor',
      joinDate: '2026',
      avatarUrl: 'https://example.com/avatar.png'
    }
  });

  try {
    const res = await testFetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    assert.equal(res.status, 200);
    const data = await res.json();
    assert.ok(data.accessToken);
    assert.equal(data.user.email, email);
    assert.equal(data.user.id, createdUser.id);
  } finally {
    await prisma.user.delete({ where: { id: createdUser.id } }).catch(() => {});
  }
});

test('2) noto\'g\'ri parol bilan login rad etilishi (401 yoki 400 qaytishi)', async () => {
  const email = `login-wrong-${Date.now()}@example.com`;
  const password = 'CorrectPassword123';
  const hashedPassword = await bcrypt.hash(password, 10);

  const createdUser = await prisma.user.create({
    data: {
      email,
      password: hashedPassword,
      name: 'Wrong Password Test',
      role: 'Xaridor',
      joinDate: '2026',
      avatarUrl: 'https://example.com/avatar.png'
    }
  });

  try {
    const res = await testFetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: 'WrongPassword999' })
    });

    assert.equal(res.ok, false);
    assert.ok(res.status === 400 || res.status === 401);
    const data = await res.json();
    assert.ok(data.error);
  } finally {
    await prisma.user.delete({ where: { id: createdUser.id } }).catch(() => {});
  }
});

test('3) ro\'yxatdan o\'tishda parol bcrypt bilan hash qilinishi (plain text saqlanmasligi)', async () => {
  const email = `register-bcrypt-${Date.now()}@example.com`;
  const password = 'MySecretPassword1';
  const name = 'Bcrypt Register User';

  try {
    const res = await testFetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, name })
    });

    assert.equal(res.status, 201);
    const data = await res.json();
    assert.ok(data.accessToken);

    const userInDb = await prisma.user.findUnique({ where: { email } });
    assert.ok(userInDb);
    assert.notEqual(userInDb.password, password);
    assert.ok(userInDb.password.startsWith('$2a$') || userInDb.password.startsWith('$2b$'));
    assert.equal(bcrypt.compareSync(password, userInDb.password), true);
  } finally {
    await prisma.user.deleteMany({ where: { email } }).catch(() => {});
  }
});

test('4) JWT token yaratilganda undagi userId va role maydonlari to\'g\'ri ekanligi', async () => {
  const email = `jwt-payload-${Date.now()}@example.com`;
  const password = 'JwtPassword123';
  const name = 'JWT Test User';

  const res = await testFetch(`${API_BASE}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, name })
  });

  assert.equal(res.status, 201);
  const data = await res.json();
  const token = data.accessToken;
  assert.ok(token);

  const decoded = jwt.verify(token, JWT_SECRET) as any;
  assert.equal(decoded.id, data.user.id);
  assert.equal(decoded.role, 'Xaridor');

  await prisma.user.delete({ where: { id: data.user.id } }).catch(() => {});
});

test('5) muddati o\'tgan yoki noto\'g\'ri token bilan himoyalangan endpointga kirishga urinilganda 401 qaytishi', async () => {
  // Test with completely invalid token string
  const invalidRes = await testFetch(`${API_BASE}/escrow/my-purchases`, {
    headers: { Authorization: 'Bearer invalid-token-string-xyz' }
  });
  assert.equal(invalidRes.status, 401);

  // Test with expired token
  const expiredToken = generateExpiredToken({
    id: 99999,
    email: 'expired@example.com',
    name: 'Expired User',
    role: 'Xaridor'
  });

  const expiredRes = await testFetch(`${API_BASE}/escrow/my-purchases`, {
    headers: { Authorization: `Bearer ${expiredToken}` }
  });
  assert.equal(expiredRes.status, 401);
});
