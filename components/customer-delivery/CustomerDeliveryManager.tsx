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

type CustomerGroup = {
  deliveryCompanyName: string;
  rows: LedgerRow[];
  totalQuantity: number;
  totalSaleAmount: number;
};

function money(value: number) {
  return Number(value || 0).toLocaleString("ko-KR");
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("ko-KR");
}

export default function CustomerDeliveryManager() {
  const [rows, setRows] = useState<LedgerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [expandedCustomers, setExpandedCustomers] = useState<Set<string>>(
    new Set()
  );

  function toggleCustomer(deliveryCompanyName: string) {
    setExpandedCustomers((current) => {
      const next = new Set(current);
      if (next.has(deliveryCompanyName)) {
        next.delete(deliveryCompanyName);
      } else {
        next.add(deliveryCompanyName);
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
    loadItems();
  }, []);

  const filteredRows = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    return rows
      .filter((row) => {
        if (!row.deliveryCompanyName?.trim()) return false;

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
          row.deliveryCompanyName,
          row.productName,
          row.supplierName,
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

  const groupedByCustomer = useMemo<CustomerGroup[]>(() => {
    const map = new Map<string, CustomerGroup>();

    for (const row of filteredRows) {
      const deliveryCompanyName = row.deliveryCompanyName?.trim();
      if (!deliveryCompanyName) continue;

      const current =
        map.get(deliveryCompanyName) || {
          deliveryCompanyName,
          rows: [],
          totalQuantity: 0,
          totalSaleAmount: 0,
        };

      current.rows.push(row);
      current.totalQuantity += Number(row.quantity || 0);
      current.totalSaleAmount += Number(row.saleAmount || 0);

      map.set(deliveryCompanyName, current);
    }

    return Array.from(map.values()).sort((a, b) =>
      a.deliveryCompanyName.localeCompare(b.deliveryCompanyName, "ko")
    );
  }, [filteredRows]);

  const totalQuantity = filteredRows.reduce(
    (sum, row) => sum + Number(row.quantity || 0),
    0
  );

  const totalSaleAmount = filteredRows.reduce(
    (sum, row) => sum + Number(row.saleAmount || 0),
    0
  );

  return (
    <div style={pageStyle}>
      <div style={headerStyle}>
        <div>
          <h1 style={titleStyle}>🚚 거래처별 납품목록</h1>
          <p style={subtitleStyle}>
            도매 거래 한 줄 장부에 입력된 납품업체별 판매·납품 내역을 자동으로
            보여줍니다.
          </p>
        </div>

        <button onClick={loadItems} style={refreshButtonStyle}>
          새로고침
        </button>
      </div>

      <div style={summaryGridStyle}>
        <SummaryCard
          label="거래처 수"
          value={`${groupedByCustomer.length.toLocaleString()}곳`}
        />
        <SummaryCard
          label="총 납품 수량"
          value={`${totalQuantity.toLocaleString()}개`}
        />
        <SummaryCard
          label="총 판매금액"
          value={`${money(totalSaleAmount)}원`}
        />
      </div>

      <div style={toolbarStyle}>
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="거래처, 상품명, 공급업체, 고객 이름, 메모 검색"
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
      ) : groupedByCustomer.length === 0 ? (
        <div style={emptyStyle}>표시할 거래처별 납품내역이 없습니다.</div>
      ) : (
        <div style={customerListStyle}>
          {groupedByCustomer.map((group) => (
            <section key={group.deliveryCompanyName} style={customerCardStyle}>
              <div style={customerHeaderStyle}>
                <div style={customerTitleAreaStyle}>
                  <div style={customerNameStyle}>{group.deliveryCompanyName}</div>
                  <button
                    type="button"
                    onClick={() => toggleCustomer(group.deliveryCompanyName)}
                    style={detailButtonStyle}
                  >
                    {expandedCustomers.has(group.deliveryCompanyName)
                      ? "접기"
                      : "상세"}
                  </button>
                </div>

                <div style={customerSummaryStyle}>
                  총 {group.totalQuantity.toLocaleString()}개 ·{" "}
                  {money(group.totalSaleAmount)}원
                </div>
              </div>

              {expandedCustomers.has(group.deliveryCompanyName) && (
                <div style={tableWrapStyle}>
                  <table style={tableStyle}>
                    <thead>
                      <tr>
                        <th style={thStyle}>거래일</th>
                        <th style={thStyle}>상품명</th>
                        <th style={thStyle}>수량</th>
                        <th style={thStyle}>판매금액</th>
                        <th style={thStyle}>배송비</th>
                        <th style={thStyle}>공급업체</th>
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
                            {money(row.saleAmount)}원
                          </td>
                          <td style={tdStyle}>
                            {money(row.shippingFee)}원
                          </td>
                          <td style={tdStyle}>{row.supplierName || "-"}</td>
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
  color: "#111827",
};

const headerStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: "20px",
  marginBottom: "24px",
};

const titleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: "28px",
  fontWeight: 900,
};

const subtitleStyle: React.CSSProperties = {
  margin: "8px 0 0",
  color: "#6b7280",
  fontSize: "14px",
};

const refreshButtonStyle: React.CSSProperties = {
  border: "1px solid #dbe3f0",
  background: "#ffffff",
  color: "#2563eb",
  borderRadius: "10px",
  padding: "10px 16px",
  fontWeight: 800,
  cursor: "pointer",
};

const summaryGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
  gap: "16px",
  marginBottom: "20px",
};

const summaryCardStyle: React.CSSProperties = {
  background: "#ffffff",
  border: "1px solid #e2e8f0",
  borderRadius: "16px",
  padding: "20px",
};

const summaryLabelStyle: React.CSSProperties = {
  fontSize: "14px",
  color: "#64748b",
  marginBottom: "8px",
};

const summaryValueStyle: React.CSSProperties = {
  fontSize: "26px",
  fontWeight: 900,
};

const toolbarStyle: React.CSSProperties = {
  display: "flex",
  gap: "14px",
  alignItems: "end",
  marginBottom: "20px",
  flexWrap: "wrap",
};

const searchStyle: React.CSSProperties = {
  flex: "1 1 460px",
  minWidth: "280px",
  height: "48px",
  border: "1px solid #cbd5e1",
  borderRadius: "10px",
  padding: "0 16px",
  fontSize: "15px",
  boxSizing: "border-box",
};

const dateFilterStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "end",
  gap: "10px",
  flexWrap: "wrap",
};

const dateLabelStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "6px",
  fontSize: "12px",
  fontWeight: 800,
  color: "#475569",
};

const dateInputStyle: React.CSSProperties = {
  height: "48px",
  border: "1px solid #cbd5e1",
  borderRadius: "10px",
  padding: "0 12px",
  fontSize: "14px",
  background: "#ffffff",
};

const dateSeparatorStyle: React.CSSProperties = {
  paddingBottom: "14px",
  color: "#64748b",
  fontWeight: 900,
};

const resetButtonStyle: React.CSSProperties = {
  height: "48px",
  border: "1px solid #cbd5e1",
  background: "#ffffff",
  borderRadius: "10px",
  padding: "0 16px",
  fontWeight: 800,
  cursor: "pointer",
};

const emptyStyle: React.CSSProperties = {
  border: "1px solid #e2e8f0",
  background: "#ffffff",
  borderRadius: "14px",
  padding: "38px",
  textAlign: "center",
  color: "#64748b",
};

const customerListStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "14px",
};

const customerCardStyle: React.CSSProperties = {
  border: "1px solid #dbe3f0",
  borderRadius: "14px",
  background: "#ffffff",
  overflow: "hidden",
};

const customerHeaderStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "18px",
  padding: "18px 22px",
  background: "#f8fafc",
};

const customerTitleAreaStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "12px",
};

const customerNameStyle: React.CSSProperties = {
  fontSize: "18px",
  fontWeight: 900,
};

const detailButtonStyle: React.CSSProperties = {
  border: "1px solid #2563eb",
  background: "#ffffff",
  color: "#2563eb",
  borderRadius: "9px",
  padding: "7px 12px",
  fontWeight: 800,
  cursor: "pointer",
};

const customerSummaryStyle: React.CSSProperties = {
  color: "#1d4ed8",
  fontWeight: 900,
  fontSize: "16px",
};

const tableWrapStyle: React.CSSProperties = {
  width: "100%",
  overflowX: "auto",
  borderTop: "1px solid #e2e8f0",
};

const tableStyle: React.CSSProperties = {
  width: "100%",
  minWidth: "980px",
  borderCollapse: "collapse",
};

const thStyle: React.CSSProperties = {
  textAlign: "left",
  background: "#f8fafc",
  color: "#475569",
  fontSize: "12px",
  padding: "12px 14px",
  borderBottom: "1px solid #e2e8f0",
  whiteSpace: "nowrap",
};

const tdStyle: React.CSSProperties = {
  padding: "13px 14px",
  borderBottom: "1px solid #eef2f7",
  fontSize: "13px",
  whiteSpace: "nowrap",
};

const productTdStyle: React.CSSProperties = {
  ...tdStyle,
  minWidth: "220px",
  maxWidth: "340px",
  overflow: "hidden",
  textOverflow: "ellipsis",
};
