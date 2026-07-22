"use client";

import {
  useEffect,
  useState,
} from "react";

import {
  useRouter,
} from "next/navigation";

type DashboardData = {
  summary: {
    productCount: number;
    skuCount: number;
    totalStock: number;
    totalSales: number;
    totalCost: number;
    grossProfit: number;
    todaySales: number;
    monthSales: number;
    totalPurchaseAmount: number;
    waitingPurchaseOrders: number;
    waitingDeliveries: number;
    orderReceivedCount: number;
    shippingWaitingCount: number;
    shippingCount: number;
    deliveredCount: number;
    lowStockCount: number;
    orderingSkuCount: number;
    urgentOrderCount: number;
    orderCount: number;
  };

  lowStockItems: {
    id: number;
    sku: string;
    productName: string;
    productCode: string;
    color: string;
    size: string;
    stock: number;
    safetyStock: number;
    shortageQuantity: number;
    pendingOrderQuantity: number;
    remainingOrderQuantity: number;
  }[];

  urgentOrderItems: {
    id: number;
    sku: string;
    productName: string;
    productCode: string;
    color: string;
    size: string;
    stock: number;
    safetyStock: number;
    shortageQuantity: number;
    pendingOrderQuantity: number;
    remainingOrderQuantity: number;
  }[];


  topProducts: {
    productName: string;
    quantity: number;
    amount: number;
  }[];

  channelSales: {
    channel: string;
    amount: number;
  }[];

  recentOrders: {
    id: number;
    orderNumber: string;
    channel: string;
    customerName: string;
    status: string;
    deliveryStatus: string;
    createdAt: string;
  }[];

  recentPurchases: {
    id: number;
    purchaseNumber: string;
    totalAmount: number;
    status: string;
    createdAt: string;
  }[];

  recentPurchaseOrders: {
    id: number;
    purchaseOrderNumber: string;
    supplierName: string;
    status: string;
    totalAmount: number;
    expectedDate: string | null;
    itemCount: number;
    createdAt: string;
  }[];
};

