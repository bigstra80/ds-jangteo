"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { changedInputStyle } from "@/lib/dirty-input-style";
import { uniqueProductCodes } from "@/lib/product-code";
import {
  compactProductSearchText,
  normalizeProductName,
  normalizeProductSearchText,
} from "@/lib/product-name";

type ProductSku = {
  id: number;
  sku: string;
  color: string;
  size: string;
  stock: number;
};

type Supplier = {
  id: number;
  code: string;
  name: string;
};

type Product = {
  id: number;
  code: string;
  name: string;
  brand: string | null;
  category: string | null;
  colors: string | null;
  sizes: string | null;
  cost: number | null;
  cost2: number | null;
  cost3: number | null;
  price: number | null;
  imageUrl: string | null;
  productType: "DIRECT" | "BROKER";
  sourceProductName: string | null;
  bandPostId: string | null;
  bandPostUrl: string | null;
  isBandImported: boolean;
  supplierId: number | null;
  supplier: Supplier | null;
  supplier2Id: number | null;
  supplier2: Supplier | null;
  supplier3Id: number | null;
  supplier3: Supplier | null;
  skus: ProductSku[];
};



type ProductExcelRow = {
  상품코드?: unknown;
  상품명?: unknown;
  공급업체?: unknown;
  단가?: unknown;
  색상?: unknown;
  사이즈?: unknown;
  판매가?: unknown;
  브랜드?: unknown;
  카테고리?: unknown;
  이미지URL?: unknown;
  상품유형?: unknown;
};

function excelText(value: unknown) {
  return value === null || value === undefined ? "" : String(value).trim();
}

function excelNumber(value: unknown) {
  const text = excelText(value).replace(/,/g, "");
  if (!text) return "";
  const number = Number(text);
  return Number.isFinite(number) ? String(Math.round(number * 10) / 10) : "";
}

function supplierCodeFromProductCode(productCode: string) {
  const matched = productCode.trim().toUpperCase().match(/^([A-Z]{2})/);
  return matched?.[1] || "";
}

type ParsedBandPost = {
  code: string;
  additionalCode: string;
  sourceProductName: string;
  colors: string;
  sizes: string;
  price: string;
  additionalPrice: string;
};

function cleanBandLine(value: string) {
  return value
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/^[\s✔️✅☑️•·▪︎◾◼︎■◆◇▶▷➤➜⛳️-]+/, "")
    .trim();
}

function parseBandPost(text: string): ParsedBandPost | null {
  const rawLines = text.replace(/\r/g, "").split("\n");
  const lines = rawLines.map(cleanBandLine);
  const meaningful = lines.filter(Boolean);

  if (meaningful.length < 2) return null;

  // 코드 뒤에 "티셔츠", "세트" 같은 구분 문구와 별표가 붙어도 인식합니다.
  const codePattern = /^([A-Z]{1,3}\s*[-_]?\s*\d{4,})(?:\s+.*)?$/i;
  const codeCandidates = meaningful
    .map((line, index) => ({ line, index, match: line.match(codePattern) }))
    .filter((item) => item.match);

  if (codeCandidates.length === 0) return null;

  const uniqueCodes = uniqueProductCodes(
    codeCandidates.map((candidate) => candidate.match?.[1] || "")
  );

  const code = uniqueCodes[0] || "";
  const additionalCode = uniqueCodes[1] || "";

  const firstCodeIndex = codeCandidates[0].index;
  let sourceProductName = "";

  for (let index = firstCodeIndex + 1; index < meaningful.length; index += 1) {
    const line = meaningful[index];
    const upper = line.toUpperCase();

    if (codePattern.test(line)) continue;
    if (/^(COLOR|COLOUR|색상|SIZE|사이즈|매장가|판매가|PRICE|바배)\s*[:：]?/i.test(line)) continue;
    if (/^\(?\d+\s*켤레/i.test(line)) continue;
    if (/^[0-9]+(?:\.[0-9]+)?$/.test(line)) continue;
    if (upper.startsWith("HTTP://") || upper.startsWith("HTTPS://")) continue;

    sourceProductName = normalizeProductName(line);
    break;
  }

  function extractLabelValue(labelPattern: RegExp) {
    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index];
      const match = line.match(labelPattern);
      if (!match) continue;

      const values: string[] = [];
      const inlineValue = (match[1] || "").trim();
      if (inlineValue) values.push(inlineValue);

      for (let nextIndex = index + 1; nextIndex < lines.length; nextIndex += 1) {
        const next = lines[nextIndex].trim();
        if (!next) {
          if (values.length > 0) break;
          continue;
        }
        if (/^(COLOR|COLOUR|색상|SIZE|사이즈|매장가|판매가|PRICE)\s*[:：]?/i.test(next)) break;
        if (codePattern.test(next) || /^[0-9]+(?:\.[0-9]+)?$/.test(next)) break;
        if (next.startsWith("-") || next.startsWith("•")) break;

        values.push(next);
        if (values.length >= 2) break;
      }

      return values.join(" ").replace(/\s*,\s*/g, ", ").trim();
    }

    return "";
  }

  const colors = extractLabelValue(/^(?:COLOR|COLOUR|색상)\s*[:：]\s*(.*)$/i);
  const sizes = extractLabelValue(/^(?:SIZE|사이즈)\s*[:：]\s*(.*)$/i);
  const lastCodeIndex = codeCandidates[codeCandidates.length - 1].index;
  const priceCandidates = meaningful
    .slice(lastCodeIndex + 1)
    .filter((line) => /^\d+(?:\.\d+)?$/.test(line));
  const prices =
    additionalCode && priceCandidates.length >= 2
      ? priceCandidates.slice(-2)
      : priceCandidates.slice(-1);
  const price = prices[0] || "";
  const additionalPrice = additionalCode ? prices[1] || "" : "";

  if (!sourceProductName) return null;

  return {
    code,
    additionalCode,
    sourceProductName,
    colors,
    sizes,
    price,
    additionalPrice,
  };
}

type ProductForm = {
  code: string;
  additionalCode: string;
  name: string;
  brand: string;
  category: string;
  colors: string;
  sizes: string;
  cost: string;
  additionalCost: string;
  cost2: string;
  additionalCost2: string;
  cost3: string;
  additionalCost3: string;
  price: string;
  additionalPrice: string;
  imageUrl: string;
  productType: "DIRECT" | "BROKER";
  supplierId: string;
  supplier2Id: string;
  supplier3Id: string;
  sourceProductName: string;
  bandPostId: string;
  bandPostUrl: string;
  isBandImported: boolean;
};

const emptyForm: ProductForm = {
  code: "",
  additionalCode: "",
  name: "",
  brand: "",
  category: "",
  colors: "",
  sizes: "",
  cost: "",
  additionalCost: "",
  cost2: "",
  additionalCost2: "",
  cost3: "",
  additionalCost3: "",
  price: "",
  additionalPrice: "",
  imageUrl: "",
  productType: "DIRECT",
  supplierId: "",
  supplier2Id: "",
  supplier3Id: "",
  sourceProductName: "",
  bandPostId: "",
  bandPostUrl: "",
  isBandImported: false,
};

function normalizeOneDecimal(value: string) {
  const cleaned = value
    .replace(/,/g, "")
    .replace(/[^0-9.]/g, "")
    .replace(/(\..*)\./g, "$1");

  const [integerPart = "", decimalPart] = cleaned.split(".");

  return decimalPart !== undefined
    ? `${integerPart}.${decimalPart.slice(0, 1)}`
    : integerPart;
}

function nullableDecimal(value: string) {
  const normalized = normalizeOneDecimal(value);
  return normalized === "" ? null : Number(normalized);
}

function comparableSupplier(value: unknown) {
  const normalized = String(value ?? "").trim().toLocaleLowerCase();
  return normalized === "-" ? "" : normalized;
}

function comparableDecimal(value: unknown) {
  const text = String(value ?? "").trim();
  if (!text || text === "-") return null;

  const normalized = nullableDecimal(text);
  return normalized !== null && Number.isFinite(normalized) ? normalized : null;
}

function validateDecimalDraft(
  value: string | undefined,
  productCode: string,
  label: string
) {
  if (value === undefined || value === "") return;
  if (!/^\d+(?:\.\d)?$/.test(value)) {
    throw new Error(`상품코드 ${productCode}의 ${label}를 확인해 주세요.`);
  }
}

