import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { calculateLedgerAmount } from "@/lib/ledger-amount";

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

function resolveSaleAmount(
  body: Record<string, unknown>,
  quantity: number
) {
  if (
    body.saleUnitPrice !== undefined &&
    body.saleUnitPrice !== null &&
    body.saleUnitPrice !== ""
  ) {
    return calculateLedgerAmount(body.saleUnitPrice, quantity);
  }

  // 기존 목록 인라인 수정 요청은 saleAmount를 총액으로 전달합니다.
  return toOneDecimal(body.saleAmount, 0);
}

function parseId(value: string) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: idText } = await context.params;
    const id = parseId(idText);

    if (!id) {
      return NextResponse.json(
        { error: "잘못된 거래 번호입니다." },
        { status: 400 }
      );
    }

    const body = await request.json();

    const productName = String(body.productName ?? "").trim();

    if (!productName) {
      return NextResponse.json(
        { error: "상품명이 필요합니다." },
        { status: 400 }
      );
    }

    const transactionDateText = String(body.transactionDate ?? "").trim();
    const transactionDate = transactionDateText
      ? new Date(`${transactionDateText}T00:00:00`)
      : new Date();

    const quantity = toInt(body.quantity, 1);
    const row = await prisma.wholesaleLedger.update({
      where: { id },
      data: {
        transactionDate,
        productName,

        // 반품 처리를 위해 음수 수량 허용
        quantity,

        supplierName: toNullableText(body.supplierName),

        // 음수 매입금액 그대로 유지
        purchaseAmount: toOneDecimal(body.purchaseAmount, 0),

        deliveryCompanyName: toNullableText(body.deliveryCompanyName),
        customerName: toNullableText(body.customerName),
        customerPhone: toNullableText(body.customerPhone),

        // 수정 폼에서도 단가 × 수량을 총 판매금액으로 저장합니다.
        saleAmount: resolveSaleAmount(body, quantity),
        shippingFee: toOneDecimal(body.shippingFee, 0),

        settlementStatus:
          String(body.settlementStatus ?? "").trim() || "미정산",

        memo: toNullableText(body.memo),
      },
    });

    return NextResponse.json({ row });
  } catch (error) {
    console.error("도매 거래 수정 오류:", error);

    return NextResponse.json(
      { error: "거래를 수정하지 못했습니다." },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: idText } = await context.params;
    const id = parseId(idText);

    if (!id) {
      return NextResponse.json(
        { error: "잘못된 거래 번호입니다." },
        { status: 400 }
      );
    }

    await prisma.wholesaleLedger.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("도매 거래 삭제 오류:", error);

    return NextResponse.json(
      { error: "거래를 삭제하지 못했습니다." },
      { status: 500 }
    );
  }
}
