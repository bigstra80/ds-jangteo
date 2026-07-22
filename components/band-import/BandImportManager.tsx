"use client";

import { useEffect, useMemo, useState } from "react";

type Band = {
  name: string;
  band_key: string;
  cover?: string;
  member_count?: number;
};

type Supplier = {
  id: number;
  code: string;
  name: string;
};

type BandPhoto = {
  url?: string;
  is_video_thumbnail?: boolean;
};

type BandPost = {
  post_key: string;
  band_key: string;
  content: string;
  created_at: number;
  photos?: BandPhoto[];
};

type ParsedProduct = {
  code: string;
  name: string;
  colors: string;
  sizes: string;
  imageUrl: string;
  bandPostId: string;
  bandPostUrl: string;
};

type ImportExtra = {
  supplierId: string;
  cost: string;
};

type ExistingStatus = {
  exists: boolean;
  productId?: number;
  code?: string;
  name?: string;
};

function cleanLine(value: string) {
  return value
    .replace(/<[^>]+>/g, " ")
    .replace(/\*+/g, "")
    .replace(/[■●○□◆◇▶▷▪▫◼︎◻︎]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeListText(value: string) {
  return value
    .replace(/[\/|·ㆍ]/g, ",")
    .replace(/\s*,\s*/g, ", ")
    .replace(/,\s*,+/g, ", ")
    .trim();
}

function extractTaggedValue(
  lines: string[],
  labels: string[]
) {
  const normalizedLabels = labels.map((label) => label.toLowerCase());

  for (const line of lines) {
    const lower = line.toLowerCase();
    const matched = normalizedLabels.find((label) => lower.includes(label));

    if (!matched) continue;

    const originalLabel = labels[normalizedLabels.indexOf(matched)];

    const value = line
      .replace(
        new RegExp(
          `^.*?(${labels
            .map((label) => label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
            .join("|")})\\s*[:：\\-]?\\s*`,
          "i"
        ),
        ""
      )
      .trim();

    if (value && value.toLowerCase() !== originalLabel.toLowerCase()) {
      return normalizeListText(value);
    }
  }

  return "";
}

function extractProductCode(lines: string[]) {
  const explicit = lines.find((line) =>
    /^(상품코드|품번|제품코드|model|code)\s*[:：\-]/i.test(line)
  );

  if (explicit) {
    return explicit
      .replace(/^(상품코드|품번|제품코드|model|code)\s*[:：\-]?\s*/i, "")
      .replace(/\s+/g, "")
      .trim();
  }

  const strict = lines.find((line) =>
    /^[A-Za-z]{1,12}[\s_-]?\d{2,}[A-Za-z0-9_-]*$/i.test(line)
  );

  if (strict) return strict.replace(/\s+/g, "");

  const loose = lines.find((line) =>
    /^[A-Za-z0-9][A-Za-z0-9_-]{3,29}$/.test(line)
  );

  return loose ? loose.replace(/\s+/g, "") : "";
}

function extractProductName(lines: string[], codeLine: string) {
  const explicit = lines.find((line) =>
    /^(상품명|제품명|품명|name)\s*[:：\-]/i.test(line)
  );

  if (explicit) {
    return explicit
      .replace(/^(상품명|제품명|품명|name)\s*[:：\-]?\s*/i, "")
      .trim();
  }

  return (
    lines.find((line) => {
      const lower = line.toLowerCase();

      if (line.replace(/\s+/g, "") === codeLine.replace(/\s+/g, "")) {
        return false;
      }

      if (
        [
          "상품코드",
          "품번",
          "제품코드",
          "컬러",
          "색상",
          "color",
          "사이즈",
          "size",
          "판매가",
          "가격",
          "price",
        ].some((key) => lower.includes(key))
      ) {
        return false;
      }

      if (/^[A-Za-z0-9_-]{4,30}$/.test(line)) {
        return false;
      }

      return line.length >= 3;
    }) || ""
  );
}

function parsePost(post: BandPost): ParsedProduct {
  const rawLines = String(post.content || "")
    .split(/\r?\n/)
    .map(cleanLine)
    .filter(Boolean);

  const code = extractProductCode(rawLines);
  const colors = extractTaggedValue(rawLines, [
    "컬러",
    "색상",
    "color",
    "colour",
  ]);
  const sizes = extractTaggedValue(rawLines, [
    "사이즈",
    "size",
    "sizes",
  ]);
  const name = extractProductName(rawLines, code);

  const firstPhoto =
    (post.photos || []).find(
      (photo) => !photo.is_video_thumbnail && photo.url
    ) ||
    (post.photos || []).find((photo) => photo.url);

  return {
    code,
    name,
    colors,
    sizes,
    imageUrl: firstPhoto?.url || "",
    bandPostId: post.post_key,
    bandPostUrl: `https://band.us/band/${post.band_key}/post/${post.post_key}`,
  };
}


function makeTestPosts(): BandPost[] {
  return [
    {
      post_key: "TEST-JJ43749",
      band_key: "TEST-BAND",
      created_at: Date.now(),
      content: `JJ43749
로로피아나 클래식 로고 린넨 셔츠
컬러: 베이지, 화이트
사이즈: 95, 100, 105, 110`,
      photos: [],
    },
    {
      post_key: "TEST-TS24001",
      band_key: "TEST-BAND",
      created_at: Date.now() - 1000,
      content: `상품코드 : TS24001
상품명 : 프리미엄 메쉬 카라 반팔티
색상 - 블랙 / 화이트 / 차콜
SIZE : 95 / 100 / 105`,
      photos: [],
    },
    {
      post_key: "TEST-AB-9901",
      band_key: "TEST-BAND",
      created_at: Date.now() - 2000,
      content: `품번: AB-9901
여름 린넨 밴딩 팬츠
COLOR 베이지 · 네이비
사이즈 M | L | XL`,
      photos: [],
    },
  ];
}


function makeUpdateTestPosts(): BandPost[] {
  return [
    {
      post_key: "TEST-AB-9901",
      band_key: "TEST-BAND",
      created_at: Date.now(),
      content: `품번: AB-9901
여름 프리미엄 린넨 밴딩 팬츠
COLOR 베이지 · 네이비 · 블랙
사이즈 M | L | XL | 2XL`,
      photos: [],
    },
  ];
}


function SupplierSearchSelect({
  value,
  onChange,
  suppliers,
}: {
  value: string;
  onChange: (value: string) => void;
  suppliers: Supplier[];
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(-1);

  const selected = suppliers.find((supplier) => String(supplier.id) === value);

  const filtered = useMemo(() => {
    const keyword = query.trim().toLowerCase();

    if (!keyword) return suppliers.slice(0, 30);

    return suppliers
      .filter((supplier) =>
        `${supplier.code} ${supplier.name}`.toLowerCase().includes(keyword)
      )
      .slice(0, 50);
  }, [query, suppliers]);

  useEffect(() => {
    if (open) {
      setHighlightedIndex(filtered.length > 0 ? 0 : -1);
    } else {
      setHighlightedIndex(-1);
    }
  }, [open, filtered.length]);

  function selectSupplier(supplier: Supplier) {
    onChange(String(supplier.id));
    setQuery("");
    setOpen(false);
    setHighlightedIndex(-1);
  }

  return (
    <div style={supplierSearchWrapStyle}>
      <div style={supplierSearchInputWrapStyle}>
        <input
          value={open ? query : selected ? `${selected.code} · ${selected.name}` : ""}
          onFocus={() => {
            setOpen(true);
            setQuery("");
          }}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
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
              const supplier = filtered[highlightedIndex];
              if (supplier) selectSupplier(supplier);
            }

            if (e.key === "Escape") {
              e.preventDefault();
              setOpen(false);
              setQuery("");
              setHighlightedIndex(-1);
            }
          }}
          placeholder="공급업체 검색"
          autoComplete="off"
          style={supplierSearchInputStyle}
        />
        <button
          type="button"
          onClick={() => {
            setOpen((prev) => !prev);
            setQuery("");
          }}
          style={supplierSearchButtonStyle}
        >
          ▼
        </button>
      </div>

      {open && (
        <div style={supplierDropdownStyle}>
          {filtered.length > 0 ? (
            filtered.map((supplier, index) => (
              <button
                key={supplier.id}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onMouseEnter={() => setHighlightedIndex(index)}
                onClick={() => selectSupplier(supplier)}
                style={{
                  ...supplierOptionStyle,
                  ...(highlightedIndex === index
                    ? supplierOptionActiveStyle
                    : {}),
                }}
              >
                {supplier.code} · {supplier.name}
              </button>
            ))
          ) : (
            <div style={supplierNoResultStyle}>검색 결과가 없습니다.</div>
          )}
        </div>
      )}
    </div>
  );
}