export default function ProductManager() {
  const [products, setProducts] = useState<Product[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [form, setForm] = useState<ProductForm>(emptyForm);
  const [bandPostText, setBandPostText] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showProductForm, setShowProductForm] = useState(false);
  const [visibleSupplierCount, setVisibleSupplierCount] = useState(1);
  const [detailProduct, setDetailProduct] = useState<Product | null>(null);
  const [detailImageDraft, setDetailImageDraft] = useState("");
  const [detailImageDragging, setDetailImageDragging] = useState(false);
  const [savingDetailImage, setSavingDetailImage] = useState(false);
  const [search, setSearch] = useState("");
  const [searchField, setSearchField] = useState("all");
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [isDraggingImage, setIsDraggingImage] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [listSupplierDrafts, setListSupplierDrafts] = useState<Record<number, string>>({});
  const [listCostDrafts, setListCostDrafts] = useState<Record<number, string>>({});
  const [listPriceDrafts, setListPriceDrafts] = useState<Record<number, string>>({});
  const [savingListSupplierId, setSavingListSupplierId] = useState<number | null>(null);
  const [savingListCostId, setSavingListCostId] = useState<number | null>(null);
  const [savingAllProducts, setSavingAllProducts] = useState(false);
  const listCellRefs = useRef<Map<string, HTMLInputElement>>(new Map());
  const [importingExcel, setImportingExcel] = useState(false);
  const excelInputRef = useRef<HTMLInputElement | null>(null);
  const cost1InputRef = useRef<HTMLInputElement | null>(null);

  async function loadProducts() {
    try {
      const response = await fetch("/api/product", {
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error("상품 조회 실패");
      }

      const data = await response.json();
      setProducts(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error(error);
      alert("상품 목록을 불러오지 못했습니다.");
    }
  }

  async function loadSuppliers() {
    try {
      const response = await fetch("/api/suppliers", {
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error("공급업체 조회 실패");
      }

      const data = await response.json();
      setSuppliers(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error(error);
      setSuppliers([]);
    }
  }

  function downloadProductExcel() {
    if (filteredProducts.length === 0) {
      alert("다운로드할 상품이 없습니다.");
      return;
    }

    const rows = filteredProducts.map((product) => ({
      상품코드: product.code,
      상품명: product.name,
      공급업체: product.supplier?.name || "",
      단가: product.cost ?? "",
      색상: product.colors || "",
      사이즈: product.sizes || "",
      판매가: product.price ?? "",
    }));

    const guideRows = [
      { 항목: "필수", 설명: "상품코드, 상품명" },
      { 항목: "선택 항목", 설명: "공급업체, 단가, 색상, 사이즈 등 나머지 컬럼은 없어도 등록됩니다." },
      { 항목: "기본값", 설명: "공급업체·색상·사이즈는 빈칸, 단가는 0으로 등록되며 상품관리에서 수정할 수 있습니다." },
      { 항목: "공급업체", 설명: "기존 업체명 또는 업체코드를 입력합니다. 없는 업체는 자동 등록됩니다." },
      { 항목: "재업로드", 설명: "같은 상품코드가 있으면 해당 상품을 수정하고, 없으면 새 상품으로 등록합니다." },
    ];

    const workbook = XLSX.utils.book_new();
    const productSheet = XLSX.utils.json_to_sheet(rows);
    const guideSheet = XLSX.utils.json_to_sheet(guideRows);
    productSheet["!cols"] = [
      { wch: 16 }, { wch: 30 }, { wch: 18 }, { wch: 10 }, { wch: 22 },
      { wch: 22 }, { wch: 10 },
    ];
    guideSheet["!cols"] = [{ wch: 16 }, { wch: 80 }];
    XLSX.utils.book_append_sheet(workbook, productSheet, "상품목록");
    XLSX.utils.book_append_sheet(workbook, guideSheet, "작성방법");
    XLSX.writeFile(workbook, "상품등록_양식.xlsx");
  }

  async function findOrCreateSupplierId(nameOrCode: string) {
    const keyword = nameOrCode.trim();
    if (!keyword) return "";

    const matched = suppliers.find(
      (supplier) =>
        supplier.name.trim().toLowerCase() === keyword.toLowerCase() ||
        supplier.code.trim().toLowerCase() === keyword.toLowerCase()
    );
    if (matched) return String(matched.id);

    const response = await fetch("/api/suppliers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code: keyword,
        name: keyword,
        businessNumber: "",
        representative: "",
        phone: "",
        email: "",
        address: "",
        contactName: "",
        contactPhone: "",
        bankName: "",
        bankAccount: "",
        accountHolder: "",
        memo: "",
      }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.message || `${keyword} 공급업체 등록 실패`);
    return String(result.id);
  }

  async function uploadProductExcel(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    try {
      setImportingExcel(true);
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: "array" });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<ProductExcelRow>(firstSheet, { defval: "" });

      if (rows.length === 0) {
        alert("엑셀에 등록할 상품이 없습니다.");
        return;
      }

      const validRows = rows.filter((row) => excelText(row.상품코드) || excelText(row.상품명));
      const errors: string[] = [];
      validRows.forEach((row, index) => {
        const missing = [
          ["상품코드", excelText(row.상품코드)],
          ["상품명", excelText(row.상품명)],
        ].filter(([, value]) => !value).map(([label]) => label);
        if (missing.length) errors.push(`${index + 2}행: ${missing.join(", ")} 누락`);
      });

      if (errors.length) {
        alert(`엑셀 내용을 확인해주세요.\n\n${errors.slice(0, 10).join("\n")}${errors.length > 10 ? "\n..." : ""}`);
        return;
      }

      const confirmed = window.confirm(
        `${validRows.length}개 상품을 업로드합니다.\n같은 상품코드는 기존 상품을 수정합니다. 진행할까요?`
      );
      if (!confirmed) return;

      const supplierCache = new Map<string, string>();
      const productMap = new Map(products.map((product) => [product.code.trim().toLowerCase(), product]));
      let created = 0;
      let updated = 0;
      const failed: string[] = [];

      for (let index = 0; index < validRows.length; index += 1) {
        const row = validRows[index];
        const code = excelText(row.상품코드);
        try {
          const supplierText = excelText(row.공급업체) || supplierCodeFromProductCode(code);
          let supplierId = "";
          if (supplierText) {
            const cacheKey = supplierText.toLowerCase();
            supplierId = supplierCache.get(cacheKey) || "";
            if (!supplierId) {
              supplierId = await findOrCreateSupplierId(supplierText);
              supplierCache.set(cacheKey, supplierId);
            }
          }

          const existing = productMap.get(code.toLowerCase());
          const payload = {
            id: existing?.id,
            code,
            name: excelText(row.상품명),
            brand: excelText(row.브랜드),
            category: excelText(row.카테고리),
            colors: excelText(row.색상),
            sizes: excelText(row.사이즈),
            cost: excelNumber(row.단가) || "0",
            cost2: existing?.cost2 == null ? "" : String(existing.cost2),
            cost3: existing?.cost3 == null ? "" : String(existing.cost3),
            price: excelNumber(row.판매가),
            imageUrl: excelText(row.이미지URL),
            productType: excelText(row.상품유형).includes("중도매") ? "BROKER" : "DIRECT",
            supplierId,
            supplier2Id: existing?.supplier2Id ? String(existing.supplier2Id) : "",
            supplier3Id: existing?.supplier3Id ? String(existing.supplier3Id) : "",
            sourceProductName: existing?.sourceProductName || "",
            bandPostId: existing?.bandPostId || "",
            bandPostUrl: existing?.bandPostUrl || "",
            isBandImported: Boolean(existing?.isBandImported),
            excelImport: true,
          };

          const response = await fetch("/api/product", {
            method: existing ? "PUT" : "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
          const result = await response.json();
          if (!response.ok) throw new Error(result.message || "상품 저장 실패");
          if (existing) updated += 1;
          else {
            created += 1;
            productMap.set(code.toLowerCase(), result);
          }
        } catch (error) {
          failed.push(`${index + 2}행 ${code}: ${error instanceof Error ? error.message : "등록 실패"}`);
        }
      }

      await Promise.all([loadProducts(), loadSuppliers()]);
      alert(
        `엑셀 업로드가 완료되었습니다.\n신규 등록: ${created}개\n수정: ${updated}개\n실패: ${failed.length}개` +
          (failed.length ? `\n\n${failed.slice(0, 10).join("\n")}` : "")
      );
    } catch (error) {
      console.error(error);
      alert(error instanceof Error ? error.message : "엑셀 업로드 중 오류가 발생했습니다.");
    } finally {
      setImportingExcel(false);
    }
  }

  async function loadCurrentUser() {
    try {
      const response = await fetch("/api/auth/me", {
        cache: "no-store",
      });

      if (!response.ok) {
        setIsAdmin(false);
        return;
      }

      const data = await response.json();
      setIsAdmin(data?.user?.role === "ADMIN");
    } catch {
      setIsAdmin(false);
    }
  }

  useEffect(() => {
    // Initial client-side data hydration is intentionally performed once on mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadProducts();
    loadSuppliers();
    loadCurrentUser();
  }, []);

  const filteredProducts = useMemo(() => {
    const keyword = normalizeProductSearchText(search);
    const compactKeyword = compactProductSearchText(search);

    return products.filter((product) => {

      if (!keyword) return true;

      const fields: Record<string, unknown[]> = {
        all: [product.code, product.name, product.brand, product.category, product.colors, product.sizes, product.sourceProductName, product.supplier?.code, product.supplier?.name, product.supplier2?.code, product.supplier2?.name, product.supplier3?.code, product.supplier3?.name],
        code: [product.code], name: [product.name, product.sourceProductName], supplier: [product.supplier?.code, product.supplier?.name, product.supplier2?.code, product.supplier2?.name, product.supplier3?.code, product.supplier3?.name], brand: [product.brand], category: [product.category],
      };
      return (fields[searchField] || fields.all).some((value) => {
        const normalizedValue = normalizeProductSearchText(value);
        return (
          normalizedValue.includes(keyword) ||
          compactProductSearchText(value).includes(compactKeyword)
        );
      });
    });
  }, [products, search, searchField]);

  const dirtyProductIds = useMemo(() => {
    return new Set(
      products
        .filter((product) => {
          const supplierDraft = listSupplierDrafts[product.id];
          const costDraft = listCostDrafts[product.id];
          const priceDraft = listPriceDrafts[product.id];

          const supplierChanged =
            supplierDraft !== undefined &&
            comparableSupplier(supplierDraft) !==
              comparableSupplier(product.supplier?.code);
          const costChanged =
            costDraft !== undefined &&
            comparableDecimal(costDraft) !==
              comparableDecimal(product.cost);
          const priceChanged =
            priceDraft !== undefined &&
            comparableDecimal(priceDraft) !==
              comparableDecimal(product.price);

          return supplierChanged || costChanged || priceChanged;
        })
        .map((product) => product.id)
    );
  }, [products, listSupplierDrafts, listCostDrafts, listPriceDrafts]);

  function isListSupplierChanged(product: Product) {
    const draft = listSupplierDrafts[product.id];
    return (
      draft !== undefined &&
      comparableSupplier(draft) !== comparableSupplier(product.supplier?.code)
    );
  }

  function isListCostChanged(product: Product) {
    const draft = listCostDrafts[product.id];
    return (
      draft !== undefined &&
      comparableDecimal(draft) !== comparableDecimal(product.cost)
    );
  }

  function isListPriceChanged(product: Product) {
    const draft = listPriceDrafts[product.id];
    return (
      draft !== undefined &&
      comparableDecimal(draft) !== comparableDecimal(product.price)
    );
  }

  function resetForm() {
    setForm(emptyForm);
    setBandPostText("");
    setEditingId(null);
    setVisibleSupplierCount(1);
  }

  function openCreateForm() {
    if (showProductForm) {
      resetForm();
      setShowProductForm(false);
      return;
    }

    resetForm();
    setShowProductForm(true);
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  function startEdit(product: Product) {
    setEditingId(product.id);
    setForm({
      code: product.code,
      additionalCode: "",
      name: product.name,
      brand: product.brand || "",
      category: product.category || "",
      colors: product.colors || "",
      sizes: product.sizes || "",
      cost: String(product.cost || ""),
      additionalCost: "",
      cost2: String(product.cost2 || ""),
      additionalCost2: "",
      cost3: String(product.cost3 || ""),
      additionalCost3: "",
      price: String(product.price || ""),
      additionalPrice: "",
      imageUrl: product.imageUrl || "",
      productType: "DIRECT",
      supplierId: product.supplierId ? String(product.supplierId) : "",
      supplier2Id: product.supplier2Id ? String(product.supplier2Id) : "",
      supplier3Id: product.supplier3Id ? String(product.supplier3Id) : "",
      sourceProductName: product.sourceProductName || "",
      bandPostId: product.bandPostId || "",
      bandPostUrl: product.bandPostUrl || "",
      isBandImported: Boolean(product.isBandImported),
    });
    setVisibleSupplierCount(
      product.supplier3Id || product.cost3 != null
        ? 3
        : product.supplier2Id || product.cost2 != null
          ? 2
          : 1
    );
    setShowProductForm(true);

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  function cancelForm() {
    resetForm();
    setShowProductForm(false);
  }

  function updateForm(
    field: keyof ProductForm,
    value: string | boolean
  ) {
    setForm((current) => {
      const next = {
        ...current,
        [field]: value,
      } as ProductForm;

      // 상품코드의 첫 두 글자가 영문 대문자이면 해당 업체를 공급업체 1로 자동 선택합니다.
      if (field === "code" && typeof value === "string") {
        const supplierCode = supplierCodeFromProductCode(value);
        const matchedSupplier = suppliers.find(
          (supplier) => supplier.code.trim().toUpperCase() === supplierCode
        );

        // 상품코드의 첫 두 글자와 같은 공급업체를 공급업체 1에 자동 반영합니다.
        next.supplierId = matchedSupplier ? String(matchedSupplier.id) : "";
      }

      if (field === "sourceProductName" && typeof value === "string") {
        next.name = value;
      }

      return next;
    });
  }

  function changePrimarySupplier(nextSupplierId: string) {
    setForm((current) => {
      if (nextSupplierId === current.supplier2Id) {
        return {
          ...current,
          supplierId: current.supplier2Id,
          cost: current.cost2,
          supplier2Id: current.supplierId,
          cost2: current.cost,
        };
      }

      if (nextSupplierId === current.supplier3Id) {
        return {
          ...current,
          supplierId: current.supplier3Id,
          cost: current.cost3,
          supplier3Id: current.supplierId,
          cost3: current.cost,
        };
      }

      return {
        ...current,
        supplierId: nextSupplierId,
      };
    });
  }

  function isSupportedImage(file: File) {
    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/gif",
    ];

    if (!allowedTypes.includes(file.type)) {
      alert("JPG, PNG, WEBP, GIF 이미지만 등록할 수 있습니다.");
      return false;
    }

    if (file.size > 10 * 1024 * 1024) {
      alert("이미지는 10MB 이하만 등록할 수 있습니다.");
      return false;
    }

    return true;
  }

  function applyBandPostText(text: string, showMessage = false) {
    const parsed = parseBandPost(text);
    if (!parsed) return false;

    const supplierCode = supplierCodeFromProductCode(parsed.code);
    const matchedSupplier = suppliers.find(
      (supplier) => supplier.code.trim().toUpperCase() === supplierCode
    );

    setBandPostText(text);
    setForm((current) => ({
      ...current,
      code: parsed.code,
      additionalCode: parsed.additionalCode,
      supplierId: matchedSupplier ? String(matchedSupplier.id) : current.supplierId,
      sourceProductName: parsed.sourceProductName,
      colors: parsed.colors || current.colors,
      sizes: parsed.sizes || current.sizes,
      price: parsed.price || current.price,
      additionalPrice: parsed.additionalPrice || current.additionalPrice,
    }));

    if (showMessage) {
      alert("밴드 게시글에서 상품정보를 자동으로 입력했습니다.");
    }

    return true;
  }

  function handleSmartPaste(event: React.ClipboardEvent<HTMLFormElement>) {
    const pastedText = event.clipboardData.getData("text/plain");
    if (!pastedText || !pastedText.includes("\n")) return;

    if (applyBandPostText(pastedText)) {
      event.preventDefault();
    }
  }

  async function uploadImageFile(file: File) {
    if (!isSupportedImage(file)) return;

    try {
      setUploadingImage(true);

      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/upload/product-image", {
        method: "POST",
        body: formData,
      });

      const result = await response.json();

      if (!response.ok) {
        alert(result.message || "이미지 업로드에 실패했습니다.");
        return;
      }

      return String(result.url || "");
    } catch (error) {
      console.error(error);
      alert("이미지 업로드 중 오류가 발생했습니다.");
    } finally {
      setUploadingImage(false);
    }
  }

  async function selectDetailImage(file: File) {
    const imageUrl = await uploadImageFile(file);
    if (imageUrl) {
      setDetailImageDraft(imageUrl);
    }
  }

  async function uploadImage(file: File) {
    const imageUrl = await uploadImageFile(file);
    if (imageUrl) {
      updateForm("imageUrl", imageUrl);
    }
  }

  function handleImageDrop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    event.stopPropagation();
    setIsDraggingImage(false);

    const file = event.dataTransfer.files?.[0];
    if (!file || uploadingImage) return;
    void uploadImage(file);
  }

  function openProductDetail(product: Product) {
    setDetailProduct(product);
    setDetailImageDraft(product.imageUrl || "");
    setDetailImageDragging(false);
  }

  function closeProductDetail() {
    if (
      detailProduct &&
      detailImageDraft !== (detailProduct.imageUrl || "") &&
      !window.confirm(
        "저장하지 않은 이미지가 있습니다. 닫으시겠습니까?"
      )
    ) {
      return;
    }

    setDetailProduct(null);
    setDetailImageDraft("");
    setDetailImageDragging(false);
  }

  async function saveDetailImage(nextImageUrl = detailImageDraft) {
    if (!detailProduct || savingDetailImage) return false;

    try {
      setSavingDetailImage(true);
      const response = await fetch("/api/product", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: detailProduct.id,
          code: detailProduct.code,
          name: detailProduct.name,
          brand: detailProduct.brand || "",
          category: detailProduct.category || "",
          colors: detailProduct.colors || "",
          sizes: detailProduct.sizes || "",
          cost: detailProduct.cost,
          cost2: detailProduct.cost2,
          cost3: detailProduct.cost3,
          price: detailProduct.price,
          imageUrl: nextImageUrl,
          productType: detailProduct.productType,
          supplierId: detailProduct.supplierId,
          supplier2Id: detailProduct.supplier2Id,
          supplier3Id: detailProduct.supplier3Id,
          sourceProductName:
            detailProduct.sourceProductName || detailProduct.name,
          bandPostId: detailProduct.bandPostId || "",
          bandPostUrl: detailProduct.bandPostUrl || "",
          isBandImported: detailProduct.isBandImported,
        }),
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "이미지 저장에 실패했습니다.");
      }

      setProducts((current) =>
        current.map((product) =>
          product.id === result.id ? result : product
        )
      );
      setDetailProduct(result);
      setDetailImageDraft(result.imageUrl || "");
      alert(
        nextImageUrl
          ? "이미지가 저장되었습니다."
          : "이미지가 삭제되었습니다."
      );
      return true;
    } catch (error) {
      console.error(error);
      alert(
        error instanceof Error
          ? error.message
          : "이미지 저장에 실패했습니다."
      );
      return false;
    } finally {
      setSavingDetailImage(false);
    }
  }

  function handleDetailImagePaste(
    event: React.ClipboardEvent<HTMLDivElement>
  ) {
    const imageItem = Array.from(event.clipboardData.items).find((item) =>
      item.type.startsWith("image/")
    );
    if (!imageItem) return;

    const file = imageItem.getAsFile();
    if (!file || !isSupportedImage(file)) return;

    event.preventDefault();
    void selectDetailImage(file);
  }

  async function saveProduct(event: React.FormEvent) {
    event.preventDefault();

    const wasEditing = editingId !== null;

    if (!form.code.trim()) {
      alert("상품코드를 입력해주세요.");
      return;
    }

    if (!form.sourceProductName.trim()) {
      alert("상품을 입력해주세요.");
      return;
    }


    try {
      setSaving(true);

      let resolvedSupplierId = form.supplierId;
      if (!resolvedSupplierId) {
        const supplierCode = supplierCodeFromProductCode(form.code);
        if (supplierCode) {
          resolvedSupplierId = await findOrCreateSupplierId(supplierCode);
        }
      }

      const primaryPayload = {
        id: editingId,
        ...form,
        name: normalizeProductName(form.sourceProductName),
        sourceProductName: normalizeProductName(form.sourceProductName),
        supplierId: resolvedSupplierId,
      };

      const response = await fetch("/api/product", {
        method: editingId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(primaryPayload),
      });

      const result = await response.json();

      if (!response.ok) {
        alert(result.message || (editingId ? "상품 수정에 실패했습니다." : "상품 등록에 실패했습니다."));
        return;
      }

      // 추가 상품코드는 같은 상품정보를 사용하되 별도의 상품/재고로 등록합니다.
      // 따라서 추가 코드와 추가 매입단가는 기본 상품과 섞이지 않습니다.
      if (!editingId && form.additionalCode.trim()) {
        const additionalResponse = await fetch("/api/product", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...primaryPayload,
            id: null,
            code: form.additionalCode.trim(),
            cost: form.additionalCost,
            cost2: form.additionalCost2,
            cost3: form.additionalCost3,
            price: form.additionalPrice || form.price,
          }),
        });
        const additionalResult = await additionalResponse.json();
        if (!additionalResponse.ok) {
          alert(`기본 상품은 등록되었지만 추가 상품 등록에 실패했습니다.\n${additionalResult.message || "추가 상품 등록 실패"}`);
          await loadProducts();
          return;
        }
      }

      alert(
        editingId
          ? "상품이 수정되었습니다."
          : "상품이 등록되었습니다."
      );

      resetForm();

      // 신규 상품 등록 후에는 연속 등록할 수 있도록 등록창을 열린 상태로 유지합니다.
      // 기존 상품을 수정한 경우에만 등록창을 닫습니다.
      setShowProductForm(!wasEditing);
      await loadProducts();
    } catch (error) {
      console.error(error);
      alert("상품 저장 중 오류가 발생했습니다.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteProduct(product: Product) {
    const confirmed = window.confirm(
      `${product.code} / ${product.name}\n\n이 상품을 삭제하시겠습니까?`
    );

    if (!confirmed) return;

    try {
      setDeletingId(product.id);

      const response = await fetch(
        `/api/product?id=${product.id}`,
        {
          method: "DELETE",
        }
      );

      const result = await response.json();

      if (!response.ok) {
        alert(result.message || "상품 삭제에 실패했습니다.");
        return;
      }

      alert(result.message || "상품이 삭제되었습니다.");
      await loadProducts();
    } catch (error) {
      console.error(error);
      alert("상품 삭제 중 오류가 발생했습니다.");
    } finally {
      setDeletingId(null);
    }
  }

  async function saveListCost(product: Product) {
    if (!isAdmin || savingListCostId === product.id) return;

    const draft = listCostDrafts[product.id] ?? String(product.cost ?? "");
    const normalizedCost = normalizeOneDecimal(draft);
    const nextCost = normalizedCost === "" ? null : Number(normalizedCost);

    try {
      setSavingListCostId(product.id);
      const response = await fetch("/api/product", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: product.id,
          code: product.code,
          name: product.name,
          brand: product.brand || "",
          category: product.category || "",
          colors: product.colors || "",
          sizes: product.sizes || "",
          cost: nextCost,
          cost2: product.cost2,
          cost3: product.cost3,
          price: product.price,
          imageUrl: product.imageUrl || "",
          productType: product.productType,
          supplierId: product.supplierId,
          supplier2Id: product.supplier2Id,
          supplier3Id: product.supplier3Id,
          sourceProductName: product.sourceProductName || product.name,
          bandPostId: product.bandPostId || "",
          bandPostUrl: product.bandPostUrl || "",
          isBandImported: product.isBandImported,
        }),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.message || "매입단가 저장에 실패했습니다.");
      }

      setProducts((current) =>
        current.map((item) => (item.id === product.id ? result : item))
      );
      setListCostDrafts((current) => {
        const next = { ...current };
        delete next[product.id];
        return next;
      });
    } catch (error) {
      console.error(error);
      alert(error instanceof Error ? error.message : "매입단가 저장 중 오류가 발생했습니다.");
    } finally {
      setSavingListCostId(null);
    }
  }

  function moveListCell(
    productId: number,
    column: "supplier" | "cost" | "price",
    direction: "up" | "down" | "left" | "right"
  ) {
    const currentIndex = filteredProducts.findIndex((item) => item.id === productId);
    let nextIndex = currentIndex;
    let nextColumn = column;

    if (direction === "up") nextIndex -= 1;
    if (direction === "down") nextIndex += 1;
    if (direction === "left") {
      nextColumn =
        column === "price" ? "cost" : "supplier";
    }
    if (direction === "right") {
      nextColumn =
        column === "supplier" ? "cost" : "price";
    }

    const nextProduct = filteredProducts[nextIndex];
    if (!nextProduct) return;
    listCellRefs.current.get(`${nextProduct.id}-${nextColumn}`)?.focus();
  }

  function handleListCellArrows(
    event: React.KeyboardEvent<HTMLInputElement>,
    productId: number,
    column: "supplier" | "cost" | "price"
  ) {
    const directions = {
      ArrowUp: "up",
      ArrowDown: "down",
      ArrowLeft: "left",
      ArrowRight: "right",
    } as const;
    const direction = directions[event.key as keyof typeof directions];
    if (!direction) return;
    event.preventDefault();
    moveListCell(productId, column, direction);
  }

  async function saveListSupplier(product: Product) {
    if (savingListSupplierId === product.id) return;
    const supplierText = (
      listSupplierDrafts[product.id] ??
      product.supplier?.code ??
      ""
    ).trim();

    try {
      setSavingListSupplierId(product.id);
      const resolvedSupplierId = supplierText
        ? Number(await findOrCreateSupplierId(supplierText))
        : null;

      let supplierId = resolvedSupplierId;
      let supplier2Id = product.supplier2Id;
      let supplier3Id = product.supplier3Id;
      let cost = product.cost;
      let cost2 = product.cost2;
      let cost3 = product.cost3;

      if (resolvedSupplierId && resolvedSupplierId === product.supplier2Id) {
        supplierId = product.supplier2Id;
        supplier2Id = product.supplierId;
        cost = product.cost2;
        cost2 = product.cost;
      } else if (resolvedSupplierId && resolvedSupplierId === product.supplier3Id) {
        supplierId = product.supplier3Id;
        supplier3Id = product.supplierId;
        cost = product.cost3;
        cost3 = product.cost;
      }

      const response = await fetch("/api/product", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: product.id,
          code: product.code,
          name: product.name,
          brand: product.brand || "",
          category: product.category || "",
          colors: product.colors || "",
          sizes: product.sizes || "",
          cost,
          cost2,
          cost3,
          price: product.price,
          imageUrl: product.imageUrl || "",
          productType: product.productType,
          supplierId,
          supplier2Id,
          supplier3Id,
          sourceProductName: product.sourceProductName || product.name,
          bandPostId: product.bandPostId || "",
          bandPostUrl: product.bandPostUrl || "",
          isBandImported: product.isBandImported,
        }),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.message || "대표 공급업체 저장에 실패했습니다.");
      }

      setProducts((current) =>
        current.map((item) => (item.id === product.id ? result : item))
      );
      setListSupplierDrafts((current) => {
        const next = { ...current };
        delete next[product.id];
        return next;
      });
      setListCostDrafts((current) => {
        const next = { ...current };
        delete next[product.id];
        return next;
      });
    } catch (error) {
      console.error(error);
      alert(error instanceof Error ? error.message : "대표 공급업체 저장 중 오류가 발생했습니다.");
    } finally {
      setSavingListSupplierId(null);
    }
  }

  async function saveDraftProducts(targetProducts: Product[]) {
    targetProducts.forEach((product) => {
      validateDecimalDraft(
        listCostDrafts[product.id],
        product.code,
        "대표 매입단가"
      );
      validateDecimalDraft(
        listPriceDrafts[product.id],
        product.code,
        "판매단가"
      );
    });

    const requestProducts = await Promise.all(
      targetProducts.map(async (product) => {
        const supplierText = (
          listSupplierDrafts[product.id] ??
          product.supplier?.code ??
          ""
        ).trim();
        const supplierId = supplierText
          ? Number(await findOrCreateSupplierId(supplierText))
          : null;

        return {
          id: product.id,
          supplierId,
          cost:
            listCostDrafts[product.id] !== undefined
              ? nullableDecimal(listCostDrafts[product.id])
              : product.cost,
          price:
            listPriceDrafts[product.id] !== undefined
              ? nullableDecimal(listPriceDrafts[product.id])
              : product.price,
        };
      })
    );

    const response = await fetch("/api/products/bulk", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ products: requestProducts }),
    });
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || "상품 저장에 실패했습니다.");
    }

    const results = Array.isArray(data.results) ? data.results : [];
    const successResults = results.filter(
      (result: { success?: boolean }) => result.success
    ) as Array<{ id: number; success: true; product: Product }>;
    const failedResults = results.filter(
      (result: { success?: boolean }) => !result.success
    ) as Array<{ id: number; success: false; reason: string }>;
    const savedById = new Map(
      successResults.map((result) => [result.id, result.product])
    );
    const successfulIds = new Set(successResults.map((result) => result.id));

    setProducts((current) =>
      current.map((product) => savedById.get(product.id) || product)
    );

    const clearSuccessfulDrafts = (current: Record<number, string>) => {
      const next = { ...current };
      successfulIds.forEach((id) => delete next[id]);
      return next;
    };
    setListSupplierDrafts(clearSuccessfulDrafts);
    setListCostDrafts(clearSuccessfulDrafts);
    setListPriceDrafts(clearSuccessfulDrafts);

    return { successResults, failedResults };
  }

  async function saveListFieldsAndEdit(product: Product) {
    if (
      savingAllProducts ||
      savingListSupplierId === product.id ||
      savingListCostId === product.id
    ) {
      return;
    }

    if (!dirtyProductIds.has(product.id)) {
      startEdit(product);
      return;
    }

    try {
      setSavingListSupplierId(product.id);
      setSavingListCostId(product.id);
      const { successResults, failedResults } = await saveDraftProducts([product]);

      if (failedResults.length > 0) {
        throw new Error(failedResults[0].reason);
      }

      startEdit(successResults[0].product);
    } catch (error) {
      console.error(error);
      alert(
        error instanceof Error
          ? error.message
          : "상품 목록 수정 중 오류가 발생했습니다."
      );
    } finally {
      setSavingListSupplierId(null);
      setSavingListCostId(null);
    }
  }

  async function saveAllProductDrafts() {
    if (savingAllProducts) return;

    const changedProducts = products.filter((product) =>
      dirtyProductIds.has(product.id)
    );

    if (changedProducts.length === 0) {
      alert("변경된 상품이 없습니다.");
      return;
    }

    try {
      setSavingAllProducts(true);
      const { successResults, failedResults } =
        await saveDraftProducts(changedProducts);

      if (failedResults.length === 0) {
        alert("변경된 상품이 모두 저장되었습니다.");
        return;
      }

      const failedDetails = failedResults
        .map((result) => {
          const product = products.find((item) => item.id === result.id);
          return `${product?.code || result.id} ${product?.name || ""}: ${result.reason}`;
        })
        .join("\n");

      alert(
        `${changedProducts.length}개 중 ${successResults.length}개 저장 성공, ` +
          `${failedResults.length}개 저장 실패\n\n${failedDetails}`
      );
    } catch (error) {
      console.error(error);
      alert(error instanceof Error ? error.message : "전체 저장에 실패했습니다.");
    } finally {
      setSavingAllProducts(false);
    }
  }

  return (
    <div style={pageStyle} className="pm-page">

      <style>{`
        .pm-mobile-product-summary {
          display: none;
        }

        .pm-mobile-detail-wrap {
          display: block;
        }

        .pm-list-product-name {
          min-width: 0;
        }

        .pm-list-info {
          min-width: 0;
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .pm-list-label {
          color: #64748b;
          font-size: 13px;
        }

        .pm-list-info strong {
          color: #111827;
          font-size: 12px;
          overflow-wrap: anywhere;
        }

        .pm-inline-field {
          min-width: 0;
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .pm-inline-input {
          width: 100%;
          min-width: 0;
          height: 34px;
          padding: 0 9px;
          border: 1px solid #dbe3ee;
          border-radius: 7px;
          background: #ffffff;
          color: #111827;
          font-size: 13px;
          font-weight: 700;
          box-sizing: border-box;
          outline: none;
        }

        .pm-inline-input:focus {
          border-color: #94a3b8;
          box-shadow: 0 0 0 2px rgba(148, 163, 184, 0.16);
        }

        .pm-detail-summary {
          display: grid;
          grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
          gap: 0;
          border-top: 1px solid #e5e7eb;
          background: #fbfdff;
        }

        .pm-detail-summary-item {
          padding: 14px 18px;
          min-width: 0;
        }

        .pm-detail-summary-item + .pm-detail-summary-item {
          border-left: 1px solid #e5e7eb;
        }

        .pm-detail-summary-label {
          display: block;
          margin-bottom: 7px;
          color: #64748b;
          font-size: 13px;
          font-weight: 700;
        }

        .pm-detail-summary-value {
          color: #111827;
          font-size: 16px;
          font-weight: 800;
          line-height: 1.45;
          overflow-wrap: anywhere;
        }

        .pm-image-editor > div:first-child,
        .pm-image-editor > label,
        .pm-image-editor > button,
        .pm-image-editor > div:nth-of-type(2) {
          display: none !important;
        }
        .pm-image-editor > div:last-child {
          display: flex;
          flex-direction: column;
        }
        .pm-image-editor textarea {
          flex: none;
          height: 165px !important;
          min-height: 165px !important;
          resize: vertical !important;
        }
        .pm-form-content.pm-form-editing {
          grid-template-columns: minmax(0, 1fr) !important;
        }
        .pm-form-editing .pm-image-editor {
          display: none !important;
        }

        .pm-extra-supplier {
          grid-column: 1 / -1;
          display: grid;
          grid-template-columns: minmax(180px, 1.65fr) minmax(84px, .75fr) minmax(84px, .75fr) auto;
          gap: 8px;
          align-items: end;
          padding: 9px;
          border: 1px solid #e2e8f0;
          border-radius: 10px;
          background: #f8fafc;
        }
        .pm-form-card,
        .pm-form-content,
        .pm-form-grid,
        .pm-compact-top-grid,
        .pm-supplier-cost-grid,
        .pm-price-grid,
        .pm-extra-supplier {
          min-width: 0;
          max-width: 100%;
          box-sizing: border-box;
        }
        .pm-form-card h3 { font-size: 16px !important; }
        .pm-form-card input,
        .pm-form-card select,
        .pm-form-card textarea { font-size: 11px !important; }
        .pm-form-card button,
        .pm-form-card label { font-size: 11px; }
        .pm-compact-top-grid > *,
        .pm-supplier-cost-grid > *,
        .pm-price-grid > *,
        .pm-extra-supplier > * {
          min-width: 0;
        }
        @media (max-width: 1000px) and (min-width: 769px) {
          .pm-form-content {
            grid-template-columns: minmax(120px, 24%) minmax(0, 1fr) !important;
            gap: 14px !important;
          }
          .pm-compact-top-grid {
            grid-template-columns: minmax(0, .72fr) minmax(0, .72fr) minmax(0, 1.55fr) !important;
          }
          .pm-supplier-cost-grid,
          .pm-price-grid {
            grid-template-columns: minmax(0, 1.5fr) minmax(0, .72fr) minmax(0, .72fr) !important;
          }
        }
        .pm-add-supplier, .pm-collapse-supplier {
          border: 1px solid #cbd5e1;
          border-radius: 8px;
          background: white;
          color: #334155;
          font-weight: 800;
          cursor: pointer;
        }
        .pm-add-supplier { grid-column: 1 / -1; justify-self: start; padding: 10px 14px; color: #2563eb; border-color: #93c5fd; }
        .pm-collapse-supplier { min-height: 42px; padding: 0 13px; color: #b91c1c; border-color: #fecaca; }

        .pm-product-row {
          display: grid;
          grid-template-columns: 90px minmax(300px, 1fr) 78px 72px 72px 156px;
          align-items: center;
          column-gap: 5px;
          min-height: 50px;
          padding: 5px 9px;
          box-sizing: border-box;
        }
        .pm-product-card.pm-product-dirty {
          background: #f5f9ff;
          border-color: #bfdbfe;
        }
        .pm-save-all {
          height: 32px;
          padding: 0 13px;
          border: 0;
          border-radius: 6px;
          background: #2563eb;
          color: white;
          font-size: 11px;
          font-weight: 800;
          white-space: nowrap;
          cursor: pointer;
        }
        .pm-save-all:disabled {
          background: #93c5fd;
          cursor: not-allowed;
        }
        .pm-product-name-cell { padding-right: 22px; }
        .pm-product-cell { min-width: 0; }
        .pm-column-label { display: block; margin-bottom: 2px; color: #64748b; font-size: 9px; font-weight: 700; }
        .pm-product-cell strong { display: block; color: #111827; font-size: 11px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .pm-list-cost-input {
          width: 100%;
          height: 24px;
          min-width: 0;
          padding: 2px 6px;
          border: 1px solid #cbd5e1;
          border-radius: 5px;
          background: white;
          color: #111827;
          font-size: 11px;
          font-weight: 700;
          box-sizing: border-box;
          outline: none;
        }
        .pm-list-cost-input:focus {
          border-color: #2563eb;
          box-shadow: 0 0 0 2px rgba(37, 99, 235, .12);
        }
        .pm-list-cost-input:disabled { background: #f8fafc; color: #64748b; }
        .pm-product-name-cell strong { display: -webkit-box; white-space: normal; -webkit-line-clamp: 2; -webkit-box-orient: vertical; line-height: 1.35; }
        .pm-row-actions { display: grid; grid-template-columns: repeat(3, 1fr); gap: 4px; justify-self: end; }
        .pm-row-actions button { width: 48px !important; height: 26px !important; line-height: 24px !important; font-size: 9px !important; }

        .pm-modal-backdrop { position: fixed; inset: 0; z-index: 1000; display: flex; align-items: center; justify-content: center; padding: 20px; background: rgba(15,23,42,.58); }
        .pm-detail-modal { width: min(900px, 100%); max-height: calc(100vh - 40px); overflow: auto; border-radius: 16px; background: white; box-shadow: 0 24px 70px rgba(15,23,42,.28); }
        .pm-detail-header { position: sticky; top: 0; z-index: 1; display: flex; justify-content: space-between; gap: 20px; align-items: flex-start; padding: 20px 24px; border-bottom: 1px solid #e2e8f0; background: white; }
        .pm-detail-header span { color: #64748b; font-size: 12px; font-weight: 800; }
        .pm-detail-header h3 { margin: 4px 0 0; color: #0f172a; font-size: 22px; }
        .pm-modal-close { width: 38px; height: 38px; border: 0; border-radius: 50%; background: #f1f5f9; color: #334155; font-size: 25px; cursor: pointer; }
        .pm-detail-content { display: grid; grid-template-columns: minmax(260px, .8fr) minmax(0, 1.2fr); gap: 24px; padding: 24px; }
        .pm-detail-image { position: relative; aspect-ratio: 1; display: flex; align-items: center; justify-content: center; overflow: hidden; border: 2px dashed #cbd5e1; border-radius: 14px; background: #f8fafc; color: #94a3b8; font-weight: 700; outline: none; }
        .pm-detail-image:focus, .pm-detail-image-dragging { border-color: #2563eb; background: #eff6ff; box-shadow: 0 0 0 4px rgba(37,99,235,.12); }
        .pm-detail-image img { width: 100%; height: 100%; object-fit: contain; background: white; }
        .pm-detail-image-empty { display: flex; flex-direction: column; align-items: center; gap: 7px; padding: 18px; text-align: center; }
        .pm-detail-image-empty strong { color: #64748b; font-size: 16px; }
        .pm-detail-image-empty span { font-size: 12px; }
        .pm-detail-image-overlay { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; background: rgba(255,255,255,.88); color: #2563eb; font-weight: 900; }
        .pm-detail-image-actions { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 7px; margin-top: 9px; }
        .pm-detail-image-actions label, .pm-detail-image-actions button { display: flex; align-items: center; justify-content: center; min-height: 36px; padding: 7px 9px; border: 0; border-radius: 7px; background: #2563eb; color: white; font-size: 11px; font-weight: 800; cursor: pointer; box-sizing: border-box; text-align: center; }
        .pm-detail-image-actions input { display: none; }
        .pm-detail-image-actions button:disabled { opacity: .55; cursor: not-allowed; }
        .pm-detail-image-actions .pm-detail-image-delete { background: #ef4444; }
        .pm-detail-image-unsaved { margin-top: 7px; color: #b45309; font-size: 11px; font-weight: 700; text-align: center; }
        .pm-detail-highlights { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 12px; }
        .pm-detail-highlights div { padding: 14px; border-radius: 10px; background: #eff6ff; }
        .pm-detail-highlights span, .pm-detail-grid dt { display: block; margin-bottom: 6px; color: #64748b; font-size: 12px; font-weight: 800; }
        .pm-detail-highlights strong { color: #1e3a8a; font-size: 17px; overflow-wrap: anywhere; }
        .pm-detail-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0 18px; margin: 0; }
        .pm-detail-grid > div { min-width: 0; padding: 12px 0; border-bottom: 1px solid #e2e8f0; }
        .pm-detail-grid dd { margin: 0; color: #111827; font-size: 14px; font-weight: 700; line-height: 1.5; overflow-wrap: anywhere; }
        .pm-detail-grid a { color: #2563eb; }
        .pm-detail-wide { grid-column: 1 / -1; }
        .pm-detail-footer { position: sticky; bottom: 0; display: flex; justify-content: flex-end; padding: 14px 24px; border-top: 1px solid #e2e8f0; background: white; }
        .pm-detail-footer button { min-width: 100px; padding: 10px 16px; border: 0; border-radius: 8px; background: #111827; color: white; font-weight: 800; cursor: pointer; }

        /* 상품관리 모바일 반응형 */
        @media (max-width: 768px) {
          .pm-page {
            width: 100% !important;
            max-width: 100% !important;
            padding: 0 12px 32px !important;
            box-sizing: border-box !important;
            overflow-x: hidden !important;
          }

          .pm-top-row {
            display: flex !important;
            flex-direction: column !important;
            align-items: stretch !important;
            gap: 14px !important;
            margin-bottom: 16px !important;
          }

          .pm-top-row h2 {
            font-size: 24px !important;
          }

          .pm-top-row p {
            font-size: 14px !important;
            line-height: 1.5 !important;
          }

          .pm-primary-button {
            width: auto !important;
            min-height: 36px !important;
          }

          .pm-title-action-row {
            width: 100% !important;
            flex-direction: column !important;
            align-items: stretch !important;
            flex-wrap: wrap !important;
            gap: 8px !important;
          }

          .pm-title-left,
          .pm-title-excel-actions {
            width: 100% !important;
          }

          .pm-title-left {
            flex-wrap: wrap !important;
          }

          .pm-title-excel-actions {
            justify-content: flex-start !important;
            flex-wrap: wrap !important;
          }

          .pm-title-action-row .pm-primary-button,
          .pm-title-action-row .pm-excel-button {
            width: auto !important;
            min-width: 90px !important;
            height: 36px !important;
            padding: 0 16px !important;
          }

          .pm-form-card {
            padding: 16px !important;
            border-radius: 12px !important;
          }
          .pm-form-header {
  display: grid !important;
  grid-template-columns: minmax(0, 1fr) !important;
  align-items: stretch !important;
  gap: 12px !important;
}

.pm-form-header > div {
  min-width: 0 !important;
  width: 100% !important;
}

.pm-form-header h3 {
  margin: 0 !important;
  font-size: 20px !important;
  line-height: 1.35 !important;
  overflow-wrap: anywhere !important;
}

.pm-form-header p {
  margin-top: 6px !important;
  line-height: 1.5 !important;
  overflow-wrap: anywhere !important;
}

.pm-form-header > button {
  width: 100% !important;
  min-width: 0 !important;
  min-height: 46px !important;
}

.pm-form-grid {
  display: grid !important;
  grid-template-columns: minmax(0, 1fr) !important;
  gap: 14px !important;
}

.pm-form-grid label {
  min-width: 0 !important;
  width: 100% !important;
  box-sizing: border-box !important;
}

.pm-compact-top-grid,
.pm-supplier-cost-grid,
.pm-price-grid {
  grid-template-columns: minmax(0, 1fr) !important;
}

.pm-price-grid > div[aria-hidden="true"] {
  display: none !important;
}

.pm-form-grid input,
.pm-form-grid select,
.pm-form-grid textarea {
  width: 100% !important;
  min-width: 0 !important;
  max-width: 100% !important;
  box-sizing: border-box !important;
}

.pm-image-editor {
  width: 100% !important;
  max-width: 100% !important;
  margin: 0 !important;
}

.pm-image-editor > div:first-child {
  width: 100% !important;
  max-width: 280px !important;
  margin: 0 auto !important;
}
          .pm-form-header {
            flex-direction: column !important;
            align-items: stretch !important;
            gap: 12px !important;
          }

          .pm-form-header > button {
            width: 100% !important;
          }

          .pm-form-content {
            display: grid !important;
            grid-template-columns: 1fr !important;
            gap: 18px !important;
          }

          .pm-image-editor {
            width: 100% !important;
          }

          .pm-image-editor > div:first-child {
            max-width: 280px !important;
            width: 100% !important;
            margin: 0 auto !important;
          }

          .pm-form-grid {
            display: grid !important;
            grid-template-columns: 1fr !important;
            gap: 12px !important;
          }

          .pm-form-footer {
            flex-direction: column !important;
            gap: 8px !important;
          }

          .pm-form-footer > button {
            width: 100% !important;
            min-width: 0 !important;
          }

          .pm-toolbar {
            flex-direction: column !important;
            align-items: stretch !important;
            gap: 10px !important;
            padding: 12px !important;
          }

          .pm-search-input {
            width: 100% !important;
            max-width: 100% !important;
            box-sizing: border-box !important;
          }

          .pm-count-text {
            text-align: right !important;
            font-size: 14px !important;
          }

          .pm-product-list {
            grid-template-columns: 1fr !important;
            gap: 8px !important;
          }

          .pm-product-card {
            width: 100% !important;
            overflow: hidden !important;
            box-sizing: border-box !important;
          }

          .pm-extra-supplier { grid-template-columns: 1fr !important; gap: 10px !important; }
          .pm-collapse-supplier { width: 100% !important; }
          .pm-product-row { grid-template-columns: 1fr 1fr !important; gap: 12px 16px !important; padding: 14px !important; }
          .pm-product-name-cell { grid-column: 1 / -1 !important; grid-row: 1 !important; }
          .pm-product-name-cell { padding-right: 0 !important; }
          .pm-row-actions { grid-column: 1 / -1 !important; width: 100% !important; justify-self: stretch !important; }
          .pm-row-actions button { width: 100% !important; }
          .pm-detail-modal { max-height: calc(100vh - 20px) !important; }
          .pm-detail-content { grid-template-columns: 1fr !important; padding: 16px !important; }
          .pm-detail-image { max-width: 360px !important; width: 100% !important; margin: 0 auto !important; }
          .pm-detail-grid { grid-template-columns: 1fr !important; }
          .pm-detail-wide { grid-column: auto !important; }

          .pm-mobile-product-summary {
            display: grid !important;
            grid-template-columns: 74px minmax(0, 1fr) 28px !important;
            align-items: center !important;
            gap: 12px !important;
            width: 100% !important;
            padding: 12px !important;
            border: none !important;
            background: white !important;
            text-align: left !important;
            cursor: pointer !important;
          }

          .pm-mobile-summary-image {
            width: 74px !important;
            height: 74px !important;
            border: 1px solid #e2e8f0 !important;
            border-radius: 9px !important;
            overflow: hidden !important;
            background: #f8fafc !important;
          }

          .pm-mobile-summary-image img {
            width: 100% !important;
            height: 100% !important;
            object-fit: contain !important;
            background: white !important;
          }

          .pm-mobile-summary-no-image {
            width: 100% !important;
            height: 100% !important;
            display: flex !important;
            flex-direction: column !important;
            align-items: center !important;
            justify-content: center !important;
            gap: 4px !important;
            color: #94a3b8 !important;
          }

          .pm-mobile-summary-no-image span {
            font-size: 24px !important;
          }

          .pm-mobile-summary-no-image small {
            font-size: 10px !important;
          }

          .pm-mobile-summary-text {
            min-width: 0 !important;
          }

          .pm-mobile-summary-code {
            display: block !important;
            margin-bottom: 5px !important;
            color: #475569 !important;
            font-size: 13px !important;
            font-weight: 800 !important;
            overflow-wrap: anywhere !important;
          }

          .pm-mobile-summary-name {
            display: block !important;
            color: #111827 !important;
            font-size: 19px !important;
            line-height: 1.3 !important;
            overflow-wrap: anywhere !important;
          }

          .pm-mobile-summary-toggle {
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            width: 28px !important;
            height: 28px !important;
            border-radius: 50% !important;
            background: #f1f5f9 !important;
            color: #334155 !important;
            font-size: 13px !important;
            font-weight: 900 !important;
          }

          .pm-mobile-detail-wrap {
            display: none !important;
          }

          .pm-mobile-detail-open {
            display: block !important;
            border-top: 1px solid #e5e7eb !important;
          }

          .pm-mobile-detail-wrap .pm-product-main-row {
            display: grid !important;
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          }

          .pm-mobile-detail-wrap .pm-list-product-name {
            grid-column: 1 / -1 !important;
          }

          .pm-mobile-detail-wrap .pm-list-info {
            min-width: 0 !important;
          }

          .pm-mobile-detail-wrap .pm-summary-box,
          .pm-mobile-detail-wrap .pm-action-box {
            grid-column: 1 / -1 !important;
          }

          .pm-product-main-row {
            display: grid !important;
            grid-template-columns: 82px minmax(0, 1fr) !important;
            gap: 12px !important;
            padding: 14px !important;
            min-height: 0 !important;
            align-items: start !important;
          }

          .pm-product-image-box {
            width: 82px !important;
            height: 82px !important;
            grid-column: 1 !important;
            grid-row: 1 !important;
          }

          .pm-mobile-detail-wrap .pm-product-image-box {
            display: none !important;
          }

          .pm-mobile-detail-wrap .pm-product-info {
            grid-column: 1 / -1 !important;
            grid-row: auto !important;
          }

          .pm-mobile-detail-wrap .pm-product-info > div:first-child {
            display: none !important;
          }

          .pm-product-info {
            grid-column: 2 !important;
            grid-row: 1 !important;
            width: 100% !important;
            min-width: 0 !important;
          }

          .pm-product-info > div:first-child {
            margin-bottom: 8px !important;
          }

          .pm-product-info > div:first-child > div > div:first-child {
            font-size: 13px !important;
            margin-bottom: 4px !important;
            overflow-wrap: anywhere !important;
          }

          .pm-product-info > div:first-child > div > div:nth-child(2) {
            font-size: 18px !important;
            line-height: 1.3 !important;
            overflow-wrap: anywhere !important;
          }

          .pm-meta-grid {
            grid-column: 1 / -1 !important;
            display: grid !important;
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
            gap: 6px 12px !important;
            margin-top: 8px !important;
          }

          .pm-meta-grid > div {
            min-width: 0 !important;
            padding: 4px 0 !important;
          }

          .pm-meta-grid span {
            font-size: 12px !important;
          }

          .pm-meta-grid strong {
            font-size: 14px !important;
            white-space: normal !important;
            overflow: visible !important;
            text-overflow: clip !important;
            overflow-wrap: anywhere !important;
          }

          .pm-summary-box {
            grid-column: 1 / -1 !important;
            width: 100% !important;
            padding: 12px 0 0 !important;
            border-left: none !important;
            border-right: none !important;
            border-top: 1px solid #e2e8f0 !important;
            box-sizing: border-box !important;
          }

          .pm-summary-box > div {
            margin-top: 6px !important;
            font-size: 14px !important;
          }

          .pm-action-box {
            grid-column: 1 / -1 !important;
            display: grid !important;
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
            gap: 8px !important;
            justify-content: stretch !important;
            width: 100% !important;
            margin-top: 4px !important;
          }

          .pm-action-box > button {
            width: 100% !important;
            height: 38px !important;
            min-width: 0 !important;
            padding: 0 8px !important;
            font-size: 13px !important;
            line-height: 36px !important;
          }

          .pm-sku-panel {
            padding: 14px !important;
          }

          .pm-sku-grid {
            display: grid !important;
            grid-template-columns: 1fr !important;
            gap: 8px !important;
          }
        }

        @media (max-width: 420px) {
          .pm-page {
            padding-left: 8px !important;
            padding-right: 8px !important;
          }

          .pm-product-main-row {
            grid-template-columns: 72px minmax(0, 1fr) !important;
            gap: 10px !important;
            padding: 12px !important;
          }

          .pm-product-image-box {
            width: 72px !important;
            height: 72px !important;
          }

          .pm-meta-grid {
            grid-template-columns: 1fr 1fr !important;
          }

          .pm-action-box {
            grid-template-columns: 1fr 1fr !important;
          }
        }
      `}</style>

      <div style={topRowStyle} className="pm-top-row">
        <div>
          <div style={titleActionRowStyle} className="pm-title-action-row">
            <div style={titleLeftGroupStyle} className="pm-title-left">
              <h2 style={titleStyle}>👕 상품관리</h2>
              <button
                type="button"
                onClick={openCreateForm}
                style={primaryButtonStyle}
                className="pm-primary-button"
              >
                {showProductForm ? "닫기" : "+ 상품등록"}
              </button>
            </div>

            <div style={excelActionGroupStyle} className="pm-title-excel-actions">
              <button
                type="button"
                onClick={downloadProductExcel}
                style={{
                  ...secondaryButtonStyle,
                  backgroundColor: "#16a34a",
                  color: "#ffffff",
                  border: "none",
                }}
                className="pm-excel-button"
              >
                엑셀 다운로드
              </button>

              <button
                type="button"
                onClick={() => excelInputRef.current?.click()}
                disabled={importingExcel}
                style={{
                  ...secondaryButtonStyle,
                  backgroundColor: "#ef4444",
                  color: "#ffffff",
                  border: "none",
                  opacity: importingExcel ? 0.65 : 1,
                  cursor: importingExcel ? "not-allowed" : "pointer",
                }}
                className="pm-excel-button"
              >
                {importingExcel ? "업로드 중..." : "엑셀 업로드"}
              </button>

              <input
                ref={excelInputRef}
                type="file"
                accept=".xlsx,.xls"
                onChange={uploadProductExcel}
                style={{ display: "none" }}
              />
            </div>
          </div>

          <p style={subtitleStyle}>
            상품과 공급업체·SKU를 한곳에서 관리합니다.
          </p>
        </div>
      </div>

      {showProductForm && (
        <form
          onSubmit={saveProduct}
          onPaste={handleSmartPaste}
          style={formCardStyle}
          className="pm-form-card"
        >
          <div style={formHeaderStyle} className="pm-form-header">
            <div>
              <h3 style={{ margin: 0 }}>
                {editingId ? "상품 수정" : "상품 등록"}
              </h3>
              <p style={formHelpStyle}>
                색상과 사이즈는 쉼표(,)로 구분해서 입력하세요.
              </p>
            </div>

          </div>

         

          <div
            style={formContentStyle}
            className={`pm-form-content ${editingId ? "pm-form-editing" : ""}`}
          >
            <div style={imageEditorStyle} className="pm-image-editor">
              <div
                style={{
                  ...imagePreviewBoxStyle,
                  ...(isDraggingImage ? imagePreviewBoxDraggingStyle : {}),
                  ...(uploadingImage ? { opacity: 0.72 } : {}),
                }}
                onDragEnter={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  if (!uploadingImage) setIsDraggingImage(true);
                }}
                onDragOver={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  event.dataTransfer.dropEffect = "copy";
                  if (!uploadingImage) setIsDraggingImage(true);
                }}
                onDragLeave={(event) => {
                  event.preventDefault();
                  event.stopPropagation();

                  const nextTarget = event.relatedTarget as Node | null;
                  if (!nextTarget || !event.currentTarget.contains(nextTarget)) {
                    setIsDraggingImage(false);
                  }
                }}
                onDrop={handleImageDrop}
              >
                {form.imageUrl ? (
                  <img
                    src={form.imageUrl}
                    alt="상품 미리보기"
                    style={imagePreviewStyle}
                  />
                ) : (
                  <div style={emptyImageStyle}>
                    <div style={{ fontSize: "34px" }}>🖼️</div>
                    <div style={{ fontWeight: 800 }}>사진을 여기에 끌어다 놓으세요</div>
                    <div style={{ fontSize: "11px" }}>또는 캡처 후 Ctrl+V로 붙여넣기</div>
                  </div>
                )}

                {isDraggingImage && (
                  <div style={dropOverlayStyle}>
                    <div style={{ fontSize: "32px" }}>⬇️</div>
                    <div>여기에 놓으면 바로 업로드됩니다</div>
                  </div>
                )}

                {uploadingImage && (
                  <div style={uploadOverlayStyle}>업로드 중...</div>
                )}
              </div>

              <label style={uploadLabelStyle}>
                {uploadingImage
                  ? "업로드 중..."
                  : "이미지 선택"}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  disabled={uploadingImage}
                  style={{ display: "none" }}
                  onChange={(event) => {
                    const file =
                      event.target.files?.[0];

                    if (file) {
                      void uploadImage(file);
                    }

                    event.target.value = "";
                  }}
                />
              </label>

              {form.imageUrl && (
                <button
                  type="button"
                  onClick={() =>
                    updateForm("imageUrl", "")
                  }
                  style={removeImageButtonStyle}
                >
                  이미지 제거
                </button>
              )}

              <div style={imageHelpStyle}>
                사진을 끌어다 놓거나 캡처 후 Ctrl+V로 붙여넣으세요 · JPG, PNG, WEBP, GIF / 최대 10MB
              </div>
              {!editingId ? (
                <>
                  <div style={bandPasteBoxStyle}>
                    <div style={bandPasteTitleStyle}>📋 게시글</div>
                    <textarea
                      value={bandPostText}
                      onChange={(event) => {
                        const nextBandPostText = event.target.value;
                        setBandPostText(nextBandPostText);
                        applyBandPostText(nextBandPostText);
                      }}
                      onKeyDown={(event) => {
                        if (event.key === "Tab" && !event.shiftKey) {
                          event.preventDefault();
                          cost1InputRef.current?.focus();
                        }
                      }}
                      placeholder=""
                      style={bandPasteTextareaStyle}
                    />
                  </div>
                  <div className="pm-band-meta" style={bandMetaStyle}>
                    <Field
                      label="밴드 원본 게시글 주소"
                      value={form.bandPostUrl}
                      onChange={(value) => updateForm("bandPostUrl", value)}
                      placeholder="자동 저장"
                    />
                    <label style={bandCheckStyle}>
                      <input
                        type="checkbox"
                        checked={form.isBandImported}
                        onChange={(event) =>
                          updateForm("isBandImported", event.target.checked)
                        }
                      />
                      <span>네이버 밴드 상품</span>
                    </label>
                  </div>
                </>
              ) : null}
            </div>

            <div style={formGridStyle} className="pm-form-grid">
              <div className="pm-compact-top-grid" style={compactTopGridStyle}>
                <Field
                  label="상품코드"
                  value={form.code}
                  onChange={(value) => updateForm("code", value)}
                  placeholder="예: TEST-001"
                />
                <Field
                  label="상품코드 추가"
                  value={form.additionalCode}
                  onChange={(value) => updateForm("additionalCode", value)}
                  placeholder="선택사항"
                />
                <label style={fieldStyle}>
                  <span style={fieldLabelStyle}>상품</span>
                  <textarea
                    ref={(element) => {
                      if (!element) return;
                      element.style.height = "auto";
                      element.style.height = `${element.scrollHeight}px`;
                    }}
                    value={form.sourceProductName}
                    onChange={(event) => updateForm("sourceProductName", event.target.value)}
                    onInput={(event) => {
                      event.currentTarget.style.height = "auto";
                      event.currentTarget.style.height = `${event.currentTarget.scrollHeight}px`;
                    }}
                    placeholder="상품을 입력하세요"
                    rows={3}
                    style={{
                      ...inputStyle,
                      minHeight: "62px",
                      lineHeight: 1.45,
                      resize: "vertical",
                      overflowWrap: "anywhere",
                      whiteSpace: "pre-wrap",
                    }}
                  />
                </label>
              </div>

              <div className="pm-supplier-cost-grid" style={supplierCostGridStyle}>
                <SupplierSearchSelect
                  label="공급업체 1"
                  suppliers={suppliers}
                  value={form.supplierId}
                  onChange={changePrimarySupplier}
                />
                <Field
                  id="product-cost-1"
                  inputRef={cost1InputRef}
                  label="매입단가 1"
                  value={form.cost}
                  onChange={(value) => updateForm("cost", normalizeOneDecimal(value))}
                  placeholder="0"
                  inputMode="decimal"
                />
                <Field
                  label="매입단가 추가"
                  value={form.additionalCost}
                  onChange={(value) => updateForm("additionalCost", normalizeOneDecimal(value))}
                  placeholder="0"
                  inputMode="decimal"
                />
              </div>

              {visibleSupplierCount >= 2 && (
                <div className="pm-extra-supplier">
                  <SupplierSearchSelect
                    label="공급업체 2"
                    suppliers={suppliers}
                    value={form.supplier2Id}
                    onChange={(value) => updateForm("supplier2Id", value)}
                  />
                  <Field
                    label="매입단가 2"
                    value={form.cost2}
                    onChange={(value) => updateForm("cost2", normalizeOneDecimal(value))}
                    placeholder="0"
                    inputMode="decimal"
                  />
                  <Field
                    label="매입단가 추가"
                    value={form.additionalCost2}
                    onChange={(value) => updateForm("additionalCost2", normalizeOneDecimal(value))}
                    placeholder="0"
                    inputMode="decimal"
                  />
                  <button type="button" className="pm-collapse-supplier" onClick={() => setVisibleSupplierCount(1)}>
                    − 접기
                  </button>
                </div>
              )}

              {visibleSupplierCount >= 3 && (
                <div className="pm-extra-supplier">
                  <SupplierSearchSelect
                    label="공급업체 3"
                    suppliers={suppliers}
                    value={form.supplier3Id}
                    onChange={(value) => updateForm("supplier3Id", value)}
                  />
                  <Field
                    label="매입단가 3"
                    value={form.cost3}
                    onChange={(value) => updateForm("cost3", normalizeOneDecimal(value))}
                    placeholder="0"
                    inputMode="decimal"
                  />
                  <Field
                    label="매입단가 추가"
                    value={form.additionalCost3}
                    onChange={(value) => updateForm("additionalCost3", normalizeOneDecimal(value))}
                    placeholder="0"
                    inputMode="decimal"
                  />
                  <button type="button" className="pm-collapse-supplier" onClick={() => setVisibleSupplierCount(2)}>
                    − 접기
                  </button>
                </div>
              )}

              {visibleSupplierCount < 3 && (
                <button
                  type="button"
                  className="pm-add-supplier"
                  onClick={() => setVisibleSupplierCount((current) => Math.min(3, current + 1))}
                >
                  + 공급업체 추가
                </button>
              )}

              <Field
                label="상품명"
                value={form.sourceProductName}
                onChange={(value) => updateForm("sourceProductName", value)}
                placeholder="상품명"
              />

              <Field
                label="색상"
                value={form.colors}
                onChange={(value) => updateForm("colors", value)}
                placeholder="예: 블랙, 화이트"
              />

              <div className="pm-price-grid" style={priceGridStyle}>
                <Field
                  label="사이즈"
                  value={form.sizes}
                  onChange={(value) => updateForm("sizes", value)}
                  placeholder="예: 95, 100, 105"
                />
                <Field
                  label="판매가 1"
                  value={form.price}
                  onChange={(value) => updateForm("price", normalizeOneDecimal(value))}
                  placeholder="0"
                  inputMode="decimal"
                />
                <Field
                  label="판매가 추가"
                  value={form.additionalPrice}
                  onChange={(value) =>
                    updateForm("additionalPrice", normalizeOneDecimal(value))
                  }
                  placeholder="0"
                  inputMode="decimal"
                />
              </div>

              {editingId && (
                <>
                  <Field
                    label="밴드 원본 게시글 주소"
                    value={form.bandPostUrl}
                    onChange={(value) => updateForm("bandPostUrl", value)}
                    placeholder="밴드에서 가져오면 자동으로 저장됩니다"
                  />
                  <label style={{ ...bandCheckStyle, gridColumn: "1 / -1" }}>
                    <input
                      type="checkbox"
                      checked={form.isBandImported}
                      onChange={(event) =>
                        updateForm("isBandImported", event.target.checked)
                      }
                    />
                    <span>네이버 밴드에서 가져온 상품</span>
                  </label>
                </>
              )}
            </div>
          </div>

          <div style={formSubmitRowStyle}>
            <button
              type="submit"
              disabled={saving || uploadingImage}
              style={{
                ...saveButtonStyle,
                opacity: saving || uploadingImage ? 0.6 : 1,
              }}
            >
              {saving
                ? "저장 중..."
                : editingId
                  ? "상품 수정 저장"
                  : "상품 등록"}
            </button>
          </div>
        </form>
      )}

      <div style={toolbarStyle} className="pm-toolbar">
        <div
          style={{
            display: "flex",
            gap: "10px",
            flex: 1,
            flexWrap: "wrap",
          }}
        >
          <select value={searchField} onChange={(e) => setSearchField(e.target.value)} style={searchTypeStyle} aria-label="검색 항목 선택">
            <option value="all">전체</option><option value="code">상품코드</option><option value="name">상품명</option><option value="supplier">공급업체</option><option value="brand">브랜드</option><option value="category">카테고리</option>
          </select>
          <input
            value={search}
            onChange={(event) =>
              setSearch(event.target.value)
            }
            placeholder="상품코드, 상품명, 공급업체 검색"
            style={searchInputStyle}
            className="pm-search-input"
          />
        </div>

        <div style={countTextStyle} className="pm-count-text">
          총 {filteredProducts.length}개 상품
        </div>
        <span style={{ color: "#64748b", fontSize: "11px", whiteSpace: "nowrap" }}>
          변경 {dirtyProductIds.size}건
        </span>
        <button
          type="button"
          className="pm-save-all"
          onClick={() => void saveAllProductDrafts()}
          disabled={savingAllProducts}
        >
          {savingAllProducts ? "저장 중..." : "전체 저장"}
        </button>
      </div>

      {filteredProducts.length === 0 ? (
        <div style={emptyListStyle}>
          등록된 상품이 없습니다.
        </div>
      ) : (
        <div style={productListStyle} className="pm-product-list">
          {filteredProducts.map((product) => (
            <div
              key={product.id}
              style={productCardStyle}
              className={`pm-product-card ${
                dirtyProductIds.has(product.id) ? "pm-product-dirty" : ""
              }`}
            >
              <div className="pm-product-row">
                <div className="pm-product-cell">
                  <span className="pm-column-label">상품코드</span>
                  <strong>{product.code}</strong>
                </div>
                <div className="pm-product-cell pm-product-name-cell">
                  <span className="pm-column-label">상품명</span>
                  <strong title={product.sourceProductName || product.name}>
                    {product.sourceProductName || product.name || "-"}
                  </strong>
                </div>
                <div className="pm-product-cell">
                  <span className="pm-column-label">대표 공급업체</span>
                  <input
                    ref={(element) => {
                      const key = `${product.id}-supplier`;
                      if (element) listCellRefs.current.set(key, element);
                      else listCellRefs.current.delete(key);
                    }}
                    className="pm-list-cost-input"
                    style={
                      isListSupplierChanged(product)
                        ? changedInputStyle
                        : undefined
                    }
                    aria-label={`${product.code} 대표 공급업체`}
                    value={listSupplierDrafts[product.id] ?? product.supplier?.code ?? ""}
                    placeholder="-"
                    disabled={savingListSupplierId === product.id}
                    onChange={(event) =>
                      setListSupplierDrafts((current) => ({
                        ...current,
                        [product.id]: event.target.value,
                      }))
                    }
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        void saveListSupplier(product);
                        return;
                      }
                      handleListCellArrows(event, product.id, "supplier");
                    }}
                  />
                </div>
                <div className="pm-product-cell">
                  <span className="pm-column-label">대표 매입단가</span>
                  {isAdmin ? (
                    <input
                      ref={(element) => {
                        const key = `${product.id}-cost`;
                        if (element) listCellRefs.current.set(key, element);
                        else listCellRefs.current.delete(key);
                      }}
                      className="pm-list-cost-input"
                      style={
                        isListCostChanged(product)
                          ? changedInputStyle
                          : undefined
                      }
                      inputMode="decimal"
                      aria-label={`${product.code} 대표 매입단가`}
                      value={listCostDrafts[product.id] ?? String(product.cost ?? "")}
                      placeholder="-"
                      disabled={savingListCostId === product.id}
                      onChange={(event) =>
                        setListCostDrafts((current) => ({
                          ...current,
                          [product.id]: normalizeOneDecimal(event.target.value),
                        }))
                      }
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          void saveListCost(product);
                          return;
                        }
                        handleListCellArrows(event, product.id, "cost");
                      }}
                    />
                  ) : (
                    <strong>***</strong>
                  )}
                </div>
                <div className="pm-product-cell">
                  <span className="pm-column-label">판매단가</span>
                  <input
                    ref={(element) => {
                      const key = `${product.id}-price`;
                      if (element) listCellRefs.current.set(key, element);
                      else listCellRefs.current.delete(key);
                    }}
                    className="pm-list-cost-input"
                    style={
                      isListPriceChanged(product)
                        ? changedInputStyle
                        : undefined
                    }
                    inputMode="decimal"
                    aria-label={`${product.code} 판매단가`}
                    value={listPriceDrafts[product.id] ?? String(product.price ?? "")}
                    placeholder="-"
                    disabled={
                      savingListSupplierId === product.id ||
                      savingListCostId === product.id
                    }
                    onChange={(event) =>
                      setListPriceDrafts((current) => ({
                        ...current,
                        [product.id]: normalizeOneDecimal(event.target.value),
                      }))
                    }
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        void saveListFieldsAndEdit(product);
                        return;
                      }
                      handleListCellArrows(event, product.id, "price");
                    }}
                  />
                </div>
                <div className="pm-row-actions">
                  <button type="button" onClick={() => openProductDetail(product)} style={skuButtonStyle}>상세</button>
                  <button
                    type="button"
                    onClick={() => void saveListFieldsAndEdit(product)}
                    style={editButtonStyle}
                  >
                    수정
                  </button>
                  <button type="button" onClick={() => deleteProduct(product)} disabled={deletingId === product.id} style={deleteButtonStyle}>
                    {deletingId === product.id ? "삭제 중" : "삭제"}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {detailProduct && (
        <div className="pm-modal-backdrop" role="presentation" onMouseDown={closeProductDetail}>
          <section className="pm-detail-modal" role="dialog" aria-modal="true" aria-labelledby="product-detail-title" onMouseDown={(event) => event.stopPropagation()}>
            <div className="pm-detail-header">
              <div>
                <span>상품 상세</span>
                <h3 id="product-detail-title">{detailProduct.sourceProductName || detailProduct.name}</h3>
              </div>
              <button type="button" className="pm-modal-close" onClick={closeProductDetail} aria-label="상품 상세 닫기">×</button>
            </div>
            <div className="pm-detail-content">
              <div className="pm-detail-hero">
                <div
                  className={`pm-detail-image ${
                    detailImageDragging ? "pm-detail-image-dragging" : ""
                  }`}
                  tabIndex={0}
                  onPaste={handleDetailImagePaste}
                  onDragEnter={(event) => {
                    event.preventDefault();
                    if (!uploadingImage) setDetailImageDragging(true);
                  }}
                  onDragOver={(event) => {
                    event.preventDefault();
                    event.dataTransfer.dropEffect = "copy";
                    if (!uploadingImage) setDetailImageDragging(true);
                  }}
                  onDragLeave={(event) => {
                    event.preventDefault();
                    const nextTarget = event.relatedTarget as Node | null;
                    if (
                      !nextTarget ||
                      !event.currentTarget.contains(nextTarget)
                    ) {
                      setDetailImageDragging(false);
                    }
                  }}
                  onDrop={(event) => {
                    event.preventDefault();
                    setDetailImageDragging(false);
                    const file = event.dataTransfer.files?.[0];
                    if (file && !uploadingImage) {
                      void selectDetailImage(file);
                    }
                  }}
                >
                  {detailImageDraft ? (
                    <img
                      src={detailImageDraft}
                      alt={detailProduct.sourceProductName || detailProduct.name}
                    />
                  ) : (
                    <div className="pm-detail-image-empty">
                      <strong>이미지 없음</strong>
                      <span>사진을 끌어 놓으세요</span>
                      <span>또는 캡처 후 Ctrl+V로 붙여넣기</span>
                    </div>
                  )}
                  {uploadingImage && (
                    <div className="pm-detail-image-overlay">업로드 중...</div>
                  )}
                </div>
                <div className="pm-detail-image-actions">
                  <label>
                    {uploadingImage ? "업로드 중..." : "이미지 선택"}
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/gif"
                      disabled={uploadingImage || savingDetailImage}
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (file) void selectDetailImage(file);
                        event.target.value = "";
                      }}
                    />
                  </label>
                  <button
                    type="button"
                    disabled={
                      uploadingImage ||
                      savingDetailImage ||
                      detailImageDraft === (detailProduct.imageUrl || "")
                    }
                    onClick={() => void saveDetailImage()}
                  >
                    {savingDetailImage ? "저장 중..." : "이미지 저장"}
                  </button>
                  {detailImageDraft && (
                    <button
                      type="button"
                      className="pm-detail-image-delete"
                      disabled={uploadingImage || savingDetailImage}
                      onClick={() => {
                        if (
                          window.confirm(
                            "등록된 상품 이미지를 삭제하시겠습니까?"
                          )
                        ) {
                          void saveDetailImage("");
                        }
                      }}
                    >
                      이미지 삭제
                    </button>
                  )}
                </div>
                {detailImageDraft !== (detailProduct.imageUrl || "") && (
                  <div className="pm-detail-image-unsaved">
                    저장되지 않은 이미지입니다.
                  </div>
                )}
                <div className="pm-detail-highlights">
                  <div><span>색상</span><strong>{detailProduct.colors || "-"}</strong></div>
                  <div><span>사이즈</span><strong>{detailProduct.sizes || "-"}</strong></div>
                </div>
              </div>
              <dl className="pm-detail-grid">
                <div><dt>상품코드</dt><dd>{detailProduct.code}</dd></div>
                <div><dt>상품명</dt><dd>{detailProduct.name || "-"}</dd></div>
                <div><dt>공급업체 1 / 매입단가 1</dt><dd>{detailProduct.supplier?.name || detailProduct.supplier?.code || "-"} / {isAdmin && detailProduct.cost != null ? detailProduct.cost.toLocaleString() : isAdmin ? "-" : "***"}</dd></div>
                {(detailProduct.supplier2 || detailProduct.cost2 != null) && <div><dt>공급업체 2 / 매입단가 2</dt><dd>{detailProduct.supplier2?.name || detailProduct.supplier2?.code || "-"} / {isAdmin && detailProduct.cost2 != null ? detailProduct.cost2.toLocaleString() : isAdmin ? "-" : "***"}</dd></div>}
                {(detailProduct.supplier3 || detailProduct.cost3 != null) && <div><dt>공급업체 3 / 매입단가 3</dt><dd>{detailProduct.supplier3?.name || detailProduct.supplier3?.code || "-"} / {isAdmin && detailProduct.cost3 != null ? detailProduct.cost3.toLocaleString() : isAdmin ? "-" : "***"}</dd></div>}
                <div><dt>판매가</dt><dd>{detailProduct.price != null ? detailProduct.price.toLocaleString() : "-"}</dd></div>
                <div><dt>게시글</dt><dd>{detailProduct.bandPostId || detailProduct.sourceProductName || "-"}</dd></div>
                <div className="pm-detail-wide"><dt>밴드 원본 게시글 주소</dt><dd>{detailProduct.bandPostUrl ? <a href={detailProduct.bandPostUrl} target="_blank" rel="noreferrer">{detailProduct.bandPostUrl}</a> : "-"}</dd></div>
                <div><dt>네이버 밴드에서 가져온 상품</dt><dd>{detailProduct.isBandImported ? "예" : "아니오"}</dd></div>
              </dl>
            </div>
            <div className="pm-detail-footer"><button type="button" onClick={closeProductDetail}>닫기</button></div>
          </section>
        </div>
      )}
    </div>
  );
}

