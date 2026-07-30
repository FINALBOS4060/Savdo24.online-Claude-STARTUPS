import jwt from 'jsonwebtoken';
import { prisma, JWT_SECRET } from '../server';

export { prisma };

export function setupTestDatabase() {
  return prisma;
}

export async function cleanupTestDatabase() {
  // Teardown hook
}

export function generateTestToken(user: { id: number; email: string; name: string; role: string }) {
  return jwt.sign(
    { id: user.id, email: user.email, name: user.name, role: user.role },
    JWT_SECRET,
    { expiresIn: '15m' }
  );
}

export function generateExpiredToken(user: { id: number; email: string; name: string; role: string }) {
  return jwt.sign(
    { id: user.id, email: user.email, name: user.name, role: user.role },
    JWT_SECRET,
    { expiresIn: '-1s' }
  );
}

let ipCounter = 1;

export async function testFetch(url: string, options: RequestInit = {}) {
  ipCounter = (ipCounter % 250) + 1;
  const fakeIp = `192.168.10.${ipCounter}`;

  const headers = new Headers(options.headers || {});
  if (!headers.has('X-Forwarded-For')) {
    headers.set('X-Forwarded-For', fakeIp);
  }

  return fetch(url, {
    ...options,
    headers
  });
}
