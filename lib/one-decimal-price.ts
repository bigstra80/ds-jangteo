const EDITABLE_ONE_DECIMAL_PRICE_PATTERN = /^\d*(?:\.\d?)?$/;
const SAVABLE_ONE_DECIMAL_PRICE_PATTERN = /^\d+(?:\.\d)?$/;

export function isEditableOneDecimalPrice(value: string) {
  return EDITABLE_ONE_DECIMAL_PRICE_PATTERN.test(value);
}

export function parseOneDecimalPrice(value: unknown): number | null {
  const normalized = String(value ?? "").trim();

  if (!SAVABLE_ONE_DECIMAL_PRICE_PATTERN.test(normalized)) {
    return null;
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}
