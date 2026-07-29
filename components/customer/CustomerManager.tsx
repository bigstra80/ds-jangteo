"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";

type Customer = {
  id: number;
  code: string;
  name: string;
  grade: "A" | "B" | "C" | "D";
  phone: string | null;
  email: string | null;
  address: string | null;
  memo: string | null;
  isActive: boolean;
};

type CustomerForm = {
  code: string;
  name: string;
  grade: "A" | "B" | "C" | "D";
  phone: string;
  email: string;
  address: string;
  memo: string;
};

type CustomerExcelRow = Record<string, unknown>;

const emptyForm: CustomerForm = {
  code: "",
  name: "",
  grade: "C",
  phone: "",
  email: "",
  address: "",
  memo: "",
};

function normalizeGradeSearch(value: string) {
  const normalized = value
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "")
    .replace(/그룹$/u, "");

  return ["A", "B", "C", "D"].includes(normalized)
    ? normalized
    : null;
}

export default function CustomerManager() {
  const [customers, setCustomers] =
    useState<Customer[]>([]);
  const [form, setForm] =
    useState<CustomerForm>(emptyForm);
  const [editingId, setEditingId] =
    useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [searchField, setSearchField] = useState("all");
  const [statusFilter, setStatusFilter] =
    useState("전체");
  const [loading, setLoading] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [importingExcel, setImportingExcel] = useState(false);
  const excelInputRef = useRef<HTMLInputElement>(null);
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
    // Initial client-side data hydration is intentionally performed once on mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
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
      setIsFormOpen(false);
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
    setIsFormOpen(true);

    setForm({
      code: customer.code,
      name: customer.name,
      grade: customer.grade || "D",
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

          if (searchField === "grade") {
            const normalizedGrade = normalizeGradeSearch(search);
            return normalizedGrade !== null &&
              (customer.grade || "D") === normalizedGrade;
          }

          const fields: Record<string, unknown[]> = {
            all: [customer.code, customer.name],
            code: [customer.code],
            name: [customer.name],
          };
          return (fields[searchField] || fields.all).some((value) => String(value || "").toLowerCase().includes(keyword));
        }
      );
    }, [
      customers,
      search,
      searchField,
      statusFilter,
    ]);

  function downloadExcel() {
    const rows = filteredCustomers.map(
      (customer) => ({
        고객코드: customer.code,
        고객명: customer.name,
        등급: `${customer.grade || "D"}그룹`,
        전화번호: customer.phone || "",
        이메일: customer.email || "",
        주소: customer.address || "",
        상태: customer.isActive
          ? "사용중"
          : "사용중지",
      })
    );

    const worksheet = XLSX.utils.json_to_sheet(rows, {
      header: [
        "고객코드",
        "고객명",
        "등급",
        "전화번호",
        "이메일",
        "주소",
        "상태",
      ],
    });
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

  async function uploadExcel(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    try {
      setImportingExcel(true);
      const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<CustomerExcelRow>(firstSheet, { defval: "" });

      if (rows.length === 0) {
        alert("엑셀 파일에 등록할 거래처가 없습니다.");
        return;
      }

      const getValue = (row: CustomerExcelRow, names: string[]) => {
        for (const name of names) {
          const value = row[name];
          if (value !== undefined && String(value).trim()) return String(value).trim();
        }
        return "";
      };

      let successCount = 0;
      const failures: string[] = [];

      for (const [index, row] of rows.entries()) {
        const code = getValue(row, ["거래처코드", "고객코드", "코드"]);
        const name = getValue(row, ["거래처명", "고객명", "이름"]);
        const rawGrade = getValue(row, ["등급", "거래처등급", "고객등급"])
          .toUpperCase()
          .replace("그룹", "");
        const grade = ["A", "B", "C", "D"].includes(rawGrade) ? rawGrade : "C";

        if (!code || !name) {
          failures.push(`${index + 2}행: 거래처 코드 또는 거래처명이 없습니다.`);
          continue;
        }

        try {
          const response = await fetch("/api/customers", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              code,
              name,
              grade,
              phone: getValue(row, ["전화번호", "연락처", "전화"]),
              email: getValue(row, ["이메일", "email", "Email"]),
              address: getValue(row, ["주소"]),
              memo: getValue(row, ["거래처메모", "고객메모", "메모"]),
            }),
          });
          const result = await response.json();
          if (!response.ok) {
            failures.push(`${code}: ${result.message || "등록 실패"}`);
            continue;
          }
          successCount += 1;
        } catch {
          failures.push(`${code}: 등록 요청 중 오류가 발생했습니다.`);
        }
      }

      await loadCustomers();
      alert(
        `엑셀 업로드가 완료되었습니다.\n신규 등록: ${successCount}개\n실패: ${failures.length}개` +
          (failures.length ? `\n\n${failures.slice(0, 10).join("\n")}` : "")
      );
    } catch (error) {
      console.error(error);
      alert("엑셀 파일을 읽는 중 오류가 발생했습니다.");
    } finally {
      setImportingExcel(false);
    }
  }

  return (
    <div style={{ width: "100%", maxWidth: "820px", margin: "0", boxSizing: "border-box" }}>
      <div style={topActionRow}>
        <button
          type="button"
          style={formToggleButton}
          aria-expanded={isFormOpen}
          onClick={() => setIsFormOpen((current) => !current)}
        >
          {isFormOpen ? "거래처 등록 닫기" : "+ 거래처 등록"}
        </button>
        <div style={excelActionRow}>
          <input
            ref={excelInputRef}
            type="file"
            accept=".xlsx,.xls"
            onChange={uploadExcel}
            style={{ display: "none" }}
          />
          <button
            type="button"
            style={excelUploadButton}
            disabled={importingExcel}
            onClick={() => excelInputRef.current?.click()}
          >
            {importingExcel ? "업로드 중..." : "엑셀 업로드"}
          </button>
          <button
            type="button"
            style={excelButton}
            onClick={downloadExcel}
          >
            엑셀 다운로드
          </button>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateRows: isFormOpen ? "1fr" : "0fr",
          transition: "grid-template-rows 180ms ease",
        }}
      >
        <div style={{ overflow: "hidden" }}>
          <section style={section}>
            <h2 style={formTitle}>
              {editingId
                ? "고객 수정"
                : "거래처 등록"}
            </h2>

            <form onSubmit={handleSubmit}>
              <div style={grid}>
                <input name="code" value={form.code} onChange={handleChange} placeholder="코드" style={shortInput} />
                <input name="name" value={form.name} onChange={handleChange} placeholder="거래처명" style={shortInput} />
                <select
                  name="grade"
                  value={form.grade}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      grade: event.target.value as CustomerForm["grade"],
                    }))
                  }
                  style={{ ...gradeInput, backgroundColor: "white" }}
                  aria-label="거래처 등급"
                >
                  <option value="A">A그룹</option>
                  <option value="B">B그룹</option>
                  <option value="C">C그룹</option>
                  <option value="D">D그룹</option>
                </select>
                <input name="phone" value={form.phone} onChange={handleChange} placeholder="전화번호" style={phoneInput} />
                <input name="email" value={form.email} onChange={handleChange} placeholder="이메일" style={emailInput} />
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
                      setIsFormOpen(false);
                    }}
                  >
                    수정 취소
                  </button>
                )}
              </div>
            </form>
          </section>
        </div>
      </div>

      <section style={{ marginTop: "10px" }}>
        <div style={filterRow}>
          <select
            value={searchField}
            onChange={(event) => {
              setSearchField(event.target.value);
              setSearch("");
            }}
            style={filterSelect}
            aria-label="검색 항목 선택"
          >
            <option value="all">전체</option>
            <option value="code">거래처 코드</option>
            <option value="name">이름</option>
            <option value="grade">그룹별</option>
          </select>
          <input
            style={searchInput}
            value={search}
            onChange={(event) =>
              setSearch(event.target.value)
            }
            placeholder={
              searchField === "code"
                ? "거래처 코드 검색"
                : searchField === "name"
                  ? "거래처명 검색"
                  : searchField === "grade"
                    ? "A, B, C, D 그룹 검색"
                    : "거래처 코드 또는 이름 검색"
            }
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
                <th style={{ ...th, width: "90px" }}>코드</th>
                <th style={{ ...th, width: "90px" }}>거래처명</th>
                <th style={{ ...th, width: "68px" }}>그룹</th>
                <th style={{ ...th, width: "130px" }}>전화번호</th>
                <th style={{ ...th, width: "72px" }}>상태</th>
                <th style={{ ...th, width: "238px" }}>관리</th>
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
                    <td style={{ ...td, whiteSpace: "nowrap" }}>
                      {customer.grade || "D"}그룹
                    </td>
                    <td style={td}>
                      {customer.phone || "-"}
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
                        <button
                          style={deleteButton}
                          onClick={() =>
                            deleteCustomer(customer)
                          }
                        >
                          삭제
                        </button>
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

