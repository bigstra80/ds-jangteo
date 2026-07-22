import CustomerManager from "@/components/customer/CustomerManager";

export default function CustomersPage() {
  return (
    <main style={{ width: "100%", padding: "30px" }}>
      <div style={{ marginBottom: "25px" }}>
        <h1 style={{ marginBottom: "8px" }}>👥 고객관리</h1>

        <p style={{ margin: 0, color: "#6b7280" }}>
          고객 정보를 등록하고 주문과 매출에 연결합니다.
        </p>
      </div>

      <CustomerManager />
    </main>
  );
}