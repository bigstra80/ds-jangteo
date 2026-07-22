"use client";

import { usePathname } from "next/navigation";
import Sidebar from "@/components/Sidebar/Sidebar";

export default function AppShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  if (pathname === "/login") {
    return <>{children}</>;
  }

  return (
    <>
      <div className="app-shell">
        <Sidebar />

        <main className="app-main">
          {children}
        </main>
      </div>

      <style jsx global>{`
        .app-shell {
          display: flex;
          width: 100%;
          min-height: 100vh;
          background: #ffffff;
        }

        .app-main {
          flex: 1;
          min-width: 0;
          min-height: 100vh;
          overflow-x: auto;
          background-color: #ffffff;
        }

        @media (max-width: 768px) {
          .app-shell {
            display: block;
          }

          .app-main {
            width: 100%;
            min-width: 0;
            padding-top: 68px;
            overflow-x: hidden;
          }
        }
      `}</style>
    </>
  );
}