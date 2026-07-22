import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth";

const pagePermissions: Record<string, string> = {
  "/wholesale-ledger": "wholesale-ledger",
  "/products": "products",
  "/stock": "stock",
  "/shipment": "shipment",
  "/stock-history": "stock-history",
  "/safety-stock": "safety-stock",
  "/purchase-orders": "purchase-orders",
  "/purchases": "purchases",
  "/order": "order",
  "/delivery": "delivery",
  "/returns": "returns",
  "/suppliers": "suppliers",
  "/customers": "customers",
  "/sales": "sales",
  "/statistics": "statistics",
  "/excel": "excel",
  "/users": "users",
};

const apiPermissions: Record<string, string> = {
  "/api/wholesale-ledger": "wholesale-ledger",
  "/api/product": "products",
  "/api/stock": "stock",
  "/api/shipment": "shipment",
  "/api/stock-history": "stock-history",
  "/api/safety-stock": "safety-stock",
  "/api/purchase-order": "purchase-orders",
  "/api/purchase": "purchases",
  "/api/order": "order",
  "/api/delivery": "delivery",
  "/api/returns": "returns",
  "/api/supplier": "suppliers",
  "/api/customers": "customers",
  "/api/sales": "sales",
  "/api/statistics": "statistics",
  "/api/export": "excel",
  "/api/import": "excel",
  "/api/users": "users",
};

const permissionPages: Array<[string, string]> = [
  ["wholesale-ledger", "/wholesale-ledger"],
  ["products", "/products"],
  ["stock", "/stock"],
  ["shipment", "/shipment"],
  ["stock-history", "/stock-history"],
  ["safety-stock", "/safety-stock"],
  ["purchase-orders", "/purchase-orders"],
  ["purchases", "/purchases"],
  ["order", "/order"],
  ["delivery", "/delivery"],
  ["returns", "/returns"],
  ["suppliers", "/suppliers"],
  ["customers", "/customers"],
  ["sales", "/sales"],
  ["statistics", "/statistics"],
  ["excel", "/excel"],
];

function requiredPermission(pathname: string, map: Record<string, string>) {
  const match = Object.entries(map).find(
    ([path]) => pathname === path || pathname.startsWith(`${path}/`)
  );
  return match?.[1];
}

function firstAllowedPage(role: string, permissions: string[]) {
  if (role === "ADMIN") return "/wholesale-ledger";

  const match = permissionPages.find(([permission]) =>
    permissions.includes(permission)
  );

  return match?.[1] ?? "/login";
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname === "/login" || pathname.startsWith("/api/auth/")) {
    return NextResponse.next();
  }

  const session = await verifySessionToken(
    request.cookies.get(SESSION_COOKIE)?.value
  );

  if (!session) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { message: "로그인이 필요합니다." },
        { status: 401 }
      );
    }

    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (pathname === "/") {
    return NextResponse.redirect(
      new URL(firstAllowedPage(session.role, session.permissions), request.url)
    );
  }

  const permission = pathname.startsWith("/api/")
    ? requiredPermission(pathname, apiPermissions)
    : requiredPermission(pathname, pagePermissions);

  const denied =
    permission &&
    session.role !== "ADMIN" &&
    !session.permissions.includes(permission);

  if (denied) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { message: "이 기능을 사용할 권한이 없습니다." },
        { status: 403 }
      );
    }

    const fallback = firstAllowedPage(session.role, session.permissions);

    // 자기 자신으로 다시 보내는 무한 리디렉션 방지
    if (fallback === pathname || fallback === "/login") {
      return NextResponse.redirect(new URL("/login", request.url));
    }

    return NextResponse.redirect(new URL(fallback, request.url));
  }

  if (
    (pathname === "/users" || pathname.startsWith("/api/users")) &&
    session.role !== "ADMIN"
  ) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { message: "관리자 권한이 필요합니다." },
        { status: 403 }
      );
    }

    const fallback = firstAllowedPage(session.role, session.permissions);
    return NextResponse.redirect(new URL(fallback, request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};