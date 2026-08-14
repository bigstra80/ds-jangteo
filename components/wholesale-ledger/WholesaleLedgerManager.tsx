"use client";

import { FormEvent, KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  isZeroAmount,
  zeroAmountTextColor,
} from "@/lib/zero-amount-style";
import { calculateLedgerAmount } from "@/lib/ledger-amount";
import { getLocalDateString } from "@/lib/local-date";
import { changedInputStyle } from "@/lib/dirty-input-style";
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
  orderPageStyle,
  settlementDateCellStyle,
  settlementPageStyle,
  settlementWrappingCellStyle,
} from "@/lib/settlement-table-layout";

type LedgerRow = {
  id: number;
  transactionDate: string;
  createdAt: string;
  productId: number | null;
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
};

function compareCreatedOrder(
  a: LedgerRow,
  b: LedgerRow,
  direction: "asc" | "desc"
) {
  const aCreatedAt = new Date(a.createdAt).getTime();
  const bCreatedAt = new Date(b.createdAt).getTime();
  const safeACreatedAt = Number.isFinite(aCreatedAt) ? aCreatedAt : 0;
  const safeBCreatedAt = Number.isFinite(bCreatedAt) ? bCreatedAt : 0;
  const createdAtDiff = safeACreatedAt - safeBCreatedAt;

  if (createdAtDiff !== 0) {
    return direction === "asc" ? createdAtDiff : -createdAtDiff;
  }

  return direction === "asc" ? a.id - b.id : b.id - a.id;
}

type SortOrder = "inputDesc" | "inputAsc";

type FormState = {
  transactionDate: string;
  productName: string;
  quantity: string;
  supplierName: string;
  purchaseAmount: string;
  deliveryCompanyName: string;
  customerName: string;
  customerPhone: string;
  saleAmount: string;
  shippingFee: string;
  settlementStatus: string;
  memo: string;
};

type SupplierCostOption = {
  id?: string;
  name: string;
  unitCost: number;
};

type SearchOption = {
  id: string;
  label: string;
  keywords?: string;
  code?: string;
  customerGrade?: string;
  isActive?: boolean;
  productCode?: string;
  productName?: string;
  basePrice?: number;
  supplierCosts?: SupplierCostOption[];
};

const today = getLocalDateString;

const emptyForm = (): FormState => ({
  transactionDate: today(),
  productName: "",
  quantity: "1",
  supplierName: "",
  purchaseAmount: "",
  deliveryCompanyName: "",
  customerName: "",
  customerPhone: "",
  saleAmount: "",
  shippingFee: "0.4",
  settlementStatus: "미정산",
  memo: "",
});

