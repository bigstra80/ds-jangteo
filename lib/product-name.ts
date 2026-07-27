const ZERO_WIDTH_CHARACTERS = /[\u200B-\u200D\u2060\uFEFF]/g;
const SPECIAL_SPACES = /[\u00A0\u1680\u180E\u2000-\u200A\u202F\u205F\u3000]/g;

export function normalizeProductName(value: unknown) {
  return String(value ?? "")
    .replace(ZERO_WIDTH_CHARACTERS, "")
    .replace(SPECIAL_SPACES, " ")
    .replace(/[\r\n\t\f\v]+/g, " ")
    .replace(/ +/g, " ")
    .trim();
}

export function normalizeProductSearchText(value: unknown) {
  return normalizeProductName(value).toLocaleLowerCase("ko-KR");
}

export function compactProductSearchText(value: unknown) {
  return normalizeProductSearchText(value).replace(/ /g, "");
}

