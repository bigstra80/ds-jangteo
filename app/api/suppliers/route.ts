import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const suppliers = await prisma.supplier.findMany({
      orderBy: {
        createdAt: "desc",
      },
      include: {
        purchases: true,
        purchaseOrders: true,
      },
    });

    const result = suppliers.map((supplier) => ({
      ...supplier,
      purchaseCount: supplier.purchases.length,
      purchaseOrderCount: supplier.purchaseOrders.length,
      totalPurchaseAmount: supplier.purchases.reduce(
        (sum, purchase) => sum + purchase.totalAmount,
        0
      ),
      totalOrderedAmount: supplier.purchaseOrders.reduce(
        (sum, purchaseOrder) =>
          sum + purchaseOrder.totalAmount,
        0
      ),
      purchases: undefined,
      purchaseOrders: undefined,
    }));

    return NextResponse.json(result);
  } catch (error) {
    console.error("거래처 조회 오류:", error);

    return NextResponse.json(
      { message: "거래처 목록 조회에 실패했습니다." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const code = String(body.code || "").trim();
    const name = String(body.name || "").trim();

    if (!code || !name) {
      return NextResponse.json(
        {
          message: "거래처 코드와 거래처명은 필수입니다.",
        },
        {
          status: 400,
        }
      );
    }

    const duplicate = await prisma.supplier.findUnique({
      where: {
        code,
      },
    });

    if (duplicate) {
      return NextResponse.json(
        {
          message: "이미 사용 중인 거래처 코드입니다.",
        },
        {
          status: 409,
        }
      );
    }

    const supplier = await prisma.supplier.create({
      data: {
        code,
        name,
        businessNumber:
          String(body.businessNumber || "").trim() || null,
        representative:
          String(body.representative || "").trim() || null,
        phone: String(body.phone || "").trim() || null,
        email: String(body.email || "").trim() || null,
        address: String(body.address || "").trim() || null,
        contactName:
          String(body.contactName || "").trim() || null,
        contactPhone:
          String(body.contactPhone || "").trim() || null,
        bankName: String(body.bankName || "").trim() || null,
        bankAccount:
          String(body.bankAccount || "").trim() || null,
        accountHolder:
          String(body.accountHolder || "").trim() || null,
        memo: String(body.memo || "").trim() || null,
        isActive: true,
      },
    });

    return NextResponse.json(supplier, {
      status: 201,
    });
  } catch (error) {
    console.error("거래처 등록 오류:", error);

    return NextResponse.json(
      { message: "거래처 등록에 실패했습니다." },
      { status: 500 }
    );
  }
}
