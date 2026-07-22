import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentSessionUser } from "@/lib/auth";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

// 거래처 상세 조회
export async function GET(
  _request: Request,
  context: RouteContext
) {
  try {
    const { id } = await context.params;
    const supplierId = Number(id);

    if (!supplierId || Number.isNaN(supplierId)) {
      return NextResponse.json(
        { message: "올바른 거래처 ID가 아닙니다." },
        { status: 400 }
      );
    }

    const supplier = await prisma.supplier.findUnique({
      where: {
        id: supplierId,
      },
    });

    if (!supplier) {
      return NextResponse.json(
        { message: "거래처를 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    return NextResponse.json(supplier);
  } catch (error) {
    console.error("거래처 상세 조회 오류:", error);

    return NextResponse.json(
      { message: "거래처 정보를 불러오지 못했습니다." },
      { status: 500 }
    );
  }
}

// 거래처 수정
export async function PUT(
  request: Request,
  context: RouteContext
) {
  try {
    const { id } = await context.params;
    const supplierId = Number(id);
    const body = await request.json();

    if (!supplierId || Number.isNaN(supplierId)) {
      return NextResponse.json(
        { message: "올바른 거래처 ID가 아닙니다." },
        { status: 400 }
      );
    }

    const updatedSupplier = await prisma.supplier.update({
      where: {
        id: supplierId,
      },
      data: {
        code: body.code,
        name: body.name,
        businessNumber: body.businessNumber || null,
        representative: body.representative || null,
        phone: body.phone || null,
        email: body.email || null,
        address: body.address || null,
        contactName: body.contactName || null,
        contactPhone: body.contactPhone || null,
        bankName: body.bankName || null,
        bankAccount: body.bankAccount || null,
        accountHolder: body.accountHolder || null,
        memo: body.memo || null,
        isActive:
          typeof body.isActive === "boolean"
            ? body.isActive
            : true,
      },
    });

    return NextResponse.json(updatedSupplier);
  } catch (error) {
    console.error("거래처 수정 오류:", error);

    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "거래처 수정에 실패했습니다.",
      },
      { status: 500 }
    );
  }
}

// 거래처 삭제 / 관리자 강제삭제
export async function DELETE(
  request: Request,
  context: RouteContext
) {
  try {
    const { id } = await context.params;
    const supplierId = Number(id);
    const { searchParams } = new URL(request.url);
    const force = searchParams.get("force") === "true";

    if (!supplierId || Number.isNaN(supplierId)) {
      return NextResponse.json(
        { message: "올바른 거래처 ID가 아닙니다." },
        { status: 400 }
      );
    }

    const supplier = await prisma.supplier.findUnique({
      where: {
        id: supplierId,
      },
    });

    if (!supplier) {
      return NextResponse.json(
        { message: "거래처를 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    const [purchaseCount, purchaseOrderCount] =
      await Promise.all([
        prisma.purchase.count({
          where: {
            supplierId,
          },
        }),
        prisma.purchaseOrder.count({
          where: {
            supplierId,
          },
        }),
      ]);

    // 일반 삭제
    if (!force) {
      if (purchaseCount > 0 || purchaseOrderCount > 0) {
        return NextResponse.json(
          {
            message:
              `이 거래처는 매입 ${purchaseCount}건, 발주 ${purchaseOrderCount}건과 연결되어 있어 삭제할 수 없습니다.\n` +
              "삭제 대신 '사용중지'로 변경하거나 관리자 강제삭제를 사용해주세요.",
          },
          { status: 400 }
        );
      }

      await prisma.supplier.delete({
        where: {
          id: supplierId,
        },
      });

      return NextResponse.json({
        message: "거래처가 삭제되었습니다.",
      });
    }

    // 관리자 강제삭제 권한 확인
    const sessionUser = await getCurrentSessionUser();

    if (!sessionUser) {
      return NextResponse.json(
        { message: "로그인이 필요합니다." },
        { status: 401 }
      );
    }

    if (sessionUser.role !== "ADMIN") {
      return NextResponse.json(
        { message: "관리자만 강제삭제할 수 있습니다." },
        { status: 403 }
      );
    }

    await prisma.$transaction(async (tx) => {
      await tx.purchase.deleteMany({
        where: {
          supplierId,
        },
      });

      await tx.purchaseOrder.deleteMany({
        where: {
          supplierId,
        },
      });

      await tx.supplier.delete({
        where: {
          id: supplierId,
        },
      });
    });

    return NextResponse.json({
      message:
        `관리자 강제삭제가 완료되었습니다.\n` +
        `삭제된 연결 기록: 매입 ${purchaseCount}건, 발주 ${purchaseOrderCount}건`,
    });
  } catch (error) {
    console.error("거래처 삭제 오류:", error);

    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "거래처 삭제에 실패했습니다.",
      },
      { status: 500 }
    );
  }
}

// 거래처 사용중 / 사용중지 변경
export async function PATCH(
  request: Request,
  context: RouteContext
) {
  try {
    const { id } = await context.params;
    const supplierId = Number(id);
    const body = await request.json();

    if (!supplierId || Number.isNaN(supplierId)) {
      return NextResponse.json(
        { message: "올바른 거래처 ID가 아닙니다." },
        { status: 400 }
      );
    }

    if (typeof body.isActive !== "boolean") {
      return NextResponse.json(
        { message: "사용 여부 값이 올바르지 않습니다." },
        { status: 400 }
      );
    }

    const supplier = await prisma.supplier.update({
      where: {
        id: supplierId,
      },
      data: {
        isActive: body.isActive,
      },
    });

    return NextResponse.json(supplier);
  } catch (error) {
    console.error("거래처 상태 변경 오류:", error);

    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "거래처 상태 변경에 실패했습니다.",
      },
      { status: 500 }
    );
  }
}