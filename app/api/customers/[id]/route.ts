import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function PUT(
  request: Request,
  context: RouteContext
) {
  try {
    const { id } = await context.params;
    const customerId = Number(id);
    const body = await request.json();

    if (!customerId || Number.isNaN(customerId)) {
      return NextResponse.json(
        { message: "잘못된 고객 번호입니다." },
        { status: 400 }
      );
    }

    const code = String(body.code || "").trim();
    const name = String(body.name || "").trim();

    if (!code || !name) {
      return NextResponse.json(
        { message: "고객 코드와 고객명은 필수입니다." },
        { status: 400 }
      );
    }

    const duplicate = await prisma.customer.findFirst({
      where: {
        code,
        NOT: {
          id: customerId,
        },
      },
    });

    if (duplicate) {
      return NextResponse.json(
        { message: "이미 사용 중인 고객 코드입니다." },
        { status: 409 }
      );
    }

    const customer = await prisma.customer.update({
      where: {
        id: customerId,
      },
      data: {
        code,
        name,
        phone: String(body.phone || "").trim() || null,
        email: String(body.email || "").trim() || null,
        address: String(body.address || "").trim() || null,
        memo: String(body.memo || "").trim() || null,
      },
    });

    return NextResponse.json(customer);
  } catch (error) {
    console.error("고객 수정 오류:", error);

    return NextResponse.json(
      { message: "고객 수정에 실패했습니다." },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: Request,
  context: RouteContext
) {
  try {
    const { id } = await context.params;
    const customerId = Number(id);
    const body = await request.json();

    if (!customerId || Number.isNaN(customerId)) {
      return NextResponse.json(
        { message: "잘못된 고객 번호입니다." },
        { status: 400 }
      );
    }

    const customer = await prisma.customer.update({
      where: {
        id: customerId,
      },
      data: {
        isActive: Boolean(body.isActive),
      },
    });

    return NextResponse.json(customer);
  } catch (error) {
    console.error("고객 상태 변경 오류:", error);

    return NextResponse.json(
      { message: "고객 상태 변경에 실패했습니다." },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  context: RouteContext
) {
  try {
    const { id } = await context.params;
    const customerId = Number(id);

    if (!customerId || Number.isNaN(customerId)) {
      return NextResponse.json(
        { message: "잘못된 고객 번호입니다." },
        { status: 400 }
      );
    }

    const orderCount = await prisma.order.count({
      where: {
        customerId,
      },
    });

    if (orderCount > 0) {
      return NextResponse.json(
        {
          message:
            `이 고객은 주문 ${orderCount}건과 연결되어 있어 삭제할 수 없습니다.\n` +
            "삭제 대신 '사용중지'로 변경해주세요.",
        },
        { status: 400 }
      );
    }

    await prisma.customer.delete({
      where: {
        id: customerId,
      },
    });

    return NextResponse.json({
      message: "고객이 삭제되었습니다.",
    });
  } catch (error) {
    console.error("고객 삭제 오류:", error);

    return NextResponse.json(
      { message: "고객 삭제에 실패했습니다." },
      { status: 500 }
    );
  }
}
