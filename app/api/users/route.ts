import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth";
import { hashPassword } from "@/lib/password";

async function requireAdmin() {
  const store = await cookies();
  const session = await verifySessionToken(store.get(SESSION_COOKIE)?.value);
  return session?.role === "ADMIN" ? session : null;
}

export async function GET() {
  if (!(await requireAdmin())) return NextResponse.json({ message: "권한이 없습니다." }, { status: 403 });
  const users = await prisma.user.findMany({ orderBy: { id: "asc" } });
  return NextResponse.json(users.map(({ passwordHash, ...user }) => ({ ...user, permissions: JSON.parse(user.permissions || "[]") })));
}

export async function POST(request: Request) {
  if (!(await requireAdmin())) return NextResponse.json({ message: "권한이 없습니다." }, { status: 403 });
  try {
    const body = await request.json();
    if (!body.username || !body.password || !body.name) {
      return NextResponse.json({ message: "이름, 아이디, 비밀번호는 필수입니다." }, { status: 400 });
    }
    const user = await prisma.user.create({
      data: {
        username: body.username.trim(),
        passwordHash: hashPassword(body.password),
        name: body.name.trim(),
        role: body.role === "ADMIN" ? "ADMIN" : "STAFF",
        permissions: JSON.stringify(body.permissions || []),
        isActive: body.isActive !== false,
      },
    });
    return NextResponse.json({ id: user.id });
  } catch (error: any) {
    return NextResponse.json({ message: error?.code === "P2002" ? "이미 사용 중인 아이디입니다." : "직원 계정을 저장하지 못했습니다." }, { status: 400 });
  }
}

export async function PATCH(request: Request) {
  if (!(await requireAdmin())) return NextResponse.json({ message: "권한이 없습니다." }, { status: 403 });
  const body = await request.json();
  const id = Number(body.id);
  const data: any = {
    name: body.name,
    role: body.role === "ADMIN" ? "ADMIN" : "STAFF",
    permissions: JSON.stringify(body.permissions || []),
    isActive: body.isActive !== false,
  };
  if (body.password) data.passwordHash = hashPassword(body.password);
  await prisma.user.update({ where: { id }, data });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ message: "권한이 없습니다." }, { status: 403 });
  const { id } = await request.json();
  if (Number(id) === admin.id) return NextResponse.json({ message: "현재 로그인한 관리자 계정은 삭제할 수 없습니다." }, { status: 400 });
  await prisma.user.delete({ where: { id: Number(id) } });
  return NextResponse.json({ ok: true });
}
