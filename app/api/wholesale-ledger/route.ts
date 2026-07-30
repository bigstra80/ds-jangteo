import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentSessionUser } from "@/lib/auth";
import { resolveLedgerSaleAmount } from "@/lib/wholesale-ledger-sale-price";
import {
  calculateRegisteredProductPurchaseAmount,
  hasRegisteredProductId,
  PurchaseAmountResolutionError,
} from "@/lib/wholesale-ledger-purchase-amount";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function toInt(value: unknown, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.trunc(number) : fallback;
}

function toOneDecimal(value: unknown, fallback = 0) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.round(number * 10) / 10;
}

function toNullableText(value: unknown) {
  const text = String(value ?? "").trim();
  return text ? text : null;
}

function requiredNumber(value: unknown) {
  if (
    (typeof value !== "string" && typeof value !== "number") ||
    String(value).trim() === ""
  ) {
    return null;
  }

  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export async function GET() {
  try {
    const rows = await prisma.wholesaleLedger.findMany({
      orderBy: [
        { createdAt: "desc" },
        { id: "desc" },
      ],
    });

    return NextResponse.json({ rows }, { headers: { "Cache-Control": "no-store, no-cache, must-revalidate" } });
  } catch (error) {
    console.error("도매 거래 목록 조회 오류:", error);

    return NextResponse.json(
      { error: "거래 목록을 불러오지 못했습니다." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const sessionUser = await getCurrentSessionUser();
    if (!sessionUser) {
      return NextResponse.json(
        { error: "로그인이 필요합니다." },
        { status: 401 }
      );
    }

    const body = await request.json();

    const productName = String(body.productName ?? "").trim();

    if (!productName) {
      return NextResponse.json(
        { error: "상품명을 입력해주세요." },
        { status: 400 }
      );
    }

    const transactionDateText = String(body.transactionDate ?? "").trim();
    const transactionDate = transactionDateText
      ? new Date(`${transactionDateText}T00:00:00`)
      : new Date();

    const parsedQuantity = requiredNumber(body.quantity);
    if (parsedQuantity === null || !Number.isInteger(parsedQuantity)) {
      return NextResponse.json(
        { error: "수량을 올바르게 입력해주세요." },
        { status: 400 }
      );
    }
    const quantity = toInt(parsedQuantity, 1);

    const parsedPurchaseAmount = requiredNumber(body.purchaseAmount);
    if (parsedPurchaseAmount === null) {
      return NextResponse.json(
        { error: "단가를 올바르게 입력해주세요." },
        { status: 400 }
      );
    }
    const purchaseAmount =
      sessionUser.role !== "ADMIN" &&
      hasRegisteredProductId(body.productId)
        ? await calculateRegisteredProductPurchaseAmount(body, quantity)
        : toOneDecimal(parsedPurchaseAmount);

    const saleValue =
      body.saleUnitPrice !== undefined &&
      body.saleUnitPrice !== null &&
      body.saleUnitPrice !== ""
        ? body.saleUnitPrice
        : body.saleAmount;
    if (requiredNumber(saleValue) === null) {
      return NextResponse.json(
        { error: "판매금액을 올바르게 입력해주세요." },
        { status: 400 }
      );
    }

    const parsedShippingFee = requiredNumber(body.shippingFee);
    if (parsedShippingFee === null) {
      return NextResponse.json(
        { error: "배송비를 올바르게 입력해주세요." },
        { status: 400 }
      );
    }
    const row = await prisma.wholesaleLedger.create({
      data: {
        transactionDate,
        productName,

        // 반품 처리를 위해 음수 수량 허용
        quantity,

        supplierName: toNullableText(body.supplierName),
        purchaseAmount,

        deliveryCompanyName: toNullableText(body.deliveryCompanyName),
        customerName: toNullableText(body.customerName),
        customerPhone: toNullableText(body.customerPhone),

        // 신규/수정 폼은 단가 × 수량을 총 판매금액으로 저장합니다.
        saleAmount: await resolveLedgerSaleAmount(body, quantity),
        shippingFee: toOneDecimal(parsedShippingFee),

        settlementStatus:
          String(body.settlementStatus ?? "").trim() || "미정산",

        memo: toNullableText(body.memo),
      },
    });

    return NextResponse.json({ row }, { status: 201 });
  } catch (error) {
    if (error instanceof PurchaseAmountResolutionError) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    console.error("도매 거래 등록 오류:", error);

    return NextResponse.json(
      { error: "거래를 저장하지 못했습니다." },
      { status: 500 }
    );
  }
}
