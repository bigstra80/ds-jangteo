import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const [customers, products, ledgerRows] = await Promise.all([
      prisma.customer.findMany({
        where: { isActive: true },
        select: {
          id: true,
          code: true,
          name: true,
        },
        orderBy: { name: "asc" },
      }),

      prisma.product.findMany({
        select: {
          code: true,
          name: true,
        },
      }),

      prisma.wholesaleLedger.findMany({
        orderBy: { id: "desc" },
      }),
    ]);

    const normalizeName = (value: string) =>
      value.trim().replace(/\s+/g, " ").toLocaleLowerCase("ko-KR");

    const customerByName = new Map(
      customers.map((customer) => [normalizeName(customer.name), customer])
    );

    const productCodeByName = new Map(
      products.map((product) => [normalizeName(product.name), product.code])
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
          productCode: string | null;
          productName: string;
          quantity: number;
          supplierName: string | null;
          purchaseAmount: number;
          deliveryCompanyName: string | null;
          customerName: string | null;
          customerPhone: string | null;
          saleAmount: number;
          shippingFee: number;
          settlementStatus: string;
          memo: string | null;
          createdAt: Date;
        }>;
      }
    >();

    for (const row of ledgerRows) {
      const deliveryCompanyName = String(
        row.deliveryCompanyName || ""
      ).trim();

      // 납품업체가 없는 장부는 거래처 정산 대상에서 제외
      if (!deliveryCompanyName) continue;

      const normalizedDeliveryName = normalizeName(deliveryCompanyName);
      const matchedCustomer = customerByName.get(normalizedDeliveryName);
      const key = normalizedDeliveryName;

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
      const shippingFee = Number(row.shippingFee || 0);
      const totalAmount = saleAmount + shippingFee;
      const isReturn =
        saleAmount < 0 ||
        row.quantity < 0 ||
        String(row.memo || "").includes("반품");

      item.tradeCount += 1;

      if (isReturn) {
        item.returnAmount += Math.abs(totalAmount);
      } else {
        item.grossSalesAmount += totalAmount;
      }

      item.netSalesAmount += totalAmount;

      if (row.settlementStatus !== "정산완료") {
        item.receivableAmount += totalAmount;
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
        productCode: productCodeByName.get(normalizeName(row.productName)) ?? null,
        productName: row.productName,
        quantity: row.quantity,
        supplierName: row.supplierName,
        purchaseAmount: row.purchaseAmount,
        deliveryCompanyName: row.deliveryCompanyName,
        customerName: row.customerName,
        customerPhone: row.customerPhone,
        saleAmount: row.saleAmount,
        shippingFee: row.shippingFee || 0,
        settlementStatus: row.settlementStatus,
        memo: row.memo,
        createdAt: row.createdAt,
      });
    }

    const result = Array.from(grouped.values())
      .map((item) => ({
        ...item,
        rows: [...item.rows].sort((a, b) => {
          const createdDiff =
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
          return createdDiff !== 0 ? createdDiff : b.id - a.id;
        }),
      }))
      .sort((a, b) => {
        const aLatest = a.rows[0];
        const bLatest = b.rows[0];

        const createdDiff =
          new Date(bLatest?.createdAt ?? 0).getTime() -
          new Date(aLatest?.createdAt ?? 0).getTime();

        return createdDiff !== 0
          ? createdDiff
          : (bLatest?.id ?? 0) - (aLatest?.id ?? 0);
      });

    return NextResponse.json(result, {
      headers: { "Cache-Control": "no-store, no-cache, must-revalidate" },
    });
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
