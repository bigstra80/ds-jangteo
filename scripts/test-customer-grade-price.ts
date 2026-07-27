import { calculatePriceByCustomerGrade } from "../lib/customer-grade-price";

const cases = [
  ["A", "**** 상품명***", 4],
  ["A", "상품명***", 4.5],
  ["A", "**** 상품명", 4],
  ["A", "상품명", 6],
  ["A", "* 상품명*****", 5.5],
  ["A", "  **** 상품명***  ", 4],
  ["B", "**** 상품명***", 4.5],
  ["B", "상품명***", 4.5],
  ["B", "**** 상품명", 6],
  ["B", "상품명", 6],
  ["C", "**** 상품명***", 5.5],
  ["C", "상품명***", 5.5],
  ["C", "**** 상품명", 6],
  ["C", "상품명", 6],
  ["D", "**** 상품명***", 6],
  ["A", "상품*이름***", 4.5],
  ["A", "**************** 상품명", 0],
] as const;

for (const [customerGrade, productName, expected] of cases) {
  const actual = calculatePriceByCustomerGrade({
    basePrice: 6,
    productName,
    customerGrade,
  });
  if (actual !== expected) {
    throw new Error(`${customerGrade} / ${productName}: expected ${expected}, received ${actual}`);
  }
}

console.log(`customer grade price tests passed: ${cases.length}`);

