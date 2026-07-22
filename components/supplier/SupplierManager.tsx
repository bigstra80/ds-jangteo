"use client";

import { useEffect, useMemo, useState } from "react";

type Supplier = {
  id: number;
  code: string;
  name: string;
  businessNumber: string | null;
  representative: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  contactName: string | null;
  contactPhone: string | null;
  bankName: string | null;
  bankAccount: string | null;
  accountHolder: string | null;
  memo: string | null;
  isActive: boolean;
};

type SupplierForm = {
  code: string;
  name: string;
  businessNumber: string;
  representative: string;
  phone: string;
  email: string;
  address: string;
  contactName: string;
  contactPhone: string;
  bankName: string;
  bankAccount: string;
  accountHolder: string;
  memo: string;
};

const emptyForm: SupplierForm = {
  code: "",
  name: "",
  businessNumber: "",
  representative: "",
  phone: "",
  email: "",
  address: "",
  contactName: "",
  contactPhone: "",
  bankName: "",
  bankAccount: "",
  accountHolder: "",
  memo: "",
};

export default function SupplierManager() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [form, setForm] = useState<SupplierForm>(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [forceDeletingId, setForceDeletingId] = useState<number | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [registerOpen, setRegisterOpen] = useState(false);


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

  async function loadSuppliers() {
    try {
      const response = await fetch("/api/suppliers", {
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error("거래처 조회 실패");
      }

      const data = await response.json();
      setSuppliers(data);
    } catch (error) {
      console.error(error);
      alert("거래처 목록을 불러오지 못했습니다.");
    }
  }

  useEffect(() => {
    loadCurrentUser();
    loadSuppliers();
  }, []);

  function handleChange(
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) {
    const { name, value } = event.target;

    setForm((current) => ({
      ...current,
      [name]: value,
    }));
  }

  async function handleSubmit(event: React.FormEvent) {
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
        ? `/api/suppliers/${editingId}`
        : "/api/suppliers";

      const method = editingId ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
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

      if (editingId) {
        alert("거래처가 수정되었습니다.");
      } else {
        alert("거래처가 등록되었습니다.");
      }

      setForm(emptyForm);
      setEditingId(null);
      setRegisterOpen(false);

      await loadSuppliers();
    } catch (error) {
      console.error(error);
      alert("저장 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }

  function startEdit(supplier: Supplier) {
    setEditingId(supplier.id);
    setRegisterOpen(true);

    setForm({
      code: supplier.code,
      name: supplier.name,
      businessNumber: supplier.businessNumber || "",
      representative: supplier.representative || "",
      phone: supplier.phone || "",
      email: supplier.email || "",
      address: supplier.address || "",
      contactName: supplier.contactName || "",
      contactPhone: supplier.contactPhone || "",
      bankName: supplier.bankName || "",
      bankAccount: supplier.bankAccount || "",
      accountHolder: supplier.accountHolder || "",
      memo: supplier.memo || "",
    });

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(emptyForm);
    setRegisterOpen(false);
  }

  async function deleteSupplier(id: number, name: string) {
    const confirmed = window.confirm(
      `${name} 거래처를 정말 삭제하시겠습니까?`
    );

    if (!confirmed) {
      return;
    }

    try {
      const response = await fetch(`/api/suppliers/${id}`, {
        method: "DELETE",
      });

      const result = await response.json();

      if (!response.ok) {
        alert(result.message || "삭제에 실패했습니다.");
        return;
      }

      if (editingId === id) {
        cancelEdit();
      }

      alert("거래처가 삭제되었습니다.");

      await loadSuppliers();
    } catch (error) {
      console.error(error);
      alert("삭제 중 오류가 발생했습니다.");
    }
  }

  async function forceDeleteSupplier(supplier: Supplier) {
    const firstConfirmed = window.confirm(
      `[관리자 강제삭제]\n\n${supplier.code} / ${supplier.name}\n\n이 거래처와 연결된 매입 및 발주 기록까지 함께 삭제됩니다.\n\n계속하시겠습니까?`
    );

    if (!firstConfirmed) {
      return;
    }

    const typed = window.prompt(
      `실수 방지를 위해 거래처 코드 "${supplier.code}"를 정확히 입력해주세요.`
    );

    if (typed !== supplier.code) {
      alert("거래처 코드가 일치하지 않아 강제삭제를 취소했습니다.");
      return;
    }

    try {
      setForceDeletingId(supplier.id);

      const response = await fetch(
        `/api/suppliers/${supplier.id}?force=true`,
        {
          method: "DELETE",
        }
      );

      let result: { message?: string } = {};

      try {
        result = await response.json();
      } catch {
        result = {};
      }

      if (!response.ok) {
        alert(result.message || "거래처 강제삭제에 실패했습니다.");
        return;
      }

      if (editingId === supplier.id) {
        cancelEdit();
      }

      alert(result.message || "거래처가 강제삭제되었습니다.");
      await loadSuppliers();
    } catch (error) {
      console.error(error);
      alert("거래처 강제삭제 중 오류가 발생했습니다.");
    } finally {
      setForceDeletingId(null);
    }
  }

  async function toggleActive(supplier: Supplier) {
    try {
      const response = await fetch(`/api/suppliers/${supplier.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          isActive: !supplier.isActive,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        alert(result.message || "상태 변경에 실패했습니다.");
        return;
      }

      await loadSuppliers();
    } catch (error) {
      console.error(error);
      alert("상태 변경 중 오류가 발생했습니다.");
    }
  }

  const filteredSuppliers = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    if (!keyword) {
      return suppliers;
    }

    return suppliers.filter((supplier) => {
      const values = [
        supplier.code,
        supplier.name,
        supplier.businessNumber,
        supplier.representative,
        supplier.phone,
        supplier.contactName,
        supplier.contactPhone,
      ];

      return values.some((value) =>
        (value || "").toLowerCase().includes(keyword)
      );
    });
  }, [suppliers, search]);

  return (
    <div style={{ width: "100%", maxWidth: "1180px", margin: "0", boxSizing: "border-box" }}>
      <div style={{ marginBottom: "18px" }}>
        <button
          type="button"
          onClick={() => {
            if (registerOpen) {
              setEditingId(null);
              setForm(emptyForm);
            }
            setRegisterOpen((current) => !current);
          }}
          style={registerToggleButtonStyle}
        >
          {registerOpen ? "▲ 거래처 등록 닫기" : "＋ 거래처 등록"}
        </button>
      </div>

      {registerOpen && (
      <section style={sectionStyle}>
        <h2 style={{ marginTop: 0 }}>
          {editingId ? "✏️ 거래처 수정" : "🤝 거래처 등록"}
        </h2>

        <form onSubmit={handleSubmit}>
          <div style={gridStyle}>
            <input
              name="code"
              value={form.code}
              onChange={handleChange}
              placeholder="거래처 코드 예: S001"
              style={inputStyle}
            />

            <input
              name="name"
              value={form.name}
              onChange={handleChange}
              placeholder="거래처명"
              style={inputStyle}
            />

            <input
              name="businessNumber"
              value={form.businessNumber}
              onChange={handleChange}
              placeholder="사업자등록번호"
              style={inputStyle}
            />

            <input
              name="representative"
              value={form.representative}
              onChange={handleChange}
              placeholder="대표자명"
              style={inputStyle}
            />

            <input
              name="phone"
              value={form.phone}
              onChange={handleChange}
              placeholder="대표 전화번호"
              style={inputStyle}
            />

            <input
              name="email"
              value={form.email}
              onChange={handleChange}
              placeholder="이메일"
              style={inputStyle}
            />

            <input
              name="contactName"
              value={form.contactName}
              onChange={handleChange}
              placeholder="담당자명"
              style={inputStyle}
            />

            <input
              name="contactPhone"
              value={form.contactPhone}
              onChange={handleChange}
              placeholder="담당자 연락처"
              style={inputStyle}
            />

            <input
              name="bankName"
              value={form.bankName}
              onChange={handleChange}
              placeholder="은행명"
              style={inputStyle}
            />

            <input
              name="bankAccount"
              value={form.bankAccount}
              onChange={handleChange}
              placeholder="계좌번호"
              style={inputStyle}
            />

            <input
              name="accountHolder"
              value={form.accountHolder}
              onChange={handleChange}
              placeholder="예금주"
              style={inputStyle}
            />
          </div>

          <input
            name="address"
            value={form.address}
            onChange={handleChange}
            placeholder="주소"
            style={fullInputStyle}
          />

          <textarea
            name="memo"
            value={form.memo}
            onChange={handleChange}
            placeholder="메모"
            style={textareaStyle}
          />

          <div
            style={{
              display: "flex",
              gap: "10px",
              marginTop: "15px",
            }}
          >
            <button
              type="submit"
              disabled={loading}
              style={saveButtonStyle}
            >
              {loading
                ? "저장 중..."
                : editingId
                ? "거래처 수정 저장"
                : "거래처 저장"}
            </button>

            {editingId && (
              <button
                type="button"
                onClick={cancelEdit}
                style={cancelButtonStyle}
              >
                수정 취소
              </button>
            )}
          </div>
        </form>
      </section>

      )}

      <section style={{ marginTop: "24px" }}>
        <h2>거래처 목록</h2>

        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="거래처 코드, 거래처명, 대표자, 담당자 검색"
          style={searchStyle}
        />

        <div style={{ overflowX: "auto" }}>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>코드</th>
                <th style={thStyle}>거래처명</th>
                <th style={thStyle}>대표자</th>
                <th style={thStyle}>전화번호</th>
                <th style={thStyle}>담당자</th>
                <th style={thStyle}>담당자 연락처</th>
                <th style={thStyle}>상태</th>
                <th style={thStyle}>관리</th>
              </tr>
            </thead>

            <tbody>
              {filteredSuppliers.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    style={{
                      ...tdStyle,
                      textAlign: "center",
                      padding: "30px",
                    }}
                  >
                    등록된 거래처가 없습니다.
                  </td>
                </tr>
              ) : (
                filteredSuppliers.map((supplier) => (
                  <tr key={supplier.id}>
                    <td style={tdStyle}>{supplier.code}</td>

                    <td style={tdStyle}>
                      <strong>{supplier.name}</strong>
                    </td>

                    <td style={tdStyle}>
                      {supplier.representative || "-"}
                    </td>

                    <td style={tdStyle}>{supplier.phone || "-"}</td>

                    <td style={tdStyle}>
                      {supplier.contactName || "-"}
                    </td>

                    <td style={tdStyle}>
                      {supplier.contactPhone || "-"}
                    </td>

                    <td style={tdStyle}>
                      <span
                        style={
                          supplier.isActive
                            ? activeBadgeStyle
                            : inactiveBadgeStyle
                        }
                      >
                        {supplier.isActive ? "사용중" : "사용중지"}
                      </span>
                    </td>

                    <td style={tdStyle}>
                      <div
                        style={{
                          display: "flex",
                          gap: "6px",
                          justifyContent: "center",
                          flexWrap: "wrap",
                        }}
                      >
                        <button
                          onClick={() => startEdit(supplier)}
                          style={editButtonStyle}
                        >
                          수정
                        </button>

                        <button
                          onClick={() => toggleActive(supplier)}
                          style={statusButtonStyle}
                        >
                          {supplier.isActive ? "사용중지" : "재사용"}
                        </button>

                        {isAdmin && (
                          <button
                            onClick={() =>
                              deleteSupplier(supplier.id, supplier.name)
                            }
                            style={deleteButtonStyle}
                          >
                            삭제
                          </button>
                        )}

                        {isAdmin && (
                          <button
                            onClick={() =>
                              forceDeleteSupplier(supplier)
                            }
                            disabled={
                              forceDeletingId === supplier.id
                            }
                            style={{
                              ...forceDeleteButtonStyle,
                              opacity:
                                forceDeletingId === supplier.id
                                  ? 0.6
                                  : 1,
                              cursor:
                                forceDeletingId === supplier.id
                                  ? "not-allowed"
                                  : "pointer",
                            }}
                          >
                            {forceDeletingId === supplier.id
                              ? "삭제 중..."
                              : "강제삭제"}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

const registerToggleButtonStyle: React.CSSProperties = {
  padding: "9px 16px",
  border: "none",
  borderRadius: "7px",
  backgroundColor: "#2563eb",
  color: "white",
  fontSize: "14px",
  fontWeight: "bold",
  cursor: "pointer",
};

const sectionStyle: React.CSSProperties = {
  border: "1px solid #e5e7eb",
  borderRadius: "10px",
  padding: "14px",
  width: "100%",
  maxWidth: "1180px",
  boxSizing: "border-box",
};

const gridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
  gap: "8px",
};

const inputStyle: React.CSSProperties = {
  padding: "9px 10px",
  border: "1px solid #d1d5db",
  borderRadius: "6px",
  fontSize: "14px",
  boxSizing: "border-box",
  minWidth: 0,
};

const fullInputStyle: React.CSSProperties = {
  ...inputStyle,
  width: "100%",
  marginTop: "10px",
  boxSizing: "border-box",
};

const textareaStyle: React.CSSProperties = {
  ...inputStyle,
  width: "100%",
  height: "65px",
  marginTop: "8px",
  resize: "vertical",
};

const saveButtonStyle: React.CSSProperties = {
  padding: "9px 18px",
  border: "none",
  borderRadius: "6px",
  backgroundColor: "#1f2937",
  color: "white",
  fontSize: "14px",
  fontWeight: "bold",
  cursor: "pointer",
};

const cancelButtonStyle: React.CSSProperties = {
  padding: "9px 18px",
  border: "none",
  borderRadius: "6px",
  backgroundColor: "#6b7280",
  color: "white",
  cursor: "pointer",
};

const searchStyle: React.CSSProperties = {
  ...inputStyle,
  width: "420px",
  maxWidth: "100%",
  marginBottom: "12px",
};

const tableStyle: React.CSSProperties = {
  width: "100%",
  maxWidth: "1180px",
  borderCollapse: "collapse",
  tableLayout: "auto",
  fontSize: "14px",
};

const thStyle: React.CSSProperties = {
  border: "1px solid #d1d5db",
  backgroundColor: "#f3f4f6",
  padding: "9px 7px",
  textAlign: "center",
  whiteSpace: "nowrap",
};

const tdStyle: React.CSSProperties = {
  border: "1px solid #d1d5db",
  padding: "8px 7px",
  textAlign: "center",
  whiteSpace: "nowrap",
};

const activeBadgeStyle: React.CSSProperties = {
  padding: "5px 10px",
  borderRadius: "20px",
  backgroundColor: "#dcfce7",
  color: "#166534",
  fontWeight: "bold",
};

const inactiveBadgeStyle: React.CSSProperties = {
  padding: "5px 10px",
  borderRadius: "20px",
  backgroundColor: "#fee2e2",
  color: "#991b1b",
  fontWeight: "bold",
};

const editButtonStyle: React.CSSProperties = {
  padding: "6px 9px",
  border: "none",
  borderRadius: "5px",
  backgroundColor: "#2563eb",
  color: "white",
  cursor: "pointer",
};

const statusButtonStyle: React.CSSProperties = {
  padding: "6px 9px",
  border: "none",
  borderRadius: "5px",
  backgroundColor: "#d97706",
  color: "white",
  cursor: "pointer",
};

const deleteButtonStyle: React.CSSProperties = {
  padding: "6px 9px",
  border: "none",
  borderRadius: "5px",
  backgroundColor: "#dc2626",
  color: "white",
  cursor: "pointer",
};

const forceDeleteButtonStyle: React.CSSProperties = {
  padding: "6px 9px",
  border: "none",
  borderRadius: "5px",
  backgroundColor: "#7f1d1d",
  color: "white",
  fontWeight: "bold",
  cursor: "pointer",
  whiteSpace: "nowrap",
};