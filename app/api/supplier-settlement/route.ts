import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const ledgerRows = await prisma.wholesaleLedger.findMany({
      where: {
        supplierName: {
          not: null,
        },
      },
      orderBy: [
        { transactionDate: "desc" },
        { id: "desc" },
      ],
    });

    const grouped = new Map<
      string,
      {
        supplierName: string;
        tradeCount: number;
        grossPurchaseAmount: number;
        returnAmount: number;
        netPurchaseAmount: number;
        payableAmount: number;
        recentTradeDate: Date | null;
        rows: typeof ledgerRows;
      }
    >();

    for (const row of ledgerRows) {
      const supplierName = String(row.supplierName || "").trim();
      if (!supplierName) continue;

      if (!grouped.has(supplierName)) {
        grouped.set(supplierName, {
          supplierName,
          tradeCount: 0,
          grossPurchaseAmount: 0,
          returnAmount: 0,
          netPurchaseAmount: 0,
          payableAmount: 0,
          recentTradeDate: null,
          rows: [],
        });
      }

      const item = grouped.get(supplierName)!;
      const purchaseAmount = Number(row.purchaseAmount || 0);

      item.tradeCount += 1;

      if (purchaseAmount >= 0) {
        item.grossPurchaseAmount += purchaseAmount;
      } else {
        item.returnAmount += Math.abs(purchaseAmount);
      }

      item.netPurchaseAmount += purchaseAmount;

      if (row.settlementStatus === "미정산") {
        item.payableAmount += purchaseAmount;
      }

      if (
        !item.recentTradeDate ||
        row.transactionDate > item.recentTradeDate
      ) {
        item.recentTradeDate = row.transactionDate;
      }

      item.rows.push(row);
    }

    return NextResponse.json(Array.from(grouped.values()));
  } catch (error) {
    console.error("공급업체 정산 조회 오류:", error);

    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "공급업체 정산 정보를 불러오지 못했습니다.",
      },
      { status: 500 }
    );
  }
}
