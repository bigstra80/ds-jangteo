"use client";

import { useEffect, useState } from "react";

const MENUS = [
  ["products", "상품관리"],
  ["wholesale-ledger", "도매 거래 한 줄 장부"],
  ["customer-settlement", "거래처 정산·미수금"],
  ["supplier-settlement", "공급업체 정산"],
  ["broker-purchases", "업체별 매입목록"],
  ["customer-prices", "거래처별 판매단가"],
  ["band-import", "네이버 밴드 상품수집"],
  ["suppliers", "공급업체 관리"],
  ["customers", "거래처 관리"],
];

type User = { id: number; username: string; name: string; role: string; permissions: string[]; isActive: boolean };
const empty = { id: 0, username: "", password: "", name: "", role: "STAFF", permissions: [] as string[], isActive: true };

export default function UserManager() {
  const [users, setUsers] = useState<User[]>([]);
  const [form, setForm] = useState(empty);
  const [message, setMessage] = useState("");

  async function load() { const r = await fetch("/api/users"); if (r.ok) setUsers(await r.json()); }
  useEffect(() => { load(); }, []);

  function togglePermission(key: string) {
    setForm((f) => ({ ...f, permissions: f.permissions.includes(key) ? f.permissions.filter((x) => x !== key) : [...f.permissions, key] }));
  }

  async function save() {
    setMessage("");
    const method = form.id ? "PATCH" : "POST";
    const r = await fetch("/api/users", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    const data = await r.json();
    if (!r.ok) return setMessage(data.message || "저장 실패");
    setForm(empty); setMessage("저장되었습니다."); load();
  }

  async function remove(id: number) {
    if (!confirm("이 계정을 삭제할까요?")) return;
    const r = await fetch("/api/users", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
    const data = await r.json();
    if (!r.ok) return alert(data.message);
    load();
  }

  return <div style={{ display: "grid", gap: 24 }}>
    <section style={card}>
      <h2 style={{ marginTop: 0 }}>{form.id ? "계정 수정" : "직원 계정 추가"}</h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: 12 }}>
        <input placeholder="이름" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} style={input} />
        <input placeholder="아이디" disabled={!!form.id} value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} style={input} />
        <input type="password" placeholder={form.id ? "새 비밀번호(변경 시 입력)" : "비밀번호"} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} style={input} />
        <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} style={input}><option value="STAFF">직원</option><option value="ADMIN">관리자</option></select>
      </div>
      {form.role === "STAFF" && <div style={{ marginTop: 18 }}><b>접근 가능한 메뉴</b><div style={{ display: "grid", gridTemplateColumns: "repeat(4,minmax(0,1fr))", gap: 8, marginTop: 10 }}>{MENUS.map(([key,label]) => <label key={key} style={{ padding: 10, border: "1px solid #e2e8f0", borderRadius: 7 }}><input type="checkbox" checked={form.permissions.includes(key)} onChange={() => togglePermission(key)} /> {label}</label>)}</div></div>}
      <label style={{ display: "inline-block", marginTop: 16 }}><input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} /> 사용 가능</label>
      {message && <span style={{ marginLeft: 14, color: "#2563eb" }}>{message}</span>}
      <div style={{ marginTop: 18, display: "flex", gap: 8 }}><button onClick={save} style={primary}>저장</button>{form.id > 0 && <button onClick={() => setForm(empty)} style={secondary}>취소</button>}</div>
    </section>
    <section style={card}><h2 style={{ marginTop: 0 }}>계정 목록</h2><div style={{ overflowX: "auto" }}><table style={{ width: "100%", borderCollapse: "collapse" }}><thead><tr>{["이름","아이디","권한","상태","메뉴 권한","관리"].map(x => <th key={x} style={th}>{x}</th>)}</tr></thead><tbody>{users.map(u => <tr key={u.id}><td style={td}>{u.name}</td><td style={td}>{u.username}</td><td style={td}>{u.role === "ADMIN" ? "관리자" : "직원"}</td><td style={td}>{u.isActive ? "사용" : "중지"}</td><td style={td}>{u.role === "ADMIN" ? "전체" : `${u.permissions.length}개 메뉴`}</td><td style={td}><button onClick={() => setForm({ ...u, password: "" })} style={small}>수정</button> <button onClick={() => remove(u.id)} style={danger}>삭제</button></td></tr>)}</tbody></table></div></section>
  </div>;
}

const card: React.CSSProperties = { background: "white", border: "1px solid #e2e8f0", borderRadius: 12, padding: 22 };
const input: React.CSSProperties = { padding: 11, border: "1px solid #cbd5e1", borderRadius: 7, minWidth: 0 };
const th: React.CSSProperties = { textAlign: "left", padding: 12, borderBottom: "1px solid #cbd5e1", background: "#f8fafc" };
const td: React.CSSProperties = { padding: 12, borderBottom: "1px solid #e2e8f0" };
const primary: React.CSSProperties = { padding: "10px 18px", border: 0, borderRadius: 7, background: "#2563eb", color: "white", fontWeight: 700 };
const secondary: React.CSSProperties = { ...primary, background: "#64748b" };
const small: React.CSSProperties = { padding: "6px 10px", border: 0, borderRadius: 6, background: "#e2e8f0" };
const danger: React.CSSProperties = { ...small, background: "#fee2e2", color: "#b91c1c" };
