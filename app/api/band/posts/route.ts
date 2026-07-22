import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const accessToken = process.env.BAND_ACCESS_TOKEN;
  const bandKey = request.nextUrl.searchParams.get("bandKey");

  if (!accessToken) {
    return NextResponse.json(
      { message: "BAND_ACCESS_TOKEN이 설정되지 않았습니다." },
      { status: 400 }
    );
  }

  if (!bandKey) {
    return NextResponse.json(
      { message: "밴드를 먼저 선택해주세요." },
      { status: 400 }
    );
  }

  try {
    const url = new URL("https://openapi.band.us/v2/band/posts");
    url.searchParams.set("access_token", accessToken);
    url.searchParams.set("band_key", bandKey);
    url.searchParams.set("locale", "ko_KR");

    const response = await fetch(url, { cache: "no-store" });
    const data = await response.json();

    if (!response.ok || data?.result_code !== 1) {
      return NextResponse.json(
        {
          message:
            data?.result_data?.message ||
            data?.message ||
            "밴드 게시글을 불러오지 못했습니다.",
          raw: data,
        },
        { status: 502 }
      );
    }

    return NextResponse.json({
      posts: Array.isArray(data?.result_data?.items)
        ? data.result_data.items
        : [],
    });
  } catch (error) {
    console.error("BAND 게시글 조회 오류:", error);

    return NextResponse.json(
      { message: "BAND 게시글 조회 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
