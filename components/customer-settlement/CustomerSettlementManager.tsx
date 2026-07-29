"use client";

import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { getLocalDateString } from "@/lib/local-date";
import { zeroAmountTextColor } from "@/lib/zero-amount-style";
import {
  COMPACT_CONTROL_HEIGHT,
  COMPACT_TABLE_BODY_FONT_SIZE,
  COMPACT_TABLE_CELL_PADDING,
  COMPACT_TABLE_HEADER_FONT_SIZE,
  COMPACT_TABLE_HEADER_HEIGHT,
  COMPACT_TABLE_LINE_HEIGHT,
  COMPACT_TABLE_ROW_HEIGHT,
  COMPACT_TOOLBAR_MARGIN_BOTTOM,
  SETTLEMENT_DATE_COLUMN_WIDTH,
  SETTLEMENT_MEMO_MIN_WIDTH,
  SETTLEMENT_TABLE_MIN_WIDTH,
  settlementDateCellStyle,
  settlementPageStyle,
  settlementWrappingCellStyle,
} from "@/lib/settlement-table-layout";

type SortOrder = "inputDesc" | "inputAsc";

type LedgerDetail = {
  id: number;
  transactionDate: string;
  productCode: string | null;
  productName: string;
  quantity: number;
  supplierName: string | null;
  purchaseAmount: number;
  deliveryCompanyName: string | null;
  customerName: string | null;
  customerPhone: string | null;
  saleAmount: number;
  shippingFee: number;
  settlementStatus: string;
  memo: string | null;
  createdAt: string;
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
  const [searchField, setSearchField] = useState("all");
  const [startDate, setStartDate] = useState(getLocalDateString);
  const [endDate, setEndDate] = useState("");
  const [sortOrder, setSortOrder] = useState<SortOrder>("inputDesc");

  async function loadData() {
    try {
      setLoading(true);

      const response = await fetch(`/api/customer-settlement?ts=${Date.now()}`, {
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
    // Initial client-side settlement hydration is intentionally performed once.
    // eslint-disable-next-line react-hooks/set-state-in-effect
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

        const fields: Record<string, unknown[]> = {
          all: [row.deliveryCompanyName, row.productCode, row.productName, row.customerName, row.customerPhone, row.memo],
          deliveryCompany: [row.deliveryCompanyName],
          productCode: [row.productCode],
          product: [row.productName],
          customer: [row.customerName],
          phone: [row.customerPhone],
          memo: [row.memo],
        };
        return (fields[searchField] || fields.all).some((value) =>
          String(value || "").toLowerCase().includes(keyword)
        );
      })
      .sort((a, b) => {
        const createdDiff =
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        if (createdDiff !== 0) {
          return sortOrder === "inputAsc" ? createdDiff : -createdDiff;
        }
        return sortOrder === "inputAsc" ? a.id - b.id : b.id - a.id;
      });
  }, [data, search, searchField, startDate, endDate, sortOrder]);

  function downloadExcel() {
    const excelRows = filteredRows.map((row) => ({
      거래일: new Date(row.transactionDate).toLocaleDateString("ko-KR"),
      거래처: row.deliveryCompanyName || "-",
      상품번호: row.productCode || "-",
      상품명: row.productName,
      이름: row.customerName || "-",
      전화번호: row.customerPhone || "-",
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
      { wch: 16 },
      { wch: 34 },
      { wch: 16 },
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

        result.tradeCount += 1;
        result.saleAmount += saleAmount;
        result.shippingFee += shippingFee;
        result.totalAmount += saleAmount + shippingFee;

        return result;
      },
      {
        tradeCount: 0,
        saleAmount: 0,
        shippingFee: 0,
        totalAmount: 0,
      }
    );
  }, [filteredRows]);

  return (
    <div style={settlementPageStyle} className="settlement-fixed-page">
      <style jsx>{`
        .customer-settlement-summary {
          display: grid;
          grid-template-columns: repeat(4, 160px);
          gap: 10px;
          margin-bottom: 10px;
          justify-content: start;
        }

        .customer-settlement-toolbar {
          display: flex;
          align-items: flex-end;
          gap: 6px;
          width: 100%;
          min-width: 0;
          margin-bottom: 8px;
        }

        .customer-settlement-filter-left {
          display: flex;
          align-items: flex-end;
          gap: 6px;
          flex: 1 1 auto;
          min-width: 0;
        }

        .customer-settlement-search-type {
          flex: 0 0 70px;
          min-width: 70px !important;
          width: 70px;
        }

        .customer-settlement-search {
          flex: 0 1 250px;
          width: 250px !important;
          min-width: 180px;
        }

        .customer-settlement-toolbar-right {
          display: flex;
          align-items: center;
          gap: 6px;
          flex: 0 1 auto;
          min-width: 0;
        }

        .customer-settlement-sort-select {
          flex: 0 0 90px;
          min-width: 90px;
          width: 90px !important;
        }

        .customer-settlement-excel-button {
          flex: 0 1 auto;
          min-width: 104px;
        }

        .customer-settlement-date-group {
          display: flex;
          flex: 0 1 108px;
          min-width: 108px;
          flex-direction: column;
          gap: 4px;
        }

        .customer-settlement-date-label {
          font-size: 11px;
          font-weight: 700;
          color: #475569;
        }

        .customer-settlement-date-input {
          width: 100%;
          min-width: 0;
          height: ${COMPACT_CONTROL_HEIGHT}px;
          padding: 0 8px;
          border: 1px solid #cbd5e1;
          border-radius: 8px;
          box-sizing: border-box;
          font-size: 12px;
          background: #fff;
        }

        .customer-settlement-reset-button {
          height: ${COMPACT_CONTROL_HEIGHT}px;
          padding: 0 9px;
          flex: 0 1 88px;
          min-width: 72px;
          white-space: nowrap;
          font-size: 12px;
          border: 1px solid #cbd5e1;
          border-radius: 8px;
          background: #fff;
          font-weight: 700;
          cursor: pointer;
        }

        .customer-settlement-table-wrap {
          width: 100%;
          max-width: 100%;
          min-width: 0;
          max-height: clamp(360px, calc(100vh - 260px), 760px);
          overflow-x: auto;
          overflow-y: auto;
          margin-right: auto;
          scrollbar-gutter: stable;
          overscroll-behavior: contain;
        }

        .customer-settlement-table thead th {
          position: sticky;
          top: 0;
          z-index: 2;
          background: #f8fafc;
        }

        .customer-settlement-table {
          width: 100%;
          min-width: ${SETTLEMENT_TABLE_MIN_WIDTH}px;
          border-collapse: collapse;
          table-layout: fixed;
        }

        .customer-settlement-table th,
        .customer-settlement-table td {
          overflow-wrap: anywhere;
          word-break: keep-all;
        }

        .customer-settlement-table th {
          height: ${COMPACT_TABLE_HEADER_HEIGHT}px;
          padding: 6px 5px !important;
          font-size: ${COMPACT_TABLE_HEADER_FONT_SIZE}px !important;
          line-height: ${COMPACT_TABLE_LINE_HEIGHT} !important;
          box-sizing: border-box;
        }

        .customer-settlement-table td {
          height: ${COMPACT_TABLE_ROW_HEIGHT}px;
          padding: ${COMPACT_TABLE_CELL_PADDING} !important;
          font-size: ${COMPACT_TABLE_BODY_FONT_SIZE}px !important;
          line-height: ${COMPACT_TABLE_LINE_HEIGHT} !important;
          box-sizing: border-box;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .customer-settlement-table .product-cell {
          overflow: visible;
          overflow-wrap: anywhere;
          text-overflow: clip;
          white-space: normal;
          word-break: keep-all;
        }

        .customer-settlement-table .memo-cell {
          overflow: visible;
          overflow-wrap: anywhere;
          text-overflow: clip;
          white-space: normal;
          word-break: keep-all;
        }

        .customer-settlement-table .transaction-date-cell {
          overflow: visible;
          text-overflow: clip;
          white-space: nowrap;
        }

        @media (max-width: 1250px) {
          .customer-settlement-table .total-amount-cell,
          .customer-settlement-table .total-amount-head {
            padding-right: 7px !important;
          }
        }

        @media (max-width: 980px) {
          .customer-settlement-summary {
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 10px;
          }

          .customer-settlement-toolbar {
            flex-wrap: wrap;
            align-items: flex-end;
          }

          .customer-settlement-filter-left {
            flex: 1 1 100%;
          }

          .customer-settlement-toolbar-right {
            margin-left: auto;
          }

        }

        @media (max-width: 700px) {
          .customer-settlement-summary {
            grid-template-columns: 1fr;
            width: 100%;
          }

          .customer-settlement-toolbar {
            flex-direction: column;
            align-items: stretch;
          }

          .customer-settlement-filter-left {
            flex-wrap: wrap;
            align-items: flex-end;
          }

          .customer-settlement-search-type {
            flex: 0 1 92px;
          }

          .customer-settlement-search {
            flex: 1 1 calc(100% - 100px);
            max-width: none !important;
          }

          .customer-settlement-date-group {
            flex: 1 1 140px;
          }

          .customer-settlement-reset-button {
            flex: 0 1 92px;
          }

          .customer-settlement-toolbar-right {
            width: 100%;
            margin-left: 0;
          }

          .customer-settlement-sort-select,
          .customer-settlement-excel-button {
            flex: 1 1 0;
            width: auto !important;
          }

        }
      `}</style>
      <div className="customer-settlement-summary">
        <SummaryCard
          title="건수"
          value={`${totalSummary.tradeCount.toLocaleString()}건`}
        />
        <SummaryCard
          title="판매"
          value={`${money(totalSummary.saleAmount)}`}
        />
        <SummaryCard
          title="배송비"
          value={`${money(totalSummary.shippingFee)}`}
        />
        <SummaryCard
          title="총금액"
          value={`${money(totalSummary.totalAmount)}`}
        />
      </div>

      <div className="customer-settlement-toolbar">
        <div className="customer-settlement-filter-left">
          <select value={searchField} onChange={(e) => setSearchField(e.target.value)} className="customer-settlement-search-type" style={searchTypeStyle} aria-label="검색 항목 선택">
            <option value="all">전체</option><option value="deliveryCompany">납품업체</option><option value="productCode">상품번호</option><option value="product">상품명</option><option value="customer">고객명</option><option value="phone">전화번호</option><option value="memo">메모</option>
          </select>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="거래처·상품번호·상품명·이름·전화번호·메모 검색"
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

          <span className="customer-settlement-date-separator" style={{ paddingBottom: 9 }}>~</span>

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
              setStartDate(getLocalDateString());
              setEndDate("");
              setSortOrder("inputDesc");
            }}
          >
            날짜 초기화
          </button>
        </div>

        <div className="customer-settlement-toolbar-right">
          <select
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value as SortOrder)}
            className="customer-settlement-sort-select"
            style={sortSelectStyle}
            aria-label="정렬 순서"
          >
            <option value="inputDesc">최근 입력순</option>
            <option value="inputAsc">오래된 입력순</option>
          </select>

          <button onClick={downloadExcel} className="customer-settlement-excel-button" style={excelButtonStyle}>
            엑셀 다운로드
          </button>
        </div>
      </div>

      <div className="customer-settlement-table-wrap" style={tableWrapStyle}>
        <table className="customer-settlement-table" style={tableStyle}>
          <colgroup>
            <col style={{ width: SETTLEMENT_DATE_COLUMN_WIDTH }} />
            <col style={{ width: 75 }} />
            <col style={{ width: 85 }} />
            <col style={{ width: 255 }} />
            <col style={{ width: 75 }} />
            <col style={{ width: 110 }} />
            <col style={{ width: 40 }} />
            <col style={{ width: 65 }} />
            <col style={{ width: 55 }} />
            <col style={{ width: 70 }} />
            <col style={{ width: SETTLEMENT_MEMO_MIN_WIDTH }} />
          </colgroup>
          <thead>
            <tr style={{ background: "#f8fafc" }}>
              <th className="transaction-date-cell" style={{ ...centerThStyle, ...settlementDateCellStyle }}>거래일</th>
              <th style={leftThStyle}>거래처</th>
              <th style={leftThStyle}>상품번호</th>
              <th style={leftThStyle}>상품명</th>
              <th style={leftThStyle}>이름</th>
              <th style={leftThStyle}>전화번호</th>
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
                <td colSpan={11} style={emptyStyle}>불러오는 중...</td>
              </tr>
            ) : filteredRows.length === 0 ? (
              <tr>
                <td colSpan={11} style={emptyStyle}>
                  표시할 거래내역이 없습니다.
                </td>
              </tr>
            ) : (
              filteredRows.map((row) => {
                const memoText = String(row.memo || "");
                const shouldHighlightRed = [
                  "회수반품",
                  "회수확인",
                  "매입",
                  "매입처리",
                  "반품",
                  "회수",
                ].some((keyword) => memoText.includes(keyword));

                return (
                <tr
                  key={row.id}
                  style={{
                    borderTop: "1px solid #e5e7eb",
                    color: shouldHighlightRed ? "#dc2626" : undefined,
                  }}
                >
                  <td className="transaction-date-cell" style={{ ...centerTdStyle, ...settlementDateCellStyle }}>
                    {new Date(row.transactionDate).toLocaleDateString("ko-KR")}
                  </td>
                  <td style={tdStyle}>{row.deliveryCompanyName || "-"}</td>
                  <td style={tdStyle}>{row.productCode || "-"}</td>
                  <td className="product-cell" style={{ ...tdStyle, ...settlementWrappingCellStyle }}><strong>{row.productName}</strong></td>
                  <td style={tdStyle}>{row.customerName || "-"}</td>
                  <td style={tdStyle}>{row.customerPhone || "-"}</td>
                  <td style={centerTdStyle}>{row.quantity}</td>
                  <td
                    style={{
                      ...moneyStyle,
                      color: zeroAmountTextColor(row.saleAmount),
                    }}
                  >
                    {money(row.saleAmount)}
                  </td>
                  <td style={moneyStyle}>{money(row.shippingFee || 0)}</td>
                  <td
                    className="total-amount-cell"
                    style={{
                      ...totalAmountTdStyle,
                      color: zeroAmountTextColor(
                        (row.saleAmount || 0) + (row.shippingFee || 0)
                      ),
                    }}
                  >
                    {money((row.saleAmount || 0) + (row.shippingFee || 0))}
                  </td>
                  <td className="memo-cell" style={{ ...tdStyle, ...settlementWrappingCellStyle }}>
                    {row.memo || "-"}
                  </td>
                </tr>
                );
              })
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
          fontSize: 18,
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
  gridTemplateColumns: "repeat(4, 160px)",
  gap: 8,
  marginBottom: 10,
  justifyContent: "start",
};

