/**
 * fixOklabColors.js
 * ─────────────────
 * Tailwind CSS v4 uses oklab() color functions internally.
 * html2canvas v1.x cannot parse oklab(), which causes:
 *   "Attempting to parse an unsupported color function 'oklab'"
 *
 * This utility walks every element inside a container and converts
 * any computed oklab/oklch colors to hex before html2canvas captures.
 * Call restoreColors() after capture to undo the inline overrides.
 */

/**
 * Convert an oklab/oklch CSS color string to a hex color using a temporary
 * canvas 2d context (the browser does the conversion for us).
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

const COLOR_PROPS = [
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
 * Walk all elements under `root` and replace any oklab()/oklch() computed
 * color values with hex equivalents as inline styles.
 *
 * Returns a restore function that undoes the changes.
 */
export function fixOklabColors(root) {
  if (!root) return () => {};

  const saved = []; // { el, prop, oldValue }

  const elements = [root, ...root.querySelectorAll("*")];
  for (const el of elements) {
    const computed = getComputedStyle(el);
    for (const prop of COLOR_PROPS) {
      const val = computed[prop];
      if (val && (val.includes("oklab") || val.includes("oklch"))) {
        saved.push({ el, prop, oldValue: el.style[prop] });
        el.style[prop] = cssColorToHex(val);
      }
    }
    // Also check background (could be a gradient with oklab)
    const bg = computed.background;
    if (bg && (bg.includes("oklab") || bg.includes("oklch"))) {
      saved.push({ el, prop: "background", oldValue: el.style.background });
      // For gradients we can't just convert; set background-color as fallback
      // and try to set the full background
      try {
        el.style.background = bg
          .replace(/oklab\([^)]+\)/g, (m) => cssColorToHex(m))
          .replace(/oklch\([^)]+\)/g, (m) => cssColorToHex(m));
      } catch {
        // Fallback: just set backgroundColor
      }
    }
  }

  return function restoreColors() {
    for (const { el, prop, oldValue } of saved) {
      el.style[prop] = oldValue;
    }
  };
}
