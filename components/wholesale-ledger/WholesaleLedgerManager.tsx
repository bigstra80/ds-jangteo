"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";

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

type FormState = {
  transactionDate: string;
  productName: string;
  quantity: string;
  supplierName: string;
  purchaseAmount: string;
  deliveryCompanyName: string;
  customerName: string;
  saleAmount: string;
  shippingFee: string;
  settlementStatus: string;
  memo: string;
};

type SupplierCostOption = {
  name: string;
  unitCost: number;
};

type SearchOption = {
  id: string;
  label: string;
  keywords?: string;
  productCode?: string;
  productName?: string;
  supplierCosts?: SupplierCostOption[];
};

const today = () => new Date().toISOString().slice(0, 10);

const emptyForm = (): FormState => ({
  transactionDate: today(),
  productName: "",
  quantity: "1",
  supplierName: "",
  purchaseAmount: "0",
  deliveryCompanyName: "",
  customerName: "",
  saleAmount: "0",
  shippingFee: "4000",
  settlementStatus: "미정산",
  memo: "",
});

const money = (value: number) => new Intl.NumberFormat("ko-KR").format(value);

function dateOnly(value: string) {
  return new Date(value).toLocaleDateString("ko-KR");
}

function asArray(payload: unknown): any[] {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== "object") return [];

  const data = payload as Record<string, unknown>;
  const commonKeys = [
    "products",
    "items",
    "rows",
    "data",
    "suppliers",
    "customers",
    "result",
  ];

  for (const key of commonKeys) {
    if (Array.isArray(data[key])) return data[key] as any[];
  }

  return [];
}

function productOptionsFromPayload(payload: unknown): SearchOption[] {
  const products = asArray(payload);

  return products
    .map((product: any, index) => {
      const productName =
        String(product?.name ?? product?.productName ?? product?.title ?? "").trim();
      const productCode =
        String(product?.code ?? product?.productCode ?? "").trim();

      if (!productName) return null;

      const supplierCosts: SupplierCostOption[] = [
        product?.supplier?.name
          ? { name: String(product.supplier.name), unitCost: Number(product?.cost || 0) }
          : null,
        product?.supplier2?.name
          ? { name: String(product.supplier2.name), unitCost: Number(product?.cost2 || 0) }
          : null,
        product?.supplier3?.name
          ? { name: String(product.supplier3.name), unitCost: Number(product?.cost3 || 0) }
          : null,
      ].filter(Boolean) as SupplierCostOption[];

      return {
        id: String(product?.id ?? index),
        label: productName,
        productName,
        productCode,
        keywords: [productCode, productName].filter(Boolean).join(" "),
        supplierCosts,
      };
    })
    .filter(Boolean) as SearchOption[];
}

function nameOptionsFromPayload(payload: unknown, kind: "supplier" | "customer"): SearchOption[] {
  return asArray(payload)
    .map((item: any, index) => {
      const name = String(
        item?.name ??
          (kind === "supplier" ? item?.supplierName : item?.customerName) ??
          item?.companyName ??
          item?.businessName ??
          ""
      ).trim();

      if (!name) return null;

      const phone = String(item?.phone ?? "").trim();
      const contact = String(item?.contact ?? item?.managerName ?? "").trim();

      return {
        id: String(item?.id ?? index),
        label: name,
        keywords: [name, phone, contact].filter(Boolean).join(" "),
      };
    })
    .filter(Boolean) as SearchOption[];
}

async function fetchOptions(urls: string[]) {
  for (const url of urls) {
    try {
      const response = await fetch(url, { cache: "no-store" });
      if (!response.ok) continue;
      return await response.json();
    } catch {
      // 다음 후보 API 시도
    }
  }

  return [];
}

const formatWonInput = (value: string | number) => {
  const raw = String(value ?? "").replace(/,/g, "").replace(/원/g, "").trim();
  if (raw === "" || raw === "-") return raw;
  const number = Number(raw);
  if (!Number.isFinite(number)) return "0원";
  return `${number.toLocaleString("ko-KR")}원`;
};

const parseWonInput = (value: string) =>
  value.replace(/,/g, "").replace(/원/g, "").trim();


function WonInput({
  value,
  onChange,
  placeholder,
  suggestions,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  suggestions?: string[];
}) {
  const [focused, setFocused] = useState(false);
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    if (!focused) {
      setDraft(value);
    }
  }, [value, focused]);

  const displayValue = focused
    ? draft
    : formatWonInput(value);

  return (
    <>
      <input
        type="text"
        inputMode="numeric"
        list={suggestions ? "shipping-fee-options" : undefined}
        value={displayValue}
        placeholder={placeholder}
        onFocus={() => {
          setFocused(true);
          setDraft(parseWonInput(value));
        }}
        onChange={(e) => {
          const raw = parseWonInput(e.target.value);
          if (/^-?\d*$/.test(raw)) {
            setDraft(raw);
            onChange(raw);
          }
        }}
        onBlur={() => {
          setFocused(false);
          setDraft(value);
        }}
        style={inputStyle}
      />

      {suggestions && (
        <datalist id="shipping-fee-options">
          {suggestions.map((item) => (
            <option key={item} value={item}>
              {formatWonInput(item)}
            </option>
          ))}
        </datalist>
      )}
    </>
  );
}

