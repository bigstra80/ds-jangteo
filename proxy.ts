import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth";

const pagePermissions: Record<string, string> = {
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
  "/wholesale-ledger": "wholesale-ledger",
  "/customer-settlement": "customer-settlement",
  "/supplier-settlement": "supplier-settlement",
  "/broker-purchases": "broker-purchases",
  "/customer-prices": "customer-prices",
  "/band-import": "band-import",
};

const apiPermissions: Record<string, string> = {
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
  "/api/suppliers": "suppliers",
  "/api/customers": "customers",
  "/api/sales": "sales",
  "/api/statistics": "statistics",
  "/api/export": "excel",
  "/api/import": "excel",
  "/api/wholesale-ledger": "wholesale-ledger",
  "/api/customer-settlement": "customer-settlement",
  "/api/supplier-settlement": "supplier-settlement",
  "/api/broker-purchase-requests": "broker-purchases",
  "/api/customer-prices": "customer-prices",
  "/api/band": "band-import",
};

const permissionPages: Array<[string, string]> = [
  ["wholesale-ledger", "/wholesale-ledger"],
  ["products", "/products"],
  ["customer-settlement", "/customer-settlement"],
  ["supplier-settlement", "/supplier-settlement"],
  ["broker-purchases", "/broker-purchases"],
  ["customer-prices", "/customer-prices"],
  ["band-import", "/band-import"],
  ["suppliers", "/suppliers"],
  ["customers", "/customers"],
];

function requiredPermission(pathname: string, map: Record<string, string>) {
  const match = Object.entries(map).find(
    ([path]) => pathname === path || pathname.startsWith(`${path}/`)
  );

  return match?.[1];
}

function firstAllowedPage(role: string, permissions: string[]) {
  // 대시보드를 삭제했으므로 관리자의 첫 화면은 도매 한 줄 장부로 이동합니다.
  if (role === "ADMIN") {
    return "/wholesale-ledger";
  }

  const match = permissionPages.find(([permission]) =>
    permissions.includes(permission)
  );

  return match?.[1] ?? "/login";
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 로그인 및 인증 API는 항상 통과
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

  // 관리자 전용 사용자 권한 페이지/API를 먼저 처리합니다.
  // 기존처럼 일반 메뉴 권한 검사에 섞이지 않게 하여
  // 사용자 권한 클릭 시 로그인 페이지로 잘못 이동하는 문제를 방지합니다.
  if (pathname === "/users" || pathname.startsWith("/users/")) {
    if (session.role === "ADMIN") {
      return NextResponse.next();
    }

    return NextResponse.redirect(
      new URL(firstAllowedPage(session.role, session.permissions), request.url)
    );
  }

  if (pathname === "/api/users" || pathname.startsWith("/api/users/")) {
    if (session.role === "ADMIN") {
      return NextResponse.next();
    }

    return NextResponse.json(
      { message: "관리자 권한이 필요합니다." },
      { status: 403 }
    );
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
    Boolean(permission) &&
    session.role !== "ADMIN" &&
    !session.permissions.includes(permission as string);

  if (denied) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { message: "이 기능을 사용할 권한이 없습니다." },
        { status: 403 }
      );
    }

    const fallback = firstAllowedPage(session.role, session.permissions);

    if (fallback === pathname || fallback === "/login") {
      return NextResponse.redirect(new URL("/login", request.url));
    }

    return NextResponse.redirect(new URL(fallback, request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
