"use client";

import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";

type SortOrder = "dateDesc" | "dateAsc" | "inputDesc" | "inputAsc";

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
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [sortOrder, setSortOrder] = useState<SortOrder>("dateDesc");

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
        if (sortOrder === "inputDesc") {
          const createdDiff =
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
          return createdDiff !== 0 ? createdDiff : b.id - a.id;
        }

        if (sortOrder === "inputAsc") {
          const createdDiff =
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
          return createdDiff !== 0 ? createdDiff : a.id - b.id;
        }

        const dateDiff =
          new Date(a.transactionDate).getTime() -
          new Date(b.transactionDate).getTime();

        if (sortOrder === "dateAsc") {
          return dateDiff !== 0 ? dateDiff : a.id - b.id;
        }

        return dateDiff !== 0 ? -dateDiff : b.id - a.id;
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
          gap: 8px;
          width: min(1080px, 100%);
          min-width: 0;
          margin-bottom: 12px;
        }

        .customer-settlement-filter-left {
          display: flex;
          align-items: flex-end;
          gap: 8px;
          flex: 1 1 auto;
          min-width: 0;
        }

        .customer-settlement-search-type {
          flex: 0 1 96px;
          min-width: 72px !important;
          width: 96px;
        }

        .customer-settlement-search {
          flex: 1 1 260px;
          width: auto !important;
          min-width: 90px;
        }

        .customer-settlement-toolbar-right {
          display: flex;
          align-items: center;
          gap: 8px;
          flex: 0 1 auto;
          min-width: 0;
        }

        .customer-settlement-sort-select {
          flex: 0 1 128px;
          min-width: 92px;
          width: 128px !important;
        }

        .customer-settlement-excel-button {
          flex: 0 1 auto;
          min-width: 104px;
        }

        .customer-settlement-date-group {
          display: flex;
          flex: 0 1 128px;
          min-width: 104px;
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
          width: min(1080px, 100%);
          min-width: 0;
          max-height: clamp(260px, calc(100vh - 390px), 680px);
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
            flex-wrap: wrap;
            align-items: flex-end;
          }

          .customer-settlement-filter-left {
            flex: 1 1 100%;
          }

          .customer-settlement-toolbar-right {
            margin-left: auto;
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

        <div className="customer-settlement-toolbar-right">
          <select
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value as SortOrder)}
            className="customer-settlement-sort-select"
            style={sortSelectStyle}
            aria-label="정렬 순서"
          >
            <option value="dateDesc">최근순서</option>
            <option value="dateAsc">오래된순서</option>
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
            <col style={{ width: 92 }} />
            <col style={{ width: 82 }} />
            <col style={{ width: 105 }} />
            <col style={{ width: 205 }} />
            <col style={{ width: 90 }} />
            <col style={{ width: 125 }} />
            <col style={{ width: 48 }} />
            <col style={{ width: 90 }} />
            <col style={{ width: 78 }} />
            <col style={{ width: 92 }} />
            <col style={{ width: 145 }} />
          </colgroup>
          <thead>
            <tr style={{ background: "#f8fafc" }}>
              <th style={centerThStyle}>거래일</th>
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
                  <td style={centerTdStyle}>
                    {new Date(row.transactionDate).toLocaleDateString("ko-KR")}
                  </td>
                  <td style={tdStyle}>{row.deliveryCompanyName || "-"}</td>
                  <td style={tdStyle}>{row.productCode || "-"}</td>
                  <td className="product-cell" style={tdStyle}><strong>{row.productName}</strong></td>
                  <td style={tdStyle}>{row.customerName || "-"}</td>
                  <td style={tdStyle}>{row.customerPhone || "-"}</td>
                  <td style={centerTdStyle}>{row.quantity}</td>
                  <td style={moneyStyle}>{money(row.saleAmount)}</td>
                  <td style={moneyStyle}>{money(row.shippingFee || 0)}</td>
                  <td className="total-amount-cell" style={totalAmountTdStyle}>
                    {money((row.saleAmount || 0) + (row.shippingFee || 0))}
                  </td>
                  <td className="memo-cell" style={{ ...tdStyle, paddingLeft: 30 }}>
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


const sortSelectStyle: React.CSSProperties = {
  width: 128,
  height: 36,
  padding: "0 10px",
  border: "1px solid #cbd5e1",
  borderRadius: 8,
  background: "#fff",
  fontSize: 12,
  fontWeight: 700,
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

const searchTypeStyle: React.CSSProperties = {
  height: 42, minWidth: 96, padding: "0 30px 0 12px", border: "1px solid #cbd5e1", borderRadius: 10, background: "#fff", fontWeight: 700, color: "#334155", cursor: "pointer",
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
  maxHeight: "clamp(260px, calc(100vh - 390px), 680px)",
  overflowX: "auto",
  overflowY: "auto",
  marginRight: "auto",
  scrollbarGutter: "stable",
  overscrollBehavior: "contain",
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