function SupplierSearchSelect({
  label,
  suppliers,
  value,
  onChange,
}: {
  label: string;
  suppliers: Supplier[];
  value: string;
  onChange: (value: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const isTypingRef = useRef(false);

  useEffect(() => {
    if (isTypingRef.current) {
      isTypingRef.current = false;
      return;
    }
    const selected = suppliers.find((supplier) => String(supplier.id) === value);
    // Keep the visible label synchronized with form reset, edit, and auto-detection.
    setQuery(selected?.code ?? "");
  }, [suppliers, value]);

  const filteredSuppliers = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    const matches = keyword
      ? suppliers.filter(
          (supplier) =>
            supplier.code.toLowerCase().includes(keyword) ||
            supplier.name.toLowerCase().includes(keyword)
        )
      : suppliers;
    return matches.slice(0, 30);
  }, [query, suppliers]);

  function selectSupplier(supplier: Supplier) {
    setQuery(supplier.code);
    onChange(String(supplier.id));
    setIsOpen(false);
    setActiveIndex(-1);
  }

  function handleInput(nextQuery: string) {
    setQuery(nextQuery);
    isTypingRef.current = true;
    onChange("");
    setActiveIndex(-1);
    setIsOpen(true);
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setIsOpen(true);
      setActiveIndex((current) =>
        Math.min(current + 1, filteredSuppliers.length - 1)
      );
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((current) => Math.max(current - 1, 0));
    } else if (event.key === "Enter" && isOpen) {
      event.preventDefault();
      const supplier = filteredSuppliers[Math.max(activeIndex, 0)];
      if (supplier) selectSupplier(supplier);
    } else if (event.key === "Escape") {
      setIsOpen(false);
    }
  }

  return (
    <label style={{ ...fieldStyle, position: "relative" }}>
      <span style={fieldLabelStyle}>{label}</span>
      <div style={supplierSearchBoxStyle}>
        <input
          value={query}
          onChange={(event) => handleInput(event.target.value)}
          onFocus={() => setIsOpen(true)}
          onBlur={() => window.setTimeout(() => setIsOpen(false), 120)}
          onKeyDown={handleKeyDown}
          placeholder="공급업체 코드 또는 업체명 검색"
          autoComplete="off"
          style={supplierSearchInputStyle}
        />
        <button
          type="button"
          aria-label={`${label} 목록 열기`}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => setIsOpen((current) => !current)}
          style={supplierSearchToggleStyle}
        >
          ▼
        </button>
      </div>
      {isOpen && (
        <div style={supplierDropdownStyle}>
          {filteredSuppliers.length === 0 ? (
            <div style={supplierEmptyStyle}>검색 결과가 없습니다.</div>
          ) : (
            filteredSuppliers.map((supplier, index) => (
              <button
                key={supplier.id}
                type="button"
                onMouseDown={(event) => {
                  event.preventDefault();
                  selectSupplier(supplier);
                }}
                onMouseEnter={() => setActiveIndex(index)}
                style={{
                  ...supplierOptionStyle,
                  backgroundColor: index === activeIndex ? "#eff6ff" : "white",
                }}
              >
                <strong>{supplier.code}</strong>
              </button>
            ))
          )}
        </div>
      )}
    </label>
  );
}

