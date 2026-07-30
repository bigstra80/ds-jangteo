import { prisma } from "@/lib/prisma";
import {
  calculatePurchaseAmount,
  findSupplierUnitCost,
} from "@/lib/product-supplier-cost";

type PurchaseAmountInput = {
  productId?: unknown;
  productName?: unknown;
  supplierId?: unknown;
  supplierName?: unknown;
};

export class PurchaseAmountResolutionError extends Error {}

function positiveInteger(value: unknown) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : null;
}

export async function calculateStaffPurchaseAmount(
  input: PurchaseAmountInput,
  quantity: number
) {
  const productId = positiveInteger(input.productId);
  const productName = String(input.productName ?? "").trim();

  const product = productId
    ? await prisma.product.findUnique({
        where: { id: productId },
        include: {
          supplier: true,
          supplier2: true,
          supplier3: true,
        },
      })
    : productName
      ? await prisma.product.findFirst({
          where: { name: productName },
          orderBy: { id: "desc" },
          include: {
            supplier: true,
            supplier2: true,
            supplier3: true,
          },
        })
      : null;

  if (!product) {
    throw new PurchaseAmountResolutionError(
      "선택한 상품을 찾을 수 없습니다."
    );
  }

  const unitCost = findSupplierUnitCost(
    [
      {
        supplierId: product.supplierId,
        supplierName: product.supplier?.name ?? null,
        supplierCode: product.supplier?.code ?? null,
        unitCost: product.cost,
      },
      {
        supplierId: product.supplier2Id,
        supplierName: product.supplier2?.name ?? null,
        supplierCode: product.supplier2?.code ?? null,
        unitCost: product.cost2,
      },
      {
        supplierId: product.supplier3Id,
        supplierName: product.supplier3?.name ?? null,
        supplierCode: product.supplier3?.code ?? null,
        unitCost: product.cost3,
      },
    ],
    input
  );

  if (unitCost === null) {
    throw new PurchaseAmountResolutionError(
      "선택한 상품의 공급업체 단가를 찾을 수 없습니다."
    );
  }

  return calculatePurchaseAmount(unitCost, quantity);
}