export default function WholesaleLedgerManager({ listOnly = false }: { listOnly?: boolean }) {
  const [rows, setRows] = useState<LedgerRow[]>([]);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [keyword, setKeyword] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const [productOptions, setProductOptions] = useState<SearchOption[]>([]);
  const [supplierOptions, setSupplierOptions] = useState<SearchOption[]>([]);
  const [customerOptions, setCustomerOptions] = useState<SearchOption[]>([]);
  const [productCode, setProductCode] = useState("");
  const [selectedProductSuppliers, setSelectedProductSuppliers] = useState<SupplierCostOption[]>([]);
  const [selectedUnitCost, setSelectedUnitCost] = useState(0);
  const [selectedProductId, setSelectedProductId] = useState<string>("");
  const [selectedDeliveryCustomerId, setSelectedDeliveryCustomerId] = useState<string>("");
  const [selectedCustomerUnitPrice, setSelectedCustomerUnitPrice] = useState(0);

  async function loadRows() {
    setLoading(true);

    try {
      const response = await fetch("/api/wholesale-ledger", {
        cache: "no-store",
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "목록 조회 실패");
      }

      setRows(data.rows || []);
    } catch (error) {
      alert(error instanceof Error ? error.message : "목록을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }

  async function loadSearchOptions() {
    const [productsPayload, suppliersPayload, customersPayload] =
      await Promise.all([
        fetchOptions(["/api/products", "/api/product"]),
        fetchOptions(["/api/suppliers", "/api/supplier"]),
        fetchOptions(["/api/customers", "/api/customer"]),
      ]);

    setProductOptions(productOptionsFromPayload(productsPayload));
    setSupplierOptions(nameOptionsFromPayload(suppliersPayload, "supplier"));
    setCustomerOptions(nameOptionsFromPayload(customersPayload, "customer"));
  }

  useEffect(() => {
    loadRows();
    loadSearchOptions();
  }, []);

  const filteredRows = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase();

    return rows.filter((row) => {
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

      if (!normalizedKeyword) return true;

      return [
        row.productName,
        row.supplierName || "",
        row.deliveryCompanyName || "",
        row.customerName || "",
        String(row.shippingFee || 0),
        row.memo || "",
      ].some((value) => value.toLowerCase().includes(normalizedKeyword));
    });
  }, [rows, keyword, startDate, endDate]);

  const summary = useMemo(() => {
    return filteredRows.reduce(
      (acc, row) => {
        acc.purchase += row.purchaseAmount;
        acc.sale += row.saleAmount;
        acc.profit += row.saleAmount - row.purchaseAmount;
        return acc;
      },
      { purchase: 0, sale: 0, profit: 0 }
    );
  }, [filteredRows]);

  function changeForm<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function applyPurchaseAmount(unitCost: number, quantityValue = form.quantity) {
    const parsedQuantity = Number(quantityValue);
    const quantity = Number.isFinite(parsedQuantity) && parsedQuantity !== 0
      ? parsedQuantity
      : 1;

    setSelectedUnitCost(unitCost);
    changeForm("purchaseAmount", String(unitCost * quantity));
  }

  async function applyCustomerSalePrice(
    customerId = selectedDeliveryCustomerId,
    productId = selectedProductId,
    quantityValue = form.quantity
  ) {
    if (!customerId || !productId) {
      setSelectedCustomerUnitPrice(0);
      return;
    }

    try {
      const response = await fetch(
        `/api/customer-prices?customerId=${encodeURIComponent(customerId)}`,
        { cache: "no-store" }
      );

      if (!response.ok) return;

      const products = await response.json();
      const matched = Array.isArray(products)
        ? products.find((item: any) => String(item.id) === String(productId))
        : null;

      if (matched?.customerPrice === null || matched?.customerPrice === undefined) {
        setSelectedCustomerUnitPrice(0);
        return;
      }

      const unitPrice = Number(matched.customerPrice) || 0;
      const parsedQuantity = Number(quantityValue);
      const quantity =
        Number.isFinite(parsedQuantity) && parsedQuantity !== 0
          ? parsedQuantity
          : 1;

      setSelectedCustomerUnitPrice(unitPrice);
      changeForm("saleAmount", String(unitPrice * quantity));
    } catch (error) {
      console.error("거래처 판매단가 자동 적용 오류:", error);
    }
  }

  function selectProduct(option: SearchOption) {
    const supplierCosts = option.supplierCosts || [];
    const firstSupplier = supplierCosts[0];

    changeForm("productName", option.label);
    setSelectedProductSuppliers(supplierCosts);
    setSelectedProductId(option.id);

    if (selectedDeliveryCustomerId) {
      applyCustomerSalePrice(
        selectedDeliveryCustomerId,
        option.id,
        form.quantity
      );
    }

    if (firstSupplier) {
      changeForm("supplierName", firstSupplier.name);
      applyPurchaseAmount(firstSupplier.unitCost);
    } else {
      changeForm("supplierName", "");
      changeForm("purchaseAmount", "0");
      setSelectedUnitCost(0);
    }
  }

  function handleProductCodeChange(value: string) {
    setProductCode(value);

    const normalized = value.trim().toLowerCase();
    if (!normalized) {
      changeForm("productName", "");
      changeForm("supplierName", "");
      changeForm("purchaseAmount", "0");
      setSelectedProductSuppliers([]);
      setSelectedUnitCost(0);
      setSelectedProductId("");
      setSelectedCustomerUnitPrice(0);
      changeForm("saleAmount", "0");
      return;
    }

    const matched = productOptions.find(
      (option) => (option.productCode || "").toLowerCase() === normalized
    );

    if (matched) {
      selectProduct(matched);
    }
  }

  function selectSupplier(name: string) {
    changeForm("supplierName", name);
    const matched = selectedProductSuppliers.find((supplier) => supplier.name === name);
    applyPurchaseAmount(matched?.unitCost || 0);
  }

  function startEdit(row: LedgerRow) {
    setEditingId(row.id);
    const matchedProduct = productOptions.find(
      (option) => option.label === row.productName
    );
    setProductCode(matchedProduct?.productCode || "");
    setSelectedProductId(matchedProduct?.id || "");

    const matchedDeliveryCustomer = customerOptions.find(
      (option) => option.label === (row.deliveryCompanyName || "")
    );
    setSelectedDeliveryCustomerId(matchedDeliveryCustomer?.id || "");

    setForm({
      transactionDate: row.transactionDate.slice(0, 10),
      productName: row.productName,
      quantity: String(row.quantity),
      supplierName: row.supplierName || "",
      purchaseAmount: String(row.purchaseAmount),
      deliveryCompanyName: row.deliveryCompanyName || "",
      customerName: row.customerName || "",
      saleAmount: String(row.saleAmount),
      shippingFee: String(row.shippingFee ?? 0),
      settlementStatus: row.settlementStatus,
      memo: row.memo || "",
    });

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(emptyForm());
    setSelectedProductSuppliers([]);
    setSelectedUnitCost(0);
    setSelectedProductId("");
    setSelectedDeliveryCustomerId("");
    setSelectedCustomerUnitPrice(0);
    setProductCode("");
  }

  async function submit(e: FormEvent) {
    e.preventDefault();

    if (!form.productName.trim()) {
      alert("상품을 선택하거나 입력해주세요.");
      return;
    }

    setSaving(true);

    try {
      const url = editingId
        ? `/api/wholesale-ledger/${editingId}`
        : "/api/wholesale-ledger";

      const response = await fetch(url, {
        method: editingId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "저장 실패");
      }

      cancelEdit();
      await loadRows();
    } catch (error) {
      alert(error instanceof Error ? error.message : "저장하지 못했습니다.");
    } finally {
      setSaving(false);
    }
  }

  async function removeRow(id: number) {
    if (!confirm("이 거래 내역을 삭제하시겠습니까?")) return;

    try {
      const response = await fetch(`/api/wholesale-ledger/${id}`, {
        method: "DELETE",
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "삭제 실패");
      }

      if (editingId === id) cancelEdit();
      await loadRows();
    } catch (error) {
      alert(error instanceof Error ? error.message : "삭제하지 못했습니다.");
    }
  }

  return (
    <div style={pageStyle}>
      <style>{`
        .wl-two-column-layout {
          display: grid;
          grid-template-columns: minmax(470px, 40%) minmax(0, 60%);
          gap: 20px;
          align-items: start;
        }

        .wl-left-pane,
        .wl-right-pane {
          min-width: 0;
        }

        .wl-left-pane .wl-form-grid {
          max-width: none !important;
          width: 100% !important;
        }

        .wl-left-pane form {
          width: 100%;
        }

        .wl-left-pane .wl-form-grid {
          grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
        }

        .wl-left-pane > form > div:last-child {
          max-width: none !important;
        }

        .wl-right-pane .wl-toolbar {
          max-width: 100% !important;
          margin-top: 0 !important;
        }

        .wl-right-pane .wl-toolbar > input {
          flex: 1 1 auto !important;
          width: auto !important;
          max-width: none !important;
        }

        .wl-right-pane .wl-table-wrap {
          width: 100%;
        }

        .wl-form-grid {
          display: grid !important;
          grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          gap: 18px 12px !important;
          align-items: end !important;
          width: 100% !important;
          max-width: 760px !important;
        }

        .wl-form-grid > label {
          min-width: 0 !important;
        }

        .wl-form-grid input,
        .wl-form-grid select,
        .wl-form-grid button:not(.wl-search-drop-button) {
          width: 100% !important;
          max-width: 100% !important;
          box-sizing: border-box !important;
          font-size: 14px !important;
        }

        .wl-toolbar {
          display: flex !important;
          gap: 10px !important;
          align-items: center !important;
          justify-content: flex-start !important;
          max-width: 760px !important;
        }

        .wl-toolbar > input {
          flex: 0 1 560px !important;
          width: min(560px, 100%) !important;
        }

        .wl-toolbar select {
          flex: 0 0 130px !important;
          width: 130px !important;
        }

        .wl-table-wrap table {
          font-size: clamp(10px, 0.75vw, 13px) !important;
        }

        .wl-table-wrap th,
        .wl-table-wrap td {
          padding-left: clamp(4px, 0.45vw, 7px) !important;
          padding-right: clamp(4px, 0.45vw, 7px) !important;
        }

        .wl-product-name-cell {
          overflow: hidden !important;
          text-overflow: ellipsis !important;
          white-space: nowrap !important;
          max-width: 0 !important;
        }

        .wl-date-cell {
          font-size: 10px !important;
          letter-spacing: -0.2px !important;
          white-space: nowrap !important;
        }

        @media (max-width: 1180px) {
          .wl-two-column-layout {
            grid-template-columns: 1fr;
          }

          .wl-right-pane {
            margin-top: 0;
          }
        }

        @media (max-width: 1100px) {
          .wl-form-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          }
        }

        @media (max-width: 760px) {
          .wl-form-grid {
            grid-template-columns: 1fr !important;
          }

          .wl-toolbar {
            flex-direction: column !important;
            max-width: 100% !important;
          }

          .wl-toolbar > * {
            width: 100% !important;
            min-width: 0 !important;
            flex: 1 1 auto !important;
          }

          .wl-table-wrap {
            overflow-x: auto !important;
            -webkit-overflow-scrolling: touch;
          }
        }
      `}</style>
      <div style={headerStyle}>
        <div>
          <h1 style={titleStyle}>{listOnly ? "전체 거래내역" : "도매 거래 한 줄 장부"}</h1>
          <p style={descriptionStyle}>
            {listOnly
              ? "도매 거래 한 줄 장부에 등록된 모든 거래가 자동으로 표시됩니다."
              : "상품번호로 상품을 빠르게 불러오고 매입·판매·정산까지 관리합니다."}
          </p>
        </div>
      </div>

      <div className={listOnly ? "" : "wl-two-column-layout"}>
        {!listOnly && (
        <div className="wl-left-pane">
      <form onSubmit={submit} style={formCardStyle}>
        <div style={formGridStyle} className="wl-form-grid">
          <Field label="날짜">
            <input
              type="date"
              value={form.transactionDate}
              onChange={(e) = style={{ width: "110px", height: "38px", minHeight: "38px", padding: "0 10px", boxSizing: "border-box" }}> changeForm("transactionDate", e.target.value)}
              style={inputStyle}
            />
          </Field>

          <Field label="상품번호">
            <SearchSelect
              value={productCode}
              onChange={(value) => {
                setProductCode(value);
                handleProductCodeChange(value);
              }}
              onSelect={(option) => {
                setProductCode(option.productCode || "");
                selectProduct({
                  ...option,
                  label: option.productName || option.label,
                });
              }}
              options={productOptions.map((option) => ({
                ...option,
                label: option.productCode || "",
                keywords: [option.productCode, option.label].filter(Boolean).join(" "),
              }))}
              placeholder="상품번호 검색"
              allowCustom
            />
          </Field>

          <Field label="수량">
            <input
              type="number"
              step="1"
              placeholder="예: 1 / 반품은 -1"
              title="반품 거래는 수량을 음수로 입력하세요. 예: -1"
              value={form.quantity}
              onChange={(e) => {
                const nextQuantity = e.target.value;
                changeForm("quantity", nextQuantity);

                const parsedQuantity = Number(nextQuantity);

                if (selectedUnitCost > 0) {
                  if (Number.isFinite(parsedQuantity) && parsedQuantity !== 0) {
                    changeForm(
                      "purchaseAmount",
                      String(selectedUnitCost * parsedQuantity)
                    );
                  }
                }

                if (selectedCustomerUnitPrice > 0) {
                  if (Number.isFinite(parsedQuantity) && parsedQuantity !== 0) {
                    changeForm(
                      "saleAmount",
                      String(selectedCustomerUnitPrice * parsedQuantity)
                    );
                  }
                }
              }}
              style={inputStyle}
            />
          </Field>

          <Field label="상품">
            <SearchSelect
              value={form.productName}
              onChange={(value) => {
                changeForm("productName", value);
                setSelectedProductSuppliers([]);
                setSelectedUnitCost(0);

                const matched = productOptions.find(
                  (option) => option.label === value
                );

                if (matched) {
                  setSelectedProductId(matched.id);
                  if (selectedDeliveryCustomerId) {
                    applyCustomerSalePrice(
                      selectedDeliveryCustomerId,
                      matched.id,
                      form.quantity
                    );
                  }
                } else {
                  setSelectedProductId("");
                  setSelectedCustomerUnitPrice(0);
                }
              }}
              onSelect={(option) => {
                selectProduct(option);
                setProductCode(option.productCode || "");
              }}
              options={productOptions}
              placeholder="상품명 검색"
              allowCustom
            />
          </Field>

          <Field label="공급업체">
            <SearchSelect
              value={form.supplierName}
              onChange={(value) => {
                changeForm("supplierName", value);
                const matched = selectedProductSuppliers.find(
                  (supplier) => supplier.name === value
                );
                if (matched) applyPurchaseAmount(matched.unitCost);
              }}
              onSelect={(option) => selectSupplier(option.label)}
              options={
                selectedProductSuppliers.length > 0
                  ? selectedProductSuppliers.map((supplier, index) => ({
                      id: `${supplier.name}-${index}`,
                      label: supplier.name,
                      keywords: supplier.name,
                    }))
                  : supplierOptions
              }
              placeholder={
                selectedProductSuppliers.length > 0
                  ? "이 상품의 공급업체 선택"
                  : "공급업체 검색"
              }
              allowCustom
            />
          </Field>

          <Field label="납품업체">
            <SearchSelect
              value={form.deliveryCompanyName}
              onChange={(value) => {
                changeForm("deliveryCompanyName", value);

                const matched = customerOptions.find(
                  (option) => option.label === value
                );

                if (matched) {
                  setSelectedDeliveryCustomerId(matched.id);
                  applyCustomerSalePrice(
                    matched.id,
                    selectedProductId,
                    form.quantity
                  );
                } else {
                  setSelectedDeliveryCustomerId("");
                  setSelectedCustomerUnitPrice(0);
                }
              }}
              onSelect={(option) => {
                changeForm("deliveryCompanyName", option.label);
                setSelectedDeliveryCustomerId(option.id);
                applyCustomerSalePrice(
                  option.id,
                  selectedProductId,
                  form.quantity
                );
              }}
              options={customerOptions}
              placeholder="납품업체 검색"
              allowCustom
            />
          </Field>

          <Field label="단가">
            <WonInput
              value={form.purchaseAmount}
              onChange={(value) => changeForm("purchaseAmount", value)}
              placeholder="직접 입력"
            />
          </Field>

          <Field label="판매금액">
            <WonInput
              value={form.saleAmount}
              onChange={(value) => {
                changeForm("saleAmount", value);
                setSelectedCustomerUnitPrice(0);
              }}
              placeholder="직접 입력"
            />
          </Field>

          <Field label="배송비">
            <WonInput
              value={form.shippingFee}
              onChange={(value) => changeForm("shippingFee", value)}
              placeholder="직접 입력 또는 목록 선택"
              suggestions={["0", "4000", "7000"]}
            />
          </Field>

          <Field label="고객 이름">
            <input
              value={form.customerName}
              onChange={(e) => changeForm("customerName", e.target.value)}
              placeholder="고객 이름"
              style={inputStyle}
              autoComplete="off"
            />
          </Field>

          <Field label="메모">
            <input
              value={form.memo}
              onChange={(e) => changeForm("memo", e.target.value)}
              placeholder="선택"
              style={inputStyle}
            />
          </Field>


        </div>

        <div style={buttonRowStyle}>
          {editingId && (
            <button type="button" onClick={cancelEdit} style={cancelButtonStyle}>
              수정 취소
            </button>
          )}
          <button type="submit" disabled={saving} style={saveButtonStyle}>
            {saving ? "저장 중..." : editingId ? "수정 저장" : "거래 저장"}
          </button>
        </div>
      </form>
        </div>
        )}

        <div className={listOnly ? "" : "wl-right-pane"}>
      <div style={toolbarStyle} className="wl-toolbar">
        <input
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          placeholder="상품·공급업체·납품업체·고객이름·메모 검색"
          style={searchStyle}
        />

        <div style={dateFilterStyle}>
          <label style={dateLabelStyle}>
            시작일
            <input
              type="date"
              value={startDate}
              onChange={(e) = style={{ width: "110px", height: "38px", minHeight: "38px", padding: "0 10px", boxSizing: "border-box" }}> setStartDate(e.target.value)}
              style={dateInputStyle}
            />
          </label>

          <span style={dateSeparatorStyle}>~</span>

          <label style={dateLabelStyle}>
            종료일
            <input
              type="date"
              value={endDate}
              onChange={(e) = style={{ width: "110px", height: "38px", minHeight: "38px", padding: "0 10px", boxSizing: "border-box" }}> setEndDate(e.target.value)}
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

      <div style={tableWrapStyle} className="wl-table-wrap">
        <table style={tableStyle}>
          <colgroup>
            <col style={{ width: "66px" }} />
            <col style={{ width: "150px" }} />
            <col style={{ width: "42px" }} />
            <col style={{ width: "68px" }} />
            <col style={{ width: "76px" }} />
            <col style={{ width: "78px" }} />
            <col style={{ width: "76px" }} />
            <col style={{ width: "78px" }} />
            <col style={{ width: "68px" }} />
            <col style={{ width: "72px" }} />
            <col style={{ width: "64px" }} />
            {!listOnly && <col style={{ width: "78px" }} />}
          </colgroup>
          <thead>
            <tr>
              {[
                "날짜",
                "상품",
                "수량",
                "공급업체",
                "매입금액",
                "납품업체",
                "고객 이름",
                "판매금액",
                "배송비",
                "이익",
                "메모",
                ...(!listOnly ? ["관리"] : []),
              ].map((head) => (
                <th key={head} style={{ ...thStyle, textAlign: "left" }}>
                  {head}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td colSpan={listOnly ? 11 : 12} style={emptyStyle}>불러오는 중...</td>
              </tr>
            ) : filteredRows.length === 0 ? (
              <tr>
                <td colSpan={listOnly ? 11 : 12} style={emptyStyle}>등록된 거래가 없습니다.</td>
              </tr>
            ) : (
              [...filteredRows].reverse().map((row) => {
                const profit = row.saleAmount - row.purchaseAmount;

                return (
                  <tr key={row.id}>
                    <td className="wl-date-cell" style={tdStyle}>
                      {dateOnly(row.transactionDate)}
                    </td>
                    <td
                      className="wl-product-name-cell"
                      style={{
                        ...tdStyle,
                        fontWeight: 800,
                        fontSize:
                          row.productName.length >= 22
                            ? "10px"
                            : row.productName.length >= 16
                            ? "11px"
                            : row.productName.length >= 11
                            ? "12px"
                            : "13px",
                      }}
                      title={row.productName}
                    >
                      {row.productName}
                    </td>
                    <td style={centerTdStyle}>{money(row.quantity)}</td>
                    <td style={tdStyle}>{row.supplierName || "-"}</td>
                    <td style={numberTdStyle}>{money(row.purchaseAmount)}원</td>
                    <td style={tdStyle}>{row.deliveryCompanyName || "-"}</td>
                    <td style={tdStyle}>{row.customerName || "-"}</td>
                    <td style={numberTdStyle}>{money(row.saleAmount)}원</td>
                    <td style={numberTdStyle}>{money(row.shippingFee || 0)}원</td>
                    <td style={{
                      ...numberTdStyle,
                      fontWeight: 900,
                      color: profit >= 0 ? "#166534" : "#b91c1c",
                    }}>
                      {money(profit)}원
                    </td>
                    <td style={tdStyle}>{row.memo || "-"}</td>
                    {!listOnly && (
                    <td style={centerTdStyle}>
                      <div style={actionStyle}>
                        <button onClick={() => startEdit(row)} style={editButtonStyle}>
                          수정
                        </button>
                        <button onClick={() => removeRow(row.id)} style={deleteButtonStyle}>
                          삭제
                        </button>
                      </div>
                    </td>
                    )}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
        </div>
      </div>
    </div>
  );
}

function SearchSelect({
  value,
  onChange,
  onSelect,
  options,
  placeholder,
  allowCustom = false,
}: {
  value: string;
  onChange: (value: string) => void;
  onSelect?: (option: SearchOption) => void;
  options: SearchOption[];
  placeholder: string;
  allowCustom?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filtered = useMemo(() => {
    const q = value.trim().toLowerCase();

    if (!q) return options.slice(0, 30);

    return options
      .filter((option) =>
        `${option.label} ${option.keywords || ""}`
          .toLowerCase()
          .includes(q)
      )
      .slice(0, 50);
  }, [options, value]);

  useEffect(() => {
    if (!open) {
      setHighlightedIndex(-1);
      return;
    }

    setHighlightedIndex(filtered.length > 0 ? 0 : -1);
  }, [open, filtered.length]);

  return (
    <div
      ref={wrapperRef}
      style={{
        ...searchSelectWrapStyle,
        zIndex: open ? 100000 : 20,
      }}
    >
      <div style={searchSelectInputWrapStyle}>
        <input
          value={value}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            onChange(e.target.value);
            setOpen(true);
            setHighlightedIndex(0);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();

              if (!open) {
                setOpen(true);
                setHighlightedIndex(filtered.length > 0 ? 0 : -1);
                return;
              }

              if (filtered.length > 0) {
                setHighlightedIndex((current) =>
                  current < filtered.length - 1 ? current + 1 : 0
                );
              }
            }

            if (e.key === "ArrowUp") {
              e.preventDefault();

              if (!open) {
                setOpen(true);
                setHighlightedIndex(filtered.length > 0 ? filtered.length - 1 : -1);
                return;
              }

              if (filtered.length > 0) {
                setHighlightedIndex((current) =>
                  current > 0 ? current - 1 : filtered.length - 1
                );
              }
            }

            if (e.key === "Enter" && open && highlightedIndex >= 0) {
              e.preventDefault();
              const option = filtered[highlightedIndex];

              if (option) {
                onChange(option.label);
                onSelect?.(option);
                setOpen(false);
                setHighlightedIndex(-1);
              }
            }

            if (e.key === "Escape") {
              e.preventDefault();
              setOpen(false);
              setHighlightedIndex(-1);
            }
          }}
          placeholder={placeholder}
          autoComplete="off"
          role="combobox"
          aria-expanded={open}
          aria-autocomplete="list"
          style={searchSelectInputStyle}
        />
        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          className="wl-search-drop-button"
          style={dropButtonStyle}
          aria-label="목록 열기"
        >
          ▼
        </button>
      </div>

      {open && (
        <div style={dropdownStyle}>
          {filtered.length > 0 ? (
            filtered.map((option, index) => (
              <button
                key={option.id}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onMouseEnter={() => setHighlightedIndex(index)}
                onClick={() => {
                  onChange(option.label);
                  onSelect?.(option);
                  setOpen(false);
                  setHighlightedIndex(-1);
                }}
                style={{
                  ...optionButtonStyle,
                  ...(highlightedIndex === index ? highlightedOptionStyle : {}),
                }}
              >
                {option.label}
              </button>
            ))
          ) : (
            <div style={noResultStyle}>
              {allowCustom
                ? "검색 결과가 없습니다. 직접 입력해도 됩니다."
                : "검색 결과가 없습니다."}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={fieldStyle}>
      <span style={labelStyle}>{label}</span>
      {children}
    </label>
  );
}

function statusBadgeStyle(status: string): React.CSSProperties {
  const background =
    status === "정산완료" ? "#dcfce7" :
    status === "일부정산" ? "#fef3c7" :
    "#fee2e2";

  const color =
    status === "정산완료" ? "#166534" :
    status === "일부정산" ? "#92400e" :
    "#991b1b";

  return {
    display: "inline-block",
    padding: "5px 9px",
    borderRadius: "999px",
    background,
    color,
    fontSize: "12px",
    fontWeight: 800,
    whiteSpace: "nowrap",
  };
}

const pageStyle: React.CSSProperties = {
  width: "100%",
  maxWidth: "none",
  margin: "0",
  boxSizing: "border-box",
};

const headerStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: "20px",
};

const titleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: "clamp(22px, 2vw, 28px)",
  fontWeight: 900,
  color: "#0f172a",
};

const descriptionStyle: React.CSSProperties = {
  margin: "7px 0 0",
  color: "#64748b",
};

const formCardStyle: React.CSSProperties = {
  background: "white",
  height: "fit-content",
  border: "1px solid #e2e8f0",
  borderRadius: "16px",
  padding: "clamp(12px, 1.4vw, 18px)",
  boxShadow: "0 8px 24px rgba(15, 23, 42, 0.05)",
  overflow: "visible",
  position: "relative",
  zIndex: 20,
};

const formGridStyle: React.CSSProperties = {
  display: "grid",
  overflow: "visible",
  gridTemplateColumns: "repeat(9, minmax(120px, 1fr))",
  gap: "12px",
  alignItems: "end",
};

const fieldStyle: React.CSSProperties = {
  display: "flex",
  overflow: "visible",
  flexDirection: "column",
  gap: "6px",
  position: "relative",
};

const labelStyle: React.CSSProperties = {
  fontSize: "12px",
  fontWeight: 800,
  color: "#475569",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  minHeight: "42px",
  border: "1px solid #cbd5e1",
  borderRadius: "9px",
  padding: "8px 10px",
  background: "white",
  color: "#0f172a",
};

const searchSelectWrapStyle: React.CSSProperties = {
  position: "relative",
  width: "100%",
  zIndex: 20,
};

const searchSelectInputWrapStyle: React.CSSProperties = {
  display: "flex",
  width: "100%",
  minHeight: "42px",
  border: "1px solid #93c5fd",
  borderRadius: "9px",
  overflow: "hidden",
  background: "white",
};

const searchSelectInputStyle: React.CSSProperties = {
  flex: 1,
  width: "100%",
  minWidth: 0,
  border: 0,
  outline: "none",
  padding: "8px 10px",
  color: "#0f172a",
  background: "transparent",
};

const dropButtonStyle: React.CSSProperties = {
  width: "40px",
  minWidth: "40px",
  flex: "0 0 40px",
  border: 0,
  borderLeft: "1px solid #bfdbfe",
  background: "#eff6ff",
  color: "#1e3a8a",
  cursor: "pointer",
};

const dropdownStyle: React.CSSProperties = {
  position: "absolute",
  top: "calc(100% + 4px)",
  left: 0,
  right: 0,
  maxHeight: "260px",
  overflowY: "auto",
  background: "white",
  border: "1px solid #cbd5e1",
  borderRadius: "10px",
  boxShadow: "0 12px 28px rgba(15, 23, 42, 0.14)",
  zIndex: 100001,
};

const optionButtonStyle: React.CSSProperties = {
  display: "block",
  width: "100%",
  border: 0,
  borderBottom: "1px solid #f1f5f9",
  background: "white",
  padding: "10px 12px",
  textAlign: "left",
  color: "#0f172a",
  cursor: "pointer",
  fontSize: "13px",
};

const highlightedOptionStyle: React.CSSProperties = {
  background: "#eff6ff",
  color: "#1d4ed8",
  fontWeight: 800,
};

const noResultStyle: React.CSSProperties = {
  padding: "14px",
  color: "#94a3b8",
  fontSize: "13px",
};

const buttonRowStyle: React.CSSProperties = {
  marginTop: "18px",
  display: "flex",
  justifyContent: "flex-end",
  gap: "8px",
  width: "100%",
  maxWidth: "760px",
};

const saveButtonStyle: React.CSSProperties = {
  border: 0,
  borderRadius: "9px",
  padding: "11px 20px",
  background: "#2563eb",
  color: "white",
  fontWeight: 800,
  cursor: "pointer",
};

const cancelButtonStyle: React.CSSProperties = {
  border: "1px solid #cbd5e1",
  borderRadius: "9px",
  padding: "11px 20px",
  background: "white",
  color: "#334155",
  fontWeight: 800,
  cursor: "pointer",
};

const toolbarStyle: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: "12px",
  marginTop: "0",
  marginBottom: "12px",
  alignItems: "flex-end",
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
  height: "48px",
  padding: "0 12px",
  border: "1px solid #cbd5e1",
  borderRadius: "10px",
  background: "white",
  boxSizing: "border-box",
};

const dateSeparatorStyle: React.CSSProperties = {
  paddingBottom: "15px",
  color: "#64748b",
};

const resetButtonStyle: React.CSSProperties = {
  height: "48px",
  padding: "0 14px",
  border: "1px solid #cbd5e1",
  borderRadius: "10px",
  background: "white",
  color: "#334155",
  fontWeight: 700,
  cursor: "pointer",
};

const tableWrapStyle: React.CSSProperties = {
  overflowX: "auto",
  background: "white",
  border: "1px solid #e2e8f0",
  borderRadius: "14px",
};

const tableStyle: React.CSSProperties = {
  width: "100%",
  minWidth: "980px",
  borderCollapse: "collapse",
  tableLayout: "fixed",
};

const thStyle: React.CSSProperties = {
  background: "#f8fafc",
  color: "#475569",
  padding: "11px 8px",
  borderBottom: "1px solid #e2e8f0",
  textAlign: "left",
  fontSize: "12px",
  fontWeight: 900,
  whiteSpace: "nowrap",
};

const tdStyle: React.CSSProperties = {
  padding: "11px 8px",
  borderBottom: "1px solid #f1f5f9",
  fontSize: "13px",
  color: "#334155",
  whiteSpace: "nowrap",
};

const numberTdStyle: React.CSSProperties = {
  ...tdStyle,
  textAlign: "left",
};

const centerTdStyle: React.CSSProperties = {
  ...tdStyle,
  textAlign: "left",
};

const emptyStyle: React.CSSProperties = {
  padding: "45px",
  textAlign: "center",
  color: "#94a3b8",
};

const actionStyle: React.CSSProperties = {
  display: "flex",
  gap: "6px",
  justifyContent: "flex-start",
};

const editButtonStyle: React.CSSProperties = {
  border: "1px solid #bfdbfe",
  background: "#eff6ff",
  color: "#1d4ed8",
  borderRadius: "7px",
  padding: "6px 9px",
  fontWeight: 800,
  cursor: "pointer",
};

const deleteButtonStyle: React.CSSProperties = {
  border: "1px solid #fecaca",
  background: "#fff1f2",
  color: "#be123c",
  borderRadius: "7px",
  padding: "6px 9px",
  fontWeight: 800,
  cursor: "pointer",
};