export default function BandImportManager() {
  const [bands, setBands] = useState<Band[]>([]);
  const [selectedBandKey, setSelectedBandKey] = useState("");
  const [posts, setPosts] = useState<BandPost[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [extras, setExtras] = useState<Record<string, ImportExtra>>({});
  const [loadingBands, setLoadingBands] = useState(false);
  const [loadingPosts, setLoadingPosts] = useState(false);
  const [importingPostKey, setImportingPostKey] = useState<string | null>(null);
  const [bulkImporting, setBulkImporting] = useState(false);
  const [selectedPostKeys, setSelectedPostKeys] = useState<string[]>([]);
  const [existingStatuses, setExistingStatuses] = useState<
    Record<string, ExistingStatus>
  >({});
  const [checkingStatuses, setCheckingStatuses] = useState(false);
  const [importResults, setImportResults] = useState<
    Record<string, "created" | "updated">
  >({});
  const [message, setMessage] = useState("");

  async function loadBands() {
    setLoadingBands(true);
    setMessage("");

    try {
      const response = await fetch("/api/band/bands", { cache: "no-store" });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "밴드 목록 조회 실패");
      }

      setBands(data.bands || []);

      const dunk = (data.bands || []).find(
        (band: Band) => band.name.trim() === "덩크"
      );

      if (dunk) {
        setSelectedBandKey(dunk.band_key);
      }
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "밴드 목록을 불러오지 못했습니다."
      );
    } finally {
      setLoadingBands(false);
    }
  }

  async function loadPosts() {
    if (!selectedBandKey) {
      setMessage("먼저 밴드를 선택해주세요.");
      return;
    }

    setLoadingPosts(true);
    setMessage("");

    try {
      const response = await fetch(
        `/api/band/posts?bandKey=${encodeURIComponent(selectedBandKey)}`,
        { cache: "no-store" }
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "게시글 조회 실패");
      }

      const loadedPosts = data.posts || [];
      setPosts(loadedPosts);
      setSelectedPostKeys(
        loadedPosts.map((post: BandPost) => post.post_key)
      );
      await checkExistingStatuses(loadedPosts);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "게시글을 불러오지 못했습니다."
      );
    } finally {
      setLoadingPosts(false);
    }
  }

  function loadTestPosts() {
    const testPosts = makeTestPosts();
    setPosts(testPosts);
    setSelectedPostKeys(testPosts.map((post) => post.post_key));
    void checkExistingStatuses(testPosts);
    setMessage(
      "테스트 상품 3개를 불러왔습니다. 실제 BAND 승인 전에도 자동 분석과 ERP 등록 흐름을 확인할 수 있습니다."
    );
  }

  function loadUpdateTestPosts() {
    const updatePosts = makeUpdateTestPosts();
    setPosts(updatePosts);
    setSelectedPostKeys(updatePosts.map((post) => post.post_key));
    void checkExistingStatuses(updatePosts);
    setMessage(
      "기존 상품 업데이트 테스트용 AB-9901을 불러왔습니다. 상품명·색상·사이즈가 변경된 버전입니다."
    );
  }


  async function loadSuppliers() {
    const urls = ["/api/suppliers", "/api/supplier"];

    for (const url of urls) {
      try {
        const response = await fetch(url, { cache: "no-store" });
        if (!response.ok) continue;

        const data = await response.json();
        const list = Array.isArray(data)
          ? data
          : Array.isArray(data.suppliers)
            ? data.suppliers
            : Array.isArray(data.data)
              ? data.data
              : [];

        setSuppliers(list);
        return;
      } catch {
        // 다음 후보 API 시도
      }
    }
  }

  function updateExtra(postKey: string, patch: Partial<ImportExtra>) {
    setExtras((prev) => ({
      ...prev,
      [postKey]: {
        supplierId: prev[postKey]?.supplierId || "",
        cost: prev[postKey]?.cost || "",
        ...patch,
      },
    }));
  }

  useEffect(() => {
    loadBands();
    loadSuppliers();
  }, []);

  const selectedBand = useMemo(
    () => bands.find((band) => band.band_key === selectedBandKey),
    [bands, selectedBandKey]
  );

  async function checkExistingStatuses(targetPosts: BandPost[]) {
    if (targetPosts.length === 0) {
      setExistingStatuses({});
      return;
    }

    setCheckingStatuses(true);

    try {
      const items = targetPosts.map((post) => {
        const parsed = parsePost(post);

        return {
          postKey: post.post_key,
          code: parsed.code,
          bandPostId: parsed.bandPostId,
        };
      });

      const response = await fetch("/api/band/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "기존 상품 확인 실패");
      }

      setExistingStatuses(data.statuses || {});
    } catch (error) {
      console.error(error);
      setExistingStatuses({});
    } finally {
      setCheckingStatuses(false);
    }
  }

  function selectOnlyNewProducts() {
    const newKeys = posts
      .filter((post) => {
        const parsed = parsePost(post);
        const ready =
          parsed.code && parsed.name && parsed.colors && parsed.sizes;

        return ready && !existingStatuses[post.post_key]?.exists;
      })
      .map((post) => post.post_key);

    setSelectedPostKeys(newKeys);
  }

  function toggleSelectedPost(postKey: string) {
    setSelectedPostKeys((current) =>
      current.includes(postKey)
        ? current.filter((key) => key !== postKey)
        : [...current, postKey]
    );
  }

  function toggleSelectAll() {
    const readyPostKeys = posts
      .filter((post) => {
        const parsed = parsePost(post);
        return parsed.code && parsed.name && parsed.colors && parsed.sizes;
      })
      .map((post) => post.post_key);

    const allSelected =
      readyPostKeys.length > 0 &&
      readyPostKeys.every((key) => selectedPostKeys.includes(key));

    setSelectedPostKeys(allSelected ? [] : readyPostKeys);
  }

  async function importParsedPost(post: BandPost) {
    const parsed = parsePost(post);

    if (!parsed.code || !parsed.name || !parsed.colors || !parsed.sizes) {
      throw new Error(`${parsed.name || post.post_key}: 자동 인식 정보가 부족합니다.`);
    }

    const response = await fetch("/api/band/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...parsed,
        supplierId: extras[post.post_key]?.supplierId || "",
        cost: extras[post.post_key]?.cost || "",
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || "상품 등록 실패");
    }

    setImportResults((prev) => ({
      ...prev,
      [post.post_key]: data.mode === "updated" ? "updated" : "created",
    }));

    return data;
  }

  async function bulkImportSelected() {
    const targets = posts.filter((post) =>
      selectedPostKeys.includes(post.post_key)
    );

    if (targets.length === 0) {
      alert("등록할 상품을 먼저 선택해주세요.");
      return;
    }

    const confirmed = window.confirm(
      `선택한 ${targets.length}개 상품을 ERP에 등록·업데이트하시겠습니까?`
    );

    if (!confirmed) return;

    setBulkImporting(true);

    let successCount = 0;
    let failCount = 0;
    const failures: string[] = [];

    for (const post of targets) {
      try {
        await importParsedPost(post);
        successCount += 1;
      } catch (error) {
        failCount += 1;
        failures.push(
          error instanceof Error ? error.message : post.post_key
        );
      }
    }

    setBulkImporting(false);

    alert(
      `일괄 처리 완료\n성공: ${successCount}개\n실패: ${failCount}개${
        failures.length ? `\n\n${failures.join("\n")}` : ""
      }`
    );
  }

  async function importPost(post: BandPost) {
    const parsed = parsePost(post);

    if (!parsed.code || !parsed.name || !parsed.colors || !parsed.sizes) {
      alert(
        "이 게시글에서 상품코드, 상품명, 색상, 사이즈를 모두 자동으로 찾지 못했습니다."
      );
      return;
    }

    setImportingPostKey(post.post_key);

    try {
      const data = await importParsedPost(post);

      alert(
        data.mode === "updated"
          ? `${parsed.name}\n기존 상품을 업데이트했습니다.`
          : `${parsed.name}\n새 상품으로 등록했습니다.`
      );
    } catch (error) {
      alert(
        error instanceof Error ? error.message : "상품 등록 중 오류가 발생했습니다."
      );
    } finally {
      setImportingPostKey(null);
    }
  }


  return (
    <div style={pageStyle}>
      <div style={headerStyle}>
        <div>
          <h1 style={titleStyle}>🟢 네이버 밴드 상품수집</h1>
          <p style={descriptionStyle}>
            밴드 게시글에서 상품코드·상품명·색상·사이즈·대표이미지를 가져옵니다.
          </p>
        </div>
      </div>

      <div style={controlCardStyle}>
        <div style={controlRowStyle}>
          <label style={fieldStyle}>
            <span style={labelStyle}>밴드 선택</span>
            <select
              value={selectedBandKey}
              onChange={(e) => setSelectedBandKey(e.target.value)}
              style={selectStyle}
            >
              <option value="">밴드를 선택하세요</option>
              {bands.map((band) => (
                <option key={band.band_key} value={band.band_key}>
                  {band.name}
                </option>
              ))}
            </select>
          </label>

          <button
            type="button"
            onClick={loadPosts}
            disabled={!selectedBandKey || loadingPosts}
            style={primaryButtonStyle}
          >
            {loadingPosts ? "불러오는 중..." : "최신 상품글 가져오기"}
          </button>

          <button
            type="button"
            onClick={loadBands}
            disabled={loadingBands}
            style={secondaryButtonStyle}
          >
            밴드 목록 새로고침
          </button>

          <button
            type="button"
            onClick={loadTestPosts}
            style={testButtonStyle}
          >
            테스트 상품 불러오기
          </button>

          <button
            type="button"
            onClick={loadUpdateTestPosts}
            style={updateTestButtonStyle}
          >
            기존상품 업데이트 테스트
          </button>
        </div>

        {selectedBand && (
          <div style={bandInfoStyle}>
            선택된 밴드: <strong>{selectedBand.name}</strong>
          </div>
        )}

        {message && <div style={errorStyle}>{message}</div>}

        {posts.length > 0 && (
          <div style={bulkBarStyle}>
            <label style={bulkCheckLabelStyle}>
              <input
                type="checkbox"
                checked={
                  posts.length > 0 &&
                  posts
                    .filter((post) => {
                      const parsed = parsePost(post);
                      return (
                        parsed.code &&
                        parsed.name &&
                        parsed.colors &&
                        parsed.sizes
                      );
                    })
                    .every((post) =>
                      selectedPostKeys.includes(post.post_key)
                    )
                }
                onChange={toggleSelectAll}
              />
              전체 선택
            </label>

            <div style={bulkCountStyle}>
              선택 {selectedPostKeys.length}개
            </div>

            <button
              type="button"
              onClick={selectOnlyNewProducts}
              disabled={checkingStatuses}
              style={newOnlyButtonStyle}
            >
              {checkingStatuses ? "확인 중..." : "신규 상품만 선택"}
            </button>

            <button
              type="button"
              onClick={bulkImportSelected}
              disabled={bulkImporting || selectedPostKeys.length === 0}
              style={{
                ...bulkImportButtonStyle,
                opacity:
                  bulkImporting || selectedPostKeys.length === 0 ? 0.5 : 1,
              }}
            >
              {bulkImporting
                ? "일괄 등록 중..."
                : "선택 상품 일괄 등록·업데이트"}
            </button>
          </div>
        )}
      </div>

      {posts.length === 0 ? (
        <div style={emptyStyle}>
          {loadingPosts
            ? "밴드 게시글을 불러오는 중입니다..."
            : "BAND 승인 전에는 테스트 상품 불러오기로 전체 등록 과정을 확인할 수 있습니다."}
        </div>
      ) : (
        <div style={gridStyle}>
          {posts.map((post) => {
            const parsed = parsePost(post);
            const ready =
              parsed.code &&
              parsed.name &&
              parsed.colors &&
              parsed.sizes;

            return (
              <article key={post.post_key} style={cardStyle}>
                <label style={cardCheckStyle}>
                  <input
                    type="checkbox"
                    checked={selectedPostKeys.includes(post.post_key)}
                    onChange={() => toggleSelectedPost(post.post_key)}
                    disabled={!ready}
                  />
                  선택
                </label>
                <div style={imageBoxStyle}>
                  {parsed.imageUrl ? (
                    <img
                      src={parsed.imageUrl}
                      alt={parsed.name || "밴드 상품"}
                      style={imageStyle}
                    />
                  ) : (
                    <div style={noImageStyle}>이미지 없음</div>
                  )}
                </div>

                <div style={contentStyle}>
                  <div style={statusStyle(!!ready)}>
                    {ready ? "자동등록 가능" : "확인 필요"}
                  </div>

                  {ready && (
                    <div
                      style={
                        existingStatuses[post.post_key]?.exists
                          ? existingProductStyle
                          : newProductStyle
                      }
                    >
                      {checkingStatuses
                        ? "기존 상품 확인 중"
                        : existingStatuses[post.post_key]?.exists
                          ? "기존 상품 · 업데이트"
                          : "신규 상품"}
                    </div>
                  )}

                  {importResults[post.post_key] && (
                    <div
                      style={
                        importResults[post.post_key] === "updated"
                          ? updatedResultStyle
                          : createdResultStyle
                      }
                    >
                      {importResults[post.post_key] === "updated"
                        ? "기존 상품 업데이트 완료"
                        : "신규 상품 등록 완료"}
                    </div>
                  )}

                  <div style={infoGridStyle}>
                    <Info label="상품코드" value={parsed.code || "자동 인식 실패"} />
                    <Info label="상품명" value={parsed.name || "자동 인식 실패"} />
                    <Info label="색상" value={parsed.colors || "자동 인식 실패"} />
                    <Info label="사이즈" value={parsed.sizes || "자동 인식 실패"} />
                  </div>

                  <div style={importSettingStyle}>
                    <label style={settingFieldStyle}>
                      <span style={settingLabelStyle}>공급업체</span>
                      <SupplierSearchSelect
                        value={extras[post.post_key]?.supplierId || ""}
                        onChange={(value) =>
                          updateExtra(post.post_key, { supplierId: value })
                        }
                        suppliers={suppliers}
                      />
                    </label>

                    <label style={settingFieldStyle}>
                      <span style={settingLabelStyle}>매입단가</span>
                      <input
                        value={extras[post.post_key]?.cost || ""}
                        onChange={(e) =>
                          updateExtra(post.post_key, {
                            cost: e.target.value.replace(/[^0-9]/g, ""),
                          })
                        }
                        placeholder="0"
                        inputMode="numeric"
                        style={settingInputStyle}
                      />
                    </label>
                  </div>

                  <details style={detailsStyle}>
                    <summary>밴드 원문 보기</summary>
                    <pre style={preStyle}>{post.content}</pre>
                  </details>

                  <button
                    type="button"
                    disabled={!ready || importingPostKey === post.post_key}
                    onClick={() => importPost(post)}
                    style={{
                      ...importButtonStyle,
                      opacity: !ready ? 0.45 : 1,
                    }}
                  >
                    {importingPostKey === post.post_key
                      ? "ERP 반영 중..."
                      : "ERP 상품으로 등록·업데이트"}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div style={infoStyle}>
      <span style={infoLabelStyle}>{label}</span>
      <strong style={infoValueStyle}>{value}</strong>
    </div>
  );
}

function statusStyle(ready: boolean): React.CSSProperties {
  return {
    display: "inline-block",
    alignSelf: "flex-start",
    padding: "5px 9px",
    borderRadius: "999px",
    background: ready ? "#dcfce7" : "#fef3c7",
    color: ready ? "#166534" : "#92400e",
    fontSize: "12px",
    fontWeight: 800,
  };
}

const bulkBarStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "12px",
  flexWrap: "wrap",
  marginTop: "14px",
  paddingTop: "14px",
  borderTop: "1px solid #e2e8f0",
};

const bulkCheckLabelStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "6px",
  fontWeight: 800,
  color: "#334155",
};

const bulkCountStyle: React.CSSProperties = {
  color: "#64748b",
  fontSize: "13px",
  fontWeight: 700,
};

const newOnlyButtonStyle: React.CSSProperties = {
  minHeight: "40px",
  border: "1px solid #93c5fd",
  borderRadius: "8px",
  padding: "0 14px",
  background: "#eff6ff",
  color: "#1d4ed8",
  fontWeight: 800,
  cursor: "pointer",
};

const newProductStyle: React.CSSProperties = {
  display: "inline-block",
  alignSelf: "flex-start",
  padding: "5px 9px",
  borderRadius: "999px",
  background: "#dcfce7",
  color: "#166534",
  fontSize: "12px",
  fontWeight: 800,
};

const existingProductStyle: React.CSSProperties = {
  display: "inline-block",
  alignSelf: "flex-start",
  padding: "5px 9px",
  borderRadius: "999px",
  background: "#ede9fe",
  color: "#6d28d9",
  fontSize: "12px",
  fontWeight: 800,
};

const bulkImportButtonStyle: React.CSSProperties = {
  marginLeft: "auto",
  minHeight: "42px",
  border: 0,
  borderRadius: "9px",
  padding: "0 18px",
  background: "#111827",
  color: "white",
  fontWeight: 800,
  cursor: "pointer",
};

const cardCheckStyle: React.CSSProperties = {
  position: "absolute",
  top: "12px",
  right: "12px",
  display: "flex",
  alignItems: "center",
  gap: "5px",
  padding: "5px 8px",
  borderRadius: "999px",
  background: "rgba(255,255,255,0.95)",
  border: "1px solid #dbeafe",
  color: "#334155",
  fontSize: "12px",
  fontWeight: 800,
  zIndex: 5,
};

const pageStyle: React.CSSProperties = {
  width: "100%",
  maxWidth: "1280px",
  margin: "0 auto",
};

const headerStyle: React.CSSProperties = {
  marginBottom: "20px",
};

const titleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: "28px",
  fontWeight: 900,
  color: "#0f172a",
};

const descriptionStyle: React.CSSProperties = {
  margin: "8px 0 0",
  color: "#64748b",
};

const controlCardStyle: React.CSSProperties = {
  padding: "18px",
  border: "1px solid #e2e8f0",
  borderRadius: "14px",
  background: "white",
  marginBottom: "18px",
};

const controlRowStyle: React.CSSProperties = {
  display: "flex",
  gap: "10px",
  alignItems: "end",
  flexWrap: "wrap",
};

const fieldStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "6px",
  minWidth: "280px",
  flex: 1,
};

const labelStyle: React.CSSProperties = {
  fontSize: "13px",
  fontWeight: 800,
  color: "#475569",
};

const selectStyle: React.CSSProperties = {
  minHeight: "44px",
  border: "1px solid #cbd5e1",
  borderRadius: "9px",
  padding: "8px 11px",
  background: "white",
};

const primaryButtonStyle: React.CSSProperties = {
  minHeight: "44px",
  border: 0,
  borderRadius: "9px",
  padding: "0 18px",
  background: "#2563eb",
  color: "white",
  fontWeight: 800,
  cursor: "pointer",
};

const secondaryButtonStyle: React.CSSProperties = {
  minHeight: "44px",
  border: "1px solid #cbd5e1",
  borderRadius: "9px",
  padding: "0 16px",
  background: "white",
  color: "#334155",
  fontWeight: 800,
  cursor: "pointer",
};

const testButtonStyle: React.CSSProperties = {
  minHeight: "44px",
  border: "1px solid #86efac",
  borderRadius: "9px",
  padding: "0 16px",
  background: "#f0fdf4",
  color: "#166534",
  fontWeight: 800,
  cursor: "pointer",
};

const updateTestButtonStyle: React.CSSProperties = {
  minHeight: "44px",
  border: "1px solid #c4b5fd",
  borderRadius: "9px",
  padding: "0 16px",
  background: "#f5f3ff",
  color: "#6d28d9",
  fontWeight: 800,
  cursor: "pointer",
};

const createdResultStyle: React.CSSProperties = {
  display: "inline-block",
  alignSelf: "flex-start",
  padding: "5px 9px",
  borderRadius: "999px",
  background: "#dbeafe",
  color: "#1d4ed8",
  fontSize: "12px",
  fontWeight: 800,
};

const updatedResultStyle: React.CSSProperties = {
  display: "inline-block",
  alignSelf: "flex-start",
  padding: "5px 9px",
  borderRadius: "999px",
  background: "#ede9fe",
  color: "#6d28d9",
  fontSize: "12px",
  fontWeight: 800,
};

const bandInfoStyle: React.CSSProperties = {
  marginTop: "12px",
  color: "#334155",
};

const errorStyle: React.CSSProperties = {
  marginTop: "12px",
  padding: "12px",
  borderRadius: "9px",
  background: "#fff7ed",
  color: "#9a3412",
  whiteSpace: "pre-wrap",
};

const emptyStyle: React.CSSProperties = {
  padding: "60px 20px",
  border: "1px dashed #cbd5e1",
  borderRadius: "14px",
  textAlign: "center",
  color: "#64748b",
  background: "#f8fafc",
};

const gridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(440px, 1fr))",
  gap: "14px",
};

