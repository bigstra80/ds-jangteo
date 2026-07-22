import type { Metadata } from "next";
import AppShell from "@/components/auth/AppShell";
import "./globals.css";

export const metadata: Metadata = {
  title: "의류도매 ERP",
  description: "상품, 재고, 발주, 매입, 주문, 배송을 관리하는 ERP 시스템",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body style={{ margin: 0, minHeight: "100vh", backgroundColor: "#f8fafc" }}>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
