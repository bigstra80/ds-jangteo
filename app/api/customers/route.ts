import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function extractOrderNumber(memo: string | null) {
  if (!memo) return null;
  const match = memo.match(/주문번호:\s*([^/]+)/);
  return match?.[1]?.trim() || null;
}

// 고객 목록 + 주문/매출 요약 조회
export async function GET() {
  try {
    const [customers, returnMovements] = await Promise.all([
      prisma.customer.findMany({
        orderBy: { createdAt: "desc" },
        include: { orders: { include: { items: true } } },
      }),
      prisma.stockMovement.findMany({
        where: { type: "RETURN_IN" },
        select: { quantity: true, productSkuId: true, memo: true },
      }),
    ]);

    const returnedQtyMap = new Map<string, number>();
    for (const movement of returnMovements) {
      const orderNumber = extractOrderNumber(movement.memo);
      if (!orderNumber) continue;
      const key = `${orderNumber}:${movement.productSkuId}`;
      returnedQtyMap.set(key, (returnedQtyMap.get(key) || 0) + movement.quantity);
    }

    const result = customers.map((customer) => {
      const validOrders = customer.orders.filter((order) => order.status !== "주문취소");
      const totalOrders = validOrders.length;

      let totalQuantity = 0;
      let totalSales = 0;

      for (const order of validOrders) {
        for (const item of order.items) {
          const returned = Math.min(
            item.quantity,
            returnedQtyMap.get(`${order.orderNumber}:${item.productSkuId}`) || 0
          );
          const netQuantity = Math.max(item.quantity - returned, 0);
          totalQuantity += netQuantity;
          totalSales += (item.price || 0) * netQuantity;
        }
      }

      const lastOrderAt =
        validOrders.length > 0
          ? validOrders
              .map((order) => order.createdAt)
              .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0]
          : null;

      return {
        id: customer.id,
        code: customer.code,
        name: customer.name,
        phone: customer.phone,
        email: customer.email,
        address: customer.address,
        memo: customer.memo,
        isActive: customer.isActive,
        createdAt: customer.createdAt,
        updatedAt: customer.updatedAt,
        totalOrders,
        totalQuantity,
        totalSales,
        lastOrderAt,
      };
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("고객 조회 오류:", error);
    return NextResponse.json({ message: "고객 목록을 불러오지 못했습니다." }, { status: 500 });
  }
}

// 고객 등록
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const code = String(body.code || "").trim();
    const name = String(body.name || "").trim();

    if (!code) return NextResponse.json({ message: "고객 코드를 입력해주세요." }, { status: 400 });
    if (!name) return NextResponse.json({ message: "고객명을 입력해주세요." }, { status: 400 });

    const duplicate = await prisma.customer.findUnique({ where: { code } });
    if (duplicate) {
      return NextResponse.json({ message: "이미 사용 중인 고객 코드입니다." }, { status: 409 });
    }

    const customer = await prisma.customer.create({
      data: {
        code,
        name,
        phone: String(body.phone || "").trim() || null,
        email: String(body.email || "").trim() || null,
        address: String(body.address || "").trim() || null,
        memo: String(body.memo || "").trim() || null,
        isActive: true,
      },
    });

    return NextResponse.json(customer, { status: 201 });
  } catch (error) {
    console.error("고객 등록 오류:", error);
    return NextResponse.json({ message: "고객 등록에 실패했습니다." }, { status: 500 });
  }
}
