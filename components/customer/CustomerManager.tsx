"use client";

import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";

type Customer = {
  id: number;
  code: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  memo: string | null;
  isActive: boolean;
  totalOrders: number;
  totalQuantity: number;
  totalSales: number;
  lastOrderAt: string | null;
};

type CustomerForm = {
  code: string;
  name: string;
  phone: string;
  email: string;
  address: string;
  memo: string;
};

const emptyForm: CustomerForm = {
  code: "",
  name: "",
  phone: "",
  email: "",
  address: "",
  memo: "",
};

export default function CustomerManager() {
  const [customers, setCustomers] =
    useState<Customer[]>([]);
  const [form, setForm] =
    useState<CustomerForm>(emptyForm);
  const [editingId, setEditingId] =
    useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] =
    useState("전체");
  const [loading, setLoading] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  async function loadCurrentUser() {
    try {
      const response = await fetch("/api/auth/me", {
        cache: "no-store",
      });

      if (!response.ok) {
        setIsAdmin(false);
        return;
      }

      const data = await response.json();
      setIsAdmin(data?.user?.role === "ADMIN");
    } catch {
      setIsAdmin(false);
    }
  }

  async function loadCustomers() {
    try {
      const response = await fetch(
        "/api/customers",
        {
          cache: "no-store",
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message ||
            "거래처 목록을 불러오지 못했습니다."
        );
      }

      setCustomers(
        Array.isArray(data) ? data : []
      );
    } catch (error) {
      console.error(error);
      alert("거래처 목록을 불러오지 못했습니다.");
    }
  }

  useEffect(() => {
    loadCurrentUser();
    loadCustomers();
  }, []);

  function handleChange(
    event:
      React.ChangeEvent<
        HTMLInputElement | HTMLTextAreaElement
      >
  ) {
    const { name, value } = event.target;

    setForm((current) => ({
      ...current,
      [name]: value,
    }));
  }

  async function handleSubmit(
    event: React.FormEvent
  ) {
    event.preventDefault();

    if (!form.code.trim()) {
      alert("거래처 코드를 입력해주세요.");
      return;
    }

    if (!form.name.trim()) {
      alert("거래처명을 입력해주세요.");
      return;
    }

    try {
      setLoading(true);

      const url = editingId
        ? `/api/customers/${editingId}`
        : "/api/customers";

      const response = await fetch(url, {
        method: editingId ? "PUT" : "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(form),
      });

      const result = await response.json();

      if (!response.ok) {
        alert(result.message || "저장에 실패했습니다.");
        return;
      }

      alert(
        editingId
          ? "고객 정보가 수정되었습니다."
          : "거래처가 등록되었습니다."
      );

      setForm(emptyForm);
      setEditingId(null);
      await loadCustomers();
    } catch (error) {
      console.error(error);
      alert("저장 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }

  function startEdit(customer: Customer) {
    setEditingId(customer.id);

    setForm({
      code: customer.code,
      name: customer.name,
      phone: customer.phone || "",
      email: customer.email || "",
      address: customer.address || "",
      memo: customer.memo || "",
    });

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  async function toggleActive(
    customer: Customer
  ) {
    const response = await fetch(
      `/api/customers/${customer.id}`,
      {
        method: "PATCH",
        headers: {
          "Content-Type":
            "application/json",
        },
        body: JSON.stringify({
          isActive: !customer.isActive,
        }),
      }
    );

    const result = await response.json();

    if (!response.ok) {
      alert(
        result.message ||
          "상태 변경에 실패했습니다."
      );
      return;
    }

    await loadCustomers();
  }

  async function deleteCustomer(
    customer: Customer
  ) {
    if (
      !window.confirm(
        `${customer.name} 거래처를 정말 삭제하시겠습니까?`
      )
    ) {
      return;
    }

    const response = await fetch(
      `/api/customers/${customer.id}`,
      {
        method: "DELETE",
      }
    );

    const result = await response.json();

    if (!response.ok) {
      alert(
        result.message ||
          "삭제에 실패했습니다."
      );
      return;
    }

    alert("거래처가 삭제되었습니다.");
    await loadCustomers();
  }

  const filteredCustomers =
    useMemo(() => {
      const keyword =
        search.trim().toLowerCase();

      return customers.filter(
        (customer) => {
          if (
            statusFilter === "사용중" &&
            !customer.isActive
          ) {
            return false;
          }

          if (
            statusFilter === "사용중지" &&
            customer.isActive
          ) {
            return false;
          }

          if (!keyword) {
            return true;
          }

          return [
            customer.code,
            customer.name,
            customer.phone,
            customer.email,
            customer.address,
          ].some((value) =>
            (value || "")
              .toLowerCase()
              .includes(keyword)
          );
        }
      );
    }, [
      customers,
      search,
      statusFilter,
    ]);

  const summary = useMemo(
    () => ({
      total: customers.length,
      active: customers.filter(
        (customer) => customer.isActive
      ).length,
      orders: filteredCustomers.reduce(
        (sum, customer) =>
          sum + customer.totalOrders,
        0
      ),
      sales: filteredCustomers.reduce(
        (sum, customer) =>
          sum + customer.totalSales,
        0
      ),
    }),
    [customers, filteredCustomers]
  );

  function downloadExcel() {
    const rows = filteredCustomers.map(
      (customer) => ({
        고객코드: customer.code,
        고객명: customer.name,
        전화번호: customer.phone || "",
        이메일: customer.email || "",
        주소: customer.address || "",
        상태: customer.isActive
          ? "사용중"
          : "사용중지",
        주문건수: customer.totalOrders,
        구매수량: customer.totalQuantity,
        누적매출: customer.totalSales,
        최근주문:
          customer.lastOrderAt
            ? new Date(
                customer.lastOrderAt
              ).toLocaleString("ko-KR")
            : "",
      })
    );

    const worksheet =
      XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(
      workbook,
      worksheet,
      "고객"
    );

    XLSX.writeFile(
      workbook,
      "거래처목록.xlsx"
    );
  }

  return (
    <div style={{ width: "100%", maxWidth: "1180px", margin: "0", boxSizing: "border-box" }}>
      <div style={summaryGrid}>
        <SummaryCard
          label="전체 거래처"
          value={`${summary.total}명`}
        />
        <SummaryCard
          label="사용중 거래처"
          value={`${summary.active}명`}
        />
        <SummaryCard
          label="검색 거래처 주문"
          value={`${summary.orders}건`}
        />
        <SummaryCard
          label="검색 거래처 매출"
          value={`${summary.sales.toLocaleString()}원`}
        />
      </div>

      <section style={section}>
        <h2 style={{ marginTop: 0 }}>
          {editingId
            ? "✏️ 고객 수정"
            : "🤝 거래처 등록"}
        </h2>

        <form onSubmit={handleSubmit}>
          <div style={grid}>
            {[
              ["code", "거래처 코드 예: C001"],
              ["name", "거래처명"],
              ["phone", "전화번호"],
              ["email", "이메일"],
            ].map(([name, placeholder]) => (
              <input
                key={name}
                name={name}
                value={
                  form[
                    name as keyof CustomerForm
                  ]
                }
                onChange={handleChange}
                placeholder={placeholder}
                style={input}
              />
            ))}
          </div>

          <input
            name="address"
            value={form.address}
            onChange={handleChange}
            placeholder="주소"
            style={fullInput}
          />

          <textarea
            name="memo"
            value={form.memo}
            onChange={handleChange}
            placeholder="거래처 메모"
            style={textarea}
          />

          <div style={buttonRow}>
            <button
              type="submit"
              disabled={loading}
              style={saveButton}
            >
              {loading
                ? "저장 중..."
                : editingId
                ? "고객 수정 저장"
                : "거래처 저장"}
            </button>

            {editingId && (
              <button
                type="button"
                style={cancelButton}
                onClick={() => {
                  setEditingId(null);
                  setForm(emptyForm);
                }}
              >
                수정 취소
              </button>
            )}
          </div>
        </form>
      </section>

      <section style={{ marginTop: "22px" }}>
        <div style={titleRow}>
          <h2>거래처 목록</h2>

          <button
            type="button"
            style={excelButton}
            onClick={downloadExcel}
          >
            엑셀 다운로드
          </button>
        </div>

        <div style={filterRow}>
          <input
            style={searchInput}
            value={search}
            onChange={(event) =>
              setSearch(event.target.value)
            }
            placeholder="거래처 코드, 이름, 연락처, 이메일 검색"
          />

          <select
            style={filterSelect}
            value={statusFilter}
            onChange={(event) =>
              setStatusFilter(
                event.target.value
              )
            }
          >
            <option value="전체">
              전체 상태
            </option>
            <option value="사용중">
              사용중
            </option>
            <option value="사용중지">
              사용중지
            </option>
          </select>
        </div>

        <div style={{ overflowX: "auto" }}>
          <table style={table}>
            <thead>
              <tr>
                <th style={th}>코드</th>
                <th style={th}>거래처명</th>
                <th style={th}>전화번호</th>
                <th style={th}>주문</th>
                <th style={th}>구매수량</th>
                <th style={th}>누적매출</th>
                <th style={th}>최근주문</th>
                <th style={th}>상태</th>
                <th style={th}>관리</th>
              </tr>
            </thead>

            <tbody>
              {filteredCustomers.map(
                (customer) => (
                  <tr key={customer.id}>
                    <td style={td}>
                      {customer.code}
                    </td>
                    <td style={td}>
                      <strong>
                        {customer.name}
                      </strong>
                    </td>
                    <td style={td}>
                      {customer.phone || "-"}
                    </td>
                    <td style={td}>
                      {customer.totalOrders}건
                    </td>
                    <td style={td}>
                      {customer.totalQuantity}개
                    </td>
                    <td style={td}>
                      <strong>
                        {customer.totalSales.toLocaleString()}원
                      </strong>
                    </td>
                    <td style={td}>
                      {customer.lastOrderAt
                        ? new Date(
                            customer.lastOrderAt
                          ).toLocaleDateString(
                            "ko-KR"
                          )
                        : "-"}
                    </td>
                    <td style={td}>
                      {customer.isActive
                        ? "사용중"
                        : "사용중지"}
                    </td>
                    <td style={td}>
                      <div style={actionRow}>
                        <button
                          style={priceButton}
                          onClick={() => {
                            window.location.href = `/customer-prices?customerId=${customer.id}`;
                          }}
                        >
                          판매단가
                        </button>
                        <button
                          style={editButton}
                          onClick={() =>
                            startEdit(customer)
                          }
                        >
                          수정
                        </button>
                        <button
                          style={statusButton}
                          onClick={() =>
                            toggleActive(customer)
                          }
                        >
                          {customer.isActive
                            ? "사용중지"
                            : "재사용"}
                        </button>
                        {isAdmin && (
                          <button
                            style={deleteButton}
                            onClick={() =>
                              deleteCustomer(customer)
                            }
                          >
                            삭제
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function SummaryCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div style={card}>
      <div style={cardLabel}>
        {label}
      </div>
      <div style={cardValue}>
        {value}
      </div>
    </div>
  );
}

const summaryGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns:
    "repeat(auto-fit, minmax(160px, 1fr))",
  gap: "10px",
  marginBottom: "18px",
};

const card: React.CSSProperties = {
  padding: "13px 14px",
  border: "1px solid #e5e7eb",
  borderRadius: "9px",
  backgroundColor: "white",
};

const cardLabel: React.CSSProperties = {
  color: "#6b7280",
  marginBottom: "5px",
  fontSize: "13px",
};

const cardValue: React.CSSProperties = {
  fontSize: "21px",
  fontWeight: "bold",
};

const section: React.CSSProperties = {
  border: "1px solid #e5e7eb",
  borderRadius: "10px",
  padding: "14px",
};

const grid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns:
    "repeat(4, minmax(0, 1fr))",
  gap: "8px",
};

const input: React.CSSProperties = {
  padding: "9px 10px",
  border: "1px solid #d1d5db",
  borderRadius: "6px",
  fontSize: "14px",
  boxSizing: "border-box",
  minWidth: 0,
};

const fullInput: React.CSSProperties = {
  ...input,
  width: "100%",
  marginTop: "10px",
  boxSizing: "border-box",
};

const textarea: React.CSSProperties = {
  ...input,
  width: "100%",
  height: "65px",
  marginTop: "8px",
  resize: "vertical",
};

const buttonRow: React.CSSProperties = {
  display: "flex",
  gap: "10px",
  marginTop: "10px",
};

const saveButton: React.CSSProperties = {
  padding: "9px 18px",
  border: "none",
  borderRadius: "6px",
  backgroundColor: "#1f2937",
  color: "white",
  fontSize: "14px",
  fontWeight: "bold",
  cursor: "pointer",
};

const cancelButton: React.CSSProperties = {
  padding: "9px 18px",
  border: "none",
  borderRadius: "6px",
  backgroundColor: "#6b7280",
  color: "white",
  cursor: "pointer",
};

const titleRow: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
};

const excelButton: React.CSSProperties = {
  padding: "8px 12px",
  border: "none",
  borderRadius: "7px",
  backgroundColor: "#15803d",
  color: "white",
  cursor: "pointer",
  fontWeight: "bold",
  fontSize: "13px",
};

const filterRow: React.CSSProperties = {
  display: "flex",
  gap: "10px",
  marginBottom: "12px",
};

const searchInput: React.CSSProperties = {
  ...input,
  flex: 1,
};

const filterSelect: React.CSSProperties = {
  ...input,
  width: "150px",
  backgroundColor: "white",
};

const table: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  minWidth: "0",
  tableLayout: "auto",
  fontSize: "13px",
};

const th: React.CSSProperties = {
  border: "1px solid #d1d5db",
  backgroundColor: "#f3f4f6",
  padding: "8px 6px",
  textAlign: "center",
  whiteSpace: "nowrap",
};

const td: React.CSSProperties = {
  border: "1px solid #d1d5db",
  padding: "8px 6px",
  textAlign: "center",
};

const actionRow: React.CSSProperties = {
  display: "flex",
  gap: "6px",
  justifyContent: "center",
  flexWrap: "wrap",
};

const priceButton: React.CSSProperties = {
  padding: "6px 9px",
  border: "none",
  borderRadius: "5px",
  backgroundColor: "#7c3aed",
  color: "white",
  cursor: "pointer",
};

const editButton: React.CSSProperties = {
  padding: "6px 9px",
  border: "none",
  borderRadius: "5px",
  backgroundColor: "#2563eb",
  color: "white",
  cursor: "pointer",
};

const statusButton: React.CSSProperties = {
  ...editButton,
  backgroundColor: "#d97706",
};

const deleteButton: React.CSSProperties = {
  ...editButton,
  backgroundColor: "#dc2626",
};