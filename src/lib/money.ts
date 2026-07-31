export const PLATFORM_FEE_PERCENT = 5;

export function roundToCents(amount: number): number {
  return Math.round(amount * 100) / 100;
}

export function splitAmount(total: number, feePercent: number): { fee: number, payout: number } {
  const fee = roundToCents(total * (feePercent / 100));
  const payout = roundToCents(total - fee);
  return { fee, payout };
}
