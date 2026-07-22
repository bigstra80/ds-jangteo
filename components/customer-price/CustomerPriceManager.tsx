"use client";

import { useEffect, useState } from "react";

type Customer = {
  id: number;
  code: string;
  name: string;
};

type ProductPrice = {
  id: number;
  code: string;
  name: string;
  brand: string | null;
  price: number | null;
  customerPrice: number | null;
};

export default function CustomerPriceManager() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState("");

  const [products, setProducts] = useState<ProductPrice[]>([]);
  const [priceInputs, setPriceInputs] = useState<Record<number, string>>({});

  const [loading, setLoading] = useState(false);
  const [savingProductId, setSavingProductId] = useState<number | null>(null);

  // 거래처 목록 불러오기
  const fetchCustomers = async () => {
    try {
      const response = await fetch("/api/customers");

      if (!response.ok) {
        throw new Error("거래처 목록 조회 실패");
      }

      const data = await response.json();

      setCustomers(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("거래처 조회 오류:", error);
      alert("거래처 목록을 불러오지 못했습니다.");
    }
  };

  // 거래처별 상품 판매단가 불러오기
  const fetchCustomerPrices = async (customerId: string) => {
    if (!customerId) {
      setProducts([]);
      setPriceInputs({});
      return;
    }

    try {
      setLoading(true);

      const response = await fetch(
        `/api/customer-prices?customerId=${customerId}`
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "판매단가 조회 실패");
      }

      setProducts(data);

      const nextPriceInputs: Record<number, string> = {};

      data.forEach((product: ProductPrice) => {
        if (product.customerPrice !== null) {
          nextPriceInputs[product.id] = String(product.customerPrice);
        } else {
          nextPriceInputs[product.id] = "";
        }
      });

      setPriceInputs(nextPriceInputs);
    } catch (error) {
      console.error("판매단가 조회 오류:", error);
      alert("거래처별 판매단가를 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, []);

  useEffect(() => {
    fetchCustomerPrices(selectedCustomerId);
  }, [selectedCustomerId]);

  // 가격 입력
  const handlePriceChange = (productId: number, value: string) => {
    const onlyNumber = value.replace(/[^0-9]/g, "");

    setPriceInputs((prev) => ({
      ...prev,
      [productId]: onlyNumber,
    }));
  };

  // 판매단가 저장
  const handleSave = async (productId: number) => {
    if (!selectedCustomerId) {
      alert("거래처를 선택해주세요.");
      return;
    }

    const value = priceInputs[productId];

    if (value === undefined || value === "") {
      alert("거래처 판매단가를 입력해주세요.");
      return;
    }

    try {
      setSavingProductId(productId);

      const response = await fetch("/api/customer-prices", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          customerId: Number(selectedCustomerId),
          productId,
          price: Number(value),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "저장 실패");
      }

      setProducts((prev) =>
        prev.map((product) =>
          product.id === productId
            ? {
                ...product,
                customerPrice: Number(value),
              }
            : product
        )
      );

      alert("판매단가가 저장되었습니다.");
    } catch (error) {
      console.error("판매단가 저장 오류:", error);
      alert("판매단가 저장에 실패했습니다.");
    } finally {
      setSavingProductId(null);
    }
  };

  // 판매단가 삭제
  const handleDelete = async (productId: number) => {
    if (!selectedCustomerId) {
      return;
    }

    const confirmed = confirm(
      "이 거래처의 전용 판매단가를 삭제하시겠습니까?\n삭제하면 기본 판매가가 적용됩니다."
    );

    if (!confirmed) {
      return;
    }

    try {
      const response = await fetch(
        `/api/customer-prices?customerId=${selectedCustomerId}&productId=${productId}`,
        {
          method: "DELETE",
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "삭제 실패");
      }

      setPriceInputs((prev) => ({
        ...prev,
        [productId]: "",
      }));

      setProducts((prev) =>
        prev.map((product) =>
          product.id === productId
            ? {
                ...product,
                customerPrice: null,
              }
            : product
        )
      );

      alert("거래처 전용 판매단가가 삭제되었습니다.");
    } catch (error) {
      console.error("판매단가 삭제 오류:", error);
      alert("판매단가 삭제에 실패했습니다.");
    }
  };

  const selectedCustomer = customers.find(
    (customer) => String(customer.id) === selectedCustomerId
  );

  return (
    <div
      style={{
        width: "100%",
      }}
    >
      <h1
        style={{
          marginBottom: "8px",
        }}
      >
        거래처별 판매단가 관리
      </h1>

      <p
        style={{
          marginTop: 0,
          marginBottom: "30px",
          color: "#666",
        }}
      >
        거래처마다 상품별 전용 판매단가를 등록할 수 있습니다.
      </p>

      {/* 거래처 선택 */}
      <div
        style={{
          backgroundColor: "#ffffff",
          border: "1px solid #e5e7eb",
          borderRadius: "10px",
          padding: "20px",
          marginBottom: "25px",
        }}
      >
        <label
          style={{
            display: "block",
            fontWeight: "bold",
            marginBottom: "10px",
          }}
        >
          거래처 선택
        </label>

        <select
          value={selectedCustomerId}
          onChange={(e) => setSelectedCustomerId(e.target.value)}
          style={{
            width: "100%",
            maxWidth: "400px",
            height: "42px",
            padding: "0 12px",
            border: "1px solid #d1d5db",
            borderRadius: "6px",
            fontSize: "15px",
          }}
        >
          <option value="">거래처를 선택해주세요.</option>

          {customers.map((customer) => (
            <option key={customer.id} value={customer.id}>
              {customer.code} - {customer.name}
            </option>
          ))}
        </select>

        {selectedCustomer && (
          <div
            style={{
              marginTop: "15px",
              fontSize: "14px",
              color: "#2563eb",
              fontWeight: "bold",
            }}
          >
            선택된 거래처: {selectedCustomer.name}
          </div>
        )}
      </div>

      {!selectedCustomerId ? (
        <div
          style={{
            padding: "50px",
            textAlign: "center",
            border: "1px solid #e5e7eb",
            borderRadius: "10px",
            backgroundColor: "#ffffff",
            color: "#777",
          }}
        >
          거래처를 선택하면 상품별 판매단가를 등록할 수 있습니다.
        </div>
      ) : loading ? (
        <div
          style={{
            padding: "50px",
            textAlign: "center",
          }}
        >
          불러오는 중...
        </div>
      ) : (
        <div
          style={{
            backgroundColor: "#ffffff",
            border: "1px solid #e5e7eb",
            borderRadius: "10px",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              overflowX: "auto",
            }}
          >
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                minWidth: "850px",
              }}
            >
              <thead>
                <tr
                  style={{
                    backgroundColor: "#f8f9fa",
                  }}
                >
                  <th style={thStyle}>상품코드</th>
                  <th style={thStyle}>브랜드</th>
                  <th style={thStyle}>상품명</th>
                  <th style={thStyle}>기본 판매가</th>
                  <th style={thStyle}>거래처 판매가</th>
                  <th style={thStyle}>관리</th>
                </tr>
              </thead>

              <tbody>
                {products.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      style={{
                        padding: "40px",
                        textAlign: "center",
                        color: "#777",
                      }}
                    >
                      등록된 상품이 없습니다.
                    </td>
                  </tr>
                ) : (
                  products.map((product) => (
                    <tr
                      key={product.id}
                      style={{
                        borderTop: "1px solid #e5e7eb",
                      }}
                    >
                      <td style={tdStyle}>{product.code}</td>

                      <td style={tdStyle}>{product.brand || "-"}</td>

                      <td style={tdStyle}>{product.name}</td>

                      <td
                        style={{
                          ...tdStyle,
                          textAlign: "right",
                        }}
                      >
                        {product.price !== null
                          ? `${product.price.toLocaleString()}원`
                          : "-"}
                      </td>

                      <td style={tdStyle}>
                        <input
                          type="text"
                          inputMode="numeric"
                          value={priceInputs[product.id] || ""}
                          onChange={(e) =>
                            handlePriceChange(product.id, e.target.value)
                          }
                          placeholder={
                            product.price !== null
                              ? `기본 ${product.price.toLocaleString()}원`
                              : "판매단가 입력"
                          }
                          style={{
                            width: "150px",
                            height: "38px",
                            padding: "0 10px",
                            border: "1px solid #d1d5db",
                            borderRadius: "6px",
                            textAlign: "right",
                          }}
                        />
                      </td>

                      <td style={tdStyle}>
                        <div
                          style={{
                            display: "flex",
                            gap: "8px",
                          }}
                        >
                          <button
                            type="button"
                            onClick={() => handleSave(product.id)}
                            disabled={savingProductId === product.id}
                            style={{
                              padding: "8px 14px",
                              border: "none",
                              borderRadius: "6px",
                              backgroundColor: "#2563eb",
                              color: "#ffffff",
                              cursor: "pointer",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {savingProductId === product.id
                              ? "저장 중"
                              : "저장"}
                          </button>

                          {product.customerPrice !== null && (
                            <button
                              type="button"
                              onClick={() => handleDelete(product.id)}
                              style={{
                                padding: "8px 14px",
                                border: "1px solid #dc2626",
                                borderRadius: "6px",
                                backgroundColor: "#ffffff",
                                color: "#dc2626",
                                cursor: "pointer",
                                whiteSpace: "nowrap",
                              }}
                            >
                              삭제
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
        </div>
      )}
    </div>
  );
}

const thStyle: React.CSSProperties = {
  padding: "14px",
  textAlign: "left",
  fontSize: "14px",
  borderBottom: "1px solid #e5e7eb",
  whiteSpace: "nowrap",
};

const tdStyle: React.CSSProperties = {
  padding: "14px",
  fontSize: "14px",
  verticalAlign: "middle",
};