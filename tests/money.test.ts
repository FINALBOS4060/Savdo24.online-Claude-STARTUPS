import { test } from 'node:test';
import assert from 'node:assert/strict';
import { splitAmount, roundToCents } from '../src/lib/money';

test("Pul hisob-kitoblari to'g'ri yaxlitlanishi va bo'linishi", () => {
  const cases = [133.33, 99.99, 0.01, 0.1 + 0.2, 1000000.03, 50.00, 10.00, 999999999.99];

  cases.forEach(total => {
    const { fee, payout } = splitAmount(total, 5);
    const sum = roundToCents(fee + payout);
    assert.strictEqual(sum, roundToCents(total), `Failed for ${total}: fee(${fee}) + payout(${payout}) != total(${total})`);
  });
});

test("0.1 + 0.2 suzuvchi nuqta xatosi 0.3 ga to'g'ri yaxlitlanishi", () => {
  assert.strictEqual(roundToCents(0.1 + 0.2), 0.3);
});

test("5% komissiya bo'linishida yig'indi aniq teng bo'lishi", () => {
  const result = splitAmount(10.05, 5);
  assert.strictEqual(roundToCents(result.fee + result.payout), 10.05);
});