function Field({
  id,
  label,
  value,
  onChange,
  placeholder,
  inputMode,
  inputRef,
}: {
  id?: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  inputRef?: React.Ref<HTMLInputElement>;
}) {
  return (
    <label style={fieldStyle}>
      <span style={fieldLabelStyle}>{label}</span>
      <input
        ref={inputRef}
        id={id}
        value={value}
        onChange={(event) =>
          onChange(event.target.value)
        }
        placeholder={placeholder}
        inputMode={inputMode}
        style={inputStyle}
      />
    </label>
  );
}

function Info({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div style={infoStyle}>
      <span style={infoLabelStyle}>{label}</span>
      <strong style={infoValueStyle}>{value}</strong>
    </div>
  );
}

const pageStyle: React.CSSProperties = {
  width: "100%",
  maxWidth: "936px",
  margin: "0",
  paddingBottom: "32px",
};

const topRowStyle: React.CSSProperties = {
  display: "block",
  width: "100%",
  marginBottom: "14px",
};

const titleActionRowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "12px",
  flexWrap: "nowrap",
  width: "100%",
};

const titleLeftGroupStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "9px",
  minWidth: 0,
};

const excelActionGroupStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "flex-end",
  alignItems: "center",
  gap: "8px",
  marginLeft: "auto",
};

const titleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: "22px",
  fontWeight: 800,
  color: "#111827",
};

const subtitleStyle: React.CSSProperties = {
  margin: "5px 0 0",
  color: "#64748b",
  fontSize: "12px",
};

const primaryButtonStyle: React.CSSProperties = {
  height: "36px",
  minWidth: "90px",
  padding: "0 16px",
  border: "none",
  borderRadius: "8px",
  backgroundColor: "#2563eb",
  color: "white",
  fontSize: "12px",
  fontWeight: 800,
  cursor: "pointer",
  whiteSpace: "nowrap",
  flexShrink: 0,
};

const formCardStyle: React.CSSProperties = {
  width: "100%",
  maxWidth: "674px",
  padding: "15px",
  marginBottom: "20px",
  border: "1px solid #e5e7eb",
  borderRadius: "14px",
  backgroundColor: "white",
  boxShadow: "0 2px 10px rgba(15, 23, 42, 0.05)",
  boxSizing: "border-box",
};

const formHeaderStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: "18px",
  marginBottom: "10px",
};

const formSubmitRowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "flex-end",
  marginTop: "8px",
};

const formHelpStyle: React.CSSProperties = {
  margin: "6px 0 0",
  color: "#6b7280",
  fontSize: "10px",
};

const bandPasteBoxStyle: React.CSSProperties = {
  margin: "0",
  padding: "6px",
  border: "2px dashed #2563eb",
  borderRadius: "8px",
  background: "#eff6ff",
};

