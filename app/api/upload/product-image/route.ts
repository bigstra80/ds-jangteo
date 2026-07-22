import { NextResponse } from "next/server";
import crypto from "crypto";

export const runtime = "nodejs";

const MAX_FILE_SIZE = 10 * 1024 * 1024;

const allowedTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

function makeSignature(params: Record<string, string>, apiSecret: string) {
  const payload = Object.entries(params)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join("&");

  return crypto
    .createHash("sha1")
    .update(`${payload}${apiSecret}`)
    .digest("hex");
}

export async function POST(request: Request) {
  try {
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;

    if (!cloudName || !apiKey || !apiSecret) {
      console.error("Cloudinary 환경변수가 설정되지 않았습니다.");

      return NextResponse.json(
        {
          message:
            "이미지 저장소 설정이 필요합니다. Render 환경변수에 CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET을 등록해주세요.",
        },
        { status: 500 }
      );
    }

    const requestFormData = await request.formData();
    const file = requestFormData.get("file");

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

    const timestamp = Math.floor(Date.now() / 1000).toString();
    const folder = "erp/products";

    const signature = makeSignature(
      {
        folder,
        timestamp,
      },
      apiSecret
    );

    const cloudinaryFormData = new FormData();
    cloudinaryFormData.append("file", file);
    cloudinaryFormData.append("api_key", apiKey);
    cloudinaryFormData.append("timestamp", timestamp);
    cloudinaryFormData.append("folder", folder);
    cloudinaryFormData.append("signature", signature);

    const cloudinaryResponse = await fetch(
      `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
      {
        method: "POST",
        body: cloudinaryFormData,
      }
    );

    const result = await cloudinaryResponse.json();

    if (!cloudinaryResponse.ok) {
      console.error("Cloudinary 업로드 오류:", result);

      return NextResponse.json(
        {
          message:
            result?.error?.message ||
            "외부 이미지 저장소 업로드에 실패했습니다.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      url: result.secure_url,
      publicId: result.public_id,
    });
  } catch (error) {
    console.error("상품 이미지 업로드 오류:", error);

    return NextResponse.json(
      { message: "이미지 업로드에 실패했습니다." },
      { status: 500 }
    );
  }
}
