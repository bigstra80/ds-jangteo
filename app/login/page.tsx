"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();

    setLoading(true);
    setMessage("");

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username,
          password,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setMessage(data.message || "로그인에 실패했습니다.");
        return;
      }

      router.replace("/wholesale-ledger");
      router.refresh();
    } catch {
      setMessage("서버 연결에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={pageStyle}>
      <form onSubmit={submit} style={formStyle}>
        <div style={logoStyle}>👕</div>

        <h1 style={titleStyle}>의류 도매 ERP</h1>

        <p style={descriptionStyle}>
          대도매 · 중도매 · 거래처 · 주문 · 정산 통합관리
        </p>

        <label style={labelStyle}>아이디</label>

        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoFocus
          placeholder="아이디를 입력하세요"
          style={inputStyle}
        />

        <label style={{ ...labelStyle, marginTop: 18 }}>
          비밀번호
        </label>

        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="비밀번호를 입력하세요"
          style={inputStyle}
        />

        {message && (
          <div style={messageStyle}>
            {message}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          style={{
            ...buttonStyle,
            opacity: loading ? 0.7 : 1,
          }}
        >
          {loading ? "로그인 중..." : "로그인"}
        </button>

        <div style={infoBoxStyle}>
          <div style={{ marginBottom: 5 }}>
            의류 도매 통합관리 시스템
          </div>

          <div style={{ fontSize: 12 }}>
            최초 관리자: <b>admin</b> / <b>1234</b>
          </div>
        </div>
      </form>
    </main>
  );
}

const pageStyle: React.CSSProperties = {
  minHeight: "100vh",
  display: "grid",
  placeItems: "center",
  background:
    "linear-gradient(135deg, #f8fafc 0%, #eef2ff 50%, #f1f5f9 100%)",
  padding: 20,
};

const formStyle: React.CSSProperties = {
  width: "100%",
  maxWidth: 420,
  background: "#ffffff",
  borderRadius: 22,
  padding: "42px 38px",
  boxShadow: "0 20px 60px rgba(15, 23, 42, 0.14)",
  border: "1px solid #e2e8f0",
};

const logoStyle: React.CSSProperties = {
  width: 76,
  height: 76,
  margin: "0 auto",
  borderRadius: 20,
  display: "grid",
  placeItems: "center",
  fontSize: 40,
  background: "#eff6ff",
};

const titleStyle: React.CSSProperties = {
  textAlign: "center",
  margin: "18px 0 8px",
  fontSize: 27,
  fontWeight: 900,
  color: "#0f172a",
};

const descriptionStyle: React.CSSProperties = {
  textAlign: "center",
  color: "#64748b",
  margin: "0 0 32px",
  fontSize: 14,
  lineHeight: 1.6,
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontWeight: 800,
  marginBottom: 8,
  color: "#334155",
  fontSize: 14,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  padding: "14px 15px",
  border: "1px solid #cbd5e1",
  borderRadius: 10,
  fontSize: 15,
  outline: "none",
  background: "#f8fafc",
};

const messageStyle: React.CSSProperties = {
  marginTop: 15,
  padding: "11px 12px",
  color: "#dc2626",
  background: "#fef2f2",
  borderRadius: 8,
  fontSize: 14,
};

const buttonStyle: React.CSSProperties = {
  width: "100%",
  marginTop: 26,
  padding: 15,
  border: 0,
  borderRadius: 10,
  background: "#2563eb",
  color: "#ffffff",
  fontSize: 16,
  fontWeight: 900,
  cursor: "pointer",
};

const infoBoxStyle: React.CSSProperties = {
  marginTop: 20,
  padding: 14,
  background: "#f8fafc",
  borderRadius: 10,
  color: "#64748b",
  fontSize: 13,
  textAlign: "center",
  border: "1px solid #e2e8f0",
};