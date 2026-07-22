import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type StatusItem = {
  postKey?: string;
  code?: string;
  bandPostId?: string;
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const items: StatusItem[] = Array.isArray(body?.items) ? body.items : [];

    const statuses: Record<
      string,
      {
        exists: boolean;
        productId?: number;
        code?: string;
        name?: string;
      }
    > = {};

    for (const item of items) {
      const postKey = String(item.postKey || "");
      const code = String(item.code || "").trim();
      const bandPostId = String(item.bandPostId || "").trim();

      if (!postKey) continue;

      if (!code && !bandPostId) {
        statuses[postKey] = { exists: false };
        continue;
      }

      const product = await prisma.product.findFirst({
        where: {
          OR: [
            ...(code ? [{ code }] : []),
            ...(bandPostId ? [{ bandPostId }] : []),
          ],
        },
        select: {
          id: true,
          code: true,
          name: true,
        },
      });

      statuses[postKey] = product
        ? {
            exists: true,
            productId: product.id,
            code: product.code,
            name: product.name,
          }
        : {
            exists: false,
          };
    }

    return NextResponse.json({ statuses });
  } catch (error) {
    console.error("BAND 기존 상품 상태 확인 오류:", error);

    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "기존 상품 상태 확인 중 오류가 발생했습니다.",
      },
      { status: 500 }
    );
  }
}
