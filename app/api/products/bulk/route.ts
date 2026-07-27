import { NextResponse } from "next/server";
import { getCurrentSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type BulkProductInput = {
  id?: unknown;
  supplierId?: unknown;
  cost?: unknown;
  price?: unknown;
};

function nullableId(value: unknown) {
  if (value === "" || value === null || value === undefined) return null;
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : null;
}

function nullablePrice(value: unknown, label: string) {
  if (value === "" || value === null || value === undefined) return null;
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) {
    throw new Error(`${label}를 확인해 주세요.`);
  }
  return Math.round(number * 10) / 10;
}

export async function PATCH(request: Request) {
  const sessionUser = await getCurrentSessionUser();
  if (!sessionUser) {
    return NextResponse.json(
      { message: "로그인이 필요합니다." },
      { status: 401 }
    );
  }

  const body = await request.json();
  const inputs = Array.isArray(body.products)
    ? (body.products as BulkProductInput[])
    : [];

  if (inputs.length === 0) {
    return NextResponse.json({ results: [] });
  }

  const isAdmin = sessionUser.role === "ADMIN";
  const results: Array<
    | { id: number; success: true; product: unknown }
    | { id: number; success: false; reason: string }
  > = [];

  for (const input of inputs) {
    const id = Number(input.id);

    if (!Number.isInteger(id) || id <= 0) {
      results.push({ id: Number.isFinite(id) ? id : 0, success: false, reason: "상품 ID가 올바르지 않습니다." });
      continue;
    }

    try {
      const existing = await prisma.product.findUnique({
        where: { id },
        select: {
          supplierId: true,
          supplier2Id: true,
          supplier3Id: true,
          cost: true,
          cost2: true,
          cost3: true,
        },
      });

      if (!existing) {
        throw new Error("상품을 찾을 수 없습니다.");
      }

      const requestedSupplierId = nullableId(input.supplierId);
      let supplierId = requestedSupplierId;
      let supplier2Id = existing.supplier2Id;
      let supplier3Id = existing.supplier3Id;
      let cost = existing.cost;
      let cost2 = existing.cost2;
      let cost3 = existing.cost3;

      if (requestedSupplierId && requestedSupplierId === existing.supplier2Id) {
        supplierId = existing.supplier2Id;
        supplier2Id = existing.supplierId;
        cost = existing.cost2;
        cost2 = existing.cost;
      } else if (
        requestedSupplierId &&
        requestedSupplierId === existing.supplier3Id
      ) {
        supplierId = existing.supplier3Id;
        supplier3Id = existing.supplierId;
        cost = existing.cost3;
        cost3 = existing.cost;
      }

      if (isAdmin) {
        cost = nullablePrice(input.cost, "대표 매입단가");
      }
      const price = nullablePrice(input.price, "판매단가");

      const product = await prisma.product.update({
        where: { id },
        data: {
          supplierId,
          supplier2Id,
          supplier3Id,
          cost,
          cost2,
          cost3,
          price,
        },
        include: {
          supplier: true,
          supplier2: true,
          supplier3: true,
          skus: true,
        },
      });

      results.push({
        id,
        success: true,
        product: isAdmin
          ? product
          : { ...product, cost: null, cost2: null, cost3: null },
      });
    } catch (error) {
      results.push({
        id,
        success: false,
        reason: error instanceof Error ? error.message : "저장에 실패했습니다.",
      });
    }
  }

  return NextResponse.json({ results });
}
