"use client";

import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";

type LedgerDetail = {
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

type Settlement = {
  supplierName: string;
  tradeCount: number;
  grossPurchaseAmount: number;
  returnAmount: number;
  netPurchaseAmount: number;
  payableAmount: number;
  recentTradeDate: string | null;
  rows: LedgerDetail[];
};

function money(value: number) {
  return Number(value || 0).toLocaleString("ko-KR");
}

export default function SupplierSettlementManager() {
  const [data, setData] = useState<Settlement[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);

  async function loadCurrentUser() {
    try {
      const response = await fetch("/api/auth/me", { cache: "no-store" });
      if (!response.ok) { setIsAdmin(false); return; }
      const result = await response.json();
      setIsAdmin(result?.user?.role === "ADMIN");
    } catch { setIsAdmin(false); }
  }

  async function loadData() {
    try {
      setLoading(true);

      const response = await fetch("/api/supplier-settlement", {
        cache: "no-store",
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.message || "조회에 실패했습니다."
        );
      }

      setData(Array.isArray(result) ? result : []);
    } catch (error) {
      console.error(error);
      alert(
        error instanceof Error
          ? error.message
          : "공급업체 정산 정보를 불러오지 못했습니다."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadCurrentUser();
    loadData();
  }, []);

  const filteredRows = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    return data
      .flatMap((item) => item.rows)
      .filter((row) => {
        const rowDate = String(row.transactionDate).slice(0, 10);
        if (startDate && rowDate < startDate) return false;
        if (endDate && rowDate > endDate) return false;
        if (!keyword) return true;

        return [
          row.supplierName,
          row.productName,
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

        // 같은 거래일이면 먼저 등록된 거래(id가 작은 거래)를 위에 표시
        return a.id - b.id;
      });
  }, [data, search, startDate, endDate]);

  function downloadExcel() {
    const excelRows = filteredRows.map((row) => ({
      거래일: new Date(row.transactionDate).toLocaleDateString("ko-KR"),
      공급업체: row.supplierName || "-",
      상품명: row.productName,
      이름: row.customerName || "-",
      수량: row.quantity,
      금액: row.purchaseAmount || 0,
      배송비: row.shippingFee || 0,
      메모: row.memo || "-",
    }));

    const worksheet = XLSX.utils.json_to_sheet(excelRows);

    worksheet["!cols"] = [
      { wch: 14 },
      { wch: 18 },
      { wch: 34 },
      { wch: 16 },
      { wch: 8 },
      { wch: 14 },
      { wch: 12 },
      { wch: 24 },
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "공급업체 정산");

    const today = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(workbook, `공급업체_정산_${today}.xlsx`);
  }

  // 검색어와 날짜 필터로 현재 화면에 표시되는 거래내역만 기준으로 요약 카드 재계산
  const totalSummary = useMemo(() => {
    return filteredRows.reduce(
      (result, row) => {
        const purchaseAmount = Number(row.purchaseAmount || 0);

        result.tradeCount += 1;

        if (purchaseAmount < 0) {
          result.returnAmount += Math.abs(purchaseAmount);
        } else {
          result.grossPurchaseAmount += purchaseAmount;
        }

        result.netPurchaseAmount += purchaseAmount;
        result.payableAmount += purchaseAmount;

        return result;
      },
      {
        tradeCount: 0,
        grossPurchaseAmount: 0,
        returnAmount: 0,
        netPurchaseAmount: 0,
        payableAmount: 0,
      }
    );
  }, [filteredRows]);

  return (
    <div style={{ width: "100%" }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ marginBottom: 8 }}>📕 공급업체 정산</h1>
        <p style={{ margin: 0, color: "#6b7280" }}>
          도매 거래 한 줄 장부의 공급업체별 매입·반품·정산금액을 자동으로
          집계합니다.
        </p>
      </div>

      <div style={summaryGridStyle}>
        <SummaryCard
          title="전체 거래건수"
          value={`${totalSummary.tradeCount.toLocaleString()}건`}
        />
        <SummaryCard
          title="총 매입금액"
          value={isAdmin ? `${money(totalSummary.grossPurchaseAmount)}` : "***"}
        />
        <SummaryCard
          title="반품금액"
          value={isAdmin ? `${money(totalSummary.returnAmount)}` : "***"}
        />
        <SummaryCard
          title="현재 정산금액"
          value={isAdmin ? `${money(totalSummary.payableAmount)}` : "***"}
          emphasize
        />
      </div>

      <div style={toolbarStyle}>
        <div style={filterLeftStyle}>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="공급업체·상품명·이름·메모 검색"
            style={searchStyle}
          />

          <div style={dateGroupStyle}>
            <label style={dateLabelStyle}>시작일</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              style={dateInputStyle}
            />
          </div>

          <span style={{ paddingBottom: 9 }}>~</span>

          <div style={dateGroupStyle}>
            <label style={dateLabelStyle}>종료일</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              style={dateInputStyle}
            />
          </div>

          <button
            type="button"
            onClick={() => {
              setStartDate("");
              setEndDate("");
            }}
            style={dateResetButtonStyle}
          >
            날짜 초기화
          </button>
        </div>

        <button
          type="button"
          onClick={downloadExcel}
          style={excelButtonStyle}
        >
          엑셀 다운로드
        </button>
      </div>

      <div style={tableWrapStyle}>
        <table style={tableStyle}>
          <colgroup>
            <col style={{ width: 92 }} />
            <col style={{ width: 82 }} />
            <col style={{ width: 205 }} />
            <col style={{ width: 95 }} />
            <col style={{ width: 48 }} />
            <col style={{ width: 76 }} />
            <col style={{ width: 105 }} />
            <col style={{ width: 132 }} />
          </colgroup>
          <thead>
            <tr style={{ background: "#f8fafc" }}>
              <th style={centerThStyle}>거래일</th>
              <th style={leftThStyle}>공급업체</th>
              <th style={leftThStyle}>상품명</th>
              <th style={leftThStyle}>이름</th>
              <th style={centerThStyle}>수량</th>
              <th style={rightThStyle}>금액</th>
              <th style={{ ...rightThStyle, paddingRight: 14 }}>배송비</th>
              <th style={centerThStyle}>메모</th>
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} style={emptyStyle}>불러오는 중...</td>
              </tr>
            ) : filteredRows.length === 0 ? (
              <tr>
                <td colSpan={8} style={emptyStyle}>
                  표시할 거래내역이 없습니다.
                </td>
              </tr>
            ) : (
              filteredRows.map((row) => (
                <tr
                  key={row.id}
                  style={{
                    borderTop: "1px solid #e5e7eb",
                    color: row.memo?.trim() === "회수반품" ? "#dc2626" : undefined,
                  }}
                >
                  <td style={centerTdStyle}>
                    {new Date(row.transactionDate).toLocaleDateString("ko-KR")}
                  </td>
                  <td style={tdStyle}>{row.supplierName || "-"}</td>
                  <td
                    style={{
                      ...tdStyle,
                      whiteSpace: "normal",
                      overflowWrap: "anywhere",
                      wordBreak: "keep-all",
                    }}
                  >
                    <strong>{row.productName}</strong>
                  </td>
                  <td style={tdStyle}>{row.customerName || "-"}</td>
                  <td style={centerTdStyle}>{row.quantity}</td>
                  <td style={moneyStyle}>{isAdmin ? `${money(row.purchaseAmount)}` : "***"}</td>
                  <td style={{ ...moneyStyle, paddingRight: 14 }}>{money(row.shippingFee || 0)}</td>
                  <td
                    style={{
                      ...tdStyle,
                      paddingLeft: 6,
                      whiteSpace: "normal",
                      overflowWrap: "anywhere",
                      textAlign: "center",
                    }}
                    title={row.memo || ""}
                  >
                    {row.memo?.trim() || "-"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>


    </div>
  );
}

function SummaryCard({
  title,
  value,
  emphasize = false,
}: {
  title: string;
  value: string;
  emphasize?: boolean;
}) {
  return (
    <div style={summaryCardStyle}>
      <div style={summaryTitleStyle}>{title}</div>
      <div
        style={{
          fontSize: 22,
          fontWeight: 900,
          color: emphasize ? "#dc2626" : "#111827",
        }}
      >
        {value}
      </div>
    </div>
  );
}

const summaryGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(4, 190px)",
  gap: 10,
  marginBottom: 16,
  justifyContent: "start",
};

const summaryCardStyle: React.CSSProperties = {
  padding: "11px 13px",
  minHeight: 74,
  backgroundColor: "#fff",
  border: "1px solid #e5e7eb",
  borderRadius: 10,
};

const summaryTitleStyle: React.CSSProperties = {
  color: "#6b7280",
  fontSize: 13,
  marginBottom: 8,
};

const toolbarStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "flex-end",
  justifyContent: "space-between",
  gap: 10,
  marginBottom: 12,
  flexWrap: "wrap",
};

const filterLeftStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "flex-end",
  gap: 8,
  flexWrap: "wrap",
};

const dateGroupStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 4,
};

const dateLabelStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  color: "#475569",
};

const dateInputStyle: React.CSSProperties = {
  width: 128,
  height: 36,
  padding: "0 9px",
  border: "1px solid #cbd5e1",
  borderRadius: 8,
  boxSizing: "border-box",
  fontSize: 12,
  background: "#fff",
};

const dateResetButtonStyle: React.CSSProperties = {
  height: 36,
  minWidth: 88,
  padding: "0 10px",
  whiteSpace: "nowrap",
  fontSize: 12,
  fontWeight: 700,
  border: "1px solid #cbd5e1",
  borderRadius: 8,
  background: "#fff",
  cursor: "pointer",
};

const excelButtonStyle: React.CSSProperties = {
  height: 42,
  padding: "0 18px",
  border: "none",
  borderRadius: 8,
  background: "#16a34a",
  color: "#fff",
  fontWeight: 800,
  cursor: "pointer",
  whiteSpace: "nowrap",
};

const searchStyle: React.CSSProperties = {
  width: 300,
  maxWidth: "100%",
  height: 36,
  padding: "0 12px",
  border: "1px solid #d1d5db",
  borderRadius: 8,
  fontSize: 13,
};