const summaryCardStyle: React.CSSProperties = {
  minHeight: 66,
  padding: "11px 12px",
  backgroundColor: "#fff",
  border: "1px solid #e5e7eb",
  borderRadius: 9,
};

const summaryTitleStyle: React.CSSProperties = {
  color: "#6b7280",
  fontSize: 11,
  marginBottom: 5,
};

const toolbarStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  marginBottom: COMPACT_TOOLBAR_MARGIN_BOTTOM,
};


const sortSelectStyle: React.CSSProperties = {
  width: 90,
  minWidth: 90,
  height: COMPACT_CONTROL_HEIGHT,
  padding: "0 20px 0 8px",
  border: "1px solid #cbd5e1",
  borderRadius: 8,
  background: "#fff",
  fontSize: 12,
  fontWeight: 700,
  cursor: "pointer",
};

const excelButtonStyle: React.CSSProperties = {
  height: COMPACT_CONTROL_HEIGHT,
  padding: "0 14px",
  border: "none",
  borderRadius: 8,
  background: "#16a34a",
  color: "#fff",
  fontWeight: 800,
  cursor: "pointer",
  whiteSpace: "nowrap",
};

const searchTypeStyle: React.CSSProperties = {
  width: 70, minWidth: 70, height: COMPACT_CONTROL_HEIGHT, padding: "0 20px 0 8px", border: "1px solid #cbd5e1", borderRadius: 8, background: "#fff", fontWeight: 700, color: "#334155", cursor: "pointer", fontSize: 11,
};

