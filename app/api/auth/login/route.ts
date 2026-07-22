import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSessionToken, SESSION_COOKIE } from "@/lib/auth";
import { hashPassword, verifyPassword } from "@/lib/password";

const ALL_PERMISSIONS = [
  "wholesale-ledger", "products", "stock", "shipment", "stock-history", "safety-stock",
  "purchase-orders", "purchases", "order", "delivery", "returns", "suppliers",
  "customers", "sales", "statistics", "excel", "users"
];

export async function POST(request: Request) {
  try {
    const { username, password } = await request.json();
    if (!username || !password) {
      return NextResponse.json({ message: "아이디와 비밀번호를 입력해주세요." }, { status: 400 });
    }

    let user = await prisma.user.findUnique({ where: { username } });
    const userCount = await prisma.user.count();

    if (!user && userCount === 0 && username === "admin" && password === "1234") {
      user = await prisma.user.create({
        data: {
          username: "admin",
          passwordHash: hashPassword("1234"),
          name: "관리자",
          role: "ADMIN",
          permissions: JSON.stringify(ALL_PERMISSIONS),
        },
      });
    }

    if (!user || !user.isActive || !verifyPassword(password, user.passwordHash)) {
      return NextResponse.json({ message: "아이디 또는 비밀번호가 올바르지 않습니다." }, { status: 401 });
    }

    const permissions = user.role === "ADMIN" ? ALL_PERMISSIONS : JSON.parse(user.permissions || "[]");
    const token = await createSessionToken({
      id: user.id,
      username: user.username,
      name: user.name,
      role: user.role as "ADMIN" | "STAFF",
      permissions,
    });

    const response = NextResponse.json({ ok: true });
    response.cookies.set(SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 12,
    });
    return response;
  } catch (error) {
    console.error(error);
    return NextResponse.json({ message: "로그인 중 오류가 발생했습니다." }, { status: 500 });
  }
}
