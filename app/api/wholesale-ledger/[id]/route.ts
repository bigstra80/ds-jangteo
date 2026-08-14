import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentSessionUser } from "@/lib/auth";
import { resolveLedgerSaleAmount } from "@/lib/wholesale-ledger-sale-price";
import {
  calculateRegisteredProductPurchaseAmount,
  hasRegisteredProductId,
  PurchaseAmountResolutionError,
} from "@/lib/wholesale-ledger-purchase-amount";
import {
  LedgerProductResolutionError,
  resolveLedgerProduct,
} from "@/lib/wholesale-ledger-product";

function toInt(value: unknown, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.trunc(number) : fallback;
}

function toOneDecimal(value: unknown, fallback = 0) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.round(number * 10) / 10;
}

function toNullableText(value: unknown) {
  const text = String(value ?? "").trim();
  return text ? text : null;
}

function parseId(value: string) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function requiredNumber(value: unknown) {
  if (
    (typeof value !== "string" && typeof value !== "number") ||
    String(value).trim() === ""
  ) {
    return null;
  }

  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const sessionUser = await getCurrentSessionUser();
    if (!sessionUser) {
      return NextResponse.json(
        { error: "로그인이 필요합니다." },
        { status: 401 }
      );
    }

    if (sessionUser.role !== "ADMIN") {
      return NextResponse.json(
        { error: "매입금액은 관리자만 수정할 수 있습니다." },
        { status: 403 }
      );
    }

    const { id: idText } = await context.params;
    const id = parseId(idText);
    if (!id) {
      return NextResponse.json(
        { error: "올바르지 않은 거래 번호입니다." },
        { status: 400 }
      );
    }

    const body = await request.json();
    const rawPurchaseAmount = body.purchaseAmount;
    if (
      (typeof rawPurchaseAmount !== "string" &&
        typeof rawPurchaseAmount !== "number") ||
      rawPurchaseAmount === null ||
      rawPurchaseAmount === undefined ||
      String(rawPurchaseAmount).trim() === ""
    ) {
      return NextResponse.json(
        { error: "매입금액을 입력해 주세요." },
        { status: 400 }
      );
    }

    const purchaseAmount = Number(rawPurchaseAmount);
    if (!Number.isFinite(purchaseAmount)) {
      return NextResponse.json(
        { error: "매입금액은 올바른 숫자로 입력해 주세요." },
        { status: 400 }
      );
    }

    const existingRow = await prisma.wholesaleLedger.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!existingRow) {
      return NextResponse.json(
        { error: "수정할 거래를 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    const row = await prisma.wholesaleLedger.update({
      where: { id },
      data: {
        purchaseAmount: Math.round(purchaseAmount * 10) / 10,
      },
    });

    return NextResponse.json({ row });
  } catch (error) {
    console.error("매입금액 수정 오류:", error);
    return NextResponse.json(
      { error: "매입금액을 수정하지 못했습니다." },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const sessionUser = await getCurrentSessionUser();
    if (!sessionUser) {
      return NextResponse.json(
        { error: "로그인이 필요합니다." },
        { status: 401 }
      );
    }

    const { id: idText } = await context.params;
    const id = parseId(idText);

    if (!id) {
      return NextResponse.json(
        { error: "잘못된 거래 번호입니다." },
        { status: 400 }
      );
    }

    const body = await request.json();

    const resolvedProduct = await resolveLedgerProduct(body);
    const productName = resolvedProduct.productName;

    if (!productName) {
      return NextResponse.json(
        { error: "상품명을 입력해주세요." },
        { status: 400 }
      );
    }

    const transactionDateText = String(body.transactionDate ?? "").trim();
    const transactionDate = transactionDateText
      ? new Date(`${transactionDateText}T00:00:00`)
      : new Date();

    const parsedQuantity = requiredNumber(body.quantity);
    if (parsedQuantity === null || !Number.isInteger(parsedQuantity)) {
      return NextResponse.json(
        { error: "수량을 올바르게 입력해주세요." },
        { status: 400 }
      );
    }
    const quantity = toInt(parsedQuantity, 1);

    const parsedPurchaseAmount = requiredNumber(body.purchaseAmount);
    if (parsedPurchaseAmount === null) {
      return NextResponse.json(
        { error: "단가를 올바르게 입력해주세요." },
        { status: 400 }
      );
    }
    const resolvedBody = { ...body, productId: resolvedProduct.productId };
    const purchaseAmount =
      sessionUser.role !== "ADMIN" &&
      hasRegisteredProductId(resolvedProduct.productId)
        ? await calculateRegisteredProductPurchaseAmount(resolvedBody, quantity)
        : toOneDecimal(parsedPurchaseAmount);

    const saleValue =
      body.saleUnitPrice !== undefined &&
      body.saleUnitPrice !== null &&
      body.saleUnitPrice !== ""
        ? body.saleUnitPrice
        : body.saleAmount;
    if (requiredNumber(saleValue) === null) {
      return NextResponse.json(
        { error: "판매금액을 올바르게 입력해주세요." },
        { status: 400 }
      );
    }

    const parsedShippingFee = requiredNumber(body.shippingFee);
    if (parsedShippingFee === null) {
      return NextResponse.json(
        { error: "배송비를 올바르게 입력해주세요." },
        { status: 400 }
      );
    }
    const row = await prisma.wholesaleLedger.update({
      where: { id },
      data: {
        transactionDate,
        productId: resolvedProduct.productId,
        productCode: resolvedProduct.productCode,
        productName,

        // 반품 처리를 위해 음수 수량 허용
        quantity,

        supplierName: toNullableText(body.supplierName),
        purchaseAmount,

        // 음수 매입금액 그대로 유지
        deliveryCompanyName: toNullableText(body.deliveryCompanyName),
        customerName: toNullableText(body.customerName),
        customerPhone: toNullableText(body.customerPhone),

        // 수정 폼에서도 단가 × 수량을 총 판매금액으로 저장합니다.
        saleAmount: await resolveLedgerSaleAmount(resolvedBody, quantity),
        shippingFee: toOneDecimal(parsedShippingFee),

        settlementStatus:
          String(body.settlementStatus ?? "").trim() || "미정산",

        memo: toNullableText(body.memo),
      },
    });

    return NextResponse.json({ row });
  } catch (error) {
    if (error instanceof LedgerProductResolutionError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    if (error instanceof PurchaseAmountResolutionError) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    console.error("도매 거래 수정 오류:", error);

    return NextResponse.json(
      { error: "거래를 수정하지 못했습니다." },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: idText } = await context.params;
    const id = parseId(idText);

    if (!id) {
      return NextResponse.json(
        { error: "잘못된 거래 번호입니다." },
        { status: 400 }
      );
    }

    await prisma.wholesaleLedger.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("도매 거래 삭제 오류:", error);

    return NextResponse.json(
      { error: "거래를 삭제하지 못했습니다." },
      { status: 500 }
    );
  }
}
