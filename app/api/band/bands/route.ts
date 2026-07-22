import { NextResponse } from "next/server";

export async function GET() {
  const accessToken = process.env.BAND_ACCESS_TOKEN;

  if (!accessToken) {
    return NextResponse.json(
      {
        message:
          "BAND_ACCESS_TOKEN이 설정되지 않았습니다. 프로젝트의 .env 파일에 BAND_ACCESS_TOKEN을 추가해주세요.",
      },
      { status: 400 }
    );
  }

  try {
    const url = new URL("https://openapi.band.us/v2.1/bands");
    url.searchParams.set("access_token", accessToken);

    const response = await fetch(url, { cache: "no-store" });
    const data = await response.json();

    if (!response.ok || data?.result_code !== 1) {
      return NextResponse.json(
        {
          message:
            data?.result_data?.message ||
            data?.message ||
            "가입한 밴드 목록을 불러오지 못했습니다.",
          raw: data,
        },
        { status: 502 }
      );
    }

    return NextResponse.json({
      bands: Array.isArray(data?.result_data?.bands)
        ? data.result_data.bands
        : [],
    });
  } catch (error) {
    console.error("BAND 목록 조회 오류:", error);

    return NextResponse.json(
      { message: "BAND 서버 연결 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