const bandPasteTitleStyle: React.CSSProperties = {
    fontSize: "11px",
    fontWeight: 700,
    color: "#1e3a8a",
    marginBottom: "4px",
};



const bandPasteTextareaStyle: React.CSSProperties = {
  width: "100%",
  height: "165px",
  minHeight: "165px",
  resize: "none",
  boxSizing: "border-box",
  padding: "8px",
  border: "1px solid #93c5fd",
  borderRadius: "8px",
  background: "#ffffff",
  fontSize: "11px",
  lineHeight: 1.4,
  outline: "none",
};

const bandMetaStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "6px",
  width: "100%",
  marginTop: "2px",
};

const bandCheckStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "row",
  alignItems: "center",
  gap: "6px",
  minHeight: "32px",
  padding: "5px 7px",
  border: "1px solid #e2e8f0",
  borderRadius: "7px",
  background: "#f8fafc",
  boxSizing: "border-box",
  fontSize: "10px",
  fontWeight: 700,
};



const formContentStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "158px minmax(0, 1fr)",
  gap: "10px",
  alignItems: "start",
};

const imageEditorStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "6px",
};

const imagePreviewBoxStyle: React.CSSProperties = {
  width: "100%",
  aspectRatio: "1 / 1",
  position: "relative",
  overflow: "hidden",
  border: "1px solid #d1d5db",
  borderRadius: "12px",
  backgroundColor: "#f8fafc",
};

