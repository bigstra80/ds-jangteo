export type CustomerGrade = "A" | "B" | "C" | "D";

type CalculatePriceParams = {
  basePrice: number | null | undefined;
  productName: string | null | undefined;
  customerGrade: CustomerGrade | string | null | undefined;
};

export function calculatePriceByCustomerGrade({
  basePrice,
  productName,
  customerGrade,
}: CalculatePriceParams) {
  const safeBasePrice = Number.isFinite(Number(basePrice)) ? Number(basePrice) : 0;
  const trimmedName = String(productName ?? "").trim();
  const leadingStars = trimmedName.match(/^\*+/)?.[0].length ?? 0;
  const trailingStars = trimmedName.match(/\*+$/)?.[0].length ?? 0;
  const grade = ["A", "B", "C", "D"].includes(String(customerGrade))
    ? String(customerGrade)
    : "D";

  let discount = 0;
  if (grade === "A") {
    discount = (leadingStars > 0 ? leadingStars : trailingStars) * 0.5;
  } else if (grade === "B") {
    discount = trailingStars * 0.5;
  } else if (grade === "C" && trailingStars > 0) {
    discount = 0.5;
  }

  return Math.max(0, safeBasePrice - discount);
}

