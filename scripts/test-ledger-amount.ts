import { calculateLedgerAmount } from "../lib/ledger-amount";

const cases = [
  [4.5, 1, 4.5],
  [4.5, 2, 9],
  [4.5, 3, 13.5],
  [5, 3, 15],
  [7.5, 4, 30],
  [0, 3, 0],
  [4.5, -1, -4.5],
] as const;

for (const [unitPrice, quantity, expected] of cases) {
  const actual = calculateLedgerAmount(unitPrice, quantity);
  if (actual !== expected) {
    throw new Error(
      `${unitPrice} × ${quantity}: expected ${expected}, received ${actual}`
    );
  }
}

console.log(`ledger amount tests passed: ${cases.length}`);
