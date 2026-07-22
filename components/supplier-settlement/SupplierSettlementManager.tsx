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
    loadData();
  }, []);

  const filteredRows = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    return data
      .flatMap((item) => item.rows)
      .filter((row) => {
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
  }, [data, search]);

  function downloadExcel() {
    const excelRows = filteredRows.map((row) => ({
      거래일: new Date(row.transactionDate).toLocaleDateString("ko-KR"),
      공급업체: row.supplierName || "-",
      상품명: row.productName,
      이름: row.customerName || "-",
      수량: row.quantity,
      금액: row.purchaseAmount || 0,
      배송비: row.shippingFee || 0,
      총금액: (row.purchaseAmount || 0) + (row.shippingFee || 0),
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
      { wch: 14 },
      { wch: 24 },
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "공급업체 정산");

    const today = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(workbook, `공급업체_정산_${today}.xlsx`);
  }

  const totalSummary = useMemo(() => {
    return data.reduce(
      (result, item) => {
        result.tradeCount += item.tradeCount;
        result.grossPurchaseAmount += item.grossPurchaseAmount;
        result.returnAmount += item.returnAmount;
        result.netPurchaseAmount += item.netPurchaseAmount;
        result.payableAmount += item.payableAmount;
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
  }, [data]);

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
          value={`${money(totalSummary.grossPurchaseAmount)}원`}
        />
        <SummaryCard
          title="반품금액"
          value={`${money(totalSummary.returnAmount)}원`}
        />
        <SummaryCard
          title="현재 정산금액"
          value={`${money(totalSummary.payableAmount)}원`}
          emphasize
        />
      </div>

      <div style={toolbarStyle}>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="공급업체·상품명·이름·메모 검색"
          style={searchStyle}
        />

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
            <col style={{ width: 120 }} />
            <col style={{ width: 150 }} />
            <col style={{ width: 280 }} />
            <col style={{ width: 150 }} />
            <col style={{ width: 80 }} />
            <col style={{ width: 130 }} />
            <col style={{ width: 110 }} />
            <col style={{ width: 150 }} />
            <col style={{ width: 220 }} />
          </colgroup>
          <thead>
            <tr style={{ background: "#f8fafc" }}>
              <th style={centerThStyle}>거래일</th>
              <th style={leftThStyle}>공급업체</th>
              <th style={leftThStyle}>상품명</th>
              <th style={leftThStyle}>이름</th>
              <th style={centerThStyle}>수량</th>
              <th style={rightThStyle}>금액</th>
              <th style={rightThStyle}>배송비</th>
              <th style={totalAmountThStyle}>총금액</th>
              <th style={leftThStyle}>메모</th>
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td colSpan={9} style={emptyStyle}>불러오는 중...</td>
              </tr>
            ) : filteredRows.length === 0 ? (
              <tr>
                <td colSpan={9} style={emptyStyle}>
                  표시할 거래내역이 없습니다.
                </td>
              </tr>
            ) : (
              filteredRows.map((row) => (
                <tr key={row.id} style={{ borderTop: "1px solid #e5e7eb" }}>
                  <td style={centerTdStyle}>
                    {new Date(row.transactionDate).toLocaleDateString("ko-KR")}
                  </td>
                  <td style={tdStyle}>{row.supplierName || "-"}</td>
                  <td style={tdStyle}><strong>{row.productName}</strong></td>
                  <td style={tdStyle}>{row.customerName || "-"}</td>
                  <td style={centerTdStyle}>{row.quantity}</td>
                  <td style={moneyStyle}>{money(row.purchaseAmount)}원</td>
                  <td style={moneyStyle}>{money(row.shippingFee || 0)}원</td>
                  <td style={totalAmountTdStyle}>
                    {money((row.purchaseAmount || 0) + (row.shippingFee || 0))}원
                  </td>
                  <td style={{ ...tdStyle, paddingLeft: 24 }}>
                    {row.memo || "-"}
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
  gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
  gap: 14,
  marginBottom: 24,
};

const summaryCardStyle: React.CSSProperties = {
  padding: 18,
  backgroundColor: "#fff",
  border: "1px solid #e5e7eb",
  borderRadius: 12,
};

const summaryTitleStyle: React.CSSProperties = {
  color: "#6b7280",
  fontSize: 13,
  marginBottom: 8,
};

const toolbarStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  marginBottom: 16,
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
  width: "100%",
  maxWidth: 620,
  height: 42,
  padding: "0 14px",
  border: "1px solid #d1d5db",
  borderRadius: 8,
  fontSize: 14,
};

const tableWrapStyle: React.CSSProperties = {
  overflowX: "auto",
  border: "1px solid #e5e7eb",
  borderRadius: 12,
  backgroundColor: "#fff",
};

const tableStyle: React.CSSProperties = {
  width: 1310,
  maxWidth: "100%",
  borderCollapse: "collapse",
  tableLayout: "fixed",
};

const thStyle: React.CSSProperties = {
  padding: "12px 10px",
  fontSize: 13,
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
  padding: "12px 10px",
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

const totalAmountThStyle: React.CSSProperties = {
  ...rightThStyle,
  paddingRight: 28,
};

const totalAmountTdStyle: React.CSSProperties = {
  ...moneyStyle,
  fontWeight: 900,
  paddingRight: 28,
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