const topActionRow: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "8px",
  marginBottom: "8px",
};

const formToggleButton: React.CSSProperties = {
  minHeight: "34px",
  padding: "7px 13px",
  border: "none",
  borderRadius: "6px",
  backgroundColor: "#2563eb",
  color: "white",
  cursor: "pointer",
  fontWeight: 700,
  fontSize: "13px",
};

const excelActionRow: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  justifyContent: "flex-end",
  gap: "6px",
};

const section: React.CSSProperties = {
  border: "1px solid #e5e7eb",
  borderRadius: "8px",
  padding: "10px",
  marginBottom: "2px",
};

const formTitle: React.CSSProperties = {
  margin: "0 0 8px",
  fontSize: "16px",
};

const grid: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: "6px",
};

const input: React.CSSProperties = {
  minHeight: "36px",
  padding: "7px 9px",
  border: "1px solid #d1d5db",
  borderRadius: "6px",
  fontSize: "14px",
  boxSizing: "border-box",
  minWidth: 0,
};

const shortInput: React.CSSProperties = {
  ...input,
  width: "105px",
  flex: "0 0 105px",
};

const gradeInput: React.CSSProperties = {
  ...input,
  width: "90px",
  flex: "0 0 90px",
};

const phoneInput: React.CSSProperties = {
  ...input,
  width: "150px",
  flex: "0 0 150px",
};