const cardStyle: React.CSSProperties = {
  position: "relative",
  display: "grid",
  gridTemplateColumns: "160px minmax(0, 1fr)",
  gap: "16px",
  padding: "16px",
  border: "1px solid #e2e8f0",
  borderRadius: "14px",
  background: "white",
};

const imageBoxStyle: React.CSSProperties = {
  width: "160px",
  height: "200px",
  borderRadius: "10px",
  overflow: "hidden",
  background: "#f1f5f9",
};

const imageStyle: React.CSSProperties = {
  width: "100%",
  height: "100%",
  objectFit: "cover",
};

const noImageStyle: React.CSSProperties = {
  width: "100%",
  height: "100%",
  display: "grid",
  placeItems: "center",
  color: "#94a3b8",
};

const contentStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "12px",
  minWidth: 0,
};

const infoGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: "10px",
};

const infoStyle: React.CSSProperties = {
  minWidth: 0,
  padding: "10px",
  borderRadius: "9px",
  background: "#f8fafc",
};

const infoLabelStyle: React.CSSProperties = {
  display: "block",
  marginBottom: "4px",
  fontSize: "11px",
  color: "#64748b",
  fontWeight: 800,
};

const infoValueStyle: React.CSSProperties = {
  display: "block",
  color: "#0f172a",
  overflowWrap: "anywhere",
};


