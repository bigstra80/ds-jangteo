import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";

// 거래처별 판매단가 조회
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    const customerIdParam = searchParams.get("customerId");

    if (!customerIdParam) {
      return NextResponse.json(
        { error: "거래처를 선택해주세요." },
        { status: 400 }
      );
    }

    const customerId = Number(customerIdParam);

    if (Number.isNaN(customerId)) {
      return NextResponse.json(
        { error: "잘못된 거래처 ID입니다." },
        { status: 400 }
      );
    }

    const products = await prisma.product.findMany({
      orderBy: {
        id: "desc",
      },

      include: {
        customerPrices: {
          where: {
            customerId,
          },
        },
      },
    });

    const result = products.map((product) => ({
      id: product.id,
      code: product.code,
      name: product.name,
      brand: product.brand,
      price: product.price,

      customerPrice:
        product.customerPrices.length > 0
          ? product.customerPrices[0].price
          : null,
    }));

    return NextResponse.json(result);
  } catch (error) {
    console.error("거래처별 판매단가 조회 오류:", error);

    return NextResponse.json(
      { error: "거래처별 판매단가를 불러오지 못했습니다." },
      { status: 500 }
    );
  }
}

// 거래처별 판매단가 저장 / 수정
export async function POST(request: Request) {
  try {
    const body = await request.json();

    const customerId = Number(body.customerId);
    const productId = Number(body.productId);
    const price = Number(body.price);

    if (
      Number.isNaN(customerId) ||
      Number.isNaN(productId) ||
      Number.isNaN(price)
    ) {
      return NextResponse.json(
        { error: "입력값이 올바르지 않습니다." },
        { status: 400 }
      );
    }

    if (price < 0) {
      return NextResponse.json(
        { error: "판매단가는 0원 이상이어야 합니다." },
        { status: 400 }
      );
    }

    const savedPrice = await prisma.customerProductPrice.upsert({
      where: {
        customerId_productId: {
          customerId,
          productId,
        },
      },

      update: {
        price,
      },

      create: {
        customerId,
        productId,
        price,
      },
    });

    return NextResponse.json(savedPrice);
  } catch (error) {
    console.error("거래처별 판매단가 저장 오류:", error);

    return NextResponse.json(
      { error: "거래처별 판매단가 저장에 실패했습니다." },
      { status: 500 }
    );
  }
}

// 거래처별 판매단가 삭제
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    const customerId = Number(searchParams.get("customerId"));
    const productId = Number(searchParams.get("productId"));

    if (Number.isNaN(customerId) || Number.isNaN(productId)) {
      return NextResponse.json(
        { error: "입력값이 올바르지 않습니다." },
        { status: 400 }
      );
    }

    await prisma.customerProductPrice.deleteMany({
      where: {
        customerId,
        productId,
      },
    });

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error("거래처별 판매단가 삭제 오류:", error);

    return NextResponse.json(
      { error: "거래처별 판매단가 삭제에 실패했습니다." },
      { status: 500 }
    );
  }
}