import { test } from 'node:test';
import assert from 'node:assert/strict';
import { splitAmount, roundToCents } from '../src/lib/money';

test('Pul hisob-kitoblari to\'g\'ri yaxlitlanishi va bo\'linishi', () => {
  const cases = [133.33, 99.99, 0.01, 1000000.03, 50.00, 10.00];

  cases.forEach(total => {
    const { fee, payout } = splitAmount(total, 5);
    const sum = roundToCents(fee + payout);
    assert.strictEqual(sum, roundToCents(total), `Failed for ${total}: fee(${fee}) + payout(${payout}) != total(${total})`);
  });
});
