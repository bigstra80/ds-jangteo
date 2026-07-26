"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";

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
};

function cleanBandLine(value: string) {
  return value
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/^[\s✔️✅☑️•·▪︎◾◼︎■◆◇▶▷➤➜⛳️-]+/, "")
    .trim();
}

function normalizeProductCode(value: string) {
  return value.toUpperCase().replace(/\s+/g, "").trim();
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

  const code = normalizeProductCode(codeCandidates[0].match?.[1] || "");
  const additionalCode = normalizeProductCode(codeCandidates[1]?.match?.[1] || "");

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

    sourceProductName = line;
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

  if (!sourceProductName) return null;

  return {
    code,
    additionalCode,
    sourceProductName,
    colors,
    sizes,
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
  cost3: string;
  price: string;
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
  cost3: "",
  price: "",
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

export default function ProductManager() {
  const [products, setProducts] = useState<Product[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [form, setForm] = useState<ProductForm>(emptyForm);
  const [bandPostText, setBandPostText] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showProductForm, setShowProductForm] = useState(false);
  const [openedProductIds, setOpenedProductIds] = useState<number[]>([]);
  const [openedMobileProductIds, setOpenedMobileProductIds] = useState<number[]>([]);
  const [search, setSearch] = useState("");
  const [searchField, setSearchField] = useState("all");
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [isDraggingImage, setIsDraggingImage] = useState(false);
  const [uploadingProductImageId, setUploadingProductImageId] = useState<number | null>(null);
  const [focusedProductImageId, setFocusedProductImageId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [inlineSupplierDrafts, setInlineSupplierDrafts] = useState<Record<number, string>>({});
  const [inlineCostDrafts, setInlineCostDrafts] = useState<Record<number, string>>({});
  const [inlineSavingId, setInlineSavingId] = useState<number | null>(null);
  const [importingExcel, setImportingExcel] = useState(false);
  const excelInputRef = useRef<HTMLInputElement | null>(null);

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
    const rows = products.length
      ? products.map((product) => ({
          상품코드: product.code,
          상품명: product.name,
          공급업체: product.supplier?.name || "",
          단가: product.cost ?? "",
          색상: product.colors || "",
          사이즈: product.sizes || "",
          판매가: product.price ?? "",
          브랜드: product.brand || "",
          카테고리: product.category || "",
          이미지URL: product.imageUrl || "",
          상품유형: product.productType === "BROKER" ? "중도매" : "직접",
        }))
      : [
          {
            상품코드: "A0001",
            상품명: "예시 상품",
            공급업체: "예시 공급업체",
            단가: 1.5,
            색상: "블랙,화이트",
            사이즈: "M,L,XL",
            판매가: "",
            브랜드: "",
            카테고리: "",
            이미지URL: "",
            상품유형: "직접",
          },
        ];

    const guideRows = [
      { 항목: "필수", 설명: "상품코드, 상품명" },
      { 항목: "선택 항목", 설명: "공급업체, 단가, 색상, 사이즈 등 나머지 컬럼은 없어도 등록됩니다." },
      { 항목: "기본값", 설명: "공급업체·색상·사이즈는 빈칸, 단가는 0으로 등록되며 상품관리에서 수정할 수 있습니다." },
      { 항목: "공급업체", 설명: "기존 업체명 또는 업체코드를 입력합니다. 없는 업체는 자동 등록됩니다." },
      { 항목: "상품유형", 설명: "직접 또는 중도매를 입력합니다. 비워두면 직접으로 등록됩니다." },
      { 항목: "재업로드", 설명: "같은 상품코드가 있으면 해당 상품을 수정하고, 없으면 새 상품으로 등록합니다." },
    ];

    const workbook = XLSX.utils.book_new();
    const productSheet = XLSX.utils.json_to_sheet(rows);
    const guideSheet = XLSX.utils.json_to_sheet(guideRows);
    productSheet["!cols"] = [
      { wch: 16 }, { wch: 30 }, { wch: 18 }, { wch: 10 }, { wch: 22 },
      { wch: 22 }, { wch: 10 }, { wch: 16 }, { wch: 16 }, { wch: 40 }, { wch: 12 },
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
    loadProducts();
    loadSuppliers();
    loadCurrentUser();
  }, []);

  const filteredProducts = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    return products.filter((product) => {

      if (!keyword) return true;

      const fields: Record<string, unknown[]> = {
        all: [product.code, product.name, product.brand, product.category, product.colors, product.sizes, product.sourceProductName, product.supplier?.name, product.supplier2?.name, product.supplier3?.name],
        code: [product.code], name: [product.name, product.sourceProductName], supplier: [product.supplier?.name, product.supplier2?.name, product.supplier3?.name], brand: [product.brand], category: [product.category],
      };
      return (fields[searchField] || fields.all).some((value) => String(value || "").toLowerCase().includes(keyword));
    });
  }, [products, search, searchField]);

  function resetForm() {
    setForm(emptyForm);
    setBandPostText("");
    setEditingId(null);
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
      cost3: String(product.cost3 || ""),
      price: String(product.price || ""),
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

  function handleImageDrop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    event.stopPropagation();
    setIsDraggingImage(false);

    if (uploadingImage) return;

    const file = event.dataTransfer.files?.[0];
    if (!file || !isSupportedImage(file)) return;

    void uploadImage(file);
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
    }));

    if (showMessage) {
      alert("밴드 게시글에서 상품정보를 자동으로 입력했습니다.");
    }

    return true;
  }

  function handleSmartPaste(event: React.ClipboardEvent<HTMLFormElement>) {
    if (uploadingImage) return;

    const imageItem = Array.from(event.clipboardData.items).find((item) =>
      item.type.startsWith("image/")
    );

    if (imageItem) {
      const file = imageItem.getAsFile();
      if (!file || !isSupportedImage(file)) return;

      event.preventDefault();
      void uploadImage(file);
      return;
    }

    const pastedText = event.clipboardData.getData("text/plain");
    if (!pastedText || !pastedText.includes("\n")) return;

    if (applyBandPostText(pastedText)) {
      event.preventDefault();
    }
  }

  async function uploadImage(file: File) {
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

      updateForm("imageUrl", result.url);
    } catch (error) {
      console.error(error);
      alert("이미지 업로드 중 오류가 발생했습니다.");
    } finally {
      setUploadingImage(false);
    }
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
        // 상품과 상품명은 서로 독립적으로 저장합니다.
        // 상품을 입력해도 상품명에는 자동으로 복사하지 않습니다.
        name: form.name.trim(),
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
            cost2: "",
            cost3: "",
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

  async function saveInlineProduct(
    product: Product,
    changes: {
      supplierName?: string;
      cost?: string;
      imageUrl?: string;
    }
  ) {
    try {
      setInlineSavingId(product.id);

      let supplierId = product.supplierId;

      if (changes.supplierName !== undefined) {
        const supplierName = changes.supplierName.trim();

        if (!supplierName) {
          supplierId = null;
        } else {
          let matchedSupplier = suppliers.find(
            (supplier) =>
              supplier.name.trim().toLowerCase() === supplierName.toLowerCase() ||
              supplier.code.trim().toLowerCase() === supplierName.toLowerCase()
          );

          if (!matchedSupplier) {
            const createResponse = await fetch("/api/suppliers", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                code: supplierName,
                name: supplierName,
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

            const createdSupplier = await createResponse.json();

            if (!createResponse.ok) {
              throw new Error(
                createdSupplier.message || "공급업체 저장에 실패했습니다."
              );
            }

            matchedSupplier = createdSupplier;
            await loadSuppliers();
          }

          supplierId = matchedSupplier?.id ?? null;
        }
      }

      const nextCost =
        changes.cost !== undefined
          ? Number(String(changes.cost).replace(/,/g, "").trim() || 0)
          : Number(product.cost || 0);

      if (Number.isNaN(nextCost)) {
        throw new Error("단가는 숫자로 입력해주세요.");
      }

      const response = await fetch("/api/product", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: product.id,
          code: product.code,
          name: product.name,
          brand: product.brand || "",
          category: product.category || "",
          colors: product.colors || "",
          sizes: product.sizes || "",
          cost: nextCost,
          cost2: Number(product.cost2 || 0),
          cost3: Number(product.cost3 || 0),
          price: Number(product.price || 0),
          imageUrl:
            changes.imageUrl !== undefined
              ? changes.imageUrl
              : product.imageUrl || "",
          productType: product.productType,
          supplierId,
          supplier2Id: product.supplier2Id,
          supplier3Id: product.supplier3Id,
          sourceProductName: product.sourceProductName || "",
          bandPostId: product.bandPostId || "",
          bandPostUrl: product.bandPostUrl || "",
          isBandImported: product.isBandImported,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "상품 저장에 실패했습니다.");
      }

      setInlineSupplierDrafts((current) => {
        const next = { ...current };
        delete next[product.id];
        return next;
      });

      setInlineCostDrafts((current) => {
        const next = { ...current };
        delete next[product.id];
        return next;
      });

      await loadProducts();
    } catch (error) {
      console.error(error);
      alert(error instanceof Error ? error.message : "저장 중 오류가 발생했습니다.");
      await loadProducts();
    } finally {
      setInlineSavingId(null);
    }
  }

  function handleProductImagePaste(
    event: React.ClipboardEvent<HTMLDivElement>,
    product: Product
  ) {
    if (uploadingProductImageId !== null) return;

    const imageItem = Array.from(event.clipboardData.items).find((item) =>
      item.type.startsWith("image/")
    );

    if (!imageItem) return;

    const file = imageItem.getAsFile();
    if (!file || !isSupportedImage(file)) return;

    event.preventDefault();
    void uploadProductImageDirect(product, file);
  }

  function handleProductImageDrop(
    event: React.DragEvent<HTMLDivElement>,
    product: Product
  ) {
    event.preventDefault();
    event.stopPropagation();

    if (uploadingProductImageId !== null) return;

    const file = event.dataTransfer.files?.[0];
    if (!file || !isSupportedImage(file)) return;

    void uploadProductImageDirect(product, file);
  }

  async function uploadProductImageDirect(product: Product, file: File) {
    if (!isSupportedImage(file)) return;

    try {
      setUploadingProductImageId(product.id);

      const formData = new FormData();
      formData.append("file", file);

      const uploadResponse = await fetch("/api/upload/product-image", {
        method: "POST",
        body: formData,
      });
      const uploadResult = await uploadResponse.json();

      if (!uploadResponse.ok) {
        throw new Error(uploadResult.message || "이미지 업로드에 실패했습니다.");
      }

      await saveInlineProduct(product, { imageUrl: uploadResult.url });
    } catch (error) {
      console.error(error);
      alert(error instanceof Error ? error.message : "이미지 등록 중 오류가 발생했습니다.");
    } finally {
      setUploadingProductImageId(null);
    }
  }

  function toggleMobileProduct(productId: number) {
    setOpenedMobileProductIds((current) =>
      current.includes(productId)
        ? current.filter((id) => id !== productId)
        : [...current, productId]
    );
  }

  function toggleSku(productId: number) {
    setOpenedProductIds((current) =>
      current.includes(productId)
        ? current.filter((id) => id !== productId)
        : [...current, productId]
    );
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
            width: 100% !important;
            min-height: 46px !important;
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
.pm-supplier-cost-grid {
  grid-template-columns: minmax(0, 1fr) !important;
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
            gap: 12px !important;
          }

          .pm-product-card {
            width: 100% !important;
            overflow: hidden !important;
            box-sizing: border-box !important;
          }

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
            <h2 style={titleStyle}>👕 상품관리</h2>

            <button
              type="button"
              onClick={openCreateForm}
              style={primaryButtonStyle}
              className="pm-primary-button"
            >
              {showProductForm ? "닫기" : "+ 상품등록"}
            </button>

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

         

          <div style={formContentStyle} className="pm-form-content">
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
               {!editingId && (
            <div style={bandPasteBoxStyle}>
             <div style={bandPasteTitleStyle}>📋 게시글</div>


              <textarea
                value={bandPostText}
                onChange={(event) => {
                  const value = event.target.value;
                  setBandPostText(value);
                  applyBandPostText(value);
                }}
                placeholder=""
                style={bandPasteTextareaStyle}
              />
          
            </div>
          )}
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
                <Field
                  label="상품"
                  value={form.sourceProductName}
                  onChange={(value) => updateForm("sourceProductName", value)}
                  placeholder="상품을 입력하세요"
                />
              </div>

              <div className="pm-supplier-cost-grid" style={supplierCostGridStyle}>
                <label style={fieldStyle}>
                  <span style={fieldLabelStyle}>공급업체 1</span>
                  <select
                    value={form.supplierId}
                    onChange={(event) => changePrimarySupplier(event.target.value)}
                    style={inputStyle}
                  >
                    <option value="">공급업체 선택</option>
                    {suppliers.map((supplier) => (
                      <option key={supplier.id} value={supplier.id}>{supplier.code}</option>
                    ))}
                  </select>
                </label>
                <Field
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

              <label style={fieldStyle}>
                <span style={fieldLabelStyle}>공급업체 2</span>
                <select
                  value={form.supplier2Id}
                  onChange={(event) => updateForm("supplier2Id", event.target.value)}
                  style={inputStyle}
                >
                  <option value="">공급업체 선택</option>
                  {suppliers.map((supplier) => (
                    <option key={supplier.id} value={supplier.id}>
                      {supplier.code}
                    </option>
                  ))}
                </select>
              </label>

              <Field
                label="매입단가 2"
                value={form.cost2}
                onChange={(value) => updateForm("cost2", normalizeOneDecimal(value))}
                placeholder="0"
                inputMode="decimal"
              />

              <label style={fieldStyle}>
                <span style={fieldLabelStyle}>공급업체 3</span>
                <select
                  value={form.supplier3Id}
                  onChange={(event) => updateForm("supplier3Id", event.target.value)}
                  style={inputStyle}
                >
                  <option value="">공급업체 선택</option>
                  {suppliers.map((supplier) => (
                    <option key={supplier.id} value={supplier.id}>
                      {supplier.code}
                    </option>
                  ))}
                </select>
              </label>

              <Field
                label="매입단가 3"
                value={form.cost3}
                onChange={(value) => updateForm("cost3", normalizeOneDecimal(value))}
                placeholder="0"
                inputMode="decimal"
              />

              <Field
                label="상품명"
                value={form.name}
                onChange={(value) => updateForm("name", value)}
                placeholder="상품명"
              />

              <Field
                label="색상"
                value={form.colors}
                onChange={(value) => updateForm("colors", value)}
                placeholder="예: 블랙, 화이트"
              />

              <Field
                label="사이즈"
                value={form.sizes}
                onChange={(value) => updateForm("sizes", value)}
                placeholder="예: 95, 100, 105"
              />

              <Field
                label="판매가"
                value={form.price}
                onChange={(value) => {
                  const cleaned = value
                    .replace(/[^0-9.]/g, "")
                    .replace(/(\..*)\./g, "$1");
                  const [integerPart, decimalPart] = cleaned.split(".");
                  const normalized =
                    decimalPart !== undefined
                      ? `${integerPart}.${decimalPart.slice(0, 1)}`
                      : integerPart;
                  updateForm("price", normalized);
                }}
                placeholder="0"
                inputMode="decimal"
              />

              <Field
                label="밴드 원본 게시글 주소"
                value={form.bandPostUrl}
                onChange={(value) => updateForm("bandPostUrl", value)}
                placeholder="밴드에서 가져오면 자동으로 저장됩니다"
              />

              <label
                style={{
                  ...fieldStyle,
                  gridColumn: "1 / -1",
                  flexDirection: "row",
                  alignItems: "center",
                  gap: "10px",
                  padding: "10px 12px",
                  border: "1px solid #e2e8f0",
                  borderRadius: "8px",
                  background: "#f8fafc",
                }}
              >
                <input
                  type="checkbox"
                  checked={form.isBandImported}
                  onChange={(event) =>
                    updateForm("isBandImported", event.target.checked)
                  }
                />
                <span style={{ fontSize: "13px", fontWeight: 700 }}>
                  네이버 밴드에서 가져온 상품
                </span>
              </label>
            </div>
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
      </div>

      {filteredProducts.length === 0 ? (
        <div style={emptyListStyle}>
          등록된 상품이 없습니다.
        </div>
      ) : (
        <div style={productListStyle} className="pm-product-list">
          {filteredProducts.map((product) => {
            const opened =
              openedProductIds.includes(product.id);
            const mobileOpened =
              openedMobileProductIds.includes(product.id);

            return (
              <div
                key={product.id}
                style={productCardStyle}
                className="pm-product-card"
              >
                <button
                  type="button"
                  className="pm-mobile-product-summary"
                  onClick={() => toggleMobileProduct(product.id)}
                >
                  <div className="pm-mobile-summary-image">
                    {product.imageUrl ? (
                      <img
                        src={product.imageUrl}
                        alt={product.name}
                      />
                    ) : (
                      <div className="pm-mobile-summary-no-image">
                        <span>📦</span>
                        <small>이미지 없음</small>
                      </div>
                    )}
                  </div>

                  <div className="pm-mobile-summary-text">
                    <span className="pm-mobile-summary-code">
                      {product.code}
                    </span>
                    <strong className="pm-mobile-summary-name">
                      {product.name}
                    </strong>
                  </div>

                  <span className="pm-mobile-summary-toggle">
                    {mobileOpened ? "▲" : "▼"}
                  </span>
                </button>

                <div
                  className={
                    mobileOpened
                      ? "pm-mobile-detail-wrap pm-mobile-detail-open"
                      : "pm-mobile-detail-wrap"
                  }
                >
                <div style={productMainRowStyle} className="pm-product-main-row">
                  {/* 상품 이미지 */}
                  <div
                    className="pm-product-image-control"
                    tabIndex={0}
                    title="여기를 클릭한 뒤 Ctrl+V로 이미지를 붙여넣거나, 이미지 파일을 끌어다 놓으세요."
                    onFocus={() => setFocusedProductImageId(product.id)}
                    onBlur={() => setFocusedProductImageId((current) => current === product.id ? null : current)}
                    onPaste={(event) => handleProductImagePaste(event, product)}
                    onDragOver={(event) => {
                      event.preventDefault();
                      event.dataTransfer.dropEffect = "copy";
                    }}
                    onDrop={(event) => handleProductImageDrop(event, product)}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "stretch",
                      gap: "4px",
                      flexShrink: 0,
                      outline: "none",
                      borderRadius: "8px",
                      boxShadow:
                        focusedProductImageId === product.id
                          ? "0 0 0 3px rgba(37, 99, 235, 0.28)"
                          : "none",
                    }}
                  >
                    <div
                      style={{
                        ...productImageBoxStyle,
                        cursor: "default",
                        position: "relative",
                      }}
                      className="pm-product-image-box"
                    >
                      {product.imageUrl ? (
                        <img
                          src={product.imageUrl}
                          alt={product.name}
                          style={productImageStyle}
                        />
                      ) : (
                        <div style={noImageStyle}>
                          <span style={{ fontSize: "28px" }}>📦</span>
                          <span>이미지 없음</span>
                        </div>
                      )}
                      {focusedProductImageId === product.id &&
                        uploadingProductImageId !== product.id && (
                          <div
                            style={{
                              position: "absolute",
                              left: "3px",
                              right: "3px",
                              bottom: "3px",
                              padding: "2px 3px",
                              borderRadius: "4px",
                              background: "rgba(30, 64, 175, 0.88)",
                              color: "#ffffff",
                              fontSize: "9px",
                              fontWeight: 800,
                              lineHeight: 1.2,
                              textAlign: "center",
                              pointerEvents: "none",
                            }}
                          >
                            Ctrl+V 붙여넣기
                          </div>
                        )}
                      {uploadingProductImageId === product.id && (
                        <div
                          style={{
                            position: "absolute",
                            inset: 0,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            background: "rgba(255,255,255,0.86)",
                            fontSize: "11px",
                            fontWeight: 800,
                            borderRadius: "8px",
                          }}
                        >
                          업로드 중...
                        </div>
                      )}
                    </div>

                    <label
                      title="상품 이미지 등록 또는 변경"
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        minHeight: "22px",
                        padding: "2px 5px",
                        border: "1px solid #2563eb",
                        borderRadius: "5px",
                        background: uploadingProductImageId === product.id ? "#93c5fd" : "#2563eb",
                        color: "#ffffff",
                        fontSize: "10px",
                        fontWeight: 800,
                        lineHeight: 1.2,
                        cursor: uploadingProductImageId !== null ? "not-allowed" : "pointer",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {uploadingProductImageId === product.id
                        ? "업로드 중"
                        : product.imageUrl
                          ? "이미지 변경"
                          : "이미지 선택"}
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/gif"
                        disabled={uploadingProductImageId !== null}
                        style={{ display: "none" }}
                        onChange={(event) => {
                          const file = event.target.files?.[0];
                          if (file) uploadProductImageDirect(product, file);
                          event.target.value = "";
                        }}
                      />
                    </label>
                  </div>

                  {/* 상품코드 + 상품명 */}
                  <div className="pm-list-product-name">
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                        flexWrap: "wrap",
                        marginBottom: "5px",
                      }}
                    >
                      <div style={productCodeStyle}>{product.code}</div>
                    </div>
                    <div
                      style={{
                        ...productNameStyle,
                        fontSize:
                          product.name.length >= 24
                            ? "11px"
                            : product.name.length >= 18
                              ? "12px"
                              : product.name.length >= 13
                                ? "13px"
                                : "15px",
                      }}
                      title={product.name}
                    >
                      {product.name}
                    </div>

                  </div>

                  {/* 공급업체 - 직접 입력 */}
                  <div className="pm-inline-field">
                    <span className="pm-list-label">공급업체</span>
                    <input
                      className="pm-inline-input"
                      value={
                        inlineSupplierDrafts[product.id] ??
                        product.supplier?.code ??
                        ""
                      }
                      placeholder="공급업체 입력"
                      disabled={inlineSavingId === product.id}
                      onChange={(event) =>
                        setInlineSupplierDrafts((current) => ({
                          ...current,
                          [product.id]: event.target.value,
                        }))
                      }
                      onBlur={(event) => {
                        const nextValue = event.target.value.trim();
                        const currentValue = product.supplier?.code?.trim() || "";
                        if (nextValue !== currentValue) {
                          void saveInlineProduct(product, {
                            supplierName: nextValue,
                          });
                        }
                      }}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.currentTarget.blur();
                        }
                      }}
                    />
                  </div>

                  {/* 단가 - 직접 입력 */}
                  <div className="pm-inline-field">
                    <span className="pm-list-label">단가</span>
                    <input
                      className="pm-inline-input"
                      inputMode="decimal"
                      value={
                        inlineCostDrafts[product.id] ??
                        String(product.cost || 0)
                      }
                      placeholder="단가 입력"
                      disabled={inlineSavingId === product.id}
                      onChange={(event) =>
                        setInlineCostDrafts((current) => ({
                          ...current,
                          [product.id]: normalizeOneDecimal(event.target.value),
                        }))
                      }
                      onBlur={(event) => {
                        const nextValue = event.target.value.replace(/,/g, "").trim() || "0";
                        const currentValue = String(product.cost || 0);
                        if (nextValue !== currentValue) {
                          void saveInlineProduct(product, {
                            cost: nextValue,
                          });
                        }
                      }}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.currentTarget.blur();
                        }
                      }}
                    />
                  </div>

                  {/* 버튼 */}
                  <div style={actionBoxStyle} className="pm-action-box">
                    <button
                      type="button"
                      onClick={() => toggleSku(product.id)}
                      style={skuButtonStyle}
                    >
                      {opened ? "접기" : "상세"}
                    </button>

                    <button
                      type="button"
                      onClick={() => startEdit(product)}
                      style={editButtonStyle}
                    >
                      수정
                    </button>

                    <button
                      type="button"
                      onClick={() => deleteProduct(product)}
                      disabled={deletingId === product.id}
                      style={deleteButtonStyle}
                    >
                      {deletingId === product.id ? "삭제 중..." : "삭제"}
                    </button>

                  </div>
                </div>

                {opened && (
                  <div className="pm-detail-summary">
                    <div className="pm-detail-summary-item">
                      <span className="pm-detail-summary-label">색상</span>
                      <div className="pm-detail-summary-value">
                        {product.colors || "-"}
                      </div>
                    </div>
                    <div className="pm-detail-summary-item">
                      <span className="pm-detail-summary-label">사이즈</span>
                      <div className="pm-detail-summary-value">
                        {product.sizes || "-"}
                      </div>
                    </div>
                  </div>
                )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  inputMode,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
}) {
  return (
    <label style={fieldStyle}>
      <span style={fieldLabelStyle}>{label}</span>
      <input
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
  maxWidth: "1900px",
  margin: "0",
  paddingBottom: "40px",
};

const topRowStyle: React.CSSProperties = {
  display: "block",
  width: "100%",
  marginBottom: "20px",
};

const titleActionRowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "flex-start",
  gap: "14px",
  flexWrap: "nowrap",
  width: "fit-content",
};

const titleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: "28px",
  fontWeight: 800,
  color: "#111827",
};

const subtitleStyle: React.CSSProperties = {
  margin: "8px 0 0",
  color: "#64748b",
  fontSize: "16px",
};

const primaryButtonStyle: React.CSSProperties = {
  padding: "10px 14px",
  border: "none",
  borderRadius: "8px",
  backgroundColor: "#2563eb",
  color: "white",
  fontSize: "14px",
  fontWeight: 800,
  cursor: "pointer",
  whiteSpace: "nowrap",
  flexShrink: 0,
};

const formCardStyle: React.CSSProperties = {
  width: "100%",
  maxWidth: "1180px",
  padding: "22px",
  marginBottom: "24px",
  border: "1px solid #e5e7eb",
  borderRadius: "14px",
  backgroundColor: "white",
  boxShadow: "0 2px 10px rgba(15, 23, 42, 0.05)",
};

const formHeaderStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: "20px",
  marginBottom: "18px",
};

const formHelpStyle: React.CSSProperties = {
  margin: "6px 0 0",
  color: "#6b7280",
  fontSize: "13px",
};

const bandPasteBoxStyle: React.CSSProperties = {
  margin: "0",
  padding: "6px",
  border: "2px dashed #2563eb",
  borderRadius: "8px",
  background: "#eff6ff",
};

