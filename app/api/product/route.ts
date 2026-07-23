import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";
import { getCurrentSessionUser } from "@/lib/auth";

function makeList(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function makeSkuCode(productCode: string, color: string, size: string) {
  return `${productCode}-${color}-${size}`;
}

function nullableText(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function nullableNumber(value: unknown) {
  if (value === "" || value === null || value === undefined) return null;

  const number = Number(value);
  if (!Number.isFinite(number)) return null;

  return Math.round(number * 10) / 10;
}

function nullableId(value: unknown) {
  if (value === "" || value === null || value === undefined) return null;

  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : null;
}

function hasDuplicateSupplierIds(ids: Array<number | null>) {
  const values = ids.filter((id): id is number => id !== null);
  return new Set(values).size !== values.length;
}

function normalizeProductType(value: unknown) {
  return value === "BROKER" ? "BROKER" : "DIRECT";
}

function hidePurchaseCostsForStaff<T extends {
  cost?: number | null;
  cost2?: number | null;
  cost3?: number | null;
}>(product: T, isAdmin: boolean): T {
  if (isAdmin) {
    return product;
  }

  return {
    ...product,
    cost: null,
    cost2: null,
    cost3: null,
  };
}

// 상품 등록
export async function POST(request: Request) {
  try {
    const sessionUser = await getCurrentSessionUser();

    if (!sessionUser) {
      return NextResponse.json(
        { message: "로그인이 필요합니다." },
        { status: 401 }
      );
    }

    const isAdmin = sessionUser.role === "ADMIN";
    const body = await request.json();

    const productType = normalizeProductType(body.productType);
    const colors = makeList(body.colors || "");
    const sizes = makeList(body.sizes || "");

    if (!String(body.code || "").trim()) {
      return NextResponse.json(
        { message: "상품코드를 입력해주세요." },
        { status: 400 }
      );
    }

    if (!String(body.name || "").trim()) {
      return NextResponse.json(
        { message: "상품명을 입력해주세요." },
        { status: 400 }
      );
    }

    if (colors.length === 0) {
      return NextResponse.json(
        { message: "색상을 1개 이상 입력해주세요." },
        { status: 400 }
      );
    }

    if (sizes.length === 0) {
      return NextResponse.json(
        { message: "사이즈를 1개 이상 입력해주세요." },
        { status: 400 }
      );
    }

    const supplierId = nullableId(body.supplierId);
    const supplier2Id = nullableId(body.supplier2Id);
    const supplier3Id = nullableId(body.supplier3Id);

    if (hasDuplicateSupplierIds([supplierId, supplier2Id, supplier3Id])) {
      return NextResponse.json(
        { message: "같은 공급업체를 중복으로 선택할 수 없습니다." },
        { status: 400 }
      );
    }

    if (productType === "BROKER" && !supplierId) {
      return NextResponse.json(
        { message: "중도매 상품은 1번 공급업체를 선택해주세요." },
        { status: 400 }
      );
    }

    const product = await prisma.product.create({
      data: {
        code: String(body.code).trim(),
        name: String(body.name).trim(),
        brand: nullableText(body.brand),
        category: nullableText(body.category),
        colors: String(body.colors || "").trim(),
        sizes: String(body.sizes || "").trim(),
        cost: isAdmin ? nullableNumber(body.cost) : null,
        cost2: isAdmin ? nullableNumber(body.cost2) : null,
        cost3: isAdmin ? nullableNumber(body.cost3) : null,
        price: nullableNumber(body.price),
        imageUrl: nullableText(body.imageUrl),

        productType,
        sourceProductName: nullableText(body.sourceProductName),
        bandPostId: nullableText(body.bandPostId),
        bandPostUrl: nullableText(body.bandPostUrl),
        isBandImported: Boolean(body.isBandImported),

        supplierId,
        supplier2Id,
        supplier3Id,

        skus: {
          create: colors.flatMap((color) =>
            sizes.map((size) => ({
              sku: makeSkuCode(String(body.code).trim(), color, size),
              color,
              size,
              stock: 0,
            }))
          ),
        },
      },

      include: {
        supplier: true,
        supplier2: true,
        supplier3: true,
        skus: true,
      },
    });

    return NextResponse.json(
      hidePurchaseCostsForStaff(product, isAdmin)
    );
  } catch (error) {
    console.error("상품 등록 오류:", error);

    const message =
      error instanceof Error && error.message.includes("Unique constraint")
        ? "이미 사용 중인 상품코드 또는 밴드 게시글입니다."
        : "상품 등록 중 오류가 발생했습니다.";

    return NextResponse.json(
      { message },
      { status: 500 }
    );
  }
}

// 상품 조회
export async function GET() {
  try {
    const sessionUser = await getCurrentSessionUser();

    if (!sessionUser) {
      return NextResponse.json(
        { message: "로그인이 필요합니다." },
        { status: 401 }
      );
    }

    const isAdmin = sessionUser.role === "ADMIN";

    const products = await prisma.product.findMany({
      orderBy: {
        id: "desc",
      },

      include: {
        supplier: true,
        supplier2: true,
        supplier3: true,
        skus: true,
      },
    });

    return NextResponse.json(
      products.map((product) =>
        hidePurchaseCostsForStaff(product, isAdmin)
      )
    );
  } catch (error) {
    console.error("상품 조회 오류:", error);

    return NextResponse.json(
      {
        message: "상품 조회 중 오류가 발생했습니다.",
      },
      {
        status: 500,
      }
    );
  }
}

// 상품 수정
export async function PUT(request: Request) {
  try {
    const sessionUser = await getCurrentSessionUser();

    if (!sessionUser) {
      return NextResponse.json(
        { message: "로그인이 필요합니다." },
        { status: 401 }
      );
    }

    const isAdmin = sessionUser.role === "ADMIN";
    const body = await request.json();
    const productId = Number(body.id);

    if (!productId || Number.isNaN(productId)) {
      return NextResponse.json(
        {
          message: "올바른 상품 ID가 없습니다.",
        },
        {
          status: 400,
        }
      );
    }

    const productType = normalizeProductType(body.productType);
    const colors = makeList(body.colors || "");
    const sizes = makeList(body.sizes || "");

    if (colors.length === 0) {
      return NextResponse.json(
        { message: "색상을 1개 이상 입력해주세요." },
        { status: 400 }
      );
    }

    if (sizes.length === 0) {
      return NextResponse.json(
        { message: "사이즈를 1개 이상 입력해주세요." },
        { status: 400 }
      );
    }

    const supplierId = nullableId(body.supplierId);
    const supplier2Id = nullableId(body.supplier2Id);
    const supplier3Id = nullableId(body.supplier3Id);

    if (hasDuplicateSupplierIds([supplierId, supplier2Id, supplier3Id])) {
      return NextResponse.json(
        { message: "같은 공급업체를 중복으로 선택할 수 없습니다." },
        { status: 400 }
      );
    }

    if (productType === "BROKER" && !supplierId) {
      return NextResponse.json(
        { message: "중도매 상품은 1번 공급업체를 선택해주세요." },
        { status: 400 }
      );
    }

    const existingSkus = await prisma.productSku.findMany({
      where: {
        productId,
      },
    });

    const productCode = String(body.code || "").trim();

    const existingProduct = await prisma.product.findUnique({
      where: {
        id: productId,
      },
      select: {
        cost: true,
        cost2: true,
        cost3: true,
      },
    });

    if (!existingProduct) {
      return NextResponse.json(
        { message: "상품을 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    const newSkuCodes = colors.flatMap((color) =>
      sizes.map((size) => makeSkuCode(productCode, color, size))
    );

    for (const sku of existingSkus) {
      if (!newSkuCodes.includes(sku.sku)) {
        try {
          await prisma.productSku.delete({
            where: {
              id: sku.id,
            },
          });
        } catch {
          console.log(
            `사용 중인 SKU는 삭제하지 않고 유지합니다: ${sku.sku}`
          );
        }
      }
    }

    await prisma.product.update({
      where: {
        id: productId,
      },

      data: {
        code: productCode,
        name: String(body.name || "").trim(),
        brand: nullableText(body.brand),
        category: nullableText(body.category),
        colors: String(body.colors || "").trim(),
        sizes: String(body.sizes || "").trim(),
        cost: isAdmin ? nullableNumber(body.cost) : existingProduct.cost,
        cost2: isAdmin ? nullableNumber(body.cost2) : existingProduct.cost2,
        cost3: isAdmin ? nullableNumber(body.cost3) : existingProduct.cost3,
        price: nullableNumber(body.price),
        imageUrl: nullableText(body.imageUrl),

        productType,
        sourceProductName: nullableText(body.sourceProductName),
        bandPostId: nullableText(body.bandPostId),
        bandPostUrl: nullableText(body.bandPostUrl),
        isBandImported: Boolean(body.isBandImported),

        supplierId,
        supplier2Id,
        supplier3Id,
      },
    });

    for (const color of colors) {
      for (const size of sizes) {
        const skuCode = makeSkuCode(productCode, color, size);

        const existingSku = await prisma.productSku.findFirst({
          where: {
            productId,
            sku: skuCode,
          },
        });

        if (!existingSku) {
          await prisma.productSku.create({
            data: {
              productId,
              sku: skuCode,
              color,
              size,
              stock: 0,
            },
          });
        }
      }
    }

    const product = await prisma.product.findUnique({
      where: {
        id: productId,
      },

      include: {
        supplier: true,
        supplier2: true,
        supplier3: true,
        skus: true,
      },
    });

    return NextResponse.json(
      product
        ? hidePurchaseCostsForStaff(product, isAdmin)
        : product
    );
  } catch (error) {
    console.error("상품 수정 오류:", error);

    const message =
      error instanceof Error && error.message.includes("Unique constraint")
        ? "이미 사용 중인 상품코드 또는 밴드 게시글입니다."
        : "상품 수정 중 오류가 발생했습니다.";

    return NextResponse.json(
      { message },
      { status: 500 }
    );
  }
}

// 상품 삭제 / 관리자 강제삭제
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    const id = Number(searchParams.get("id"));
    const force = searchParams.get("force") === "true";

    if (!id || Number.isNaN(id)) {
      return NextResponse.json(
        {
          message: "올바른 상품 ID가 없습니다.",
        },
        {
          status: 400,
        }
      );
    }

    const product = await prisma.product.findUnique({
      where: {
        id,
      },

      include: {
        skus: true,
      },
    });

    if (!product) {
      return NextResponse.json(
        {
          message: "상품을 찾을 수 없습니다.",
        },
        {
          status: 404,
        }
      );
    }

    if (!force) {
      try {
        await prisma.productSku.deleteMany({
          where: {
            productId: id,
          },
        });

        await prisma.product.delete({
          where: {
            id,
          },
        });

        return NextResponse.json({
          message: "상품이 삭제되었습니다.",
        });
      } catch (error) {
        console.error("연결 데이터가 있는 상품 삭제 실패:", error);

        return NextResponse.json(
          {
            message:
              "이 상품은 주문, 입출고 또는 재고이력에 사용된 기록이 있어서 삭제할 수 없습니다.",
          },
          {
            status: 400,
          }
        );
      }
    }

    const sessionUser = await getCurrentSessionUser();

    if (!sessionUser) {
      return NextResponse.json(
        { message: "로그인이 필요합니다." },
        { status: 401 }
      );
    }

    if (sessionUser.role !== "ADMIN") {
      return NextResponse.json(
        { message: "관리자만 강제삭제할 수 있습니다." },
        { status: 403 }
      );
    }

    const skuIds = product.skus.map((sku) => sku.id);

    await prisma.$transaction(async (tx) => {
      await tx.orderItem.deleteMany({
        where: {
          productSkuId: {
            in: skuIds,
          },
        },
      });

      await tx.purchaseItem.deleteMany({
        where: {
          productSkuId: {
            in: skuIds,
          },
        },
      });

      await tx.purchaseOrderItem.deleteMany({
        where: {
          productSkuId: {
            in: skuIds,
          },
        },
      });

      await tx.stockMovement.deleteMany({
        where: {
          productSkuId: {
            in: skuIds,
          },
        },
      });

      // 거래처별 개별 판매단가가 있으면 같이 정리
      await tx.customerProductPrice.deleteMany({
        where: {
          productId: id,
        },
      });

      await tx.order.deleteMany({
        where: {
          items: {
            none: {},
          },
        },
      });

      await tx.purchase.deleteMany({
        where: {
          items: {
            none: {},
          },
        },
      });

      await tx.purchaseOrder.deleteMany({
        where: {
          items: {
            none: {},
          },
        },
      });

      await tx.productSku.deleteMany({
        where: {
          productId: id,
        },
      });

      await tx.product.delete({
        where: {
          id,
        },
      });
    });

    return NextResponse.json({
      message:
        "관리자 강제삭제가 완료되었습니다.\n연결된 주문상품, 매입상품, 발주상품, 재고이력, 거래처별 판매단가와 상품이 함께 정리되었습니다.",
    });
  } catch (error) {
    console.error("상품 삭제 오류:", error);

    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "상품 삭제 중 오류가 발생했습니다.",
      },
      {
        status: 500,
      }
    );
  }
}