export default function DashboardManager() {
  const router =
    useRouter();

  const [
    data,
    setData,
  ] =
    useState<DashboardData | null>(
      null
    );

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  async function loadDashboard() {
    try {
      const response =
        await fetch(
          "/api/dashboard",
          {
            cache:
              "no-store",
          }
        );

      if (!response.ok) {
        throw new Error(
          "대시보드 조회 실패"
        );
      }

      const result =
        await response.json();

      setData(result);
    } catch (error) {
      console.error(
        error
      );

      alert(
        "대시보드 정보를 불러오지 못했습니다."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDashboard();
  }, []);

  if (loading) {
    return (
      <div>
        대시보드 불러오는 중...
      </div>
    );
  }

  if (!data) {
    return (
      <div>
        대시보드 데이터가 없습니다.
      </div>
    );
  }

  return (
    <div
      style={{
        width: "100%",
      }}
    >
      <div
        style={
          summaryGridStyle
        }
      >
        <SummaryCard
          title="전체 상품"
          value={`${data.summary.productCount}개`}
          onClick={() =>
            router.push(
              "/products"
            )
          }
        />

        <SummaryCard
          title="전체 SKU"
          value={`${data.summary.skuCount}개`}
          onClick={() =>
            router.push(
              "/products"
            )
          }
        />

        <SummaryCard
          title="총 재고"
          value={`${data.summary.totalStock}개`}
          onClick={() =>
            router.push(
              "/stock"
            )
          }
        />

        <SummaryCard
          title="재고 부족 SKU"
          value={`${data.summary.lowStockCount}개`}
          onClick={() =>
            router.push(
              "/safety-stock"
            )
          }
        />

        <SummaryCard
          title="추가발주 필요"
          value={`${data.summary.urgentOrderCount}개`}
          onClick={() =>
            router.push(
              "/safety-stock"
            )
          }
        />

        <SummaryCard
          title="발주중 SKU"
          value={`${data.summary.orderingSkuCount}개`}
          onClick={() =>
            router.push(
              "/purchase-orders"
            )
          }
        />

        <SummaryCard
          title="발주대기"
          value={`${data.summary.waitingPurchaseOrders}건`}
          onClick={() =>
            router.push(
              "/purchase-orders"
            )
          }
        />

        <SummaryCard
          title="총 주문"
          value={`${data.summary.orderCount}건`}
          onClick={() =>
            router.push(
              "/order"
            )
          }
        />

        <SummaryCard
          title="배송 미완료"
          value={`${data.summary.waitingDeliveries}건`}
          onClick={() =>
            router.push(
              "/delivery"
            )
          }
        />

        <SummaryCard
          title="오늘 매출"
          value={`${(data.summary.todaySales ?? 0).toLocaleString()}원`}
          onClick={() => router.push("/statistics")}
        />

        <SummaryCard
          title="이번 달 매출"
          value={`${(data.summary.monthSales ?? 0).toLocaleString()}원`}
          onClick={() => router.push("/statistics")}
        />

        <SummaryCard
          title="총 매출"
          value={`${(data.summary.totalSales ?? 0).toLocaleString()}원`}
          onClick={() => router.push("/sales")}
        />

        <SummaryCard
          title="판매원가"
          value={`${(data.summary.totalCost ?? 0).toLocaleString()}원`}
          onClick={() => router.push("/statistics")}
        />

        <SummaryCard
          title="매출총이익"
          value={`${(data.summary.grossProfit ?? 0).toLocaleString()}원`}
          onClick={() => router.push("/statistics")}
        />

        <SummaryCard
          title="주문접수"
          value={`${data.summary.orderReceivedCount ?? 0}건`}
          onClick={() => router.push("/order")}
        />

        <SummaryCard
          title="출고대기"
          value={`${data.summary.shippingWaitingCount ?? 0}건`}
          onClick={() => router.push("/delivery")}
        />

        <SummaryCard
          title="배송중"
          value={`${data.summary.shippingCount ?? 0}건`}
          onClick={() => router.push("/delivery")}
        />

        <SummaryCard
          title="배송완료"
          value={`${data.summary.deliveredCount ?? 0}건`}
          onClick={() => router.push("/delivery")}
        />

        <SummaryCard
          title="총 매입"
          value={`${data.summary.totalPurchaseAmount.toLocaleString()}원`}
          onClick={() =>
            router.push(
              "/purchases"
            )
          }
        />
      </div>

      <section
        style={
          urgentSectionStyle
        }
      >
        <div
          style={
            sectionHeaderStyle
          }
        >
          <div>
            <h2
              style={{
                margin:
                  0,
              }}
            >
              🚨 지금 발주가 필요한 상품
            </h2>

            <p
              style={
                sectionDescriptionStyle
              }
            >
              부족수량에서 이미 발주중인 수량을 제외한 실제 추가발주 필요 상품입니다.
            </p>
          </div>

          <button
            type="button"
            onClick={() =>
              router.push(
                "/safety-stock"
              )
            }
            style={
              viewButtonStyle
            }
          >
            안전재고 관리
          </button>
        </div>

        <div
          style={{
            overflowX:
              "auto",
          }}
        >
          <table
            style={
              tableStyle
            }
          >
            <thead>
              <tr>
                <th style={thStyle}>
                  상품명
                </th>

                <th style={thStyle}>
                  SKU
                </th>

                <th style={thStyle}>
                  현재재고
                </th>

                <th style={thStyle}>
                  안전재고
                </th>

                <th style={thStyle}>
                  부족수량
                </th>

                <th style={thStyle}>
                  발주중
                </th>

                <th style={thStyle}>
                  추가발주 필요
                </th>

                <th style={thStyle}>
                  관리
                </th>
              </tr>
            </thead>

            <tbody>
              {data
                .urgentOrderItems
                .length ===
              0 ? (
                <tr>
                  <td
                    colSpan={
                      8
                    }
                    style={{
                      ...tdStyle,

                      padding:
                        "25px",
                    }}
                  >
                    지금 추가로 발주할 상품이 없습니다.
                  </td>
                </tr>
              ) : (
                data.urgentOrderItems.map(
                  (
                    item
                  ) => (
                    <tr
                      key={
                        item.id
                      }
                    >
                      <td
                        style={
                          tdStyle
                        }
                      >
                        {
                          item.productName
                        }
                      </td>

                      <td
                        style={
                          tdStyle
                        }
                      >
                        {
                          item.sku
                        }
                      </td>

                      <td
                        style={
                          tdStyle
                        }
                      >
                        {
                          item.stock
                        }
                        개
                      </td>

                      <td
                        style={
                          tdStyle
                        }
                      >
                        {
                          item.safetyStock
                        }
                        개
                      </td>

                      <td
                        style={
                          redTdStyle
                        }
                      >
                        {
                          item.shortageQuantity
                        }
                        개
                      </td>

                      <td
                        style={
                          blueTdStyle
                        }
                      >
                        {
                          item.pendingOrderQuantity
                        }
                        개
                      </td>

                      <td
                        style={
                          orangeTdStyle
                        }
                      >
                        <strong>
                          {
                            item.remainingOrderQuantity
                          }
                          개
                        </strong>
                      </td>

                      <td
                        style={
                          tdStyle
                        }
                      >
                        <button
                          type="button"
                          onClick={() =>
                            router.push(
                              `/purchase-orders?skuId=${item.id}&quantity=${item.remainingOrderQuantity}`
                            )
                          }
                          style={
                            orderButtonStyle
                          }
                        >
                          발주하기
                        </button>
                      </td>
                    </tr>
                  )
                )
              )}
            </tbody>
          </table>
        </div>
      </section>

      <div style={twoColumnGridStyle}>
        <section style={sectionStyle}>
          <div style={sectionHeaderStyle}>
            <h2 style={{ margin: 0 }}>🏆 인기상품 TOP 5</h2>
            <button type="button" onClick={() => router.push("/sales")} style={viewButtonStyle}>
              판매관리
            </button>
          </div>

          <div style={{ overflowX: "auto" }}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>순위</th>
                  <th style={thStyle}>상품명</th>
                  <th style={thStyle}>판매수량</th>
                  <th style={thStyle}>매출</th>
                </tr>
              </thead>
              <tbody>
                {data.topProducts.length === 0 ? (
                  <tr><td colSpan={4} style={{ ...tdStyle, padding: "25px" }}>판매 데이터가 없습니다.</td></tr>
                ) : data.topProducts.map((item, index) => (
                  <tr key={`${item.productName}-${index}`}>
                    <td style={tdStyle}><strong>{index + 1}</strong></td>
                    <td style={tdStyle}>{item.productName}</td>
                    <td style={tdStyle}>{item.quantity.toLocaleString()}개</td>
                    <td style={tdStyle}>{item.amount.toLocaleString()}원</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section style={sectionStyle}>
          <div style={sectionHeaderStyle}>
            <h2 style={{ margin: 0 }}>📊 채널별 매출</h2>
            <button type="button" onClick={() => router.push("/statistics")} style={viewButtonStyle}>
              통계보기
            </button>
          </div>

          {data.channelSales.length === 0 ? (
            <div style={{ padding: "25px", textAlign: "center", color: "#666" }}>매출 데이터가 없습니다.</div>
          ) : (
            <div style={{ display: "grid", gap: "12px" }}>
              {data.channelSales.map((item) => {
                const maxAmount = Math.max(...data.channelSales.map((value) => value.amount), 1);
                const width = Math.max((item.amount / maxAmount) * 100, 3);
                return (
                  <div key={item.channel}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", marginBottom: "6px" }}>
                      <strong>{item.channel}</strong>
                      <span>{item.amount.toLocaleString()}원</span>
                    </div>
                    <div style={barTrackStyle}>
                      <div style={{ ...barFillStyle, width: `${width}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>

      <section
        style={
          sectionStyle
        }
      >
        <div
          style={
            sectionHeaderStyle
          }
        >
          <h2>
            📄 최근 발주
          </h2>

          <button
            type="button"
            onClick={() =>
              router.push(
                "/purchase-orders"
              )
            }
            style={
              viewButtonStyle
            }
          >
            발주관리
          </button>
        </div>

        <div
          style={{
            overflowX:
              "auto",
          }}
        >
          <table
            style={
              tableStyle
            }
          >
            <thead>
              <tr>
                <th style={thStyle}>
                  발주번호
                </th>

                <th style={thStyle}>
                  거래처
                </th>

                <th style={thStyle}>
                  품목수
                </th>

                <th style={thStyle}>
                  예상금액
                </th>

                <th style={thStyle}>
                  입고예정일
                </th>

                <th style={thStyle}>
                  상태
                </th>
              </tr>
            </thead>

            <tbody>
              {data
                .recentPurchaseOrders
                .length ===
              0 ? (
                <tr>
                  <td
                    colSpan={
                      6
                    }
                    style={{
                      ...tdStyle,

                      padding:
                        "25px",
                    }}
                  >
                    최근 발주가 없습니다.
                  </td>
                </tr>
              ) : (
                data.recentPurchaseOrders.map(
                  (
                    order
                  ) => (
                    <tr
                      key={
                        order.id
                      }
                      onClick={() =>
                        router.push(
                          `/purchase-orders/${order.id}`
                        )
                      }
                      style={{
                        cursor:
                          "pointer",
                      }}
                    >
                      <td
                        style={
                          tdStyle
                        }
                      >
                        {
                          order.purchaseOrderNumber
                        }
                      </td>

                      <td
                        style={
                          tdStyle
                        }
                      >
                        {
                          order.supplierName
                        }
                      </td>

                      <td
                        style={
                          tdStyle
                        }
                      >
                        {
                          order.itemCount
                        }
                        종
                      </td>

                      <td
                        style={
                          tdStyle
                        }
                      >
                        {
                          order.totalAmount.toLocaleString()
                        }
                        원
                      </td>

                      <td
                        style={
                          tdStyle
                        }
                      >
                        {order.expectedDate
                          ? new Date(
                              order.expectedDate
                            ).toLocaleDateString(
                              "ko-KR"
                            )
                          : "-"}
                      </td>

                      <td
                        style={
                          tdStyle
                        }
                      >
                        <strong>
                          {
                            order.status
                          }
                        </strong>
                      </td>
                    </tr>
                  )
                )
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section
        style={
          sectionStyle
        }
      >
        <h2>
          🛒 최근 주문
        </h2>

        <div
          style={{
            overflowX:
              "auto",
          }}
        >
          <table
            style={
              tableStyle
            }
          >
            <thead>
              <tr>
                <th style={thStyle}>
                  주문번호
                </th>

                <th style={thStyle}>
                  채널
                </th>

                <th style={thStyle}>
                  고객
                </th>

                <th style={thStyle}>
                  주문상태
                </th>

                <th style={thStyle}>
                  배송상태
                </th>

                <th style={thStyle}>
                  주문일
                </th>
              </tr>
            </thead>

            <tbody>
              {data
                .recentOrders
                .length ===
              0 ? (
                <tr>
                  <td
                    colSpan={
                      6
                    }
                    style={{
                      ...tdStyle,

                      padding:
                        "25px",
                    }}
                  >
                    최근 주문이 없습니다.
                  </td>
                </tr>
              ) : (
                data.recentOrders.map(
                  (
                    order
                  ) => (
                    <tr
                      key={order.id}
                      onClick={() => router.push(`/order?orderId=${order.id}`)}
                      style={{ cursor: "pointer" }}
                      title="클릭하여 주문관리로 이동"
                    >
                      <td
                        style={
                          tdStyle
                        }
                      >
                        {
                          order.orderNumber
                        }
                      </td>

                      <td
                        style={
                          tdStyle
                        }
                      >
                        {
                          order.channel
                        }
                      </td>

                      <td
                        style={
                          tdStyle
                        }
                      >
                        {
                          order.customerName
                        }
                      </td>

                      <td
                        style={
                          tdStyle
                        }
                      >
                        {
                          order.status
                        }
                      </td>

                      <td
                        style={
                          tdStyle
                        }
                      >
                        {
                          order.deliveryStatus
                        }
                      </td>

                      <td
                        style={
                          tdStyle
                        }
                      >
                        {new Date(
                          order.createdAt
                        ).toLocaleString(
                          "ko-KR"
                        )}
                      </td>
                    </tr>
                  )
                )
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section
        style={
          sectionStyle
        }
      >
        <h2>
          📦 최근 매입
        </h2>

        <div
          style={{
            overflowX:
              "auto",
          }}
        >
          <table
            style={
              tableStyle
            }
          >
            <thead>
              <tr>
                <th style={thStyle}>
                  매입번호
                </th>

                <th style={thStyle}>
                  금액
                </th>

                <th style={thStyle}>
                  상태
                </th>

                <th style={thStyle}>
                  등록일
                </th>
              </tr>
            </thead>

            <tbody>
              {data
                .recentPurchases
                .length ===
              0 ? (
                <tr>
                  <td
                    colSpan={
                      4
                    }
                    style={{
                      ...tdStyle,

                      padding:
                        "25px",
                    }}
                  >
                    최근 매입이 없습니다.
                  </td>
                </tr>
              ) : (
                data.recentPurchases.map(
                  (
                    purchase
                  ) => (
                    <tr
                      key={
                        purchase.id
                      }
                    >
                      <td
                        style={
                          tdStyle
                        }
                      >
                        {
                          purchase.purchaseNumber
                        }
                      </td>

                      <td
                        style={
                          tdStyle
                        }
                      >
                        {
                          purchase.totalAmount.toLocaleString()
                        }
                        원
                      </td>

                      <td
                        style={
                          tdStyle
                        }
                      >
                        {
                          purchase.status
                        }
                      </td>

                      <td
                        style={
                          tdStyle
                        }
                      >
                        {new Date(
                          purchase.createdAt
                        ).toLocaleString(
                          "ko-KR"
                        )}
                      </td>
                    </tr>
                  )
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
  title,
  value,
  onClick,
}: {
  title: string;
  value: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={
        onClick
      }
      style={
        summaryCardStyle
      }
    >
      <div
        style={
          summaryTitleStyle
        }
      >
        {title}
      </div>

      <div
        style={
          summaryValueStyle
        }
      >
        {value}
      </div>
    </button>
  );
}

const twoColumnGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 320px), 1fr))",
  gap: "20px",
  marginTop: "20px",
};

const barTrackStyle: React.CSSProperties = {
  width: "100%",
  height: "12px",
  background: "#eef1f5",
  borderRadius: "999px",
  overflow: "hidden",
};

const barFillStyle: React.CSSProperties = {
  height: "100%",
  background: "linear-gradient(90deg, #2563eb, #60a5fa)",
  borderRadius: "999px",
};

const summaryGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 180px), 1fr))",
  gap: "15px",
};

const summaryCardStyle: React.CSSProperties = {
  border:
    "1px solid #e5e7eb",
  borderRadius:
    "10px",
  padding:
    "20px",
  backgroundColor:
    "white",
  textAlign:
    "left",
  cursor:
    "pointer",
};

const summaryTitleStyle: React.CSSProperties = {
  color:
    "#6b7280",
  fontSize:
    "15px",
};

const summaryValueStyle: React.CSSProperties = {
  marginTop:
    "10px",
  fontSize:
    "26px",
  fontWeight:
    "bold",
};

const urgentSectionStyle: React.CSSProperties = {
  marginTop:
    "30px",
  padding:
    "20px",
  border:
    "1px solid #fed7aa",
  backgroundColor:
    "#fff7ed",
  borderRadius:
    "10px",
};

const sectionStyle: React.CSSProperties = {
  marginTop:
    "30px",
};

const sectionHeaderStyle: React.CSSProperties = {
  display:
    "flex",
  justifyContent:
    "space-between",
  alignItems:
    "center",
  gap:
    "15px",
};

const sectionDescriptionStyle: React.CSSProperties = {
  marginTop:
    "8px",
  marginBottom:
    0,
  color:
    "#6b7280",
};

const viewButtonStyle: React.CSSProperties = {
  padding:
    "9px 14px",
  border:
    "none",
  borderRadius:
    "6px",
  backgroundColor:
    "#2563eb",
  color:
    "white",
  cursor:
    "pointer",
  fontWeight:
    "bold",
};

const orderButtonStyle: React.CSSProperties = {
  padding:
    "8px 12px",
  border:
    "none",
  borderRadius:
    "6px",
  backgroundColor:
    "#ea580c",
  color:
    "white",
  cursor:
    "pointer",
  fontWeight:
    "bold",
};

const tableStyle: React.CSSProperties = {
  width:
    "100%",
  borderCollapse:
    "collapse",
  minWidth:
    "900px",
};

const thStyle: React.CSSProperties = {
  border:
    "1px solid #d1d5db",
  backgroundColor:
    "#f3f4f6",
  padding:
    "12px",
  textAlign:
    "center",
};

const tdStyle: React.CSSProperties = {
  border:
    "1px solid #d1d5db",
  padding:
    "12px",
  textAlign:
    "center",
};

const redTdStyle: React.CSSProperties = {
  ...tdStyle,
  color:
    "#dc2626",
  fontWeight:
    "bold",
};

const blueTdStyle: React.CSSProperties = {
  ...tdStyle,
  color:
    "#2563eb",
  fontWeight:
    "bold",
};

const orangeTdStyle: React.CSSProperties = {
  ...tdStyle,
  color:
    "#ea580c",
};