const bandPasteTitleStyle: React.CSSProperties = {
    fontSize: "14px",
    fontWeight: 700,
    color: "#1e3a8a",
    marginBottom: "4px",
};



const bandPasteTextareaStyle: React.CSSProperties = {
  width: "100%",
  minHeight: "70px",
  resize: "none",
  boxSizing: "border-box",
  padding: "8px",
  border: "1px solid #93c5fd",
  borderRadius: "8px",
  background: "#ffffff",
  fontSize: "13px",
  lineHeight: 1.4,
  outline: "none",
};



const formContentStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "220px minmax(0, 1fr)",
  gap: "22px",
  alignItems: "start",
};

const imageEditorStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "10px",
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
  fontSize: "12px",
  textAlign: "center",
};

const compactTopGridStyle: React.CSSProperties = {
  gridColumn: "1 / -1",
  display: "grid",
  gridTemplateColumns: "minmax(150px, 0.72fr) minmax(150px, 0.72fr) minmax(280px, 1.7fr)",
  gap: "14px",
};

const supplierCostGridStyle: React.CSSProperties = {
  gridColumn: "1 / -1",
  display: "grid",
  gridTemplateColumns: "minmax(280px, 1.65fr) minmax(150px, 0.75fr) minmax(150px, 0.75fr)",
  gap: "14px",
};

const formGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: "14px",
};

const fieldStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "6px",
};

const fieldLabelStyle: React.CSSProperties = {
  fontSize: "13px",
  fontWeight: 700,
  color: "#475569",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  minHeight: "42px",
  padding: "10px 12px",
  border: "1px solid #d1d5db",
  borderRadius: "7px",
  boxSizing: "border-box",
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
  padding: "10px 16px",
  border: "1px solid #d1d5db",
  borderRadius: "8px",
  backgroundColor: "white",
  cursor: "pointer",
};

const toolbarStyle: React.CSSProperties = {
  width: "100%",
  maxWidth: "1180px",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "15px",
  marginBottom: "18px",
  padding: "14px 16px",
  border: "1px solid #e5e7eb",
  borderRadius: "12px",
  backgroundColor: "white",
};

const searchTypeStyle: React.CSSProperties = {
  height: 42, minWidth: 96, padding: "0 30px 0 12px", border: "1px solid #cbd5e1", borderRadius: 10, background: "#fff", fontWeight: 700, color: "#334155", cursor: "pointer",
};

const searchInputStyle: React.CSSProperties = {
  width: "460px",
  maxWidth: "100%",
  padding: "13px 15px",
  border: "1px solid #cbd5e1",
  borderRadius: "8px",
  fontSize: "16px",
};

const countTextStyle: React.CSSProperties = {
  color: "#334155",
  fontSize: "16px",
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
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: "12px",
};

const productCardStyle: React.CSSProperties = {
  overflow: "hidden",
  border: "1px solid #dbe1e8",
  borderRadius: "12px",
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