const supplierSearchWrapStyle: React.CSSProperties = {
  position: "relative",
  width: "100%",
  zIndex: 20,
};

const supplierSearchInputWrapStyle: React.CSSProperties = {
  display: "flex",
  width: "100%",
  minHeight: "40px",
  border: "1px solid #93c5fd",
  borderRadius: "8px",
  overflow: "hidden",
  background: "white",
};

const supplierSearchInputStyle: React.CSSProperties = {
  flex: 1,
  minWidth: 0,
  border: 0,
  outline: "none",
  padding: "8px 10px",
  background: "transparent",
  color: "#0f172a",
};

const supplierSearchButtonStyle: React.CSSProperties = {
  width: "38px",
  border: 0,
  borderLeft: "1px solid #bfdbfe",
  background: "#eff6ff",
  color: "#1e3a8a",
  cursor: "pointer",
};

const supplierDropdownStyle: React.CSSProperties = {
  position: "absolute",
  top: "calc(100% + 4px)",
  left: 0,
  right: 0,
  maxHeight: "220px",
  overflowY: "auto",
  background: "white",
  border: "1px solid #cbd5e1",
  borderRadius: "8px",
  boxShadow: "0 12px 28px rgba(15, 23, 42, 0.14)",
  zIndex: 9999,
};

