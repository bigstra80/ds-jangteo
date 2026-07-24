"use client";

import { useEffect, useMemo, useState } from "react";

type LedgerRow = {
  id: number;
  transactionDate: string;
  productName: string;
  quantity: number;
  supplierName: string | null;
  purchaseAmount: number;
  deliveryCompanyName: string | null;
  customerName: string | null;
  saleAmount: number;
  shippingFee: number;
  settlementStatus: string;
  memo: string | null;
};

type SupplierGroup = {
  supplierName: string;
  rows: LedgerRow[];
  totalQuantity: number;
  totalPurchaseAmount: number;
};

function money(value: number) {
  return Number(value || 0).toLocaleString("ko-KR");
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("ko-KR");
}

export default function BrokerPurchaseManager() {
  const [rows, setRows] = useState<LedgerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [expandedSuppliers, setExpandedSuppliers] = useState<Set<string>>(
    new Set()
  );

  async function loadCurrentUser() {
    try {
      const response = await fetch("/api/auth/me", { cache: "no-store" });
      if (!response.ok) { setIsAdmin(false); return; }
      const result = await response.json();
      setIsAdmin(result?.user?.role === "ADMIN");
    } catch { setIsAdmin(false); }
  }

  function toggleSupplier(supplierName: string) {
    setExpandedSuppliers((current) => {
      const next = new Set(current);
      if (next.has(supplierName)) {
        next.delete(supplierName);
      } else {
        next.add(supplierName);
      }
      return next;
    });
  }

  async function loadItems() {
    try {
      setLoading(true);

      const response = await fetch("/api/wholesale-ledger", {
        cache: "no-store",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error ||
            data?.message ||
            "도매 거래 한 줄 장부 내역을 불러오지 못했습니다."
        );
      }

      setRows(Array.isArray(data?.rows) ? data.rows : []);
    } catch (error) {
      console.error(error);
      alert(
        error instanceof Error
          ? error.message
          : "도매 거래 한 줄 장부 내역을 불러오지 못했습니다."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadCurrentUser();
    loadItems();
  }, []);

  const filteredRows = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    return rows
      .filter((row) => {
        if (!row.supplierName?.trim()) return false;

        const rowDate = new Date(row.transactionDate);
        if (Number.isNaN(rowDate.getTime())) return false;

        if (startDate) {
          const start = new Date(`${startDate}T00:00:00`);
          if (rowDate < start) return false;
        }

        if (endDate) {
          const end = new Date(`${endDate}T23:59:59.999`);
          if (rowDate > end) return false;
        }

        if (!keyword) return true;

        return [
          row.supplierName,
          row.productName,
          row.deliveryCompanyName,
          row.customerName,
          row.memo,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(keyword);
      })
      .sort((a, b) => {
        const dateDiff =
          new Date(a.transactionDate).getTime() -
          new Date(b.transactionDate).getTime();

        if (dateDiff !== 0) return dateDiff;
        return a.id - b.id;
      });
  }, [rows, search, startDate, endDate]);

  const groupedBySupplier = useMemo<SupplierGroup[]>(() => {
    const map = new Map<string, SupplierGroup>();

    for (const row of filteredRows) {
      const supplierName = row.supplierName?.trim();
      if (!supplierName) continue;

      const current =
        map.get(supplierName) ||
        {
          supplierName,
          rows: [],
          totalQuantity: 0,
          totalPurchaseAmount: 0,
        };

      current.rows.push(row);
      current.totalQuantity += Number(row.quantity || 0);
      current.totalPurchaseAmount += Number(row.purchaseAmount || 0);

      map.set(supplierName, current);
    }

    return Array.from(map.values()).sort((a, b) =>
      a.supplierName.localeCompare(b.supplierName, "ko")
    );
  }, [filteredRows]);

  const totalQuantity = filteredRows.reduce(
    (sum, row) => sum + Number(row.quantity || 0),
    0
  );

  const totalPurchaseAmount = filteredRows.reduce(
    (sum, row) => sum + Number(row.purchaseAmount || 0),
    0
  );

  return (
    <div style={pageStyle}>
      <div style={headerStyle}>
        <div>
          <h1 style={titleStyle}>🏪 업체별 매입목록</h1>
          <p style={subtitleStyle}>
            도매 거래 한 줄 장부에 입력된 공급업체별 매입 내역을 자동으로
            보여줍니다.
          </p>
        </div>

        <button onClick={loadItems} style={refreshButtonStyle}>
          새로고침
        </button>
      </div>

      <div style={summaryGridStyle}>
       
      </div>

      <div style={toolbarStyle}>
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="공급업체, 상품명, 납품업체, 고객 이름, 메모 검색"
          style={searchStyle}
        />

        <div style={dateFilterStyle}>
          <label style={dateLabelStyle}>
            시작일
            <input
              type="date"
              value={startDate}
              onChange={(event) => setStartDate(event.target.value)}
              style={dateInputStyle}
            />
          </label>

          <span style={dateSeparatorStyle}>~</span>

          <label style={dateLabelStyle}>
            종료일
            <input
              type="date"
              value={endDate}
              onChange={(event) => setEndDate(event.target.value)}
              style={dateInputStyle}
            />
          </label>

          <button
            type="button"
            onClick={() => {
              setStartDate("");
              setEndDate("");
            }}
            style={resetButtonStyle}
          >
            날짜 초기화
          </button>
        </div>
      </div>

      {loading ? (
        <div style={emptyStyle}>불러오는 중...</div>
      ) : groupedBySupplier.length === 0 ? (
        <div style={emptyStyle}>표시할 업체별 매입내역이 없습니다.</div>
      ) : (
        <div style={supplierListStyle}>
          {groupedBySupplier.map((group) => (
            <section key={group.supplierName} style={supplierCardStyle}>
              <div style={supplierHeaderStyle}>
                <div style={supplierTitleAreaStyle}>
                  <div style={supplierNameStyle}>{group.supplierName}</div>
                  <button
                    type="button"
                    onClick={() => toggleSupplier(group.supplierName)}
                    style={detailButtonStyle}
                  >
                    {expandedSuppliers.has(group.supplierName) ? "접기" : "상세"}
                  </button>
                </div>

                <div style={supplierSummaryStyle}>
                  총 {group.totalQuantity.toLocaleString()}개 ·{" "}
                  {isAdmin ? money(group.totalPurchaseAmount) : "***"}
                </div>
              </div>

              {expandedSuppliers.has(group.supplierName) && (
                <div style={tableWrapStyle}>
                  <table style={tableStyle}>
                    <thead>
                      <tr>
                        <th style={thStyle}>거래일</th>
                        <th style={thStyle}>상품명</th>
                        <th style={thStyle}>수량</th>
                        <th style={thStyle}>매입금액</th>
                        <th style={thStyle}>납품업체</th>
                        <th style={thStyle}>고객 이름</th>
                        <th style={thStyle}>메모</th>
                      </tr>
                    </thead>

                    <tbody>
                      {group.rows.map((row) => (
                        <tr key={row.id}>
                          <td style={tdStyle}>
                            {formatDate(row.transactionDate)}
                          </td>
                          <td style={productTdStyle} title={row.productName}>
                            {row.productName}
                          </td>
                          <td style={tdStyle}>
                            {row.quantity.toLocaleString()}개
                          </td>
                          <td style={tdStyle}>
                            {isAdmin ? money(row.purchaseAmount) : "***"}
                          </td>
                          <td style={tdStyle}>
                            {row.deliveryCompanyName || "-"}
                          </td>
                          <td style={tdStyle}>{row.customerName || "-"}</td>
                          <td style={tdStyle}>{row.memo || "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          ))}
        </div>
      )}
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
    <div style={summaryCardStyle}>
      <div style={summaryLabelStyle}>{label}</div>
      <div style={summaryValueStyle}>{value}</div>
    </div>
  );
}

const pageStyle: React.CSSProperties = {
  width: "100%",
  maxWidth: "1500px",
};

const headerStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: "20px",
  marginBottom: "22px",
};

const titleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: "28px",
};

const subtitleStyle: React.CSSProperties = {
  margin: "8px 0 0",
  color: "#64748b",
  lineHeight: 1.6,
};

const refreshButtonStyle: React.CSSProperties = {
  padding: "11px 16px",
  border: "none",
  borderRadius: "8px",
  background: "#2563eb",
  color: "white",
  fontWeight: 800,
  cursor: "pointer",
};

const summaryGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
  gap: "14px",
  marginBottom: "18px",
};

const summaryCardStyle: React.CSSProperties = {
  padding: "18px",
  border: "1px solid #e2e8f0",
  borderRadius: "12px",
  background: "white",
};

const summaryLabelStyle: React.CSSProperties = {
  color: "#64748b",
  fontSize: "13px",
};

const summaryValueStyle: React.CSSProperties = {
  marginTop: "7px",
  fontSize: "24px",
  fontWeight: 900,
};

const toolbarStyle: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  alignItems: "flex-end",
  gap: "12px",
  marginBottom: "18px",
};

const searchStyle: React.CSSProperties = {
  width: "320px",
  minWidth: "220px",
  height: "48px",
  border: "1px solid #cbd5e1",
  borderRadius: "10px",
  padding: "0 16px",
  fontSize: "15px",
  boxSizing: "border-box",
};

const dateFilterStyle: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  alignItems: "flex-end",
  gap: "8px",
};

const dateLabelStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "5px",
  color: "#475569",
  fontSize: "12px",
  fontWeight: 700,
};

const dateInputStyle: React.CSSProperties = {
  minWidth: "145px",
  padding: "10px 12px",
  border: "1px solid #cbd5e1",
  borderRadius: "8px",
  background: "white",
};

const dateSeparatorStyle: React.CSSProperties = {
  paddingBottom: "10px",
  color: "#64748b",
};

const resetButtonStyle: React.CSSProperties = {
  padding: "10px 14px",
  border: "1px solid #cbd5e1",
  borderRadius: "8px",
  background: "white",
  color: "#334155",
  fontWeight: 700,
  cursor: "pointer",
};

const supplierListStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "18px",
};

const supplierCardStyle: React.CSSProperties = {
  overflow: "hidden",
  border: "1px solid #e2e8f0",
  borderRadius: "12px",
  background: "white",
};

const supplierHeaderStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "20px",
  padding: "16px 18px",
  background: "#f8fafc",
  borderBottom: "1px solid #e2e8f0",
};

const supplierTitleAreaStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "10px",
};

