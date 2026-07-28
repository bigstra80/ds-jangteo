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
  const grade = ["A", "B", "C", "D"].includes(
    String(customerGrade).toUpperCase()
  )
    ? String(customerGrade).toUpperCase()
    : "D";

  // C그룹은 상품명, 별표, 기본 판매가와 관계없이 거래별 입력을 위해 0에서 시작합니다.
  if (grade === "C") {
    return 0;
  }

  const safeBasePrice = Number.isFinite(Number(basePrice)) ? Number(basePrice) : 0;
  const trimmedName = String(productName ?? "").trim();
  const leadingStars = trimmedName.match(/^\*+/)?.[0].length ?? 0;
  const trailingStars = trimmedName.match(/\*+$/)?.[0].length ?? 0;

  let discount = 0;
  if (grade === "A") {
    discount = (leadingStars > 0 ? leadingStars : trailingStars) * 0.5;
  } else if (grade === "B") {
    discount = trailingStars * 0.5;
  }

  return Math.max(0, safeBasePrice - discount);
}
