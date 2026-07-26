import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

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

export async function GET() {
  try {
    const [rows, products] = await Promise.all([
      prisma.wholesaleLedger.findMany({
        orderBy: [
          { transactionDate: "desc" },
          { id: "desc" },
        ],
      }),
      prisma.product.findMany({
        select: { name: true, sourceProductName: true },
      }),
    ]);

    const normalizeName = (value: string) =>
      value.trim().replace(/\s+/g, " ").toLocaleLowerCase("ko-KR");
    const sourceNameByAnyName = new Map<string, string>();

    for (const product of products) {
      const sourceName = String(product.sourceProductName || "").trim();
      if (!sourceName) continue;
      if (product.name) sourceNameByAnyName.set(normalizeName(product.name), sourceName);
      sourceNameByAnyName.set(normalizeName(sourceName), sourceName);
    }

    const displayRows = rows.map((row) => ({
      ...row,
      productName:
        sourceNameByAnyName.get(normalizeName(row.productName)) || row.productName,
    }));

    return NextResponse.json({ rows: displayRows }, { headers: { "Cache-Control": "no-store, no-cache, must-revalidate" } });
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
    const body = await request.json();

    const productName = String(body.productName ?? "").trim();

    if (!productName) {
      return NextResponse.json(
        { error: "상품이 필요합니다." },
        { status: 400 }
      );
    }

    const transactionDateText = String(body.transactionDate ?? "").trim();
    const transactionDate = transactionDateText
      ? new Date(`${transactionDateText}T00:00:00`)
      : new Date();

    const row = await prisma.wholesaleLedger.create({
      data: {
        transactionDate,
        productName,

        // 반품 처리를 위해 음수 수량 허용
        quantity: toInt(body.quantity, 1),

        supplierName: toNullableText(body.supplierName),

        // 음수 매입금액도 그대로 저장
        purchaseAmount: toOneDecimal(body.purchaseAmount, 0),

        deliveryCompanyName: toNullableText(body.deliveryCompanyName),
        customerName: toNullableText(body.customerName),
        customerPhone: toNullableText(body.customerPhone),

        // 핵심 수정: Math.max(0, ...) 같은 제한 없이 음수 판매금액 그대로 저장
        saleAmount: toOneDecimal(body.saleAmount, 0),
        shippingFee: toOneDecimal(body.shippingFee, 0),

        settlementStatus:
          String(body.settlementStatus ?? "").trim() || "미정산",

        memo: toNullableText(body.memo),
      },
    });

    return NextResponse.json({ row }, { status: 201 });
  } catch (error) {
    console.error("도매 거래 등록 오류:", error);

    return NextResponse.json(
      { error: "거래를 저장하지 못했습니다." },
      { status: 500 }
    );
  }
}
