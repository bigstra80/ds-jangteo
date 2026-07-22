"use client";

import { useEffect, useMemo, useState } from "react";

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

type ProductForm = {
  code: string;
  name: string;
  brand: string;
  category: string;
  colors: string;
  sizes: string;
  cost: string;
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
  name: "",
  brand: "",
  category: "",
  colors: "",
  sizes: "",
  cost: "",
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

export default function ProductManager() {
  const [products, setProducts] = useState<Product[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [form, setForm] = useState<ProductForm>(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showProductForm, setShowProductForm] = useState(false);
  const [openedProductIds, setOpenedProductIds] = useState<number[]>([]);
  const [openedMobileProductIds, setOpenedMobileProductIds] = useState<number[]>([]);
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [forceDeletingId, setForceDeletingId] = useState<number | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [enlargedImage, setEnlargedImage] = useState<{ src: string; alt: string } | null>(null);

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

  useEffect(() => {
    if (!enlargedImage) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setEnlargedImage(null);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [enlargedImage]);

  const filteredProducts = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    return products.filter((product) => {

      if (!keyword) return true;

      const text = [
        product.code,
        product.name,
        product.brand,
        product.category,
        product.colors,
        product.sizes,
        product.sourceProductName,
        product.supplier?.name,
        product.supplier2?.name,
        product.supplier3?.name,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return text.includes(keyword);
    });
  }, [products, search]);

  function resetForm() {
    setForm(emptyForm);
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
      name: product.name,
      brand: product.brand || "",
      category: product.category || "",
      colors: product.colors || "",
      sizes: product.sizes || "",
      cost: String(product.cost || ""),
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
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  async function uploadImage(file: File) {
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

    if (!form.code.trim()) {
      alert("상품코드를 입력해주세요.");
      return;
    }

    if (!form.name.trim()) {
      alert("상품명을 입력해주세요.");
      return;
    }

    if (!form.colors.trim()) {
      alert("색상을 입력해주세요.");
      return;
    }

    if (!form.sizes.trim()) {
      alert("사이즈를 입력해주세요.");
      return;
    }


    try {
      setSaving(true);

      const response = await fetch("/api/product", {
        method: editingId ? "PUT" : "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: editingId,
          ...form,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        alert(
          result.message ||
            (editingId
              ? "상품 수정에 실패했습니다."
              : "상품 등록에 실패했습니다.")
        );
        return;
      }

      alert(
        editingId
          ? "상품이 수정되었습니다."
          : "상품이 등록되었습니다."
      );

      resetForm();
      setShowProductForm(false);
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

  async function forceDeleteProduct(product: Product) {
    const firstConfirm = window.confirm(
      `[관리자 강제삭제]\n\n${product.code} / ${product.name}\n\n이 상품과 연결된 주문상품, 매입상품, 발주상품, 재고이력까지 정리한 뒤 상품을 완전히 삭제합니다.\n\n계속하시겠습니까?`
    );

    if (!firstConfirm) return;

    const typed = window.prompt(
      `실수 방지를 위해 상품코드 "${product.code}"를 정확히 입력해주세요.`
    );

    if (typed !== product.code) {
      alert("상품코드가 일치하지 않아 강제삭제를 취소했습니다.");
      return;
    }

    try {
      setForceDeletingId(product.id);

      const response = await fetch(
        `/api/product?id=${product.id}&force=true`,
        {
          method: "DELETE",
        }
      );

      const result = await response.json();

      if (!response.ok) {
        alert(result.message || "상품 강제삭제에 실패했습니다.");
        return;
      }

      alert(result.message || "상품이 강제삭제되었습니다.");
      await loadProducts();
    } catch (error) {
      console.error(error);
      alert("상품 강제삭제 중 오류가 발생했습니다.");
    } finally {
      setForceDeletingId(null);
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
          <h2 style={titleStyle}>👕 상품관리</h2>
          <p style={subtitleStyle}>
            상품과 공급업체·SKU를 한곳에서 관리합니다.
          </p>
        </div>

        <button
          type="button"
          onClick={openCreateForm}
          style={primaryButtonStyle}
          className="pm-primary-button"
        >
          {showProductForm ? "닫기" : "+ 상품등록"}
        </button>
      </div>

      {showProductForm && (
        <form
          onSubmit={saveProduct}
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
              type="button"
              onClick={cancelForm}
              style={secondaryButtonStyle}
            >
              닫기
            </button>
          </div>

          <div style={formContentStyle} className="pm-form-content">
            <div style={imageEditorStyle} className="pm-image-editor">
              <div style={imagePreviewBoxStyle}>
                {form.imageUrl ? (
                  <img
                    src={form.imageUrl}
                    alt="상품 미리보기"
                    style={imagePreviewStyle}
                  />
                ) : (
                  <div style={emptyImageStyle}>
                    <div style={{ fontSize: "34px" }}>🖼️</div>
                    <div>대표 이미지 없음</div>
                  </div>
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
                      uploadImage(file);
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
                JPG, PNG, WEBP, GIF / 최대 10MB
              </div>
            </div>

            <div style={formGridStyle} className="pm-form-grid">
              <Field
                label="상품코드"
                value={form.code}
                onChange={(value) => updateForm("code", value)}
                placeholder="예: TEST-001"
              />

              <Field
                label="공급업체 원상품명"
                value={form.sourceProductName}
                onChange={(value) => updateForm("sourceProductName", value)}
                placeholder="공급업체에서 사용하는 상품명"
              />

              <SupplierSearchBox
                label="공급업체 1"
                suppliers={suppliers}
                value={form.supplierId}
                onChange={(value) => updateForm("supplierId", value)}
              />

              <Field
                label="매입단가 1"
                value={form.cost}
                onChange={(value) => updateForm("cost", value.replace(/[^0-9]/g, ""))}
                placeholder="0"
                inputMode="numeric"
              />

              <SupplierSearchBox
                label="공급업체 2"
                suppliers={suppliers}
                value={form.supplier2Id}
                onChange={(value) => updateForm("supplier2Id", value)}
              />

              <Field
                label="매입단가 2"
                value={form.cost2}
                onChange={(value) => updateForm("cost2", value.replace(/[^0-9]/g, ""))}
                placeholder="0"
                inputMode="numeric"
              />

              <SupplierSearchBox
                label="공급업체 3"
                suppliers={suppliers}
                value={form.supplier3Id}
                onChange={(value) => updateForm("supplier3Id", value)}
              />

              <Field
                label="매입단가 3"
                value={form.cost3}
                onChange={(value) => updateForm("cost3", value.replace(/[^0-9]/g, ""))}
                placeholder="0"
                inputMode="numeric"
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
                onChange={(value) => updateForm("price", value.replace(/[^0-9]/g, ""))}
                placeholder="0"
                inputMode="numeric"
              />

              <Field
                label="밴드 게시글 ID"
                value={form.bandPostId}
                onChange={(value) => updateForm("bandPostId", value)}
                placeholder="자동 연동 시 저장"
              />

              <Field
                label="밴드 게시글 주소"
                value={form.bandPostUrl}
                onChange={(value) => updateForm("bandPostUrl", value)}
                placeholder="https://band.us/..."
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

          <div style={formFooterStyle} className="pm-form-footer">
            <button
              type="submit"
              disabled={saving || uploadingImage}
              style={{
                ...saveButtonStyle,
                opacity:
                  saving || uploadingImage ? 0.6 : 1,
              }}
            >
              {saving
                ? "저장 중..."
                : editingId
                ? "상품 수정 저장"
                : "상품 등록"}
            </button>

            <button
              type="button"
              onClick={cancelForm}
              style={secondaryButtonStyle}
            >
              취소
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
                  <div style={productImageBoxStyle} className="pm-product-image-box">
                    {product.imageUrl ? (
                      <img
                        src={product.imageUrl}
                        alt={product.name}
                        style={{ ...productImageStyle, cursor: "zoom-in" }}
                        onClick={() =>
                          setEnlargedImage({
                            src: product.imageUrl as string,
                            alt: product.name,
                          })
                        }
                      />
                    ) : (
                      <div style={noImageStyle}>
                        <span style={{ fontSize: "28px" }}>📦</span>
                        <span>이미지 없음</span>
                      </div>
                    )}
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

                  {/* 색상 */}
                  <div className="pm-list-info">
                    <span className="pm-list-label">색상</span>
                    <strong>{product.colors || "-"}</strong>
                  </div>

                  {/* 사이즈 */}
                  <div className="pm-list-info">
                    <span className="pm-list-label">사이즈</span>
                    <strong>{product.sizes || "-"}</strong>
                  </div>

                  {/* 판매가 / 원가 */}
                  <div style={summaryBoxStyle} className="pm-summary-box">
                    <div style={summaryLineStyle}>
                      <span>공급업체</span>
                      <strong>
                        {[product.supplier?.name, product.supplier2?.name, product.supplier3?.name]
                          .filter(Boolean)
                          .join(" / ") || "-"}
                      </strong>
                    </div>
                    <div style={summaryLineStyle}>
                      <span>단가</span>
                      <strong>{(product.cost || 0).toLocaleString()}원</strong>
                    </div>
                  </div>

                  {/* 버튼 */}
                  <div style={actionBoxStyle} className="pm-action-box">
                    <button
                      type="button"
                      onClick={() => toggleSku(product.id)}
                      style={skuButtonStyle}
                    >
                      {opened ? "닫기" : "SKU"}
                    </button>

                    <button
                      type="button"
                      onClick={() => startEdit(product)}
                      style={editButtonStyle}
                    >
                      수정
                    </button>

                    {isAdmin && (
                      <button
                        type="button"
                        onClick={() => deleteProduct(product)}
                        disabled={deletingId === product.id}
                        style={deleteButtonStyle}
                      >
                        {deletingId === product.id ? "삭제 중..." : "삭제"}
                      </button>
                    )}

                    {isAdmin && (
                      <button
                        type="button"
                        onClick={() => forceDeleteProduct(product)}
                        disabled={forceDeletingId === product.id}
                        style={forceDeleteButtonStyle}
                      >
                        {forceDeletingId === product.id ? "삭제 중..." : "강제삭제"}
                      </button>
                    )}
                  </div>
                </div>

                {opened && (
                  <div style={skuPanelStyle} className="pm-sku-panel">
                    <div style={skuPanelTitleStyle}>
                      "SKU 재고 현황"
                    </div>

                    {product.skus.length === 0 ? (
                      <div style={skuEmptyStyle}>
                        등록된 SKU가 없습니다.
                      </div>
                    ) : (
                      <div style={skuGridStyle} className="pm-sku-grid">
                        {product.skus.map((sku) => (
                          <div
                            key={sku.id}
                            style={skuCardStyle}
                          >
                            <div style={skuCodeStyle}>
                              {sku.sku}
                            </div>

                            <div style={skuMetaStyle}>
                              {sku.color} / {sku.size}
                            </div>

                            <div style={stockStyle}>
                              "현재 재고"
                              <strong>
                                `${sku.stock.toLocaleString()}개`
                              </strong>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {enlargedImage && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`${enlargedImage.alt} 이미지 확대`}
          onClick={() => setEnlargedImage(null)}
          style={imageModalOverlayStyle}
        >
          <div
            style={imageModalContentStyle}
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              aria-label="확대 이미지 닫기"
              onClick={() => setEnlargedImage(null)}
              style={imageModalCloseButtonStyle}
            >
              ×
            </button>

            <img
              src={enlargedImage.src}
              alt={enlargedImage.alt}
              style={imageModalImageStyle}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function SupplierSearchBox({
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
  const [searchText, setSearchText] = useState("");
  const [isOpen, setIsOpen] = useState(false);

  const selectedSupplier = suppliers.find(
    (supplier) => String(supplier.id) === String(value)
  );

  useEffect(() => {
    if (selectedSupplier) {
      setSearchText(`${selectedSupplier.code} · ${selectedSupplier.name}`);
    } else if (!value) {
      setSearchText("");
    }
  }, [selectedSupplier, value]);

  const keyword = searchText.trim().toLowerCase();

  const visibleSuppliers = suppliers.filter((supplier) => {
    if (!keyword) return true;

    const code = supplier.code.toLowerCase();
    const name = supplier.name.toLowerCase();
    return code.includes(keyword) || name.includes(keyword);
  });

  function chooseSupplier(supplier: Supplier) {
    onChange(String(supplier.id));
    setSearchText(`${supplier.code} · ${supplier.name}`);
    setIsOpen(false);
  }

  function changeSearchText(nextValue: string) {
    setSearchText(nextValue);
    setIsOpen(true);

    // 선택된 업체명을 직접 수정하기 시작하면 기존 선택을 해제합니다.
    if (
      selectedSupplier &&
      nextValue !== `${selectedSupplier.code} · ${selectedSupplier.name}`
    ) {
      onChange("");
    }
  }

  return (
    <label style={fieldStyle}>
      <span style={fieldLabelStyle}>{label}</span>

      <div style={supplierSearchContainerStyle}>
        <input
          type="text"
          value={searchText}
          onChange={(event) => changeSearchText(event.target.value)}
          onFocus={() => setIsOpen(true)}
          onBlur={() => {
            window.setTimeout(() => setIsOpen(false), 180);
          }}
          placeholder="공급업체 코드 또는 이름을 직접 입력하여 검색"
          autoComplete="off"
          style={{
            ...inputStyle,
            paddingRight: "42px",
          }}
        />

        {searchText && (
          <button
            type="button"
            title="선택 해제"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => {
              setSearchText("");
              onChange("");
              setIsOpen(true);
            }}
            style={supplierSearchClearStyle}
          >
            ×
          </button>
        )}

        {isOpen && (
          <div style={supplierSearchDropdownStyle}>
            {visibleSuppliers.length === 0 ? (
              <div style={supplierSearchEmptyStyle}>
                검색되는 공급업체가 없습니다.
              </div>
            ) : (
              visibleSuppliers.slice(0, 100).map((supplier) => (
                <button
                  key={supplier.id}
                  type="button"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => chooseSupplier(supplier)}
                  style={{
                    ...supplierSearchOptionStyle,
                    ...(String(supplier.id) === String(value)
                      ? supplierSearchSelectedOptionStyle
                      : {}),
                  }}
                >
                  <span style={{ fontWeight: 700 }}>{supplier.code}</span>
                  <span style={{ color: "#475569" }}>{supplier.name}</span>
                </button>
              ))
            )}
          </div>
        )}
      </div>
    </label>
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
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "20px",
  marginBottom: "20px",
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
  padding: "13px 22px",
  border: "none",
  borderRadius: "8px",
  backgroundColor: "#2563eb",
  color: "white",
  fontSize: "16px",
  fontWeight: 800,
  cursor: "pointer",
  whiteSpace: "nowrap",
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
  overflow: "hidden",
  border: "1px solid #d1d5db",
  borderRadius: "12px",
  backgroundColor: "#f8fafc",
};

const imagePreviewStyle: React.CSSProperties = {
  width: "100%",
  height: "100%",
  objectFit: "cover",
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

const formGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: "14px",
};

const supplierSearchContainerStyle: React.CSSProperties = {
  position: "relative",
};

const supplierSearchClearStyle: React.CSSProperties = {
  position: "absolute",
  right: "10px",
  top: "50%",
  transform: "translateY(-50%)",
  width: "28px",
  height: "28px",
  border: "none",
  background: "transparent",
  color: "#64748b",
  fontSize: "20px",
  lineHeight: 1,
  cursor: "pointer",
  zIndex: 3,
};

const supplierSearchDropdownStyle: React.CSSProperties = {
  position: "absolute",
  left: 0,
  right: 0,
  top: "calc(100% + 4px)",
  zIndex: 100,
  maxHeight: "260px",
  overflowY: "auto",
  border: "1px solid #cbd5e1",
  borderRadius: "8px",
  backgroundColor: "#ffffff",
  boxShadow: "0 12px 28px rgba(15, 23, 42, 0.16)",
};

const supplierSearchOptionStyle: React.CSSProperties = {
  width: "100%",
  display: "flex",
  gap: "8px",
  alignItems: "center",
  padding: "11px 12px",
  border: "none",
  borderBottom: "1px solid #f1f5f9",
  backgroundColor: "#ffffff",
  color: "#0f172a",
  textAlign: "left",
  fontSize: "13px",
  cursor: "pointer",
};

const supplierSearchSelectedOptionStyle: React.CSSProperties = {
  backgroundColor: "#eff6ff",
};

const supplierSearchEmptyStyle: React.CSSProperties = {
  padding: "14px 12px",
  color: "#94a3b8",
  fontSize: "13px",
  textAlign: "center",
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
    "62px minmax(76px, 1.2fr) minmax(72px, 1fr) minmax(52px, 0.7fr) 112px 92px",
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

const imageModalOverlayStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 9999,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "24px",
  backgroundColor: "rgba(15, 23, 42, 0.78)",
  cursor: "zoom-out",
};

const imageModalContentStyle: React.CSSProperties = {
  position: "relative",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  maxWidth: "90vw",
  maxHeight: "90vh",
};

const imageModalImageStyle: React.CSSProperties = {
  maxWidth: "90vw",
  maxHeight: "90vh",
  width: "auto",
  height: "auto",
  objectFit: "contain",
  borderRadius: "10px",
  backgroundColor: "white",
  boxShadow: "0 20px 60px rgba(0, 0, 0, 0.35)",
  cursor: "default",
};

const imageModalCloseButtonStyle: React.CSSProperties = {
  position: "absolute",
  top: "8px",
  right: "8px",
  width: "38px",
  height: "38px",
  border: "none",
  borderRadius: "50%",
  backgroundColor: "rgba(255, 255, 255, 0.95)",
  color: "#111827",
  fontSize: "28px",
  lineHeight: "34px",
  cursor: "pointer",
  zIndex: 2,
  boxShadow: "0 2px 8px rgba(0, 0, 0, 0.2)",
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
  justifyContent: "end",
  alignContent: "center",
  alignSelf: "center",
};

const skuButtonStyle: React.CSSProperties = {
  padding: "5px 8px",
  borderRadius: "6px",
  border: "none",
  background: "#2563eb",
  color: "#ffffff",
  fontWeight: 700,
  fontSize: "11px",
  cursor: "pointer",
  whiteSpace: "nowrap",
};

const editButtonStyle: React.CSSProperties = {
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

const forceDeleteButtonStyle: React.CSSProperties = {
  width: "54px",
  height: "28px",
  padding: "0 6px",
  border: "none",
  borderRadius: "6px",
  backgroundColor: "#7f1d1d",
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