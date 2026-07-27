export function normalizeProductCode(value: string) {
  return value.trim().replace(/\s+/g, "").toUpperCase();
}

export function uniqueProductCodes(values: string[]) {
  const seen = new Set<string>();
  const uniqueCodes: string[] = [];

  for (const value of values) {
    const normalizedCode = normalizeProductCode(value);
    if (!normalizedCode || seen.has(normalizedCode)) continue;

    seen.add(normalizedCode);
    uniqueCodes.push(normalizedCode);
  }

  return uniqueCodes;
}
