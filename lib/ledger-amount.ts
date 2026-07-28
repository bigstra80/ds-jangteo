export function calculateLedgerAmount(
  unitPrice: unknown,
  quantity: unknown
) {
  const parsedUnitPrice = Number(unitPrice);
  const parsedQuantity = Number(quantity);

  if (!Number.isFinite(parsedUnitPrice) || !Number.isFinite(parsedQuantity)) {
    return 0;
  }

  return Math.round(parsedUnitPrice * parsedQuantity * 10) / 10;
}