const money = (value: number) =>
  new Intl.NumberFormat("ko-KR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  }).format(value);

const redMemoKeywords = [
  "회수반품",
  "회수확인",
  "매입처리",
  "반품",
  "회수",
  "매입",
  "확인",
];

function shouldHighlightMemo(memo: string | null | undefined) {
  const normalizedMemo = (memo || "").trim();
  return redMemoKeywords.some((keyword) => normalizedMemo.includes(keyword));
}

// 붙여넣기할 때 함께 들어오는 줄바꿈, 여러 공백, ** 등의 특수문자를
// 모두 무시하여 화면에 보이는 상품명 전체를 그대로 복사해도 검색되게 한다.
function normalizeSearchText(value: unknown) {
  return String(value ?? "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\p{P}\p{S}\s]+/gu, "");
}


function oneDecimalSignedInput(value: string) {
  const negative = value.startsWith("-");
  const unsigned = value.replace(/-/g, "");
  const cleaned = unsigned.replace(/[^0-9.]/g, "");
  const firstDot = cleaned.indexOf(".");

  let normalized = cleaned;
  if (firstDot !== -1) {
    const integerPart = cleaned.slice(0, firstDot);
    const decimalPart = cleaned
      .slice(firstDot + 1)
      .replace(/\./g, "")
      .slice(0, 1);
    normalized = `${integerPart}.${decimalPart}`;
  }

  return negative ? `-${normalized}` : normalized;
}

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
          ? {
              id: String(product.supplier.id),
              name: String(product.supplier.name),
              unitCost: Number(product?.cost || 0),
            }
          : null,
        product?.supplier2?.name
          ? {
              id: String(product.supplier2.id),
              name: String(product.supplier2.name),
              unitCost: Number(product?.cost2 || 0),
            }
          : null,
        product?.supplier3?.name
          ? {
              id: String(product.supplier3.id),
              name: String(product.supplier3.name),
              unitCost: Number(product?.cost3 || 0),
            }
          : null,
      ].filter(Boolean) as SupplierCostOption[];

      return {
        id: String(product?.id ?? index),
        label: productName,
        productName,
        productCode,
        basePrice: Number(product?.price || 0),
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
      const code = String(item?.code ?? "").trim();

      return {
        id: String(item?.id ?? index),
        label: name,
        code,
        customerGrade:
          kind === "customer" ? String(item?.grade || "D").toUpperCase() : undefined,
        isActive: item?.isActive !== false,
        keywords: [code, name, phone, contact].filter(Boolean).join(" "),
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
  return number.toLocaleString("ko-KR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  });
};

const parseWonInput = (value: string) =>
  value.replace(/,/g, "").replace(/원/g, "").trim();

function WonInput({
  value,
  onChange,
  placeholder,
  suggestions,
  highlightZero = false,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  suggestions?: string[];
  highlightZero?: boolean;
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
        inputMode="decimal"
        list={suggestions ? "shipping-fee-options" : undefined}
        value={displayValue}
        placeholder={placeholder}
        onFocus={() => {
          setFocused(true);
          setDraft(parseWonInput(value));
        }}
        onChange={(e) => {
          const raw = parseWonInput(e.target.value);
          if (/^-?\d*(?:\.\d{0,1})?$/.test(raw)) {
            setDraft(raw);
            onChange(raw);
          }
        }}
        onBlur={() => {
          setFocused(false);
          setDraft(value);
        }}
        style={{
          ...inputStyle,
          color:
            highlightZero && isZeroAmount(displayValue)
              ? zeroAmountTextColor(displayValue)
              : inputStyle.color,
        }}
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
  const [saveMessage, setSaveMessage] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [bulkInlineSaving, setBulkInlineSaving] = useState(false);
  const [inlineEdits, setInlineEdits] = useState<Record<number, {
    saleAmount: string;
    shippingFee: string;
    memo: string;
  }>>({});
  const [keyword, setKeyword] = useState("");
  const [searchField, setSearchField] = useState("all");
  const [zeroSaleOnly, setZeroSaleOnly] = useState(false);
  const [zeroPurchaseOnly, setZeroPurchaseOnly] = useState(false);
  const [purchaseAmountEdits, setPurchaseAmountEdits] = useState<Record<number, string>>({});
  const [savingPurchaseAmountId, setSavingPurchaseAmountId] = useState<number | null>(null);
  const [bulkPurchaseSaving, setBulkPurchaseSaving] = useState(false);
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState("");
  const [sortOrder, setSortOrder] = useState<SortOrder>("inputDesc");

  const [productOptions, setProductOptions] = useState<SearchOption[]>([]);
  const [supplierOptions, setSupplierOptions] = useState<SearchOption[]>([]);
  const [customerOptions, setCustomerOptions] = useState<SearchOption[]>([]);
  const [productCode, setProductCode] = useState("");
  const [selectedProductSuppliers, setSelectedProductSuppliers] = useState<SupplierCostOption[]>([]);
  const [selectedUnitCost, setSelectedUnitCost] = useState(0);
  const [selectedSupplierId, setSelectedSupplierId] = useState("");
  const [selectedProductId, setSelectedProductId] = useState<string>("");
  const [selectedDeliveryCustomerId, setSelectedDeliveryCustomerId] = useState<string>("");
  const [selectedCustomerUnitPrice, setSelectedCustomerUnitPrice] = useState(0);
  const [saleUnitPriceInput, setSaleUnitPriceInput] = useState("");
  const [isSalePriceManuallyEdited, setIsSalePriceManuallyEdited] = useState(false);
  const [formResetKey, setFormResetKey] = useState(0);

  async function loadRows() {
    setLoading(true);

    try {
      const response = await fetch(`/api/wholesale-ledger?ts=${Date.now()}`, {
        cache: "no-store",
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "목록 조회 실패");
      }

      const nextRows = ([...(data.rows || [])] as LedgerRow[]).sort((a, b) =>
        compareCreatedOrder(a, b, "desc")
      );
      setRows(nextRows);
      setInlineEdits((current) => {
        const next = { ...current };
        for (const row of nextRows) {
          if (!next[row.id]) {
            next[row.id] = {
              saleAmount: String(row.saleAmount ?? 0),
              shippingFee: String(row.shippingFee ?? 0),
              memo: row.memo || "",
            };
          }
        }
        return next;
      });
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
        fetchOptions(["/api/wholesale-ledger/customers"]),
      ]);

    setProductOptions(productOptionsFromPayload(productsPayload));
    setSupplierOptions(nameOptionsFromPayload(suppliersPayload, "supplier"));
    setCustomerOptions(nameOptionsFromPayload(customersPayload, "customer"));
  }

  async function loadCurrentUserRole() {
    try {
      const response = await fetch("/api/auth/me", { cache: "no-store" });
      const data = await response.json();
      setIsAdmin(response.ok && data?.isAdmin === true);
    } catch {
      setIsAdmin(false);
    }
  }

  useEffect(() => {
    loadRows();
    loadSearchOptions();
    loadCurrentUserRole();
  }, []);

  const filteredRows = useMemo(() => {
    const normalizedKeyword = normalizeSearchText(keyword);

    const nextRows = rows.filter((row) => {
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

      if (
        zeroSaleOnly &&
        !(
          typeof row.saleAmount === "number" &&
          Number.isFinite(row.saleAmount) &&
          row.saleAmount === 0
        )
      ) {
        return false;
      }

      if (zeroPurchaseOnly) {
        const rawPurchaseAmount = row.purchaseAmount as unknown;
        if (
          rawPurchaseAmount === null ||
          rawPurchaseAmount === undefined ||
          String(rawPurchaseAmount).trim() === "" ||
          !Number.isFinite(Number(rawPurchaseAmount)) ||
          Number(rawPurchaseAmount) !== 0
        ) {
          return false;
        }
      }

      if (!normalizedKeyword) return true;

      const rowProductCode = row.productCode || "";
      const fields: Record<string, unknown[]> = {
        all: [rowProductCode, row.productName, row.supplierName, row.deliveryCompanyName, row.customerName, row.customerPhone, row.shippingFee, row.memo],
        product: [rowProductCode, row.productName], supplier: [row.supplierName], deliveryCompany: [row.deliveryCompanyName], customer: [row.customerName], phone: [row.customerPhone], memo: [row.memo],
      };
      return (fields[searchField] || fields.all).some((value) => normalizeSearchText(value).includes(normalizedKeyword));
    });

    return nextRows.sort((a, b) => {
      return compareCreatedOrder(
        a,
        b,
        sortOrder === "inputAsc" ? "asc" : "desc"
      );
    });
  }, [
    rows,
    keyword,
    searchField,
    zeroSaleOnly,
    zeroPurchaseOnly,
    startDate,
    endDate,
    sortOrder,
  ]);

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

  const transactionSummary = useMemo(() => {
    return filteredRows.reduce(
      (result, row) => {
        const purchaseAmount = Number(row.purchaseAmount || 0);
        const saleAmount = Number(row.saleAmount || 0);

        result.tradeCount += 1;
        result.purchaseAmount += purchaseAmount;
        result.saleAmount += saleAmount;
        result.profitAmount += saleAmount - purchaseAmount;

        return result;
      },
      {
        tradeCount: 0,
        purchaseAmount: 0,
        saleAmount: 0,
        profitAmount: 0,
      }
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

  function applySaleUnitPrice(unitPrice: number, quantityValue = form.quantity) {
    setSelectedCustomerUnitPrice(unitPrice);
    setSaleUnitPriceInput(String(unitPrice));
    changeForm(
      "saleAmount",
      String(calculateLedgerAmount(unitPrice, quantityValue))
    );
    setIsSalePriceManuallyEdited(false);
  }

  async function applyCustomerSalePrice(
    customerId = selectedDeliveryCustomerId,
    productId = selectedProductId,
    quantityValue = form.quantity
  ) {
    if (!productId) {
      setSelectedCustomerUnitPrice(0);
      setSaleUnitPriceInput("");
      setIsSalePriceManuallyEdited(false);
      return;
    }

    const selectedProduct = productOptions.find(
      (option) => String(option.id) === String(productId)
    );

    if (!customerId) {
      applySaleUnitPrice(selectedProduct?.basePrice || 0, quantityValue);
      return;
    }

    try {
      const response = await fetch(
        `/api/wholesale-ledger/customer-price?customerId=${encodeURIComponent(customerId)}&productId=${encodeURIComponent(productId)}`,
        { cache: "no-store" }
      );

      if (!response.ok) {
        const errorPayload = await response.json().catch(() => ({}));
        console.error("납품업체 등급 조회 실패:", response.status, errorPayload);
        setSaveMessage("납품업체 등급을 불러오지 못했습니다.");
        applySaleUnitPrice(selectedProduct?.basePrice || 0, quantityValue);
        return;
      }

      const matched = await response.json();

      if (matched?.customerPrice === null || matched?.customerPrice === undefined) {
        console.error("납품업체 등급 단가 응답에 customerPrice가 없습니다.", matched);
        setSaveMessage("납품업체 등급을 불러오지 못했습니다.");
        applySaleUnitPrice(selectedProduct?.basePrice || 0, quantityValue);
        return;
      }

      const unitPrice = Number(matched.customerPrice) || 0;
      setSaveMessage("");
      applySaleUnitPrice(unitPrice, quantityValue);
    } catch (error) {
      console.error("거래처 판매단가 자동 적용 오류:", error);
      setSaveMessage("납품업체 등급을 불러오지 못했습니다.");
      applySaleUnitPrice(selectedProduct?.basePrice || 0, quantityValue);
    }
  }

  function selectProduct(option: SearchOption) {
    const supplierCosts = option.supplierCosts || [];
    const firstSupplier = supplierCosts[0];

    changeForm("productName", option.label);
    setProductCode(option.productCode || "");
    setSelectedProductSuppliers(supplierCosts);
    setSelectedProductId(option.id);

    if (selectedDeliveryCustomerId) {
      applyCustomerSalePrice(
        selectedDeliveryCustomerId,
        option.id,
        form.quantity
      );
    } else if (form.deliveryCompanyName.trim()) {
      applySaleUnitPrice(0, form.quantity);
    } else {
      applySaleUnitPrice(option.basePrice || 0, form.quantity);
    }

    if (firstSupplier) {
      changeForm("supplierName", firstSupplier.name);
      setSelectedSupplierId(firstSupplier.id || "");
      applyPurchaseAmount(firstSupplier.unitCost);
    } else {
      changeForm("supplierName", "");
      setSelectedSupplierId("");
      changeForm("purchaseAmount", "0");
      setSelectedUnitCost(0);
    }
  }

  function handleProductCodeChange(value: string) {
    setProductCode(value);

    const normalized = value.trim().toLowerCase();
    if (!normalized) {
      setSelectedProductId("");
      return;
    }

    const matched = productOptions.find(
      (option) => (option.productCode || "").toLowerCase() === normalized
    );

    if (matched) {
      selectProduct(matched);
    } else {
      setSelectedProductId("");
      setSelectedProductSuppliers([]);
      setSelectedSupplierId("");
    }
  }

  function selectSupplier(name: string) {
    changeForm("supplierName", name);
    const matched = selectedProductSuppliers.find((supplier) => supplier.name === name);
    setSelectedSupplierId(matched?.id || "");
    applyPurchaseAmount(matched?.unitCost || 0);
  }

  function startEdit(row: LedgerRow) {
    setEditingId(row.id);
    const matchedProduct = productOptions.find((option) =>
      row.productId
        ? option.id === String(row.productId)
        : Boolean(row.productCode) &&
          option.productCode?.toLowerCase() === row.productCode?.toLowerCase()
    );
    setProductCode(matchedProduct?.productCode || "");
    setSelectedProductId(matchedProduct?.id || "");
    const matchedSupplier = matchedProduct?.supplierCosts?.find(
      (supplier) => supplier.name === (row.supplierName || "")
    );
    setSelectedProductSuppliers(matchedProduct?.supplierCosts || []);
    setSelectedSupplierId(matchedSupplier?.id || "");

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
      customerPhone: row.customerPhone || "",
      saleAmount: String(row.saleAmount),
      shippingFee: String(row.shippingFee ?? 0),
      settlementStatus: row.settlementStatus,
      memo: row.memo || "",
    });

    const editQuantity = Number(row.quantity);
    const editUnitPrice = editQuantity !== 0 ? row.saleAmount / editQuantity : row.saleAmount;
    setSelectedCustomerUnitPrice(editUnitPrice);
    setSaleUnitPriceInput(String(editUnitPrice));
    setIsSalePriceManuallyEdited(true);

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function resetOrderForm({
    preserveDate = true,
    clearMessage = true,
  }: {
    preserveDate?: boolean;
    clearMessage?: boolean;
  } = {}) {
    const nextForm = emptyForm();
    if (preserveDate) {
      nextForm.transactionDate = form.transactionDate;
    }

    setForm(nextForm);
    setSelectedProductSuppliers([]);
    setSelectedUnitCost(0);
    setSelectedSupplierId("");
    setSelectedProductId("");
    setSelectedDeliveryCustomerId("");
    setSelectedCustomerUnitPrice(0);
    setSaleUnitPriceInput("");
    setIsSalePriceManuallyEdited(false);
    setProductCode("");
    setEditingId(null);
    setFormResetKey((current) => current + 1);
    if (clearMessage) setSaveMessage("");
  }

  function resetNewOrderForm() {
    if (editingId !== null) return;
    resetOrderForm({ preserveDate: true });
  }

  function cancelEdit() {
    resetOrderForm({ preserveDate: false });
  }

  async function saveTransaction() {
    if (saving) return;

    if (!form.productName.trim()) {
      alert("상품을 선택하거나 입력해주세요.");
      return;
    }

    setSaving(true);
    setSaveMessage("저장 중...");

    try {
      const editing = editingId !== null;
      const url = editing
        ? `/api/wholesale-ledger/${editingId}`
        : "/api/wholesale-ledger";

      const response = await fetch(url, {
        method: editing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({
          ...form,
          productId: selectedProductId || null,
          productCode: productCode.trim() || null,
          supplierId: selectedSupplierId || null,
          deliveryCustomerId: selectedDeliveryCustomerId || null,
          isSalePriceManuallyEdited,
          saleUnitPrice: parseWonInput(saleUnitPriceInput || "0"),
          saleAmount: String(
            calculateLedgerAmount(
              parseWonInput(saleUnitPriceInput || "0"),
              form.quantity
            )
          ),
        }),
      });

      const rawText = await response.text();
      let data: any = {};
      try {
        data = rawText ? JSON.parse(rawText) : {};
      } catch {
        data = {};
      }

      if (!response.ok) {
        throw new Error(data?.error || rawText || `저장 실패 (${response.status})`);
      }

      const savedRow = (data?.row ?? data?.savedRow ?? data) as LedgerRow;

      if (savedRow && Number.isFinite(Number(savedRow.id))) {
        setRows((currentRows) => {
          const rowsWithoutSaved = currentRows.filter(
            (item) => item.id !== savedRow.id
          );

          return [savedRow, ...rowsWithoutSaved].sort((a, b) =>
            compareCreatedOrder(a, b, "desc")
          );
        });

        setInlineEdits((current) => ({
          ...current,
          [savedRow.id]: {
            saleAmount: String(savedRow.saleAmount ?? 0),
            shippingFee: String(savedRow.shippingFee ?? 0),
            memo: savedRow.memo || "",
          },
        }));
      } else {
        await loadRows();
      }

      setSaveMessage(editing ? "수정 완료" : "거래 저장 완료");
      resetOrderForm({ preserveDate: true, clearMessage: false });
      setSaving(false);
    } catch (error) {
      console.error("거래 저장 오류:", error);
      const message = error instanceof Error ? error.message : "저장하지 못했습니다.";
      setSaveMessage(`저장 실패: ${message}`);
      alert(message);
      setSaving(false);
    }
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    void saveTransaction();
  }

  function changeInlineEdit(
    id: number,
    key: "saleAmount" | "shippingFee" | "memo",
    value: string
  ) {
    setInlineEdits((prev) => ({
      ...prev,
      [id]: {
        saleAmount: prev[id]?.saleAmount ?? "0",
        shippingFee: prev[id]?.shippingFee ?? "0",
        memo: prev[id]?.memo ?? "",
        [key]: value,
      },
    }));
  }

  function moveInlineInputWithArrow(
    event: KeyboardEvent<HTMLInputElement>,
    rowIndex: number,
    columnIndex: number
  ) {
    const directions: Record<string, [number, number]> = {
      ArrowUp: [-1, 0],
      ArrowDown: [1, 0],
      ArrowLeft: [0, -1],
      ArrowRight: [0, 1],
    };

    const direction = directions[event.key];
    if (!direction || event.nativeEvent.isComposing) return;

    event.preventDefault();

    const [rowMove, columnMove] = direction;
    const targetRow = rowIndex + rowMove;
    const targetColumn = columnIndex + columnMove;
    const target = document.querySelector<HTMLInputElement>(
      `[data-ledger-row="${targetRow}"][data-ledger-column="${targetColumn}"]`
    );

    if (target) {
      target.focus();
      target.select();
    }
  }

  function isInlineRowChanged(row: LedgerRow) {
    const edit = inlineEdits[row.id];
    if (!edit) return false;

    return (
      Number(parseWonInput(edit.saleAmount || "0")) !== Number(row.saleAmount ?? 0) ||
      Number(parseWonInput(edit.shippingFee || "0")) !== Number(row.shippingFee ?? 0) ||
      edit.memo !== (row.memo || "")
    );
  }

  function changePurchaseAmountEdit(id: number, value: string) {
    if (/^-?\d*(?:\.\d{0,1})?$/.test(value)) {
      setPurchaseAmountEdits((current) => ({ ...current, [id]: value }));
    }
  }

  function movePurchaseAmountInput(
    event: KeyboardEvent<HTMLInputElement>,
    rowIndex: number
  ) {
    if (
      event.nativeEvent.isComposing ||
      (event.key !== "ArrowUp" && event.key !== "ArrowDown")
    ) {
      return;
    }

    const targetRowIndex =
      event.key === "ArrowUp" ? rowIndex - 1 : rowIndex + 1;
    if (targetRowIndex < 0 || targetRowIndex >= filteredRows.length) return;

    event.preventDefault();
    const target = document.querySelector<HTMLInputElement>(
      `[data-purchase-row="${targetRowIndex}"]`
    );
    target?.focus();
    target?.select();
  }

  function isPurchaseAmountChanged(row: LedgerRow) {
    const draft = purchaseAmountEdits[row.id];
    if (draft === undefined) return false;
    if (draft.trim() === "") return true;

    const parsed = Number(draft);
    return !Number.isFinite(parsed) || parsed !== Number(row.purchaseAmount ?? 0);
  }

  async function requestPurchaseAmountSave(row: LedgerRow) {
    const draft = purchaseAmountEdits[row.id] ?? String(row.purchaseAmount ?? "");
    if (!/^-?\d+(?:\.\d)?$/.test(draft.trim()) || !Number.isFinite(Number(draft))) {
      throw new Error(`${row.productName}: 매입금액은 빈 값이 아닌 숫자로 입력해 주세요.`);
    }

    const response = await fetch(`/api/wholesale-ledger/${row.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ purchaseAmount: Number(draft) }),
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || `${row.productName}: 매입금액을 수정하지 못했습니다.`);
    }

    return data.row as LedgerRow;
  }

  async function savePurchaseAmount(row: LedgerRow) {
    if (
      !listOnly ||
      !isAdmin ||
      savingPurchaseAmountId !== null ||
      bulkPurchaseSaving
    ) return;

    setSavingPurchaseAmountId(row.id);
    try {
      const savedRow = await requestPurchaseAmountSave(row);
      setRows((current) =>
        current.map((item) => (item.id === row.id ? savedRow : item))
      );
      setPurchaseAmountEdits((current) => ({
        ...current,
        [row.id]: String(savedRow.purchaseAmount ?? 0),
      }));
    } catch (error) {
      alert(error instanceof Error ? error.message : "매입금액을 수정하지 못했습니다.");
    } finally {
      setSavingPurchaseAmountId(null);
    }
  }

  async function saveAllPurchaseAmounts() {
    if (
      !listOnly ||
      !isAdmin ||
      bulkPurchaseSaving ||
      savingPurchaseAmountId !== null
    ) return;

    const changedRows = rows.filter(isPurchaseAmountChanged);
    if (changedRows.length === 0) {
      alert("변경된 매입금액이 없습니다.");
      return;
    }

    setBulkPurchaseSaving(true);
    const results = await Promise.allSettled(
      changedRows.map((row) => requestPurchaseAmountSave(row))
    );

    const savedRows = results.flatMap((result) =>
      result.status === "fulfilled" ? [result.value] : []
    );
    const savedById = new Map(savedRows.map((row) => [row.id, row]));

    if (savedRows.length > 0) {
      setRows((current) =>
        current.map((row) => savedById.get(row.id) ?? row)
      );
      setPurchaseAmountEdits((current) => {
        const next = { ...current };
        for (const row of savedRows) {
          next[row.id] = String(row.purchaseAmount ?? 0);
        }
        return next;
      });
    }

    const failedMessages = results.flatMap((result) =>
      result.status === "rejected"
        ? [
            result.reason instanceof Error
              ? result.reason.message
              : "매입금액 저장에 실패했습니다.",
          ]
        : []
    );
    setBulkPurchaseSaving(false);

    if (failedMessages.length === 0) {
      alert(`${savedRows.length}건의 매입금액이 모두 저장되었습니다.`);
    } else {
      alert(
        `${changedRows.length}건 중 ${savedRows.length}건 저장 성공, ${failedMessages.length}건 저장 실패\n\n${failedMessages.join("\n")}`
      );
    }
  }

  async function requestInlineRowSave(row: LedgerRow) {
    const edit = inlineEdits[row.id] || {
      saleAmount: String(row.saleAmount ?? 0),
      shippingFee: String(row.shippingFee ?? 0),
      memo: row.memo || "",
    };

    const response = await fetch(`/api/wholesale-ledger/${row.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        transactionDate: row.transactionDate.slice(0, 10),
        productName: row.productName,
        productId: row.productId || null,
        productCode: row.productCode || null,
        quantity: String(row.quantity),
        supplierName: row.supplierName || "",
        supplierId:
          productOptions
            .find((option) => option.id === String(row.productId))
            ?.supplierCosts?.find(
              (supplier) => supplier.name === (row.supplierName || "")
            )?.id || null,
        purchaseAmount: String(row.purchaseAmount),
        deliveryCompanyName: row.deliveryCompanyName || "",
        customerName: row.customerName || "",
        customerPhone: row.customerPhone || "",
        saleAmount: parseWonInput(edit.saleAmount || "0"),
        shippingFee: parseWonInput(edit.shippingFee || "0"),
        settlementStatus: row.settlementStatus,
        memo: edit.memo,
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || `${row.productName} 저장 실패`);
    }
  }

  async function saveAllInlineRows() {
    if (bulkInlineSaving) return;

    const changedRows = rows.filter(isInlineRowChanged);
    if (changedRows.length === 0) {
      alert("수정된 내용이 없습니다.");
      return;
    }

    setBulkInlineSaving(true);
    setSaveMessage(`${changedRows.length}건 저장 중...`);

    try {
      const results = await Promise.allSettled(
        changedRows.map((row) => requestInlineRowSave(row))
      );
      const failed = results.filter((result) => result.status === "rejected");

      await loadRows();

      if (failed.length > 0) {
        const successCount = changedRows.length - failed.length;
        setSaveMessage(`${successCount}건 저장 완료, ${failed.length}건 실패`);
        alert(`${successCount}건은 저장되었고 ${failed.length}건은 저장하지 못했습니다.`);
      } else {
        setSaveMessage(`${changedRows.length}건 저장 완료`);
        alert(`${changedRows.length}건이 한꺼번에 저장되었습니다.`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "전체 저장 실패";
      setSaveMessage(`저장 실패: ${message}`);
      alert(message);
    } finally {
      setBulkInlineSaving(false);
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
    <div
      style={{
        ...pageStyle,
        ...(listOnly ? settlementPageStyle : orderPageStyle),
      }}
      className={
        listOnly
          ? "wl-list-only-page settlement-fixed-page"
          : "order-fixed-page"
      }
    >
      <style>{`
        .wl-two-column-layout {
          display: block;
          width: 100%;
        }

        .wl-left-pane,
        .wl-right-pane {
          min-width: 0;
          width: 100%;
        }

        .wl-left-pane form {
          display: flex;
          align-items: flex-end;
          gap: 10px;
          width: 100%;
          overflow-x: auto !important;
          overflow-y: visible !important;
          padding: 10px 10px 8px !important;
          scrollbar-gutter: stable;
        }

        .wl-left-pane .wl-form-grid {
          flex: 0 0 auto;
          display: grid !important;
          grid-template-columns: 110px 110px 88px 98px 125px 105px !important;
          grid-template-rows: repeat(4, auto) !important;
          gap: 6px !important;
          align-items: end !important;
          width: auto !important;
          max-width: none !important;
          min-width: 666px !important;
        }

        /*
          1줄: 날짜
          2줄: 상품번호 / 상품
          3줄: 공급업체 / 단가 / 수량
          4줄: 납품업체 / 판매금액 / 배송비 / 고객이름 / 전화번호 / 메모
        */
        .wl-form-grid > label:nth-child(1)  { grid-row: 1; grid-column: 1 / span 3; }
        .wl-form-grid > label:nth-child(2)  { grid-row: 2; grid-column: 1; }
        .wl-form-grid > label:nth-child(4)  { grid-row: 2; grid-column: 2 / span 2; }
        .wl-form-grid > label:nth-child(5)  { grid-row: 3; grid-column: 1; }
        .wl-form-grid > label:nth-child(6)  { grid-row: 3; grid-column: 2; }
        .wl-form-grid > label:nth-child(3)  { grid-row: 3; grid-column: 3; }
        .wl-form-grid > label:nth-child(7)  { grid-row: 4; grid-column: 1; }
        .wl-form-grid > label:nth-child(8)  { grid-row: 4; grid-column: 2; }
        .wl-form-grid > label:nth-child(9)  { grid-row: 4; grid-column: 3; }
        .wl-form-grid > label:nth-child(10) { grid-row: 4; grid-column: 4; }
        .wl-form-grid > label:nth-child(11) { grid-row: 4; grid-column: 5; }
        .wl-form-grid > label:nth-child(12) { grid-row: 4; grid-column: 6; }

        .wl-form-grid > label {
          min-width: 0 !important;
          gap: 4px !important;
        }

        .wl-form-grid > label > span:first-child {
          font-size: 11px !important;
          line-height: 1.15 !important;
        }

        .wl-form-grid [style*="display: flex"][style*="border: 1px solid rgb(147, 197, 253)"],
        .wl-form-grid .wl-search-drop-button {
          min-height: 34px !important;
          height: 34px !important;
          box-sizing: border-box !important;
        }

        .wl-form-grid .wl-search-drop-button {
          width: 28px !important;
          min-width: 28px !important;
          flex: 0 0 28px !important;
          padding: 0 !important;
          font-size: 10px !important;
          line-height: 1 !important;
        }

        .wl-form-grid input,
        .wl-form-grid select,
        .wl-form-grid button:not(.wl-search-drop-button) {
          width: 100% !important;
          max-width: 100% !important;
          min-width: 0 !important;
          box-sizing: border-box !important;
          font-size: 12px !important;
        }

        .wl-form-grid input {
          min-height: 34px !important;
          height: 34px !important;
          padding-left: 8px !important;
          padding-right: 8px !important;
        }

        .wl-date-reset-row {
          display: flex;
          flex-wrap: nowrap;
          align-items: center;
          gap: 6px;
          width: 100%;
        }

        .wl-date-reset-row input {
          flex: 0 1 110px;
          width: 110px !important;
        }

        .wl-input-reset-button {
          flex: 0 0 78px;
          width: 78px !important;
          min-width: 78px !important;
          height: 34px !important;
          min-height: 34px !important;
          padding: 6px 10px !important;
          border: 1px solid #4ade80 !important;
          border-radius: 8px !important;
          background: #bbf7d0 !important;
          color: #166534 !important;
          font-size: 11px !important;
          font-weight: 800 !important;
          white-space: nowrap;
          cursor: pointer;
        }

        .wl-input-reset-button:hover {
          border-color: #22c55e !important;
          background: #86efac !important;
          color: #14532d !important;
        }

        .wl-left-pane form > div:last-child {
          flex: 0 0 auto;
          display: flex !important;
          align-items: flex-end !important;
          gap: 6px !important;
          width: auto !important;
          max-width: none !important;
          margin: 0 0 1px 0 !important;
        }

        .wl-left-pane form > div:last-child button {
          min-width: 78px;
          min-height: 34px;
          height: 34px;
          padding: 6px 10px !important;
          white-space: nowrap;
          font-size: 11px !important;
          border-radius: 8px !important;
        }

        .wl-right-pane {
          margin-top: 18px;
        }

        .wl-right-pane .wl-toolbar {
          max-width: 100% !important;
          overflow-x: auto;
          padding-bottom: 2px;
        }

        .wl-right-pane .wl-search-type {
          width: 64px !important;
          min-width: 64px !important;
          height: 36px !important;
          padding-left: 7px !important;
          font-size: 11px !important;
        }

        .wl-right-pane .wl-search-input {
          width: 240px !important;
          min-width: 240px !important;
          height: 36px !important;
          padding: 0 8px !important;
          border-radius: 8px !important;
          font-size: 11px !important;
        }

        .wl-compound-filter-row {
          display: flex;
          align-items: center;
          gap: 6px;
          width: 100%;
          margin-bottom: 5px;
        }

        .wl-zero-sale-filter {
          display: inline-flex;
          flex: 0 0 auto;
          align-items: center;
          justify-content: center;
          gap: 4px;
          width: 94px;
          height: 36px;
          padding: 0 7px;
          box-sizing: border-box;
          border: 1px solid #cbd5e1;
          border-radius: 8px;
          background: #fff;
          color: #334155;
          font-size: 11px;
          font-weight: 700;
          white-space: nowrap;
          cursor: pointer;
        }

        .wl-zero-sale-filter input {
          width: 14px;
          height: 14px;
          margin: 0;
          accent-color: #2563eb;
        }

        .wl-purchase-edit-wrap {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 3px;
          min-width: 0;
        }

        .wl-purchase-edit-input {
          width: 58px;
          min-width: 0;
          height: 28px;
          padding: 0 5px;
          box-sizing: border-box;
          border: 1px solid #cbd5e1;
          border-radius: 6px;
          background: #fff;
          color: #0f172a;
          font: inherit;
          text-align: center;
        }

        .wl-purchase-edit-save {
          height: 28px;
          padding: 0 6px;
          border: 1px solid #2563eb;
          border-radius: 6px;
          background: #fff;
          color: #2563eb;
          font-size: 10px;
          font-weight: 700;
          white-space: nowrap;
          cursor: pointer;
        }

        .wl-purchase-edit-save:disabled {
          cursor: wait;
          opacity: 0.55;
        }

        .wl-right-pane .wl-table-wrap,
        .wl-list-only-pane .wl-table-wrap {
          width: fit-content;
          max-width: 100%;
          overflow-x: auto !important;
          overflow-y: auto !important;
          max-height: clamp(280px, calc(100vh - 250px), 760px) !important;
          height: clamp(280px, calc(100vh - 250px), 760px) !important;
          scrollbar-gutter: stable both-edges;
          overscroll-behavior: contain;
        }

        .wl-list-only-pane .wl-table-wrap {
          max-height: clamp(360px, calc(100vh - 260px), 760px) !important;
          height: clamp(360px, calc(100vh - 260px), 760px) !important;
        }

        .wl-right-pane .wl-table-wrap thead th,
        .wl-list-only-pane .wl-table-wrap thead th {
          position: sticky;
          top: 0;
          z-index: 3;
          background: #f8fafc;
        }

        .wl-compact-ledger-table button {
          padding: 3px 6px !important;
          min-height: 26px !important;
          font-size: 11px !important;
          border-radius: 6px !important;
        }

        .wl-compact-ledger-table th {
          padding: 5px 4px !important;
          font-size: 12px !important;
          line-height: 1.2 !important;
        }

        .wl-compact-ledger-table td {
          padding: 3px 4px !important;
          font-size: 12px !important;
          line-height: 1.2 !important;
          height: 30px !important;
        }

        .wl-compact-ledger-table .wl-product-name-cell {
          font-size: 12px !important;
          line-height: 1.2 !important;
          overflow: hidden;
          text-overflow: ellipsis;
        }


        /* 입출고 전용 압축 레이아웃 */
        .wl-list-only-table {
          width: 100% !important;
          min-width: ${SETTLEMENT_TABLE_MIN_WIDTH}px !important;
        }

        .wl-list-only-table th {
          height: ${COMPACT_TABLE_HEADER_HEIGHT}px !important;
          padding: 6px 5px !important;
          font-size: ${COMPACT_TABLE_HEADER_FONT_SIZE}px !important;
          line-height: ${COMPACT_TABLE_LINE_HEIGHT} !important;
          box-sizing: border-box;
        }

        .wl-list-only-table td {
          height: ${COMPACT_TABLE_ROW_HEIGHT}px !important;
          padding: ${COMPACT_TABLE_CELL_PADDING} !important;
          font-size: ${COMPACT_TABLE_BODY_FONT_SIZE}px !important;
          line-height: ${COMPACT_TABLE_LINE_HEIGHT} !important;
          box-sizing: border-box;
        }

        .wl-list-only-table .wl-product-name-cell {
          font-size: 12px !important;
          line-height: 1.25 !important;
          white-space: normal !important;
          overflow: hidden !important;
        }

        .wl-list-only-table .wl-product-name-text {
          display: block;
          overflow: visible;
          white-space: normal;
          word-break: keep-all;
          overflow-wrap: anywhere;
        }

        .wl-transaction-summary {
          display: grid;
          grid-template-columns: repeat(4, 160px);
          gap: 8px;
          margin-bottom: 10px;
          justify-content: start;
        }

        .wl-transaction-summary-card {
          min-height: 66px;
          padding: 11px 12px;
          background: #fff;
          border: 1px solid #e5e7eb;
          border-radius: 9px;
          box-sizing: border-box;
        }

        .wl-transaction-summary-title {
          color: #6b7280;
          font-size: 11px;
          margin-bottom: 5px;
        }

        .wl-transaction-summary-value {
          color: #111827;
          font-size: 18px;
          font-weight: 900;
        }

        .wl-transaction-summary-value.is-receivable,
        .wl-transaction-summary-value.is-profit {
          color: #dc2626;
        }

        @media (max-width: 850px) {
          .wl-transaction-summary {
            grid-template-columns: repeat(2, minmax(0, 1fr));
            width: 100%;
          }
        }

        @media (max-width: 430px) {
          .wl-transaction-summary {
            grid-template-columns: repeat(2, minmax(0, 1fr));
            width: 100%;
          }
        }

        .wl-list-only-page .wl-toolbar {
          gap: 6px !important;
          margin-bottom: ${COMPACT_TOOLBAR_MARGIN_BOTTOM}px !important;
          align-items: flex-end !important;
        }

        .wl-list-only-page .wl-search-type {
          width: 70px !important;
          min-width: 70px !important;
          height: ${COMPACT_CONTROL_HEIGHT}px !important;
          padding: 0 20px 0 8px !important;
          border-radius: 8px !important;
          font-size: 11px !important;
        }

        .wl-list-only-page .wl-search-input {
          width: 250px !important;
          min-width: 180px !important;
          height: ${COMPACT_CONTROL_HEIGHT}px !important;
          padding: 0 10px !important;
          border-radius: 8px !important;
          font-size: 12px !important;
        }

        .wl-list-only-page .wl-date-filter {
          gap: 5px !important;
        }

        .wl-list-only-page .wl-date-filter label {
          gap: 2px !important;
          font-size: 10px !important;
        }

        .wl-list-only-page .wl-date-filter input {
          width: 108px !important;
          min-width: 108px !important;
          height: ${COMPACT_CONTROL_HEIGHT}px !important;
          padding: 0 7px !important;
          border-radius: 8px !important;
          font-size: 11px !important;
        }

        .wl-list-only-page .wl-date-filter button,
        .wl-list-only-page .wl-sort-select {
          height: ${COMPACT_CONTROL_HEIGHT}px !important;
          min-height: ${COMPACT_CONTROL_HEIGHT}px !important;
          border-radius: 8px !important;
          font-size: 11px !important;
        }

        .wl-list-only-page .wl-sort-select {
          width: 90px !important;
          min-width: 90px !important;
        }

        .wl-list-only-page .wl-date-filter > span {
          padding-bottom: 9px !important;
        }

        .wl-inline-input {
          width: 100%;
          min-width: 0;
          height: 25px;
          padding: 1px 4px;
          border: 1px solid #cbd5e1;
          border-radius: 6px;
          box-sizing: border-box;
          font-size: 11px;
          line-height: 1;
          background: #fff;
        }

        .wl-inline-money { text-align: right; }

        .wl-return-row,
        .wl-return-row td,
        .wl-return-row input {
          color: #dc2626 !important;
        }

        @media (max-width: 900px) {
          .wl-left-pane form {
            padding-bottom: 12px !important;
          }

          .wl-right-pane .wl-toolbar {
            align-items: stretch !important;
            flex-wrap: wrap !important;
            overflow-x: visible;
          }
        }

        /* 주문 입력 폼은 PC와 모바일 모두 항상 표시 */
        @media (max-width: 768px) {
          .wl-left-pane form.wl-order-form {
            display: block !important;
            width: 100% !important;
            max-width: 100% !important;
            height: auto !important;
            overflow: visible !important;
            padding: 14px !important;
          }

          .wl-left-pane form.wl-order-form .wl-form-grid {
            display: grid !important;
            grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) !important;
            align-items: end !important;
            width: 100% !important;
            max-width: 100% !important;
            min-width: 0 !important;
            height: auto !important;
            column-gap: 10px !important;
            row-gap: 14px !important;
            margin: 0 !important;
          }

          .wl-left-pane form.wl-order-form .wl-form-grid > label {
            display: flex !important;
            flex-direction: column !important;
            align-items: stretch !important;
            position: relative !important;
            grid-column: auto !important;
            grid-row: auto !important;
            width: 100% !important;
            min-width: 0 !important;
            max-width: 100% !important;
            height: auto !important;
            overflow: visible !important;
            margin: 0 !important;
            padding: 0 !important;
            gap: 6px !important;
          }

          /* 모바일 주문 입력 배열
             날짜
             상품번호 | 상품
             수량
             공급업체 | 단가
             납품업체 | 판매금액
             배송비   | 고객 이름
             전화 번호
             메모
          */
          .wl-left-pane form.wl-order-form .wl-form-grid > label.wl-field-date { grid-column: 1 !important; grid-row: 1 !important; }
          .wl-left-pane form.wl-order-form .wl-form-grid > label.wl-field-product-code { grid-column: 1 !important; grid-row: 2 !important; }
          .wl-left-pane form.wl-order-form .wl-form-grid > label.wl-field-product { grid-column: 2 !important; grid-row: 2 !important; }
          .wl-left-pane form.wl-order-form .wl-form-grid > label.wl-field-quantity { grid-column: 1 !important; grid-row: 3 !important; }
          .wl-left-pane form.wl-order-form .wl-form-grid > label.wl-field-supplier { grid-column: 1 !important; grid-row: 4 !important; }
          .wl-left-pane form.wl-order-form .wl-form-grid > label.wl-field-unit-price { grid-column: 2 !important; grid-row: 4 !important; }
          .wl-left-pane form.wl-order-form .wl-form-grid > label.wl-field-delivery-company { grid-column: 1 !important; grid-row: 5 !important; }
          .wl-left-pane form.wl-order-form .wl-form-grid > label.wl-field-sale-amount { grid-column: 2 !important; grid-row: 5 !important; }
          .wl-left-pane form.wl-order-form .wl-form-grid > label.wl-field-shipping-fee { grid-column: 1 !important; grid-row: 6 !important; }
          .wl-left-pane form.wl-order-form .wl-form-grid > label.wl-field-customer-name { grid-column: 2 !important; grid-row: 6 !important; }
          .wl-left-pane form.wl-order-form .wl-form-grid > label.wl-field-customer-phone { grid-column: 1 !important; grid-row: 7 !important; }
          .wl-left-pane form.wl-order-form .wl-form-grid > label.wl-field-memo { grid-column: 1 !important; grid-row: 8 !important; }

          .wl-left-pane form.wl-order-form .wl-form-grid > label > span:first-child {
            display: block !important;
            position: static !important;
            width: 100% !important;
            height: auto !important;
            min-height: 22px !important;
            margin: 0 !important;
            padding: 0 !important;
            font-size: 15px !important;
            line-height: 22px !important;
            font-weight: 800 !important;
            white-space: normal !important;
          }

          .wl-left-pane form.wl-order-form .wl-form-grid input,
          .wl-left-pane form.wl-order-form .wl-form-grid select,
          .wl-left-pane form.wl-order-form .wl-form-grid .wl-search-select-control {
            width: 100% !important;
            min-width: 0 !important;
            max-width: 100% !important;
            min-height: 44px !important;
            height: 44px !important;
            font-size: 14px !important;
            margin: 0 !important;
          }

          .wl-left-pane form.wl-order-form .wl-date-reset-row {
            flex-wrap: wrap;
          }

          .wl-left-pane form.wl-order-form .wl-date-reset-row input {
            flex: 1 1 170px;
            width: auto !important;
          }

          .wl-left-pane form.wl-order-form .wl-input-reset-button {
            flex: 0 0 100%;
            width: 100% !important;
          }

          .wl-left-pane form.wl-order-form > div:last-child {
            display: flex !important;
            width: 100% !important;
            max-width: 100% !important;
            margin: 4px 0 0 !important;
          }

          .wl-left-pane form.wl-order-form > div:last-child button {
            width: 100% !important;
            min-height: 52px !important;
            height: 52px !important;
            font-size: 16px !important;
          }
        }
      `}</style>
      {listOnly && (
        <div className="wl-transaction-summary">
          <div className="wl-transaction-summary-card">
            <div className="wl-transaction-summary-title">전체 거래건수</div>
            <div className="wl-transaction-summary-value">
              {transactionSummary.tradeCount.toLocaleString()}건
            </div>
          </div>
          <div className="wl-transaction-summary-card">
            <div className="wl-transaction-summary-title">매입금액</div>
            <div className="wl-transaction-summary-value">
              {money(transactionSummary.purchaseAmount)}
            </div>
          </div>
          <div className="wl-transaction-summary-card">
            <div className="wl-transaction-summary-title">판매금액</div>
            <div className="wl-transaction-summary-value">
              {money(transactionSummary.saleAmount)}
            </div>
          </div>
          <div className="wl-transaction-summary-card">
            <div className="wl-transaction-summary-title">수익</div>
            <div className="wl-transaction-summary-value is-profit">
              {money(transactionSummary.profitAmount)}
            </div>
          </div>
        </div>
      )}

      <div className={listOnly ? "" : "wl-two-column-layout"}>
        {!listOnly && (
        <div className="wl-left-pane">
      <form
        key={formResetKey}
        onSubmit={submit}
        style={formCardStyle}
        className="wl-order-form"
      >
        <div style={formGridStyle} className="wl-form-grid">
          <Field label="날짜" className="wl-field-date">
            <div className="wl-date-reset-row">
              <input
                type="date"
                value={form.transactionDate}
                onChange={(e) => changeForm("transactionDate", e.target.value)}
                style={inputStyle}
              />
              {!editingId && (
                <button
                  type="button"
                  onClick={resetNewOrderForm}
                  className="wl-input-reset-button"
                >
                  입력 초기화
                </button>
              )}
            </div>
          </Field>

          <Field label="상품번호" className="wl-field-product-code">
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

          <Field label="수량" className="wl-field-quantity">
            <input
              type="text"
              inputMode="numeric"
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

                if (saleUnitPriceInput !== "") {
                  const safeQuantity = Number.isFinite(parsedQuantity)
                    ? parsedQuantity
                    : 0;
                  const unitPrice = isSalePriceManuallyEdited
                    ? Number(parseWonInput(saleUnitPriceInput || "0"))
                    : selectedCustomerUnitPrice;
                  changeForm(
                    "saleAmount",
                    String(
                      calculateLedgerAmount(
                        Number.isFinite(unitPrice) ? unitPrice : 0,
                        safeQuantity
                      )
                    )
                  );
                }
              }}
              style={inputStyle}
            />
          </Field>

          <Field label="상품" className="wl-field-product">
            <SearchSelect
              value={form.productName}
              onChange={(value) => {
                const wasRegisteredProduct = Boolean(selectedProductId);
                changeForm("productName", value);
                setSelectedProductSuppliers([]);
                setSelectedUnitCost(0);
                setSelectedSupplierId("");

                setSelectedProductId("");
                setProductCode("");
                setSelectedCustomerUnitPrice(0);
                setSaleUnitPriceInput("");
                if (wasRegisteredProduct && !isAdmin) {
                  changeForm("purchaseAmount", "");
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

          <Field label="공급업체" className="wl-field-supplier">
            <SearchSelect
              value={form.supplierName}
              onChange={(value) => {
                changeForm("supplierName", value);
                const matched = selectedProductSuppliers.find(
                  (supplier) => supplier.name === value
                );
                setSelectedSupplierId(matched?.id || "");
                applyPurchaseAmount(matched?.unitCost ?? 0);
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

          <Field label="단가" className="wl-field-unit-price">
            {!isAdmin && Boolean(selectedProductId) ? (
              <input
                type="text"
                value="**"
                readOnly
                aria-label="단가"
                style={{
                  ...inputStyle,
                  cursor: "not-allowed",
                  background: "#f8fafc",
                  fontWeight: 800,
                }}
              />
            ) : (
              <WonInput
                value={form.purchaseAmount}
                onChange={(value) => changeForm("purchaseAmount", value)}
                placeholder="직접 입력"
              />
            )}
          </Field>

          <Field label="납품업체" className="wl-field-delivery-company">
            <SearchSelect
              value={form.deliveryCompanyName}
              onChange={(value) => {
                changeForm("deliveryCompanyName", value);
                setSelectedDeliveryCustomerId("");
                const selectedProduct = productOptions.find(
                  (option) => option.id === selectedProductId
                );
                applySaleUnitPrice(
                  value.trim() ? 0 : selectedProduct?.basePrice || 0,
                  form.quantity
                );
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

          <Field
            className="wl-field-sale-amount"
            label={
              <span style={{ color: "#2563eb" }}>
                적용금액: {money(Number(form.saleAmount) || 0)}
              </span>
            }
          >
            <div>
              <WonInput
                value={saleUnitPriceInput}
                highlightZero
                onChange={(value) => {
                  setSaleUnitPriceInput(value);
                  setIsSalePriceManuallyEdited(true);
                  const unitPrice = Number(parseWonInput(value || "0"));
                  const quantity = Number(form.quantity);
                  const safeQuantity = Number.isFinite(quantity) ? quantity : 0;
                  setSelectedCustomerUnitPrice(Number.isFinite(unitPrice) ? unitPrice : 0);
                  changeForm(
                    "saleAmount",
                    String(
                      calculateLedgerAmount(
                        Number.isFinite(unitPrice) ? unitPrice : 0,
                        safeQuantity
                      )
                    )
                  );
                }}
                placeholder="1개 가격 입력"
              />
            </div>
          </Field>

          <Field label="배송비" className="wl-field-shipping-fee">
            <WonInput
              value={form.shippingFee}
              onChange={(value) => changeForm("shippingFee", value)}
              placeholder="직접 입력"
            />
          </Field>

          <Field label="고객 이름" className="wl-field-customer-name">
            <input
              value={form.customerName}
              onChange={(e) => changeForm("customerName", e.target.value)}
              placeholder="고객 이름"
              style={inputStyle}
              autoComplete="off"
            />
          </Field>

          <Field label="전화 번호" className="wl-field-customer-phone">
            <input
              type="tel"
              value={form.customerPhone}
              onChange={(e) => changeForm("customerPhone", e.target.value)}
              placeholder="전화 번호 입력"
              style={inputStyle}
              autoComplete="tel"
            />
          </Field>

          <Field label="메모" className="wl-field-memo">
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
          <button
            type="submit"
            disabled={saving}
            style={saveButtonStyle}
          >
            {saving ? "저장 중..." : editingId ? "수정 저장" : "거래 저장"}
          </button>
          {saveMessage && (
            <span
              style={{
                fontSize: "12px",
                fontWeight: 700,
                color: saveMessage.startsWith("저장 실패") ? "#dc2626" : "#2563eb",
                whiteSpace: "nowrap",
              }}
            >
              {saveMessage}
            </span>
          )}
        </div>
      </form>
        </div>
        )}

        <div className={listOnly ? "wl-list-only-pane" : "wl-right-pane"}>
      {listOnly && (
        <div className="wl-compound-filter-row">
          <label className="wl-zero-sale-filter">
            <input
              type="checkbox"
              checked={zeroPurchaseOnly}
              onChange={(event) => setZeroPurchaseOnly(event.target.checked)}
            />
            매입금액 0원
          </label>
        </div>
      )}
      {!listOnly && (
        <div className="wl-compound-filter-row">
          <label className="wl-zero-sale-filter">
            <input
              type="checkbox"
              checked={zeroSaleOnly}
              onChange={(event) => setZeroSaleOnly(event.target.checked)}
            />
            판매금액 0원
          </label>
        </div>
      )}
      <div
        style={{
          ...toolbarStyle,
          ...(!listOnly
            ? { flexWrap: "nowrap", gap: 6, width: "100%" }
            : {}),
        }}
        className="wl-toolbar"
      >
        <select value={searchField} onChange={(e) => setSearchField(e.target.value)} style={searchTypeStyle} className="wl-search-type" aria-label="검색 항목 선택">
          <option value="all">전체</option><option value="product">상품명</option><option value="supplier">공급업체</option><option value="deliveryCompany">납품업체</option><option value="customer">고객명</option><option value="phone">전화번호</option><option value="memo">메모</option>
        </select>
        <input
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          placeholder="상품·공급업체·납품업체·고객이름·전화번호·메모 검색"
          style={searchStyle}
          className="wl-search-input"
        />

        <div style={dateFilterStyle} className="wl-date-filter">
          <label style={dateLabelStyle}>
            시작일
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              style={dateInputStyle}
            />
          </label>

          <span style={dateSeparatorStyle}>~</span>

          <label style={dateLabelStyle}>
            종료일
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              style={dateInputStyle}
            />
          </label>

          <button
            type="button"
            onClick={() => {
              setStartDate(today());
              setEndDate("");
              setSortOrder("inputDesc");
            }}
            style={resetButtonStyle}
          >
            날짜 초기화
          </button>
        </div>

        <select
          value={sortOrder}
          onChange={(e) => setSortOrder(e.target.value as SortOrder)}
          style={sortSelectStyle}
          className="wl-sort-select"
          aria-label="정렬 순서"
        >
          <option value="inputDesc">최근 입력순</option>
          <option value="inputAsc">오래된 입력순</option>
        </select>

        {listOnly && isAdmin && (
          <button
            type="button"
            onClick={() => void saveAllPurchaseAmounts()}
            disabled={bulkPurchaseSaving || savingPurchaseAmountId !== null}
            style={{
              ...bulkSaveButtonStyle,
              height: 36,
              padding: "0 12px",
              opacity:
                bulkPurchaseSaving || savingPurchaseAmountId !== null ? 0.65 : 1,
              cursor:
                bulkPurchaseSaving || savingPurchaseAmountId !== null
                  ? "wait"
                  : "pointer",
            }}
          >
            {bulkPurchaseSaving ? "저장 중..." : "전체 저장"}
          </button>
        )}

        {!listOnly && (
          <button
            type="button"
            onClick={() => void saveAllInlineRows()}
            disabled={bulkInlineSaving}
            style={{
              ...bulkSaveButtonStyle,
              opacity: bulkInlineSaving ? 0.65 : 1,
              cursor: bulkInlineSaving ? "wait" : "pointer",
            }}
          >
            {bulkInlineSaving ? "저장 중..." : "전체 저장"}
          </button>
        )}
      </div>

      <div style={tableWrapStyle} className="wl-table-wrap">
        <table style={{ ...tableStyle, width: listOnly ? "100%" : "951px", minWidth: listOnly ? `${SETTLEMENT_TABLE_MIN_WIDTH}px` : "951px" }} className={listOnly ? "wl-list-only-table" : "wl-compact-ledger-table"}>
          <colgroup>
            {listOnly ? (
              <>
                <col style={{ width: SETTLEMENT_DATE_COLUMN_WIDTH }} />
                <col style={{ width: "80px" }} />
                <col style={{ width: "235px" }} />
                <col style={{ width: "40px" }} />
                <col style={{ width: "65px" }} />
                <col style={{ width: isAdmin ? "112px" : "75px" }} />
                <col style={{ width: "70px" }} />
                <col style={{ width: "75px" }} />
                <col style={{ width: "75px" }} />
                <col style={{ width: "55px" }} />
                <col style={{ width: "60px" }} />
                <col style={{ width: SETTLEMENT_MEMO_MIN_WIDTH }} />
              </>
            ) : (
              <>
                <col style={{ width: "70px" }} />
                <col style={{ width: "75px" }} />
                <col style={{ width: "220px" }} />
                <col style={{ width: "38px" }} />
                <col style={{ width: "60px" }} />
                <col style={{ width: "64px" }} />
                <col style={{ width: "70px" }} />
                <col style={{ width: "78px" }} />
                <col style={{ width: "74px" }} />
                <col style={{ width: "92px" }} />
                <col style={{ width: "110px" }} />
              </>
            )}
          </colgroup>
          <thead>
            <tr>
              {(listOnly
                ? [
                    "날짜",
                    "상품번호",
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
                  ]
                : [
                    "날짜",
                    "상품번호",
                    "상품",
                    "수량",
                    "공급업체",
                    "납품업체",
                    "고객 이름",
                    "판매금액",
                    "배송비",
                    "메모",
                    "관리",
                  ]
              ).map((head, headIndex) => (
                <th
                  key={head}
                  style={{
                    ...thStyle,
                    textAlign: listOnly && headIndex === 5 ? "center" : "left",
                  }}
                >
                  {head}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td colSpan={listOnly ? 12 : 11} style={emptyStyle}>불러오는 중...</td>
              </tr>
            ) : filteredRows.length === 0 ? (
              <tr>
                <td colSpan={listOnly ? 12 : 11} style={emptyStyle}>등록된 거래가 없습니다.</td>
              </tr>
            ) : (
              filteredRows.map((row, rowIndex) => {
                const profit = row.saleAmount - row.purchaseAmount;

                return (
                  <tr
                    key={row.id}
                    className={
                      shouldHighlightMemo(
                        inlineEdits[row.id]?.memo ?? row.memo ?? ""
                      )
                        ? "wl-return-row"
                        : undefined
                    }
                  >
                    <td className="wl-date-cell" style={{ ...tdStyle, ...(listOnly ? settlementDateCellStyle : {}) }}>
                      {dateOnly(row.transactionDate)}
                    </td>
                    <td style={{ ...tdStyle, fontWeight: 700 }} title={row.productCode || ""}>
                      {row.productCode || "-"}
                    </td>
                    <td
                      className="wl-product-name-cell"
                      style={{
                        ...tdStyle,
                        ...(listOnly ? settlementWrappingCellStyle : {}),
                        fontWeight: 800,
                        fontSize: listOnly ? "14px" : "12px",
                      }}
                      title={row.productName}
                    >
                      <span className={listOnly ? "wl-product-name-text" : undefined}>
                        {row.productName}
                      </span>
                    </td>
                    <td style={centerTdStyle}>{money(row.quantity)}</td>
                    <td style={tdStyle}>{row.supplierName || "-"}</td>

                    {listOnly && (
                      <td
                        style={{
                          ...numberTdStyle,
                          color: zeroAmountTextColor(row.purchaseAmount),
                          textAlign: "center",
                        }}
                      >
                        {isAdmin ? (
                          <div className="wl-purchase-edit-wrap">
                            <input
                              className="wl-purchase-edit-input"
                              type="text"
                              inputMode="decimal"
                              data-purchase-row={rowIndex}
                              aria-label={`${row.productName} 매입금액`}
                              value={
                                purchaseAmountEdits[row.id] ??
                                String(row.purchaseAmount ?? 0)
                              }
                              disabled={
                                savingPurchaseAmountId === row.id ||
                                bulkPurchaseSaving
                              }
                              style={
                                {
                                  ...(isPurchaseAmountChanged(row)
                                    ? changedInputStyle
                                    : {}),
                                  color: zeroAmountTextColor(
                                    purchaseAmountEdits[row.id] ??
                                      String(row.purchaseAmount ?? 0),
                                    "#0f172a"
                                  ),
                                }
                              }
                              onChange={(event) =>
                                changePurchaseAmountEdit(row.id, event.target.value)
                              }
                              onKeyDown={(event) => {
                                if (event.key === "Enter") {
                                  event.preventDefault();
                                  return;
                                }
                                movePurchaseAmountInput(event, rowIndex);
                              }}
                            />
                            <button
                              type="button"
                              className="wl-purchase-edit-save"
                              disabled={
                                savingPurchaseAmountId === row.id ||
                                bulkPurchaseSaving
                              }
                              onClick={() => void savePurchaseAmount(row)}
                            >
                              {savingPurchaseAmountId === row.id ? "저장 중" : "저장"}
                            </button>
                          </div>
                        ) : (
                          <>{money(row.purchaseAmount)}원</>
                        )}
                      </td>
                    )}

                    <td style={tdStyle}>{row.deliveryCompanyName || "-"}</td>
                    <td style={tdStyle}>{row.customerName || "-"}</td>

                    {listOnly ? (
                      <td
                        style={{
                          ...numberTdStyle,
                          color: zeroAmountTextColor(row.saleAmount),
                        }}
                      >
                        {money(row.saleAmount)}
                      </td>
                    ) : (
                      <td style={tdStyle}>
                        <input
                          className="wl-inline-input wl-inline-money"
                          style={{
                            ...(isInlineRowChanged(row) ? changedInputStyle : {}),
                            color: zeroAmountTextColor(
                              inlineEdits[row.id]?.saleAmount ??
                                String(row.saleAmount ?? 0),
                              "#0f172a"
                            ),
                          }}
                          data-ledger-row={rowIndex}
                          data-ledger-column={0}
                          value={inlineEdits[row.id]?.saleAmount ?? String(row.saleAmount ?? 0)}
                          onChange={(e) =>
                            changeInlineEdit(
                              row.id,
                              "saleAmount",
                              oneDecimalSignedInput(e.target.value)
                            )
                          }
                          inputMode="decimal"
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                              e.preventDefault();
                              e.currentTarget.blur();
                              return;
                            }
                            moveInlineInputWithArrow(e, rowIndex, 0);
                          }}
                        />
                      </td>
                    )}

                    {listOnly ? (
                      <td style={numberTdStyle}>{money(row.shippingFee || 0)}</td>
                    ) : (
                      <td style={tdStyle}>
                        <input
                          className="wl-inline-input wl-inline-money"
                          style={isInlineRowChanged(row) ? changedInputStyle : undefined}
                          data-ledger-row={rowIndex}
                          data-ledger-column={1}
                          value={inlineEdits[row.id]?.shippingFee ?? String(row.shippingFee ?? 0)}
                          onChange={(e) =>
                            changeInlineEdit(
                              row.id,
                              "shippingFee",
                              oneDecimalSignedInput(e.target.value)
                            )
                          }
                          inputMode="decimal"
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                              e.preventDefault();
                              e.currentTarget.blur();
                              return;
                            }
                            moveInlineInputWithArrow(e, rowIndex, 1);
                          }}
                        />
                      </td>
                    )}

                    {listOnly && (
                      <td style={{
                        ...numberTdStyle,
                        fontWeight: 900,
                        color: zeroAmountTextColor(
                          profit,
                          profit >= 0 ? "#166534" : "#b91c1c"
                        ),
                      }}>
                        {money(profit)}
                      </td>
                    )}

                    {listOnly ? (
                      <td style={{ ...tdStyle, ...settlementWrappingCellStyle }}>{row.memo || "-"}</td>
                    ) : (
                      <td style={tdStyle}>
                        <input
                          className="wl-inline-input"
                          style={isInlineRowChanged(row) ? changedInputStyle : undefined}
                          data-ledger-row={rowIndex}
                          data-ledger-column={2}
                          value={inlineEdits[row.id]?.memo ?? (row.memo || "")}
                          onChange={(e) =>
                            changeInlineEdit(row.id, "memo", e.target.value)
                          }
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                              e.preventDefault();
                              e.currentTarget.blur();
                              return;
                            }
                            moveInlineInputWithArrow(e, rowIndex, 2);
                          }}
                          placeholder="-"
                        />
                      </td>
                    )}

                    {!listOnly && (
                      <td style={centerTdStyle}>
                        <div style={actionStyle}>
                          <button
                            type="button"
                            onClick={() => startEdit(row)}
                            style={editButtonStyle}
                          >
                            수정
                          </button>
                          <button
                            type="button"
                            onClick={() => removeRow(row.id)}
                            style={deleteButtonStyle}
                          >
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
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [dropdownPosition, setDropdownPosition] = useState<React.CSSProperties>({});

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(event.target as Node) &&
        !dropdownRef.current?.contains(event.target as Node)
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

  useEffect(() => {
    if (!open) return;

    const updateDropdownPosition = () => {
      const wrapper = wrapperRef.current;
      if (!wrapper) return;

      const rect = wrapper.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom - 12;
      const spaceAbove = rect.top - 12;
      const openAbove = spaceBelow < 180 && spaceAbove > spaceBelow;
      const maxHeight = Math.max(120, Math.min(260, openAbove ? spaceAbove : spaceBelow));

      setDropdownPosition({
        position: "fixed",
        left: rect.left,
        width: rect.width,
        top: openAbove ? undefined : rect.bottom + 4,
        bottom: openAbove ? window.innerHeight - rect.top + 4 : undefined,
        maxHeight,
      });
    };

    updateDropdownPosition();
    window.addEventListener("resize", updateDropdownPosition);
    window.addEventListener("scroll", updateDropdownPosition, true);

    return () => {
      window.removeEventListener("resize", updateDropdownPosition);
      window.removeEventListener("scroll", updateDropdownPosition, true);
    };
  }, [open]);

  return (
    <div
      ref={wrapperRef}
      style={{
        ...searchSelectWrapStyle,
        zIndex: open ? 100000 : 20,
      }}
    >
      <div style={searchSelectInputWrapStyle} className="wl-search-select-control">
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

      {open && typeof document !== "undefined" && createPortal(
        <div ref={dropdownRef} style={{ ...dropdownStyle, ...dropdownPosition }}>
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
        </div>,
        document.body
      )}
    </div>
  );
}

function Field({
  label,
  children,
  className,
}: {
  label: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label style={fieldStyle} className={className}>
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
  fontSize: "12px",
};

const searchSelectWrapStyle: React.CSSProperties = {
  position: "relative",
  width: "100%",
  zIndex: 20,
};

const searchSelectInputWrapStyle: React.CSSProperties = {
  display: "flex",
  width: "100%",
  minHeight: "34px",
  height: "34px",
  boxSizing: "border-box",
  border: "1px solid #93c5fd",
  borderRadius: "9px",
  overflow: "hidden",
  background: "white",
};

const searchSelectInputStyle: React.CSSProperties = {
  flex: 1,
  width: "100%",
  minWidth: 0,
  height: "32px",
  minHeight: "32px",
  boxSizing: "border-box",
  border: 0,
  outline: "none",
  padding: "6px 8px",
  color: "#0f172a",
  background: "transparent",
  fontSize: "12px",
};

const dropButtonStyle: React.CSSProperties = {
  width: "28px",
  minWidth: "28px",
  height: "32px",
  minHeight: "32px",
  flex: "0 0 28px",
  boxSizing: "border-box",
  padding: 0,
  fontSize: "10px",
  lineHeight: 1,
  border: 0,
  borderLeft: "1px solid #bfdbfe",
  background: "#eff6ff",
  color: "#1e3a8a",
  cursor: "pointer",
};

const dropdownStyle: React.CSSProperties = {
  position: "fixed",
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

const searchTypeStyle: React.CSSProperties = {
  width: 78,
  minWidth: 78,
  height: 42,
  padding: "0 24px 0 9px",
  border: "1px solid #cbd5e1",
  borderRadius: 10,
  background: "#fff",
  fontSize: 12,
  fontWeight: 700,
  color: "#334155",
  cursor: "pointer",
  flexShrink: 0,
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


const bulkSaveButtonStyle: React.CSSProperties = {
  height: 38,
  padding: "0 16px",
  border: 0,
  borderRadius: 9,
  background: "#2563eb",
  color: "white",
  fontSize: 12,
  fontWeight: 800,
  flexShrink: 0,
};

const sortSelectStyle: React.CSSProperties = {
  width: 96,
  minWidth: 96,
  height: 36,
  padding: "0 24px 0 9px",
  border: "1px solid #cbd5e1",
  borderRadius: 8,
  background: "#fff",
  fontSize: 12,
  fontWeight: 700,
  cursor: "pointer",
  flexShrink: 0,
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
  width: "118px",
  minWidth: "118px",
  height: "38px",
  padding: "0 9px",
  fontSize: "12px",
  border: "1px solid #cbd5e1",
  borderRadius: "10px",
  background: "white",
  boxSizing: "border-box",
};

const dateSeparatorStyle: React.CSSProperties = {
  paddingBottom: "11px",
  color: "#64748b",
};

const resetButtonStyle: React.CSSProperties = {
  height: "38px",
  padding: "0 11px",
  fontSize: "12px",
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
  width: "850px",
  minWidth: "850px",
  borderCollapse: "collapse",
  tableLayout: "fixed",
};

const thStyle: React.CSSProperties = {
  background: "#f8fafc",
  color: "#475569",
  padding: "7px 6px",
  borderBottom: "1px solid #e2e8f0",
  textAlign: "left",
  fontSize: "12px",
  fontWeight: 900,
  whiteSpace: "nowrap",
};

const tdStyle: React.CSSProperties = {
  padding: "5px 6px",
  borderBottom: "1px solid #f1f5f9",
  fontSize: "12px",
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
  gap: "4px",
  justifyContent: "flex-start",
  whiteSpace: "nowrap",
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