const tableWrapStyle: React.CSSProperties = {
  width: "min(835px, 100%)",
  minWidth: 0,
  overflow: "hidden",
  marginRight: "auto",
  border: "1px solid #e5e7eb",
  borderRadius: 12,
  backgroundColor: "#fff",
};

const tableStyle: React.CSSProperties = {
  width: "100%",
  maxWidth: 835,
  minWidth: 0,
  borderCollapse: "collapse",
  tableLayout: "fixed",
};

const thStyle: React.CSSProperties = {
  padding: "7px 2px",
  fontSize: 12,
  whiteSpace: "nowrap",
  verticalAlign: "middle",
  borderBottom: "1px solid #e5e7eb",
};

const leftThStyle: React.CSSProperties = {
  ...thStyle,
  textAlign: "left",
};

const centerThStyle: React.CSSProperties = {
  ...thStyle,
  textAlign: "center",
};

const rightThStyle: React.CSSProperties = {
  ...thStyle,
  textAlign: "right",
};

const tdStyle: React.CSSProperties = {
  padding: "9px 4px",
  fontSize: 14,
  verticalAlign: "middle",
  lineHeight: 1.45,
};

const centerTdStyle: React.CSSProperties = {
  ...tdStyle,
  textAlign: "center",
};

const moneyStyle: React.CSSProperties = {
  ...tdStyle,
  textAlign: "right",
  fontVariantNumeric: "tabular-nums",
};



const emptyStyle: React.CSSProperties = {
  padding: 36,
  textAlign: "center",
  color: "#6b7280",
};

const subTextStyle: React.CSSProperties = {
  marginTop: 4,
  color: "#6b7280",
  fontSize: 12,
};

const detailButton: React.CSSProperties = {
  border: "1px solid #bfdbfe",
  borderRadius: 7,
  background: "#eff6ff",
  color: "#2563eb",
  padding: "7px 11px",
  fontWeight: 800,
  cursor: "pointer",
};

const detailWrapStyle: React.CSSProperties = {
  marginTop: 28,
  padding: 20,
  border: "1px solid #dbeafe",
  borderRadius: 12,
  backgroundColor: "#f8fbff",
};

const detailHeaderStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: 18,
};

const closeButton: React.CSSProperties = {
  border: "1px solid #cbd5e1",
  borderRadius: 7,
  background: "#fff",
  padding: "7px 12px",
  cursor: "pointer",
  fontWeight: 700,
};

const unsettledBadge: React.CSSProperties = {
  display: "inline-block",
  borderRadius: 999,
  padding: "4px 8px",
  background: "#fee2e2",
  color: "#b91c1c",
  fontSize: 12,
  fontWeight: 800,
};

const settledBadge: React.CSSProperties = {
  display: "inline-block",
  borderRadius: 999,
  padding: "4px 8px",
  background: "#dcfce7",
  color: "#166534",
  fontSize: 12,
  fontWeight: 800,
};