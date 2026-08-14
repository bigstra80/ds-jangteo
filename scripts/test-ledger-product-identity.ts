import { resolveProductIdentity } from "../lib/product-identity";

const duplicateName = "<남은수량 빅 세일>";
const products = ["PO2945", "PO2944", "PO46836", "PO46835", "PO46834"].map(
  (code, index) => ({ id: index + 1, code, name: duplicateName })
);

const lookup = {
  findUnique: async ({ where }: { where: { id: number } | { code: string } }) =>
    products.find((product) =>
      "id" in where ? product.id === where.id : product.code === where.code
    ) ?? null,
};

async function main() {
  for (const product of products) {
    const resolved = await resolveProductIdentity(
      {
        productId: product.id,
        productCode: "PO2945",
        productName: duplicateName,
      },
      lookup
    );

    if (resolved.productId !== product.id || resolved.productCode !== product.code) {
      throw new Error(`${product.code} 상품 식별에 실패했습니다.`);
    }
  }

  const resolvedByCode = await resolveProductIdentity(
    { productCode: "PO46834", productName: duplicateName },
    lookup
  );

  if (resolvedByCode.productId !== 5 || resolvedByCode.productCode !== "PO46834") {
    throw new Error("상품코드 단독 식별에 실패했습니다.");
  }

  console.log("동일 상품명 5건의 상품 ID/코드 식별 테스트가 통과했습니다.");
}

void main();
