import { NextResponse } from "next/server";
import { getCurrentSessionUser } from "@/lib/auth";

export async function GET() {
  try {
    const user = await getCurrentSessionUser();

    if (!user) {
      return NextResponse.json(
        {
          message: "로그인이 필요합니다.",
          user: null,
        },
        {
          status: 401,
        }
      );
    }

    return NextResponse.json({
      user,
      isAdmin: user.role === "ADMIN",
    });
  } catch (error) {
    console.error("현재 사용자 조회 오류:", error);

    return NextResponse.json(
      {
        message: "현재 사용자 정보를 불러오지 못했습니다.",
        user: null,
      },
      {
        status: 500,
      }
    );
  }
}