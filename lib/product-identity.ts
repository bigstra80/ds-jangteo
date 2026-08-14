export class ProductIdentityResolutionError extends Error {}

type ProductReference = { id: number; code: string; name: string };
export type ProductLookup = {
  findUnique(args: {
    where: { id: number } | { code: string };
    select: { id: true; code: true; name: true };
  }): Promise<ProductReference | null>;
};

function positiveId(value: unknown) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function nullableText(value: unknown) {
  const text = String(value ?? "").trim();
  return text || null;
}

export async function resolveProductIdentity(
  body: Record<string, unknown>,
  productLookup: ProductLookup
) {
  const requestedId = positiveId(body.productId);
  const requestedCode = nullableText(body.productCode);

  if (requestedId) {
    const product = await productLookup.findUnique({
      where: { id: requestedId },
      select: { id: true, code: true, name: true },
    });

    if (!product) {
      throw new ProductIdentityResolutionError("선택한 상품을 찾을 수 없습니다.");
    }

    return {
      productId: product.id,
      productCode: product.code,
      productName: product.name,
    };
  }

  if (requestedCode) {
    const product = await productLookup.findUnique({
      where: { code: requestedCode },
      select: { id: true, code: true, name: true },
    });

    if (product) {
      return {
        productId: product.id,
        productCode: product.code,
        productName: product.name,
      };
    }
  }

  return {
    productId: null,
    productCode: requestedCode,
    productName: String(body.productName ?? "").trim(),
  };
}
