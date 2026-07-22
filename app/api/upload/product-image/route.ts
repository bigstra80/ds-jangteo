import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import crypto from "crypto";

const MAX_FILE_SIZE = 10 * 1024 * 1024;

const allowedTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

function extensionFromType(type: string) {
  if (type === "image/jpeg") return "jpg";
  if (type === "image/png") return "png";
  if (type === "image/webp") return "webp";
  if (type === "image/gif") return "gif";
  return "bin";
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json(
        { message: "이미지 파일을 선택해주세요." },
        { status: 400 }
      );
    }

    if (!allowedTypes.has(file.type)) {
      return NextResponse.json(
        { message: "JPG, PNG, WEBP, GIF 이미지만 업로드할 수 있습니다." },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { message: "이미지는 10MB 이하만 업로드할 수 있습니다." },
        { status: 400 }
      );
    }

    const bytes = Buffer.from(await file.arrayBuffer());
    const uploadDir = path.join(process.cwd(), "public", "uploads", "products");

    await fs.mkdir(uploadDir, {
      recursive: true,
    });

    const fileName = `${Date.now()}-${crypto.randomUUID()}.${extensionFromType(
      file.type
    )}`;

    const filePath = path.join(uploadDir, fileName);

    await fs.writeFile(filePath, bytes);

    return NextResponse.json({
      url: `/uploads/products/${fileName}`,
    });
  } catch (error) {
    console.error("상품 이미지 업로드 오류:", error);

    return NextResponse.json(
      { message: "이미지 업로드에 실패했습니다." },
      { status: 500 }
    );
  }
}