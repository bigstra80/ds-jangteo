"use client";

import { useEffect, useMemo, useState } from "react";
import {
  isEditableOneDecimalPrice,
  parseOneDecimalPrice,
} from "@/lib/one-decimal-price";

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
  const [customerQuery, setCustomerQuery] = useState("");
  const [isCustomerListOpen, setIsCustomerListOpen] = useState(false);
  const [activeCustomerIndex, setActiveCustomerIndex] = useState(-1);

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
    // Initial client-side customer hydration is intentionally performed once on mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchCustomers();
  }, []);

  useEffect(() => {
    // Prices must be synchronized whenever the selected customer changes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchCustomerPrices(selectedCustomerId);
  }, [selectedCustomerId]);

  // 가격 입력
  const handlePriceChange = (productId: number, value: string) => {
    if (!isEditableOneDecimalPrice(value)) {
      return;
    }

    setPriceInputs((prev) => ({
      ...prev,
      [productId]: value,
    }));
  };

  // 판매단가 저장
  const handleSave = async (productId: number) => {
    if (!selectedCustomerId) {
      alert("거래처를 선택해주세요.");
      return;
    }

    const value = priceInputs[productId];
    const parsedPrice = parseOneDecimalPrice(value);

    if (parsedPrice === null) {
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
          price: parsedPrice,
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
                customerPrice: parsedPrice,
              }
            : product
        )
      );
      setPriceInputs((prev) => ({
        ...prev,
        [productId]: String(parsedPrice),
      }));

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

  const filteredCustomers = useMemo(() => {
    const keyword = customerQuery.trim().toLowerCase();
    const matches = keyword
      ? customers.filter(
          (customer) =>
            customer.code.toLowerCase().includes(keyword) ||
            customer.name.toLowerCase().includes(keyword)
        )
      : customers;
    return matches.slice(0, 30);
  }, [customerQuery, customers]);

  function selectCustomer(customer: Customer) {
    setCustomerQuery(`${customer.code} - ${customer.name}`);
    setSelectedCustomerId(String(customer.id));
    setIsCustomerListOpen(false);
    setActiveCustomerIndex(-1);
  }

  function handleCustomerInput(value: string) {
    setCustomerQuery(value);
    setSelectedCustomerId("");
    setActiveCustomerIndex(-1);
    setIsCustomerListOpen(true);
  }

  function handleCustomerKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setIsCustomerListOpen(true);
      setActiveCustomerIndex((current) =>
        Math.min(current + 1, filteredCustomers.length - 1)
      );
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveCustomerIndex((current) => Math.max(current - 1, 0));
    } else if (event.key === "Enter" && isCustomerListOpen) {
      event.preventDefault();
      const customer = filteredCustomers[Math.max(activeCustomerIndex, 0)];
      if (customer) selectCustomer(customer);
    } else if (event.key === "Escape") {
      setIsCustomerListOpen(false);
    }
  }

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
        단가적용
      </h1>

      <p
        style={{
          marginTop: 0,
          marginBottom: "30px",
          color: "#666",
        }}
      >
        거래처별 판매단가를 관리합니다.
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

        <div
          style={{
            width: "100%",
            maxWidth: "400px",
            position: "relative",
          }}
        >
          <div style={customerSearchBoxStyle}>
            <input
              type="text"
              value={customerQuery}
              onChange={(event) => handleCustomerInput(event.target.value)}
              onFocus={() => setIsCustomerListOpen(true)}
              onBlur={() =>
                window.setTimeout(() => setIsCustomerListOpen(false), 120)
              }
              onKeyDown={handleCustomerKeyDown}
              placeholder="거래처 코드 또는 거래처명 검색"
              autoComplete="off"
              style={customerSearchInputStyle}
            />
            <button
              type="button"
              aria-label="거래처 목록 열기"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => setIsCustomerListOpen((current) => !current)}
              style={customerSearchToggleStyle}
            >
              ▼
            </button>
          </div>

          {isCustomerListOpen && (
            <div style={customerDropdownStyle}>
              {filteredCustomers.length === 0 ? (
                <div style={customerEmptyStyle}>검색 결과가 없습니다.</div>
              ) : (
                filteredCustomers.map((customer, index) => (
                  <button
                    key={customer.id}
                    type="button"
                    onMouseDown={(event) => {
                      event.preventDefault();
                      selectCustomer(customer);
                    }}
                    onMouseEnter={() => setActiveCustomerIndex(index)}
                    style={{
                      ...customerOptionStyle,
                      backgroundColor:
                        index === activeCustomerIndex ? "#eff6ff" : "white",
                    }}
                  >
                    <strong>{customer.code}</strong>
                    <span>{customer.name}</span>
                  </button>
                ))
              )}
            </div>
          )}
        </div>

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
                          inputMode="decimal"
                          pattern="[0-9]+([.][0-9])?"
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
                            border:
                              parseOneDecimalPrice(priceInputs[product.id]) !==
                              product.customerPrice
                                ? "1px solid #f59e0b"
                                : "1px solid #d1d5db",
                            borderRadius: "6px",
                            backgroundColor:
                              parseOneDecimalPrice(priceInputs[product.id]) !==
                              product.customerPrice
                                ? "#fffbeb"
                                : "#ffffff",
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

const customerSearchBoxStyle: React.CSSProperties = {
  display: "flex",
  height: "42px",
  border: "1px solid #2563eb",
  borderRadius: "8px",
  overflow: "hidden",
  backgroundColor: "white",
};

const customerSearchInputStyle: React.CSSProperties = {
  flex: 1,
  minWidth: 0,
  padding: "0 12px",
  border: "none",
  outline: "none",
  fontSize: "15px",
};

const customerSearchToggleStyle: React.CSSProperties = {
  width: "44px",
  border: "none",
  borderLeft: "1px solid #bfdbfe",
  backgroundColor: "#eff6ff",
  color: "#1d4ed8",
  cursor: "pointer",
};

const customerDropdownStyle: React.CSSProperties = {
  position: "absolute",
  top: "calc(100% + 4px)",
  left: 0,
  right: 0,
  zIndex: 30,
  maxHeight: "260px",
  overflowY: "auto",
  border: "1px solid #d1d5db",
  borderRadius: "8px",
  backgroundColor: "white",
  boxShadow: "0 10px 24px rgba(15, 23, 42, 0.14)",
};

const customerOptionStyle: React.CSSProperties = {
  display: "flex",
  width: "100%",
  gap: "10px",
  padding: "9px 12px",
  border: "none",
  borderBottom: "1px solid #f1f5f9",
  color: "#111827",
  textAlign: "left",
  cursor: "pointer",
};

const customerEmptyStyle: React.CSSProperties = {
  padding: "12px",
  color: "#6b7280",
  fontSize: "14px",
};
