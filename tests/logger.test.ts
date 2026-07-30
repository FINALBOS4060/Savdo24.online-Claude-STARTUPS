import { test } from 'node:test';
import assert from 'node:assert/strict';
import pino from 'pino';

test('Pino logger redact works for flat and deep fields', () => {
  let logOutput = '';
  const testStream = {
    write(chunk: string) {
      logOutput += chunk;
    }
  };

  const testLogger = pino({
    redact: {
      paths: [
        "password",
        "token",
        "refreshToken",
        "email",
        "phoneNumber",
        "contactEmail",
        "contactPhone",
        "*.password",
        "*.token",
        "*.refreshToken",
        "*.email",
        "*.phoneNumber",
        "*.contactEmail",
        "*.contactPhone",
        "*.*.password",
        "*.*.token",
        "*.*.refreshToken",
        "*.*.email",
        "*.*.phoneNumber",
        "*.*.*.password",
        "*.*.*.token",
        "*.*.*.refreshToken",
        "*.*.*.email",
        "*.*.*.phoneNumber",
        "*.*.*.*.password",
        "*.*.*.*.token",
        "*.*.*.*.refreshToken",
        "*.*.*.*.email",
        "*.*.*.*.phoneNumber"
      ],
      censor: "[REDACTED]"
    }
  }, testStream);

  const payload = {
    user: {
      name: 'John',
      email: 'john@example.com',
      password: 'supersecretpassword123',
      profile: {
        password: 'deep-nested-password'
      }
    },
    someNested: {
      token: 'secret-token-value'
    },
    password: 'top-level-secret'
  };

  testLogger.info(payload, 'test log');

  assert.ok(logOutput.includes('[REDACTED]'), 'Output should contain [REDACTED]');
  assert.ok(!logOutput.includes('supersecretpassword123'), 'Output should not contain the actual password');
  assert.ok(!logOutput.includes('john@example.com'), 'Output should not contain the actual email');
  assert.ok(!logOutput.includes('secret-token-value'), 'Output should not contain the nested token');
  assert.ok(!logOutput.includes('top-level-secret'), 'Output should not contain the top-level password');
  assert.ok(!logOutput.includes('deep-nested-password'), 'Output should not contain the deep nested password');
});
