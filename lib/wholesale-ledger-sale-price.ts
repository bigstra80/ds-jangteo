import { calculatePriceByCustomerGrade } from "@/lib/customer-grade-price";
import { calculateLedgerAmount } from "@/lib/ledger-amount";
import { prisma } from "@/lib/prisma";

type AutomaticSalePrice = {
  customerId: number;
  customerGrade: string;
  productId: number;
  customerPrice: number;
};

function positiveId(value: unknown) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export async function getAutomaticLedgerSalePrice(
  customerIdValue: unknown,
  productIdValue: unknown
): Promise<AutomaticSalePrice | null> {
  const customerId = positiveId(customerIdValue);
  const productId = positiveId(productIdValue);
  if (!customerId || !productId) return null;

  const [customer, product] = await Promise.all([
    prisma.customer.findUnique({
      where: { id: customerId },
      select: { id: true, grade: true, isActive: true },
    }),
    prisma.product.findUnique({
      where: { id: productId },
      select: {
        id: true,
        name: true,
        sourceProductName: true,
        price: true,
        customerPrices: {
          where: { customerId },
          select: { price: true },
          take: 1,
        },
      },
    }),
  ]);

  if (!customer?.isActive || !product) return null;

  const customerGrade = String(customer.grade || "D").toUpperCase();
  const calculatedPrice = calculatePriceByCustomerGrade({
    basePrice: product.price,
    productName: product.sourceProductName || product.name,
    customerGrade,
  });
  const savedCustomerPrice = product.customerPrices[0]?.price;
  const customerPrice = savedCustomerPrice ?? calculatedPrice;

  return {
    customerId,
    customerGrade,
    productId,
    customerPrice,
  };
}

export async function resolveLedgerSaleAmount(
  body: Record<string, unknown>,
  quantity: number
) {
  if (body.isSalePriceManuallyEdited === false) {
    const deliveryCompanyName = String(body.deliveryCompanyName ?? "").trim();
    const deliveryCustomerId = positiveId(body.deliveryCustomerId);

    if (!deliveryCustomerId && deliveryCompanyName) {
      return 0;
    }

    const automaticPrice = await getAutomaticLedgerSalePrice(
      deliveryCustomerId,
      body.productId
    );

    if (automaticPrice) {
      return calculateLedgerAmount(automaticPrice.customerPrice, quantity);
    }
  }

  if (
    body.saleUnitPrice !== undefined &&
    body.saleUnitPrice !== null &&
    body.saleUnitPrice !== ""
  ) {
    return calculateLedgerAmount(body.saleUnitPrice, quantity);
  }

  const saleAmount = Number(body.saleAmount);
  return Number.isFinite(saleAmount) ? Math.round(saleAmount * 10) / 10 : 0;
}
