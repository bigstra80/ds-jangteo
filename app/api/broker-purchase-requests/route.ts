import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const allowedStatuses = [
  "매입대기",
  "업체주문완료",
  "입고완료",
  "취소",
];

export async function GET() {
  try {
    const requests = await prisma.brokerPurchaseRequest.findMany({
      orderBy: {
        id: "desc",
      },
      include: {
        supplier: true,
        order: {
          include: {
            customer: true,
          },
        },
        productSku: {
          include: {
            product: true,
          },
        },
      },
    });

    return NextResponse.json(requests);
  } catch (error) {
    console.error("중도매 매입목록 조회 오류:", error);

    return NextResponse.json(
      {
        message: "중도매 매입목록을 불러오지 못했습니다.",
      },
      {
        status: 500,
      }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();

    const id = Number(body.id);
    const status = String(body.status || "").trim();

    if (!id || Number.isNaN(id)) {
      return NextResponse.json(
        {
          message: "수정할 매입요청 ID가 없습니다.",
        },
        {
          status: 400,
        }
      );
    }

    if (!allowedStatuses.includes(status)) {
      return NextResponse.json(
        {
          message: "올바르지 않은 상태입니다.",
        },
        {
          status: 400,
        }
      );
    }

    const updated = await prisma.brokerPurchaseRequest.update({
      where: {
        id,
      },
      data: {
        status,
      },
      include: {
        supplier: true,
        order: {
          include: {
            customer: true,
          },
        },
        productSku: {
          include: {
            product: true,
          },
        },
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("중도매 매입상태 수정 오류:", error);

    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "상태 변경에 실패했습니다.",
      },
      {
        status: 500,
      }
    );
  }
}
