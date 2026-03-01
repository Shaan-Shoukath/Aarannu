/**
 * fixOklabColors.js
 * ─────────────────
 * Tailwind CSS v4 uses oklab() / oklch() color functions internally,
 * and its `/opacity` modifier produces `color-mix(in oklab, …)`.
 *
 * html2canvas v1.x cannot parse these modern color functions, which causes:
 *   "Attempting to parse an unsupported color function 'oklab'"
 *
 * This utility walks every element inside a container and converts
 * any computed oklab/oklch colors to hex/rgba before html2canvas captures.
 * Call the returned restoreColors() after capture to undo the overrides.
 */

/**
 * Convert a modern CSS color string (oklab, oklch, color-mix, etc.)
 * to hex or rgba using a temporary canvas 2d context — the browser
 * resolves the color for us.
 */
function cssColorToHex(color) {
  if (!color) return color;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 1;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, 1, 1);
  const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
  if (a < 255) {
    return `rgba(${r},${g},${b},${(a / 255).toFixed(3)})`;
  }
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

/** Detect modern color functions that html2canvas cannot parse */
const HAS_MODERN_COLOR = /oklab|oklch|color-mix/i;

/** Match individual oklab() / oklch() function calls (no nested parens) */
const COLOR_FN_RE = /(?:oklab|oklch)\([^)]+\)/gi;

/** Simple color properties — the computed value is a single color */
const SIMPLE_COLOR_PROPS = [
  "color",
  "backgroundColor",
  "borderColor",
  "borderTopColor",
  "borderRightColor",
  "borderBottomColor",
  "borderLeftColor",
  "outlineColor",
  "textDecorationColor",
  "caretColor",
  "columnRuleColor",
];

/**
 * Complex properties — the computed value may embed color functions
 * inside a larger string (gradients, multi-layer shadows, etc.).
 * We regex-replace the color functions within the full value.
 */
const COMPLEX_PROPS = ["background", "boxShadow"];

/**
 * Walk all elements under `root` and replace any oklab()/oklch()
 * computed color values with hex/rgba equivalents as inline styles.
 *
 * Returns a restore function that undoes the changes.
 */
export function fixOklabColors(root) {
  if (!root) return () => {};

  const saved = []; // { el, prop, oldValue }

  const elements = [root, ...root.querySelectorAll("*")];
  for (const el of elements) {
    const computed = getComputedStyle(el);

    // ── Simple color properties ──
    for (const prop of SIMPLE_COLOR_PROPS) {
      const val = computed[prop];
      if (val && HAS_MODERN_COLOR.test(val)) {
        saved.push({ el, prop, oldValue: el.style[prop] });
        el.style[prop] = cssColorToHex(val);
      }
    }

    // ── Complex properties (background, boxShadow) ──
    for (const prop of COMPLEX_PROPS) {
      const val = computed[prop];
      if (val && HAS_MODERN_COLOR.test(val)) {
        saved.push({ el, prop, oldValue: el.style[prop] });
        try {
          el.style[prop] = val.replace(COLOR_FN_RE, (m) => cssColorToHex(m));
        } catch {
          // If replacement creates an invalid value, skip silently
        }
      }
    }
  }

  return function restoreColors() {
    for (const { el, prop, oldValue } of saved) {
      el.style[prop] = oldValue;
    }
  };
}
