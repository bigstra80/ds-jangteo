import UserManager from "@/components/users/UserManager";
export default function UsersPage() {
  return <main style={{ width: "100%", padding: 30, boxSizing: "border-box" }}><h1>🔐 사용자 권한</h1><p style={{ color: "#64748b" }}>관리자와 직원 계정, 메뉴별 접근 권한을 관리합니다.</p><UserManager /></main>;
}
