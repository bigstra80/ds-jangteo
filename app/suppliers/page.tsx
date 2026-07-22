import SupplierManager from "@/components/supplier/SupplierManager";

export default function SuppliersPage() {
  return (
    <main style={{ width: "100%", padding: "30px" }}>
      <div style={{ marginBottom: "25px" }}>
        <h1 style={{ marginBottom: "8px" }}>🤝 거래처관리</h1>
        <p style={{ margin: 0, color: "#6b7280" }}>
          매입처와 공급업체 정보를 등록하고 관리합니다.
        </p>
      </div>

      <SupplierManager />
    </main>
  );
}