const imagePreviewBoxDraggingStyle: React.CSSProperties = {
  border: "2px dashed #2563eb",
  backgroundColor: "#eff6ff",
  boxShadow: "0 0 0 4px rgba(37, 99, 235, 0.12)",
};

const imagePreviewStyle: React.CSSProperties = {
  width: "100%",
  height: "100%",
  objectFit: "cover",
};

const dropOverlayStyle: React.CSSProperties = {
  position: "absolute",
  inset: 0,
  zIndex: 3,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: "8px",
  padding: "16px",
  backgroundColor: "rgba(239, 246, 255, 0.96)",
  color: "#1d4ed8",
  fontSize: "13px",
  fontWeight: 900,
  textAlign: "center",
  pointerEvents: "none",
};

const uploadOverlayStyle: React.CSSProperties = {
  position: "absolute",
  inset: 0,
  zIndex: 4,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  backgroundColor: "rgba(255, 255, 255, 0.84)",
  color: "#1d4ed8",
  fontSize: "14px",
  fontWeight: 900,
  pointerEvents: "none",
};

const emptyImageStyle: React.CSSProperties = {
  width: "100%",
  height: "100%",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: "8px",
  color: "#94a3b8",
  fontSize: "13px",
};

const uploadLabelStyle: React.CSSProperties = {
  padding: "10px 12px",
  textAlign: "center",
  borderRadius: "7px",
  backgroundColor: "#2563eb",
  color: "white",
  fontWeight: "bold",
  cursor: "pointer",
};

