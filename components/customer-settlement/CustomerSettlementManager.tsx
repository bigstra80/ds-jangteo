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
  customerId: number | null;
  customerCode: string;
  customerName: string;
  tradeCount: number;
  grossSalesAmount: number;
  returnAmount: number;
  netSalesAmount: number;
  receivableAmount: number;
  recentTradeDate: string | null;
  rows: LedgerDetail[];
};

function money(value: number) {
  return Number(value || 0).toLocaleString("ko-KR");
}

export default function CustomerSettlementManager() {
  const [data, setData] = useState<Settlement[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  async function loadData() {
    try {
      setLoading(true);

      const response = await fetch("/api/customer-settlement", {
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
          : "거래처 정산 정보를 불러오지 못했습니다."
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
        const rowDate = String(row.transactionDate).slice(0, 10);

        if (startDate && rowDate < startDate) return false;
        if (endDate && rowDate > endDate) return false;
        if (!keyword) return true;

        return [
          row.deliveryCompanyName,
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
      거래처: row.deliveryCompanyName || "-",
      상품명: row.productName,
      이름: row.customerName || "-",
      수량: row.quantity,
      금액: row.saleAmount || 0,
      배송비: row.shippingFee || 0,
      총금액: (row.saleAmount || 0) + (row.shippingFee || 0),
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
    XLSX.utils.book_append_sheet(workbook, worksheet, "거래처 정산");

    const today = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(workbook, `거래처_정산_${today}.xlsx`);
  }

  const totalSummary = useMemo(() => {
    return filteredRows.reduce(
      (result, row) => {
        const saleAmount = Number(row.saleAmount || 0);
        const shippingFee = Number(row.shippingFee || 0);
        const totalAmount = saleAmount + shippingFee;
        const isReturn =
          saleAmount < 0 ||
          String(row.memo || "").trim().toLowerCase().includes("반품");

        result.tradeCount += 1;
        result.grossSalesAmount += totalAmount;

        if (isReturn) {
          result.returnAmount += Math.abs(totalAmount);
        }

        result.netSalesAmount += totalAmount;
        result.receivableAmount += totalAmount;

        return result;
      },
      {
        tradeCount: 0,
        grossSalesAmount: 0,
        returnAmount: 0,
        netSalesAmount: 0,
        receivableAmount: 0,
      }
    );
  }, [filteredRows]);

  return (
    <div style={{ width: "100%", minWidth: 0 }}>
      <style jsx>{`
        .customer-settlement-summary {
          display: grid;
          grid-template-columns: repeat(4, 190px);
          gap: 10px;
          margin-bottom: 16px;
          justify-content: start;
        }

        .customer-settlement-toolbar {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 10px;
          margin-bottom: 12px;
        }

        .customer-settlement-filter-left {
          display: flex;
          align-items: flex-end;
          gap: 8px;
          flex-wrap: nowrap;
          min-width: 0;
        }

        .customer-settlement-date-group {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .customer-settlement-date-label {
          font-size: 11px;
          font-weight: 700;
          color: #475569;
        }

        .customer-settlement-date-input {
          width: 128px;
          height: 36px;
          padding: 0 9px;
          border: 1px solid #cbd5e1;
          border-radius: 8px;
          box-sizing: border-box;
          font-size: 12px;
          background: #fff;
        }

        .customer-settlement-reset-button {
          height: 36px;
          padding: 0 10px;
          min-width: 88px;
          white-space: nowrap;
          font-size: 12px;
          border: 1px solid #cbd5e1;
          border-radius: 8px;
          background: #fff;
          font-weight: 700;
          cursor: pointer;
        }

        .customer-settlement-table-wrap {
          width: min(1080px, 100%);
          min-width: 0;
          overflow: hidden;
          margin-right: auto;
        }

        .customer-settlement-table {
          width: 100%;
          min-width: 0;
          border-collapse: collapse;
          table-layout: fixed;
        }

        .customer-settlement-table th,
        .customer-settlement-table td {
          overflow-wrap: anywhere;
          word-break: keep-all;
        }

        .customer-settlement-table th {
          padding: 7px 4px !important;
          font-size: 11px !important;
        }

        .customer-settlement-table td {
          padding: 12px 10px !important;
          font-size: 14px !important;
          line-height: 1.45 !important;
        }

        .customer-settlement-table .product-cell,
        .customer-settlement-table .memo-cell {
          white-space: normal;
        }

        @media (max-width: 1250px) {
          .customer-settlement-table th {
            padding: 9px 6px !important;
            font-size: 11px !important;
          }

          .customer-settlement-table td {
            padding: 12px 10px !important;
            font-size: 14px !important;
            line-height: 1.45 !important;
          }

          .customer-settlement-table .memo-cell {
            padding-left: 8px !important;
          }

          .customer-settlement-table .total-amount-cell,
          .customer-settlement-table .total-amount-head {
            padding-right: 8px !important;
          }
        }

        @media (max-width: 980px) {
          .customer-settlement-summary {
            grid-template-columns: repeat(2, 190px);
            gap: 10px;
          }

          .customer-settlement-toolbar {
            align-items: stretch;
          }

          .customer-settlement-table th {
            padding: 7px 4px !important;
            font-size: 10px !important;
          }

          .customer-settlement-table td {
            padding: 10px 8px !important;
            font-size: 14px !important;
            line-height: 1.4 !important;
          }
        }

        @media (max-width: 700px) {
          .customer-settlement-summary {
            grid-template-columns: 190px;
          }

          .customer-settlement-toolbar {
            flex-direction: column;
          }

          .customer-settlement-search {
            max-width: none !important;
          }

          .customer-settlement-table th {
            font-size: 9px !important;
            padding: 6px 3px !important;
          }

          .customer-settlement-table td {
            font-size: 13px !important;
            padding: 8px 5px !important;
            line-height: 1.35 !important;
          }
        }
      `}</style>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ marginBottom: 8 }}>📒 거래처 정산·미수금</h1>
        <p style={{ margin: 0, color: "#6b7280" }}>
          도매 거래 한 줄 장부의 납품업체별 판매·반품·미수금을 자동으로
          집계합니다.
        </p>
      </div>

      <div className="customer-settlement-summary">
        <SummaryCard
          title="전체 거래건수"
          value={`${totalSummary.tradeCount.toLocaleString()}건`}
        />
        <SummaryCard
          title="총 판매금액"
          value={`${money(totalSummary.grossSalesAmount)}원`}
        />
        <SummaryCard
          title="반품금액"
          value={`${money(totalSummary.returnAmount)}원`}
        />
        <SummaryCard
          title="현재 미수금"
          value={`${money(totalSummary.receivableAmount)}원`}
          emphasize
        />
      </div>

      <div className="customer-settlement-toolbar">
        <div className="customer-settlement-filter-left">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="거래처·상품명·이름·메모 검색"
            className="customer-settlement-search"
            style={searchStyle}
          />

          <div className="customer-settlement-date-group">
            <label className="customer-settlement-date-label">시작일</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="customer-settlement-date-input"
            />
          </div>

          <span style={{ paddingBottom: 9 }}>~</span>

          <div className="customer-settlement-date-group">
            <label className="customer-settlement-date-label">종료일</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="customer-settlement-date-input"
            />
          </div>

          <button
            type="button"
            className="customer-settlement-reset-button"
            onClick={() => {
              setStartDate("");
              setEndDate("");
            }}
          >
            날짜 초기화
          </button>
        </div>

        <button onClick={downloadExcel} style={excelButtonStyle}>
          엑셀 다운로드
        </button>
      </div>

      <div className="customer-settlement-table-wrap" style={tableWrapStyle}>
        <table className="customer-settlement-table" style={tableStyle}>
          <colgroup>
            <col style={{ width: 95 }} />
            <col style={{ width: 95 }} />
            <col style={{ width: 240 }} />
            <col style={{ width: 110 }} />
            <col style={{ width: 55 }} />
            <col style={{ width: 105 }} />
            <col style={{ width: 90 }} />
            <col style={{ width: 105 }} />
            <col style={{ width: 160 }} />
          </colgroup>
          <thead>
            <tr style={{ background: "#f8fafc" }}>
              <th style={centerThStyle}>거래일</th>
              <th style={leftThStyle}>거래처</th>
              <th style={leftThStyle}>상품명</th>
              <th style={leftThStyle}>이름</th>
              <th style={centerThStyle}>수량</th>
              <th style={rightThStyle}>금액</th>
              <th style={rightThStyle}>배송비</th>
              <th className="total-amount-head" style={totalAmountThStyle}>총금액</th>
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
                  <td style={tdStyle}>{row.deliveryCompanyName || "-"}</td>
                  <td className="product-cell" style={tdStyle}><strong>{row.productName}</strong></td>
                  <td style={tdStyle}>{row.customerName || "-"}</td>
                  <td style={centerTdStyle}>{row.quantity}</td>
                  <td style={moneyStyle}>{money(row.saleAmount)}원</td>
                  <td style={moneyStyle}>{money(row.shippingFee || 0)}원</td>
                  <td className="total-amount-cell" style={totalAmountTdStyle}>
                    {money((row.saleAmount || 0) + (row.shippingFee || 0))}원
                  </td>
                  <td className="memo-cell" style={{ ...tdStyle, paddingLeft: 38 }}>
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
  width: "min(1080px, 100%)",
  minWidth: 0,
  overflow: "hidden",
  marginRight: "auto",
  border: "1px solid #e5e7eb",
  borderRadius: 12,
  backgroundColor: "#fff",
};

const tableStyle: React.CSSProperties = {
  width: "100%",
  maxWidth: 1080,
  minWidth: 0,
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
  paddingRight: 30,
};

const totalAmountTdStyle: React.CSSProperties = {
  ...moneyStyle,
  fontWeight: 900,
  paddingRight: 20,
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