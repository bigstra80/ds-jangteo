"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const menuItems = [
{ permission: "suppliers", label: "공급업체 관리", icon: "🏢", href: "/suppliers" },
  { permission: "customers", label: "거래처 관리", icon: "🤝", href: "/customers" },
];

type User = {
  name: string;
  role: string;
  permissions: string[];
};

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setUser(data?.user || null));
  }, []);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  function isActive(href: string) {
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  const visibleMenus = menuItems.filter(
    (menu) =>
      !user ||
      user.role === "ADMIN" ||
      user.permissions.includes(menu.permission)
  );

  function canAccess(permission: string) {
    return (
      !user ||
      user.role === "ADMIN" ||
      user.permissions.includes(permission)
    );
  }

  return (
    <>
      <button
        className="mobile-menu-button"
        onClick={() => setMobileOpen(true)}
        aria-label="메뉴 열기"
      >
        ☰
      </button>

      {mobileOpen && (
        <div
          className="sidebar-overlay"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside className={`erp-sidebar ${mobileOpen ? "mobile-open" : ""} ${collapsed ? "collapsed" : ""}`}>
        <button
          className="desktop-collapse-button"
          onClick={() => setCollapsed((value) => !value)}
          aria-label={collapsed ? "사이드바 펼치기" : "사이드바 접기"}
          title={collapsed ? "사이드바 펼치기" : "사이드바 접기"}
        >
          {collapsed ? "☰" : "←"}
        </button>
        <button
          className="sidebar-close-button"
          onClick={() => setMobileOpen(false)}
          aria-label="메뉴 닫기"
        >
          ×
        </button>

        <div style={logoAreaStyle}>
          <div style={logoStyle}>👕</div>
          <div>
            <div className="sidebar-text" style={titleStyle}>의류 도매 ERP</div>
            <div className="sidebar-text" style={subTitleStyle}>Wholesale Management</div>
          </div>
        </div>

        <div style={dividerStyle} />
        <div className="sidebar-section-title" style={sectionTitleStyle}>도매 전용 기능</div>

{canAccess("products") && (
        <Link
          href="/products"
          style={{
            ...menuLinkStyle,
            ...(isActive("/products") ? activeMenuStyle : {}),
          }}
        >
          <span style={iconStyle}>👕</span>
          <span className="sidebar-text">상품관리</span>
        </Link>
      )}

{canAccess("wholesale-ledger") && (
        <Link
          href="/wholesale-ledger"
          style={{
            ...menuLinkStyle,
            ...(isActive("/wholesale-ledger")
              ? activeMenuStyle
              : {}),
          }}
        >
          <span style={iconStyle}>📘</span>
          <span className="sidebar-text">도매 거래 한 줄 장부</span>
        </Link>
      )}

{canAccess("customer-settlement") && (
        <Link
  href="/customer-settlement"
  style={{
    ...menuLinkStyle,
    ...(isActive("/customer-settlement")
      ? activeMenuStyle
      : {}),
  }}
>
  <span style={iconStyle}>📒</span>
  <span className="sidebar-text">거래처 정산·미수금</span>
</Link>
      )}

{canAccess("supplier-settlement") && (
        <Link
          href="/supplier-settlement"
          style={{
            ...menuLinkStyle,
            ...(isActive("/supplier-settlement")
              ? activeMenuStyle
              : {}),
          }}
        >
          <span style={iconStyle}>📕</span>
          <span className="sidebar-text">공급업체 정산</span>
        </Link>
      )}

{canAccess("broker-purchases") && (
        <Link
          href="/broker-purchases"
          style={{
            ...menuLinkStyle,
            ...(isActive("/broker-purchases")
              ? activeMenuStyle
              : {}),
          }}
        >
          <span style={iconStyle}>🏪</span>
          <span className="sidebar-text">업체별 매입목록</span>
        </Link>
      )}

{canAccess("wholesale-ledger") && (
        <Link
          href="/customer-deliveries"
          style={{
            ...menuLinkStyle,
            ...(isActive("/customer-deliveries")
              ? activeMenuStyle
              : {}),
          }}
        >
          <span style={iconStyle}>🚚</span>
          <span className="sidebar-text">거래처별 납품목록</span>
        </Link>
      )}

{canAccess("customer-prices") && (
        <Link
          href="/customer-prices"
          style={{
            ...menuLinkStyle,
            ...(isActive("/customer-prices")
              ? activeMenuStyle
              : {}),
          }}
        >
          <span style={iconStyle}>💵</span>
          <span className="sidebar-text">거래처별 판매단가</span>
        </Link>
      )}

{canAccess("band-import") && (
        <Link
          href="/band-import"
          style={{
            ...menuLinkStyle,
            ...(isActive("/band-import") ? activeMenuStyle : {}),
          }}
        >
          <span style={iconStyle}>🟢</span>
          <span className="sidebar-text">네이버 밴드 상품수집</span>
        </Link>
      )}


        


        

        


        


        

        

        
        <div style={dividerStyle} />
        <div className="sidebar-section-title" style={sectionTitleStyle}>기본 관리</div>

        <nav style={navStyle}>
          {visibleMenus.map((menu) => {
            const active = isActive(menu.href);

            return (
              <Link
                key={menu.href}
                href={menu.href}
                style={{
                  ...menuLinkStyle,
                  ...(active ? activeMenuStyle : {}),
                }}
              >
                <span style={iconStyle}>{menu.icon}</span>
                <span className="sidebar-text">{menu.label}</span>
              </Link>
            );
          })}
        </nav>

<div style={dividerStyle} />

        {user?.role === "ADMIN" && (
          <Link
            href="/users"
            style={{
              ...menuLinkStyle,
              ...(isActive("/users") ? activeMenuStyle : {}),
            }}
          >
            <span style={iconStyle}>🔐</span>
            <span className="sidebar-text">사용자 권한</span>
          </Link>
        )}

        <div className="sidebar-disabled-menu" style={disabledMenuStyle}>⚙️ <span className="sidebar-text">환경설정</span></div>

        {user && (
          <div style={userAreaStyle}>
            <div className="sidebar-user-info" style={userInfoStyle}>
              <div style={userNameStyle}>{user.name}</div>
              <div style={userRoleStyle}>
                {user.role === "ADMIN" ? "관리자" : "직원"}
              </div>
            </div>

            <button onClick={logout} style={logoutButtonStyle}>
              <span className="sidebar-text">로그아웃</span>
            </button>
          </div>
        )}
      </aside>

      <style jsx global>{`
        .erp-sidebar {
          width: 260px;
          min-width: 260px;
          height: 100vh;
          background: #172033;
          color: white;
          padding: 20px 14px;
          box-sizing: border-box;
          overflow-y: auto;
          position: sticky;
          top: 0;
          z-index: 1000;
        }

        .mobile-menu-button,
        .sidebar-close-button,
        .sidebar-overlay {
          display: none;
        }
        .desktop-collapse-button {
          position: sticky;
          top: 0;
          margin-left: auto;
          margin-bottom: 8px;
          width: 36px;
          height: 36px;
          border: none;
          border-radius: 9px;
          background: #243047;
          color: white;
          cursor: pointer;
          font-size: 20px;
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 2;
        }

        .erp-sidebar {
          transition: width 0.25s ease, min-width 0.25s ease, padding 0.25s ease;
        }

        .erp-sidebar.collapsed {
          width: 72px;
          min-width: 72px;
          padding-left: 8px;
          padding-right: 8px;
          overflow-x: hidden;
        }

        .erp-sidebar.collapsed .sidebar-text,
        .erp-sidebar.collapsed .sidebar-section-title,
        .erp-sidebar.collapsed .sidebar-user-info {
          display: none !important;
        }

        .erp-sidebar.collapsed a {
          justify-content: center !important;
          gap: 0 !important;
          padding-left: 8px !important;
          padding-right: 8px !important;
        }

        .erp-sidebar.collapsed .sidebar-disabled-menu {
          text-align: center;
          padding-left: 8px !important;
          padding-right: 8px !important;
        }

        .erp-sidebar.collapsed .desktop-collapse-button {
          margin-left: auto;
          margin-right: auto;
        }

        .erp-sidebar.collapsed > div:first-of-type {
          justify-content: center !important;
          padding-left: 0 !important;
          padding-right: 0 !important;
        }


        @media (max-width: 768px) {
          .erp-sidebar {
            position: fixed;
            left: -290px;
            top: 0;
            width: 270px;
            min-width: 270px;
            height: 100dvh;
            transition: left 0.25s ease;
            z-index: 1001;
          }

          .erp-sidebar.mobile-open {
            left: 0;
          }

          .mobile-menu-button {
            display: flex;
            align-items: center;
            justify-content: center;
            position: fixed;
            top: 12px;
            left: 12px;
            width: 44px;
            height: 44px;
            border: none;
            border-radius: 10px;
            background: #172033;
            color: white;
            font-size: 25px;
            z-index: 999;
          }

          .desktop-collapse-button {
            display: none;
          }

          .erp-sidebar.collapsed {
            width: 270px;
            min-width: 270px;
          }

          .erp-sidebar.collapsed .sidebar-text,
          .erp-sidebar.collapsed .sidebar-section-title,
          .erp-sidebar.collapsed .sidebar-user-info {
            display: initial !important;
          }

          .sidebar-close-button {
            display: block;
            position: absolute;
            top: 9px;
            right: 12px;
            border: none;
            background: transparent;
            color: white;
            font-size: 32px;
          }

          .sidebar-overlay {
            display: block;
            position: fixed;
            inset: 0;
            background: rgba(0, 0, 0, 0.45);
            z-index: 1000;
          }
        }
      `}</style>
    </>
  );
}

const logoAreaStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "12px",
  padding: "5px 8px 16px",
};

const logoStyle: React.CSSProperties = {
  width: "42px",
  height: "42px",
  borderRadius: "12px",
  display: "grid",
  placeItems: "center",
  fontSize: "25px",
  backgroundColor: "#2563eb",
};

const titleStyle: React.CSSProperties = {
  fontSize: "19px",
  fontWeight: 900,
};

const subTitleStyle: React.CSSProperties = {
  marginTop: "4px",
  fontSize: "11px",
  color: "#94a3b8",
};

const dividerStyle: React.CSSProperties = {
  height: "1px",
  backgroundColor: "#334155",
  margin: "8px 0 14px",
};

const sectionTitleStyle: React.CSSProperties = {
  padding: "0 12px 8px",
  color: "#94a3b8",
  fontSize: "11px",
  fontWeight: 800,
};

const navStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "4px",
};

const menuLinkStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "10px",
  color: "#e2e8f0",
  textDecoration: "none",
  padding: "11px 12px",
  borderRadius: "9px",
  fontSize: "14px",
  fontWeight: 600,
};

const activeMenuStyle: React.CSSProperties = {
  backgroundColor: "#2563eb",
  color: "white",
  fontWeight: 800,
};

const iconStyle: React.CSSProperties = {
  width: "23px",
  textAlign: "center",
  flexShrink: 0,
};

const comingSoonMenuStyle: React.CSSProperties = {
  margin: "3px 0",
  padding: "10px 12px",
  color: "#cbd5e1",
  fontSize: "13px",
  borderRadius: "8px",
  backgroundColor: "#1e293b",
};

const disabledMenuStyle: React.CSSProperties = {
  padding: "10px 12px",
  color: "#64748b",
  fontSize: "14px",
};

const userAreaStyle: React.CSSProperties = {
  marginTop: "16px",
  padding: "14px 10px 4px",
  borderTop: "1px solid #334155",
};

const userInfoStyle: React.CSSProperties = {
  marginBottom: "10px",
};

const userNameStyle: React.CSSProperties = {
  fontSize: "14px",
  fontWeight: 800,
  color: "#f8fafc",
};

const userRoleStyle: React.CSSProperties = {
  marginTop: "3px",
  fontSize: "12px",
  color: "#94a3b8",
};

const logoutButtonStyle: React.CSSProperties = {
  width: "100%",
  padding: "9px",
  border: "1px solid #475569",
  borderRadius: "8px",
  background: "transparent",
  color: "#e2e8f0",
  cursor: "pointer",
  fontWeight: 700,
};
