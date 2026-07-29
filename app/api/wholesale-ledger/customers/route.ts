import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const customers = await prisma.customer.findMany({
      where: { isActive: true },
      orderBy: [{ name: "asc" }, { id: "asc" }],
      select: {
        id: true,
        code: true,
        name: true,
        grade: true,
        isActive: true,
      },
    });

    return NextResponse.json(
      customers.map((customer) => ({
        ...customer,
        grade: ["A", "B", "C", "D"].includes(
          String(customer.grade).toUpperCase()
        )
          ? String(customer.grade).toUpperCase()
          : "D",
      })),
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("주문용 납품업체 조회 오류:", error);
    return NextResponse.json(
      { error: "납품업체 등급을 불러오지 못했습니다." },
      { status: 500 }
    );
  }
}
