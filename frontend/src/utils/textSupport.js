export const DEFAULT_CARD_FONT_FAMILY =
  "'Public Sans', 'Noto Sans Malayalam', sans-serif";

const MALAYALAM_REGEX = /[\u0D00-\u0D7F]/u;
const ASCII_ONLY_REGEX = /^[A-Za-z0-9\s&().,'"_/-]*$/;
const GENERIC_FONT_FAMILIES = new Set([
  "serif",
  "sans-serif",
  "monospace",
  "system-ui",
  "-apple-system",
  "cursive",
  "fantasy",
  "math",
  "emoji",
  "fangsong",
  "ui-sans-serif",
  "ui-serif",
  "ui-monospace",
]);

const graphemeSegmenter =
  typeof Intl !== "undefined" && typeof Intl.Segmenter === "function"
    ? new Intl.Segmenter(undefined, { granularity: "grapheme" })
    : null;

export function normalizeDisplayText(value) {
  return String(value ?? "").normalize("NFC");
}

export function containsMalayalam(value) {
  return MALAYALAM_REGEX.test(normalizeDisplayText(value));
}

export function splitGraphemes(value) {
  const text = normalizeDisplayText(value);
  if (!text) return [];

  if (graphemeSegmenter) {
    return [...graphemeSegmenter.segment(text)].map(({ segment }) => segment);
  }

  return Array.from(text);
}

export function firstGrapheme(value) {
  return splitGraphemes(value)[0] || "";
}

export function uppercaseLatinOnly(value) {
  const text = normalizeDisplayText(value);
  if (!text) return "";
  return ASCII_ONLY_REGEX.test(text) ? text.toUpperCase() : text;
}

export function withMalayalamFontFallback(fontFamily = DEFAULT_CARD_FONT_FAMILY) {
  const parts = String(fontFamily || DEFAULT_CARD_FONT_FAMILY)
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

  const hasMalayalamFont = parts.some((part) =>
    part.replace(/^['"]|['"]$/g, "").toLowerCase() === "noto sans malayalam",
  );
  if (hasMalayalamFont) return parts.join(", ");

  const genericIndex = parts.findIndex((part) =>
    GENERIC_FONT_FAMILIES.has(
      part.replace(/^['"]|['"]$/g, "").toLowerCase(),
    ),
  );

  if (genericIndex === -1) {
    return [...parts, "'Noto Sans Malayalam'", "sans-serif"].join(", ");
  }

  const nextParts = [...parts];
  nextParts.splice(genericIndex, 0, "'Noto Sans Malayalam'");
  return nextParts.join(", ");
}

export function getAdaptiveIdFontFamily(value, baseFontFamily) {
  return containsMalayalam(value)
    ? withMalayalamFontFallback(baseFontFamily)
    : '"Roboto Mono", "Courier New", monospace';
}
