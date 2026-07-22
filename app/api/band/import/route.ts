import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { mkdir, writeFile } from "fs/promises";
import path from "path";

function makeList(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function makeSkuCode(productCode: string, color: string, size: string) {
  return `${productCode}-${color}-${size}`;
}

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function nullableNumber(value: unknown) {
  if (value === "" || value === null || value === undefined) return null;

  const number = Number(value);
  return Number.isFinite(number) ? Math.trunc(number) : null;
}

function nullableId(value: unknown) {
  if (value === "" || value === null || value === undefined) return null;

  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : null;
}

function getImageExtension(contentType: string, url: string) {
  if (contentType.includes("png")) return ".png";
  if (contentType.includes("webp")) return ".webp";
  if (contentType.includes("gif")) return ".gif";
  if (contentType.includes("jpeg") || contentType.includes("jpg")) return ".jpg";

  try {
    const pathname = new URL(url).pathname.toLowerCase();
    const extension = path.extname(pathname);
    if ([".jpg", ".jpeg", ".png", ".webp", ".gif"].includes(extension)) {
      return extension === ".jpeg" ? ".jpg" : extension;
    }
  } catch {
    // URL 파싱 실패 시 jpg 사용
  }

  return ".jpg";
}

async function saveBandImage(imageUrl: string, productCode: string) {
  if (!imageUrl) return null;

  try {
    const response = await fetch(imageUrl, {
      cache: "no-store",
      headers: {
        "User-Agent": "Mozilla/5.0",
      },
    });

    if (!response.ok) {
      console.warn("BAND 이미지 다운로드 실패:", response.status, imageUrl);
      return imageUrl;
    }

    const contentType = response.headers.get("content-type") || "";
    const extension = getImageExtension(contentType, imageUrl);
    const safeCode = productCode.replace(/[^a-zA-Z0-9_-]/g, "_");
    const filename = `band-${safeCode}-${Date.now()}${extension}`;

    const uploadDir = path.join(
      process.cwd(),
      "public",
      "uploads",
      "products"
    );

    await mkdir(uploadDir, { recursive: true });

    const buffer = Buffer.from(await response.arrayBuffer());
    await writeFile(path.join(uploadDir, filename), buffer);

    return `/uploads/products/${filename}`;
  } catch (error) {
    console.error("BAND 이미지 저장 오류:", error);

    // 로컬 저장 실패 시 BAND 원본 URL이라도 유지
    return imageUrl;
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const code = normalizeText(body.code);
    const name = normalizeText(body.name);
    const colorsText = normalizeText(body.colors);
    const sizesText = normalizeText(body.sizes);
    const bandPostId = normalizeText(body.bandPostId);
    const bandPostUrl = normalizeText(body.bandPostUrl);
    const imageUrl = normalizeText(body.imageUrl);
    const supplierId = nullableId(body.supplierId);
    const cost = nullableNumber(body.cost);

    if (!code || !name || !colorsText || !sizesText || !bandPostId) {
      return NextResponse.json(
        {
          message:
            "상품코드, 상품명, 색상, 사이즈, 밴드 게시글 ID가 필요합니다.",
        },
        { status: 400 }
      );
    }

    const colors = makeList(colorsText);
    const sizes = makeList(sizesText);

    const savedImageUrl = imageUrl
      ? await saveBandImage(imageUrl, code)
      : null;

    const existing = await prisma.product.findFirst({
      where: {
        OR: [{ bandPostId }, { code }],
      },
      include: { skus: true },
    });

    if (!existing) {
      const product = await prisma.product.create({
        data: {
          code,
          name,
          brand: null,
          category: null,
          colors: colorsText,
          sizes: sizesText,
          cost,
          cost2: null,
          cost3: null,
          price: null,
          imageUrl: savedImageUrl || null,
          productType: "DIRECT",
          sourceProductName: name,
          bandPostId,
          bandPostUrl: bandPostUrl || null,
          isBandImported: true,
          supplierId,
          skus: {
            create: colors.flatMap((color) =>
              sizes.map((size) => ({
                sku: makeSkuCode(code, color, size),
                color,
                size,
                stock: 0,
              }))
            ),
          },
        },
        include: {
          supplier: true,
          supplier2: true,
          supplier3: true,
          skus: true,
        },
      });

      return NextResponse.json({
        mode: "created",
        product,
      });
    }

    await prisma.product.update({
      where: { id: existing.id },
      data: {
        code,
        name,
        colors: colorsText,
        sizes: sizesText,
        imageUrl: savedImageUrl || existing.imageUrl,
        sourceProductName: name,
        bandPostId,
        bandPostUrl: bandPostUrl || existing.bandPostUrl,
        isBandImported: true,
        ...(supplierId !== null ? { supplierId } : {}),
        ...(cost !== null ? { cost } : {}),
      },
    });

    const wantedSkuCodes = new Set(
      colors.flatMap((color) =>
        sizes.map((size) => makeSkuCode(code, color, size))
      )
    );

    for (const color of colors) {
      for (const size of sizes) {
        const sku = makeSkuCode(code, color, size);

        const found = existing.skus.find((item) => item.sku === sku);

        if (!found) {
          await prisma.productSku.create({
            data: {
              productId: existing.id,
              sku,
              color,
              size,
              stock: 0,
            },
          });
        }
      }
    }

    const product = await prisma.product.findUnique({
      where: { id: existing.id },
      include: {
        supplier: true,
        supplier2: true,
        supplier3: true,
        skus: true,
      },
    });

    return NextResponse.json({
      mode: "updated",
      product,
      wantedSkuCount: wantedSkuCodes.size,
    });
  } catch (error) {
    console.error("BAND 상품 등록/업데이트 오류:", error);

    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "밴드 상품 등록 중 오류가 발생했습니다.",
      },
      { status: 500 }
    );
  }
}
