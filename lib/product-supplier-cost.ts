export type ProductSupplierCost = {
  supplierId: number | null;
  supplierName: string | null;
  supplierCode: string | null;
  unitCost: number | null;
};

type SupplierSelection = {
  supplierId?: unknown;
  supplierName?: unknown;
};

function positiveInteger(value: unknown) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : null;
}

function normalizedText(value: unknown) {
  return String(value ?? "").trim().toLocaleLowerCase();
}

export function findSupplierUnitCost(
  suppliers: ProductSupplierCost[],
  input: SupplierSelection
) {
  const requestedSupplierId = positiveInteger(input.supplierId);
  const requestedSupplierName = normalizedText(input.supplierName);

  const matchedSupplier = suppliers.find((supplier) => {
    if (requestedSupplierId && supplier.supplierId === requestedSupplierId) {
      return true;
    }

    if (!requestedSupplierName) return false;

    return (
      normalizedText(supplier.supplierName) === requestedSupplierName ||
      normalizedText(supplier.supplierCode) === requestedSupplierName
    );
  });

  if (
    !matchedSupplier ||
    matchedSupplier.unitCost === null ||
    !Number.isFinite(matchedSupplier.unitCost)
  ) {
    return null;
  }

  return matchedSupplier.unitCost;
}

export function calculatePurchaseAmount(unitCost: number, quantity: number) {
  return Math.round(unitCost * quantity * 10) / 10;
}