const supplierOptionStyle: React.CSSProperties = {
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

const supplierOptionActiveStyle: React.CSSProperties = {
  background: "#eff6ff",
  color: "#1d4ed8",
  fontWeight: 800,
};

const supplierNoResultStyle: React.CSSProperties = {
  padding: "12px",
  color: "#94a3b8",
  fontSize: "13px",
};

const importSettingStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: "10px",
};

const settingFieldStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "6px",
};

const settingLabelStyle: React.CSSProperties = {
  fontSize: "12px",
  fontWeight: 800,
  color: "#475569",
};

const settingInputStyle: React.CSSProperties = {
  minHeight: "40px",
  border: "1px solid #cbd5e1",
  borderRadius: "8px",
  padding: "8px 10px",
  background: "white",
  boxSizing: "border-box",
  width: "100%",
};

const detailsStyle: React.CSSProperties = {
  color: "#475569",
  fontSize: "13px",
};

const preStyle: React.CSSProperties = {
  whiteSpace: "pre-wrap",
  wordBreak: "break-word",
  padding: "10px",
  borderRadius: "8px",
  background: "#f8fafc",
  maxHeight: "180px",
  overflow: "auto",
};

const importButtonStyle: React.CSSProperties = {
  border: 0,
  borderRadius: "9px",
  padding: "11px 14px",
  background: "#172033",
  color: "white",
  fontWeight: 800,
  cursor: "pointer",
};
