import { NextResponse } from "next/server";
import { getAutomaticLedgerSalePrice } from "@/lib/wholesale-ledger-sale-price";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const result = await getAutomaticLedgerSalePrice(
      searchParams.get("customerId"),
      searchParams.get("productId")
    );

    if (!result) {
      return NextResponse.json(
        { error: "납품업체 또는 상품 정보를 확인해 주세요." },
        { status: 404 }
      );
    }

    return NextResponse.json(result, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("주문용 거래처 등급 단가 조회 오류:", error);
    return NextResponse.json(
      { error: "납품업체 등급을 불러오지 못했습니다." },
      { status: 500 }
    );
  }
}
