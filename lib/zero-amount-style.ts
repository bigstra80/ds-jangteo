export const ZERO_AMOUNT_TEXT_COLOR = "#dc2626";

export function isZeroAmount(value: unknown) {
  if (value === null || value === undefined) return false;

  const normalized = String(value)
    .replace(/,/g, "")
    .replace(/원/g, "")
    .trim();

  return normalized !== "" && Number.isFinite(Number(normalized)) && Number(normalized) === 0;
}

export function zeroAmountTextColor(
  value: unknown,
  defaultColor?: string
) {
  return isZeroAmount(value) ? ZERO_AMOUNT_TEXT_COLOR : defaultColor;
}
