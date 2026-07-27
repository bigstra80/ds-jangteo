import {
  normalizeProductCode,
  uniqueProductCodes,
} from "../lib/product-code";

const cases = [
  {
    input: ["JJ44806", "JJ 44806"],
    expected: ["JJ44806"],
  },
  {
    input: ["AF 44625", "AF 44626", "AF 44625", "AF 44626"],
    expected: ["AF44625", "AF44626"],
  },
  {
    input: ["AF44625", "AF 44625", "af 44625"],
    expected: ["AF44625"],
  },
  {
    input: ["AF 44625", "AF 44626", "AF 44627", "AF 44625"],
    expected: ["AF44625", "AF44626", "AF44627"],
  },
];

if (normalizeProductCode(" jj   44806 ") !== "JJ44806") {
  throw new Error("상품코드 정규화 테스트 실패");
}

for (const testCase of cases) {
  const actual = uniqueProductCodes(testCase.input);
  if (JSON.stringify(actual) !== JSON.stringify(testCase.expected)) {
    throw new Error(
      `중복 제거 테스트 실패: ${JSON.stringify(testCase.input)}`
    );
  }
}

console.log(`${cases.length + 1}개 상품코드 테스트 통과`);
