import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const [customers, ledgerRows] = await Promise.all([
      prisma.customer.findMany({
        where: { isActive: true },
        select: {
          id: true,
          code: true,
          name: true,
        },
        orderBy: { name: "asc" },
      }),

      prisma.wholesaleLedger.findMany({
        orderBy: [
          { transactionDate: "desc" },
          { id: "desc" },
        ],
      }),
    ]);

    const customerByName = new Map(
      customers.map((customer) => [customer.name.trim(), customer])
    );

    const grouped = new Map<
      string,
      {
        customerId: number | null;
        customerCode: string;
        customerName: string;
        tradeCount: number;
        grossSalesAmount: number;
        returnAmount: number;
        netSalesAmount: number;
        receivableAmount: number;
        recentTradeDate: Date | null;
        rows: Array<{
          id: number;
          transactionDate: Date;
          productName: string;
          quantity: number;
          supplierName: string | null;
          purchaseAmount: number;
          deliveryCompanyName: string | null;
          customerName: string | null;
          saleAmount: number;
          shippingFee: number;
          settlementStatus: string;
          memo: string | null;
        }>;
      }
    >();

    for (const row of ledgerRows) {
      const deliveryCompanyName = String(
        row.deliveryCompanyName || ""
      ).trim();

      // 납품업체가 없는 장부는 거래처 정산 대상에서 제외
      if (!deliveryCompanyName) continue;

      const matchedCustomer = customerByName.get(deliveryCompanyName);
      const key = deliveryCompanyName;

      if (!grouped.has(key)) {
        grouped.set(key, {
          customerId: matchedCustomer?.id ?? null,
          customerCode: matchedCustomer?.code ?? "-",
          customerName: deliveryCompanyName,
          tradeCount: 0,
          grossSalesAmount: 0,
          returnAmount: 0,
          netSalesAmount: 0,
          receivableAmount: 0,
          recentTradeDate: null,
          rows: [],
        });
      }

      const item = grouped.get(key)!;
      const saleAmount = Number(row.saleAmount || 0);

      item.tradeCount += 1;

      if (saleAmount >= 0) {
        item.grossSalesAmount += saleAmount;
      } else {
        item.returnAmount += Math.abs(saleAmount);
      }

      item.netSalesAmount += saleAmount;

      if (row.settlementStatus === "미정산") {
        item.receivableAmount += saleAmount;
      }

      if (
        !item.recentTradeDate ||
        row.transactionDate > item.recentTradeDate
      ) {
        item.recentTradeDate = row.transactionDate;
      }

      item.rows.push({
        id: row.id,
        transactionDate: row.transactionDate,
        productName: row.productName,
        quantity: row.quantity,
        supplierName: row.supplierName,
        purchaseAmount: row.purchaseAmount,
        deliveryCompanyName: row.deliveryCompanyName,
        customerName: row.customerName,
        saleAmount: row.saleAmount,
        shippingFee: row.shippingFee || 0,
        settlementStatus: row.settlementStatus,
        memo: row.memo,
      });
    }

    const result = Array.from(grouped.values()).sort((a, b) =>
      a.customerName.localeCompare(b.customerName, "ko")
    );

    return NextResponse.json(result);
  } catch (error) {
    console.error("거래처 정산 조회 오류:", error);

    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "거래처 정산 정보를 불러오지 못했습니다.",
      },
      { status: 500 }
    );
  }
}