const searchStyle: React.CSSProperties = {
  width: 250,
  minWidth: 180,
  maxWidth: 250,
  height: COMPACT_CONTROL_HEIGHT,
  padding: "0 10px",
  border: "1px solid #d1d5db",
  borderRadius: 8,
  fontSize: 12,
};

const tableWrapStyle: React.CSSProperties = {
  width: "100%",
  minWidth: 0,
  maxHeight: "clamp(360px, calc(100vh - 260px), 760px)",
  overflowX: "auto",
  overflowY: "auto",
  marginRight: "auto",
  scrollbarGutter: "stable",
  overscrollBehavior: "contain",
  border: "1px solid #e5e7eb",
  borderRadius: 14,
  backgroundColor: "#fff",
};

const tableStyle: React.CSSProperties = {
  width: "100%",
  maxWidth: "none",
  minWidth: SETTLEMENT_TABLE_MIN_WIDTH,
  borderCollapse: "collapse",
  tableLayout: "fixed",
};

const thStyle: React.CSSProperties = {
  height: COMPACT_TABLE_HEADER_HEIGHT,
  padding: "6px 5px",
  fontSize: COMPACT_TABLE_HEADER_FONT_SIZE,
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
  height: COMPACT_TABLE_ROW_HEIGHT,
  padding: COMPACT_TABLE_CELL_PADDING,
  fontSize: COMPACT_TABLE_BODY_FONT_SIZE,
  verticalAlign: "middle",
  lineHeight: COMPACT_TABLE_LINE_HEIGHT,
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
  textAlign: "center",
  paddingLeft: 8,
  paddingRight: 8,
};

const totalAmountTdStyle: React.CSSProperties = {
  ...moneyStyle,
  fontWeight: 900,
  textAlign: "center",
  paddingLeft: 8,
  paddingRight: 8,
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
