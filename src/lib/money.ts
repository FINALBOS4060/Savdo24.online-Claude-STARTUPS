export const PLATFORM_FEE_PERCENT = 5;

export function roundToCents(amount: number): number {
  return Math.round(amount * 100) / 100;
}

export function splitAmount(total: number, feePercent: number): { fee: number, payout: number } {
  const totalCents = Math.round(roundToCents(total) * 100);
  const feeCents = Math.round(totalCents * (feePercent / 100));
  const payoutCents = totalCents - feeCents;
  return {
    fee: feeCents / 100,
    payout: payoutCents / 100
  };
}