const removeImageButtonStyle: React.CSSProperties = {
  padding: "9px 12px",
  border: "1px solid #fecaca",
  borderRadius: "7px",
  backgroundColor: "#fff",
  color: "#b91c1c",
  cursor: "pointer",
  fontWeight: "bold",
};

const imageHelpStyle: React.CSSProperties = {
  color: "#94a3b8",
  fontSize: "10px",
  textAlign: "center",
};

const compactTopGridStyle: React.CSSProperties = {
  gridColumn: "1 / -1",
  display: "grid",
  gridTemplateColumns: "minmax(0, 0.72fr) minmax(0, 0.72fr) minmax(0, 1.7fr)",
  gap: "6px",
};

const supplierCostGridStyle: React.CSSProperties = {
  gridColumn: "1 / -1",
  display: "grid",
  gridTemplateColumns: "minmax(0, 1.65fr) minmax(0, 0.75fr) minmax(0, 0.75fr)",
  gap: "6px",
};

const priceGridStyle: React.CSSProperties = {
  gridColumn: "1 / -1",
  display: "grid",
  gridTemplateColumns: "minmax(0, 1.65fr) minmax(0, 0.75fr) minmax(0, 0.75fr)",
  gap: "6px",
};

const formGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: "6px",
  minWidth: 0,
};

const fieldStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "3px",
};

const fieldLabelStyle: React.CSSProperties = {
  fontSize: "10px",
  fontWeight: 700,
  color: "#475569",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  minHeight: "34px",
  padding: "6px 9px",
  border: "1px solid #d1d5db",
  borderRadius: "7px",
  boxSizing: "border-box",
  minWidth: 0,
  fontSize: "11px",
};

const supplierSearchBoxStyle: React.CSSProperties = {
  display: "flex",
  width: "100%",
  minHeight: "34px",
  border: "1px solid #2563eb",
  borderRadius: "7px",
  overflow: "hidden",
  backgroundColor: "white",
  boxSizing: "border-box",
};

const supplierSearchInputStyle: React.CSSProperties = {
  flex: 1,
  minWidth: 0,
  padding: "6px 9px",
  border: "none",
  outline: "none",
  fontSize: "11px",
};

const supplierSearchToggleStyle: React.CSSProperties = {
  width: "38px",
  flex: "0 0 38px",
  border: "none",
  borderLeft: "1px solid #bfdbfe",
  backgroundColor: "#eff6ff",
  color: "#1d4ed8",
  cursor: "pointer",
};

const supplierDropdownStyle: React.CSSProperties = {
  position: "absolute",
  top: "calc(100% + 4px)",
  left: 0,
  right: 0,
  zIndex: 50,
  maxHeight: "230px",
  overflowY: "auto",
  border: "1px solid #d1d5db",
  borderRadius: "7px",
  backgroundColor: "white",
  boxShadow: "0 10px 24px rgba(15, 23, 42, 0.14)",
};

const supplierOptionStyle: React.CSSProperties = {
  display: "flex",
  width: "100%",
  gap: "8px",
  padding: "8px 10px",
  border: "none",
  borderBottom: "1px solid #f1f5f9",
  color: "#111827",
  fontSize: "11px",
  textAlign: "left",
  cursor: "pointer",
};

const supplierEmptyStyle: React.CSSProperties = {
  padding: "10px",
  color: "#6b7280",
  fontSize: "11px",
};

const formFooterStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "flex-end",
  gap: "10px",
  marginTop: "18px",
};

const saveButtonStyle: React.CSSProperties = {
  minWidth: "160px",
  padding: "11px 18px",
  border: "none",
  borderRadius: "8px",
  backgroundColor: "#111827",
  color: "white",
  fontWeight: "bold",
  cursor: "pointer",
};

const secondaryButtonStyle: React.CSSProperties = {
  height: "36px",
  minWidth: "100px",
  padding: "0 16px",
  border: "1px solid #d1d5db",
  borderRadius: "8px",
  backgroundColor: "white",
  cursor: "pointer",
  fontSize: "12px",
  fontWeight: 800,
  whiteSpace: "nowrap",
  flexShrink: 0,
};

const toolbarStyle: React.CSSProperties = {
  width: "100%",
  maxWidth: "936px",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "8px",
  marginBottom: "8px",
  padding: "8px 9px",
  border: "1px solid #e5e7eb",
  borderRadius: "12px",
  backgroundColor: "white",
};

const searchTypeStyle: React.CSSProperties = {
  height: 32, minWidth: 82, padding: "0 25px 0 9px", border: "1px solid #cbd5e1", borderRadius: 7, background: "#fff", fontWeight: 700, color: "#334155", cursor: "pointer", fontSize: "12px",
};

const searchInputStyle: React.CSSProperties = {
  width: "360px",
  maxWidth: "100%",
  padding: "7px 10px",
  border: "1px solid #cbd5e1",
  borderRadius: "8px",
  fontSize: "12px",
};

const countTextStyle: React.CSSProperties = {
  color: "#334155",
  fontSize: "12px",
  fontWeight: 700,
};

const emptyListStyle: React.CSSProperties = {
  padding: "50px",
  textAlign: "center",
  color: "#64748b",
  border: "1px solid #e5e7eb",
  borderRadius: "12px",
  backgroundColor: "white",
};

const productListStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr)",
  gap: "3px",
  maxHeight: "700px",
  overflowX: "auto",
  overflowY: "auto",
  scrollbarGutter: "stable",
  overscrollBehavior: "contain",
  paddingRight: "3px",
};

const productCardStyle: React.CSSProperties = {
  overflow: "hidden",
  border: "1px solid #dbe1e8",
  borderRadius: "7px",
  backgroundColor: "white",
  boxShadow: "0 1px 4px rgba(15, 23, 42, 0.03)",
  minWidth: 0,
};

const productMainRowStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns:
    "62px minmax(76px, 1.2fr) 74px 82px minmax(0, 1fr) 44px",
  gap: "8px",
  padding: "7px 8px",
  alignItems: "center",
  minHeight: "82px",
  boxSizing: "border-box",
};

const productImageBoxStyle: React.CSSProperties = {
  width: "58px",
  height: "58px",
  border: "1px solid #e2e8f0",
  borderRadius: "8px",
  backgroundColor: "#f8fafc",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  overflow: "hidden",
  justifySelf: "start",
  alignSelf: "center",
};

const productImageStyle: React.CSSProperties = {
  width: "100%",
  height: "100%",
  objectFit: "contain",
  backgroundColor: "white",
};

const noImageStyle: React.CSSProperties = {
  width: "100%",
  height: "100%",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: "5px",
  color: "#94a3b8",
  fontSize: "11px",
};

const productInfoStyle: React.CSSProperties = {
  minWidth: 0,
  alignSelf: "center",
};

const productTitleRowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: "16px",
  marginBottom: "13px",
};

const productCodeStyle: React.CSSProperties = {
  fontSize: "12px",
  fontWeight: 800,
  color: "#111827",
  marginBottom: "6px",
};

const productNameStyle: React.CSSProperties = {
  fontSize: "15px",
  fontWeight: 800,
  color: "#0f172a",
  lineHeight: 1.3,
  wordBreak: "keep-all",
  overflowWrap: "anywhere",
};

const priceStyle: React.CSSProperties = {
  fontSize: "26px",
  fontWeight: 900,
  color: "#111827",
  whiteSpace: "nowrap",
};

const metaGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(5, minmax(60px, 1fr))",
  gap: "8px",
  marginTop: "6px",
  alignItems: "center",
};

const infoStyle: React.CSSProperties = {
  minWidth: 0,
  padding: "6px 0",
};

const infoLabelStyle: React.CSSProperties = {
  display: "block",
  marginBottom: "4px",
  color: "#64748b",
  fontSize: "14px",
};

const infoValueStyle: React.CSSProperties = {
  display: "block",
  color: "#1f2937",
  fontSize: "16px",
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

const summaryBoxStyle: React.CSSProperties = {
  padding: "0 8px",
  borderLeft: "1px solid #e2e8f0",
  borderRight: "1px solid #e2e8f0",
  alignSelf: "stretch",
  display: "flex",
  flexDirection: "column",
  justifyContent: "center",
};

const summaryPriceStyle: React.CSSProperties = {
  fontSize: "28px",
  fontWeight: 900,
  color: "#111827",
  marginBottom: "12px",
};

const summaryLineStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: "8px",
  marginTop: "6px",
  color: "#64748b",
  fontSize: "12px",
};

const actionBoxStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr",
  gap: "4px",
  justifySelf: "end",
  alignContent: "center",
  alignSelf: "center",
};

const skuButtonStyle: React.CSSProperties = {
  width: "44px",
  height: "28px",
  padding: "0 6px",
  border: "1px solid #cbd5e1",
  borderRadius: "6px",
  backgroundColor: "white",
  color: "#111827",
  cursor: "pointer",
  fontSize: "11px",
  fontWeight: 800,
  lineHeight: "26px",
  whiteSpace: "nowrap",
};

const editButtonStyle: React.CSSProperties = {
  width: "44px",
  height: "28px",
  padding: "0 6px",
  border: "1px solid #2563eb",
  borderRadius: "6px",
  backgroundColor: "#2563eb",
  color: "#ffffff",
  cursor: "pointer",
  fontSize: "11px",
  fontWeight: 800,
  lineHeight: "26px",
  whiteSpace: "nowrap",
};

const deleteButtonStyle: React.CSSProperties = {
  width: "44px",
  height: "28px",
  padding: "0 6px",
  border: "none",
  borderRadius: "6px",
  backgroundColor: "#ef4444",
  color: "white",
  cursor: "pointer",
  fontSize: "11px",
  fontWeight: 800,
  lineHeight: "28px",
  whiteSpace: "nowrap",
};


const skuPanelStyle: React.CSSProperties = {
  padding: "14px 16px 16px",
  borderTop: "1px solid #e5e7eb",
  backgroundColor: "#f8fafc",
};

const skuPanelTitleStyle: React.CSSProperties = {
  marginBottom: "10px",
  fontSize: "14px",
  fontWeight: 800,
  color: "#334155",
};

const skuGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
  gap: "10px",
  alignItems: "stretch",
};

const skuCardStyle: React.CSSProperties = {
  padding: "12px",
  border: "1px solid #e2e8f0",
  borderRadius: "9px",
  backgroundColor: "white",
};

const skuCodeStyle: React.CSSProperties = {
  fontWeight: 800,
  fontSize: "13px",
  color: "#0f172a",
};

const skuMetaStyle: React.CSSProperties = {
  marginTop: "4px",
  color: "#64748b",
  fontSize: "12px",
};

const stockStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: "10px",
  marginTop: "10px",
  paddingTop: "9px",
  borderTop: "1px solid #e2e8f0",
  fontSize: "13px",
  color: "#475569",
};

const filterSelectStyle: React.CSSProperties = {
  minWidth: "140px",
  padding: "12px 13px",
  border: "1px solid #cbd5e1",
  borderRadius: "8px",
  backgroundColor: "white",
  fontSize: "14px",
  fontWeight: 700,
  color: "#334155",
};



const supplierNameStyle: React.CSSProperties = {
  marginTop: "5px",
  color: "#64748b",
  fontSize: "11px",
  fontWeight: 700,
};

const skuEmptyStyle: React.CSSProperties = {
  padding: "20px",
  textAlign: "center",
  color: "#94a3b8",
};