const emailInput: React.CSSProperties = {
  ...input,
  minWidth: "180px",
  flex: "1 1 220px",
};

const fullInput: React.CSSProperties = {
  ...input,
  width: "100%",
  marginTop: "6px",
  boxSizing: "border-box",
};

const textarea: React.CSSProperties = {
  ...input,
  width: "100%",
  minHeight: "54px",
  height: "54px",
  marginTop: "6px",
  resize: "vertical",
};

const buttonRow: React.CSSProperties = {
  display: "flex",
  gap: "7px",
  marginTop: "7px",
};

const saveButton: React.CSSProperties = {
  minHeight: "34px",
  padding: "7px 14px",
  border: "none",
  borderRadius: "6px",
  backgroundColor: "#1f2937",
  color: "white",
  fontSize: "14px",
  fontWeight: "bold",
  cursor: "pointer",
};

const cancelButton: React.CSSProperties = {
  minHeight: "34px",
  padding: "7px 14px",
  border: "none",
  borderRadius: "6px",
  backgroundColor: "#6b7280",
  color: "white",
  cursor: "pointer",
};

const excelButton: React.CSSProperties = {
  minHeight: "34px",
  padding: "7px 12px",
  border: "none",
  borderRadius: "7px",
  backgroundColor: "#15803d",
  color: "white",
  cursor: "pointer",
  fontWeight: "bold",
  fontSize: "13px",
};

const excelUploadButton: React.CSSProperties = {
  ...excelButton,
  backgroundColor: "#ef4444",
};

const filterRow: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: "7px",
  marginBottom: "7px",
};

const searchInput: React.CSSProperties = {
  ...input,
  flex: 1,
  minWidth: "230px",
  padding: "6px 9px",
  fontSize: "13px",
};

const filterSelect: React.CSSProperties = {
  ...input,
  width: "125px",
  backgroundColor: "white",
  padding: "6px 9px",
  fontSize: "13px",
};

const table: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  minWidth: "688px",
  tableLayout: "fixed",
  fontSize: "12px",
};

const th: React.CSSProperties = {
  border: "1px solid #d1d5db",
  backgroundColor: "#f3f4f6",
  height: "34px",
  padding: "5px 4px",
  textAlign: "center",
  whiteSpace: "nowrap",
};

const td: React.CSSProperties = {
  border: "1px solid #d1d5db",
  height: "38px",
  padding: "4px",
  textAlign: "center",
  lineHeight: 1.25,
};

const actionRow: React.CSSProperties = {
  display: "flex",
  gap: "4px",
  justifyContent: "center",
  flexWrap: "nowrap",
  whiteSpace: "nowrap",
};

const priceButton: React.CSSProperties = {
  minHeight: "30px",
  padding: "4px 7px",
  border: "none",
  borderRadius: "5px",
  backgroundColor: "#7c3aed",
  color: "white",
  cursor: "pointer",
  fontSize: "11px",
  whiteSpace: "nowrap",
};

const editButton: React.CSSProperties = {
  padding: "5px 7px",
  border: "none",
  borderRadius: "5px",
  backgroundColor: "#2563eb",
  color: "white",
  cursor: "pointer",
  fontSize: "11px",
  whiteSpace: "nowrap",
};

const statusButton: React.CSSProperties = {
  ...editButton,
  backgroundColor: "#d97706",
};

const deleteButton: React.CSSProperties = {
  ...editButton,
  backgroundColor: "#dc2626",
};