const detailButtonStyle: React.CSSProperties = {
  padding: "6px 11px",
  border: "1px solid #2563eb",
  borderRadius: "7px",
  background: "white",
  color: "#2563eb",
  fontSize: "12px",
  fontWeight: 800,
  cursor: "pointer",
};

const supplierNameStyle: React.CSSProperties = {
  fontSize: "18px",
  fontWeight: 900,
};

const supplierSummaryStyle: React.CSSProperties = {
  fontWeight: 800,
  color: "#1d4ed8",
};

const tableWrapStyle: React.CSSProperties = {
  overflowX: "auto",
};

const tableStyle: React.CSSProperties = {
  width: "100%",
  minWidth: "980px",
  borderCollapse: "collapse",
  tableLayout: "fixed",
};

const thStyle: React.CSSProperties = {
  padding: "11px 10px",
  textAlign: "left",
  background: "#f8fafc",
  borderBottom: "1px solid #e2e8f0",
  color: "#475569",
  fontSize: "12px",
};

const tdStyle: React.CSSProperties = {
  padding: "11px 10px",
  borderBottom: "1px solid #f1f5f9",
  fontSize: "13px",
  textAlign: "left",
  verticalAlign: "middle",
};

const productTdStyle: React.CSSProperties = {
  ...tdStyle,
  fontWeight: 800,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const emptyStyle: React.CSSProperties = {
  padding: "50px",
  textAlign: "center",
  border: "1px solid #e2e8f0",
  borderRadius: "12px",
  background: "white",
  color: "#64748b",
};