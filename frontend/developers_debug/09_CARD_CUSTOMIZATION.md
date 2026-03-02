# 09 – Card Customization & Orientation System

## Overview

The platform supports **full visual customization** of all 4 ID card templates (IDCard, CorporateCard, StudentCard, EventCard). Users can control:

1. **Gradient Colors** — Start & end colors for decorative gradients/SVGs
2. **Background Color** — Overall card background
3. **Text Color** — Primary text (name, details)
4. **Accent Color** — Labels, subtitles, muted text
5. **Font Family** — Selectable typeface from a curated list
6. **Corner Radius** — Adjustable border radius (0–24px)
7. **Orientation** — Horizontal (landscape CR-80) or Vertical (portrait)

All customizations apply in real-time to both preview and bulk generation output.

---

## Architecture: How Customization Flows Through the System

```
Generate.jsx (page)
    │
    ├── cardStyles state ────────────────────────────┐
    │   { bgColor, fontColor, fontFamily,            │
    │     accentColor, borderRadius }                │
    │                                                 │
    ├── orientation state ── "horizontal" | "vertical"│
    │                                                 │
    ├── gradientColors state ── { start, end }        │
    │                                                 │
    ▼                                                 ▼
renderCard(data, ref, back, side)              BulkGenerator
    │                                                 │
    │  Passes as props:                               │  Receives as props:
    │   - cardStyles                                  │   - cardStyles
    │   - orientation                                 │   - orientation
    │   - gradientColors                              │   - gradientColors
    │                                                 │
    ▼                                                 ▼
IDCard / CorporateCard / StudentCard / EventCard
    │
    ├── Derives:
    │   cs = cardStyles      (shorthand)
    │   gc = gradientColors  (shorthand)
    │   isVertical = orientation === "vertical"
    │
    ├── Applies to front container:
    │   style={{ backgroundColor: cs.bgColor,
    │            fontFamily: cs.fontFamily,
    │            borderRadius: `${cs.borderRadius}px` }}
    │   className=`${isVertical ? 'w-80' : 'w-125'}`
    │   aspectRatio: isVertical ? "53.98 / 85.6" : "85.6 / 53.98"
    │
    └── Applies to text elements:
        style={{ color: cs.fontColor }}    ← name, headings
        style={{ color: cs.accentColor }}  ← labels, subtitles
```

---

## State Definitions (Generate.jsx)

### cardStyles Object

```javascript
const [cardStyles, setCardStyles] = useState({
  bgColor: templateId === "event" ? "#1e1b4b" : "#ffffff",
  fontColor: templateId === "event" ? "#e0e7ff" : "#1e293b",
  fontFamily: "'Public Sans', sans-serif",
  accentColor: templateId === "event" ? "#818cf8" : "#64748b",
  borderRadius: 12,
});
```

**Why template-aware defaults?** The Event template has a dark theme by default (`#1e1b4b` background, light text). Other templates use white backgrounds with dark text. The defaults match each template's design language so the card looks correct out-of-the-box.

### orientation State

```javascript
const [orientation, setOrientation] = useState("horizontal");
```

**Two values:** `"horizontal"` (standard CR-80 landscape, 85.6 × 53.98 mm) or `"vertical"` (portrait, 53.98 × 85.6 mm — same card, rotated 90°).

### uploadToCloud State

```javascript
const [uploadToCloud, setUploadToCloud] = useState(true);
```

**Controls whether** generated cards are uploaded to Supabase Storage and recorded in the `generated_ids` table. When OFF, cards are only generated locally (PDF/ZIP). Default is ON for backward compatibility.

### gradientColors Object (pre-existing)

```javascript
const [gradientStart, setGradientStart] =
  useState(/* template-based default */);
const [gradientEnd, setGradientEnd] = useState(/* template-based default */);
const gradientColors = { start: gradientStart, end: gradientEnd };
```

---

## Available Font Families

```javascript
const FONT_FAMILIES = [
  { value: "'Public Sans', sans-serif", label: "Public Sans" }, // Default
  { value: "Inter, sans-serif", label: "Inter" },
  { value: "Arial, sans-serif", label: "Arial" },
  { value: "Georgia, serif", label: "Georgia" },
  { value: "'Times New Roman', serif", label: "Times New Roman" },
  { value: "'Courier New', monospace", label: "Courier New" },
  { value: "Verdana, sans-serif", label: "Verdana" },
  { value: "'Trebuchet MS', sans-serif", label: "Trebuchet MS" },
];
```

**Why these fonts?** They are **system fonts** available on all operating systems. No external font loading required, which means:

- Zero network requests for fonts
- html2canvas captures them reliably (external web fonts can fail during capture)
- Consistent rendering across devices
- No FOUT (Flash of Unstyled Text)

**Comparison with web fonts (Google Fonts):**

| Factor       | System Fonts (used)      | Web Fonts (not used)           |
| ------------ | ------------------------ | ------------------------------ |
| Availability | Always available         | Requires network fetch         |
| html2canvas  | Always renders correctly | May fail if font hasn't loaded |
| Performance  | Zero latency             | 100-300ms FOUT                 |
| Offline      | Works                    | Fails                          |
| Variety      | Limited (~8 choices)     | Thousands                      |

For a production upgrade, web fonts could be added with a `@font-face` preload strategy, but system fonts are the pragmatic choice for reliability.

---

## Orientation System: Horizontal vs Vertical

### Aspect Ratio Logic

```javascript
// Standard CR-80 ID card dimensions
// Horizontal (landscape): 85.6mm × 53.98mm → aspectRatio: "85.6 / 53.98"
// Vertical (portrait):    53.98mm × 85.6mm → aspectRatio: "53.98 / 85.6"

const isVertical = orientation === "vertical";

// Container:
style={{ aspectRatio: isVertical ? "53.98 / 85.6" : "85.6 / 53.98" }}
className={`${isVertical ? 'w-80' : 'w-125'}`}  // narrower width for portrait
```

### Layout Adaptation

When orientation switches to vertical, the card's internal layout changes:

```
HORIZONTAL (landscape – Aadhaar-style):    VERTICAL (portrait):
┌──────────────────────────┐               ┌──────────┐
│ [Header]                 │               │ [Header] │
│ ┌──────┐  Name           │               │          │
│ │Photo │  DOB: 11/20/1988│               │ ┌──────┐ │
│ │      │  Gender: MALE   │               │ │Photo │ │
│ └──────┘                 │               │ └──────┘ │
│                          │               │  Name    │
│     MEMBERSHIP ID        │               │  Role    │
│   NAV-2603-00001         │               │  DOB     │
└──────────────────────────┘               │  ID No.  │
                                           └──────────┘
```

**Horizontal layout structure (Aadhaar-style — all 4 card components):**

The horizontal layout uses a **two-section flex-col** approach:

1. **Top section** (`flex-1 flex-row`): Photo LEFT + Details RIGHT (stacked vertically)
   - Name (bold, large)
   - DOB with inline label (`DATE OF BIRTH: value`)
   - Gender with inline label (`GENDER: VALUE`)
   - Custom fields with inline labels
2. **Bottom section** (`mt-auto`): Membership ID label + large mono ID number, centered

```jsx
// Content container for horizontal mode
<div className="absolute top-16 left-6 right-6 bottom-4 flex flex-col z-10">
  {/* Row: Photo LEFT + Details RIGHT */}
  <div className="flex-1 flex flex-row gap-5 items-start">
    <div className="w-28 h-32 shrink-0 relative">  {/* Photo */}
    <div className="flex-1 flex flex-col justify-center space-y-1.5 min-w-0">
      <h3>{name}</h3>
      <p><span>DATE OF BIRTH: </span><span>{dob}</span></p>
      <p><span>GENDER: </span><span>{gender}</span></p>
      {/* Custom fields rendered inline the same way */}
    </div>
  </div>
  {/* Membership ID – large, centered at bottom */}
  <div className="text-center mt-auto pt-2">
    <p>Membership ID</p>
    <p className="font-mono font-bold tracking-widest">{id_number}</p>
  </div>
</div>
```

**Why inline labels (Aadhaar-style)?**

Instead of stacked DOB/Gender in a 2-column grid, the fields now use inline
`LABEL: VALUE` format on each line, similar to an Aadhaar card. This:

- Uses horizontal space more efficiently on landscape cards
- Is more readable at small card sizes
- Looks more professional and standardized
- Provides a familiar ID card format users recognize

**Why Photo LEFT instead of RIGHT?**

The decorative SVG triangles occupy the corners:

- **Top-right triangle**: `w-28 h-28` (112×112px) — gradient accent
- **Bottom-left triangle**: `w-20 h-20` (80×80px) — smaller accent

Placing the photo LEFT avoids the larger top-right triangle entirely. The smaller
bottom-left triangle is at the very corner and doesn't reach the photo (which is
vertically centered with `left-6` = 24px inset).

**Content padding** (`left-6 right-6 top-16 bottom-4`) keeps all elements
well-inset from the decorative corner gradients.

**Membership ID footer** uses `mt-auto` to stick to the bottom of the card,
with the font size increased by 6px over the base value font for prominence.

**Implementation in each card component:**

```jsx
// Outer content — horizontal uses flex-col (two sections), vertical uses flex-col with gap
<div className={`absolute ${
  isVertical
    ? "top-14 left-4 right-4 bottom-4"
    : "top-16 left-6 right-6 bottom-4"
} flex flex-col z-10`}>

// Photo — same size in both modes, LEFT-aligned in horizontal
// w-28 h-32 (112×128px) with rounded border and shadow

// Text — inline label format in horizontal mode (Aadhaar-style)
// Labels: text-slate-400 uppercase font-semibold (or theme-specific color)
// Values: font-semibold, inline with label on same line

// Membership ID — mt-auto pins it to bottom center
// Label: "Membership ID" in small uppercase
// Value: font-mono font-bold tracking-widest, color from gradientColors.start
// Font size: (cs.valueFontSize || 14) + 6 px

// Back content — same flex-direction switch
<div className={`flex-1 flex ${isVertical ? 'flex-col gap-4' : 'gap-6'}`}>
```

### Why the Same Card Component Handles Both?

**Alternative considered:** Separate `IDCardVertical.jsx` and `IDCardHorizontal.jsx` components.

**Why rejected:**

- 4 templates × 2 orientations = 8 components to maintain (currently only 4)
- Duplication of all logic (watermarks, custom fields, QR codes, gradients)
- Any bug fix must be applied in 2 places

**Chosen approach:** Single component with `isVertical` conditional rendering.

- **Pro:** One source of truth, DRY
- **Con:** Slightly more conditional logic in JSX (acceptable trade-off)

---

## StudentCard – College ID Format

The StudentCard was redesigned to match a real academic institution ID card (reference: Cochin University style).

### Front Layout (Vertical)

```
┌──────────────┐
│   [Logo]     │
│  ORG NAME    │
│              │
│  ┌────────┐  │
│  │ Photo  │  │
│  └────────┘  │
│  STUDENT NAME│
│  ID: 23031995│
│  B-Tech EEE  │
│  Blood: A+   │
│  Dept: SOE   │
└──────────────┘
```

### Front Layout (Horizontal – Aadhaar-style)

Same as other cards: Photo LEFT, details RIGHT (with Blood Group), Membership ID at bottom center.

### Back Layout (Both Orientations)

- "PERSONAL DETAILS" heading centered at top
- Address, DOB, custom back fields stacked with inline `LABEL: value` format
- Validity text
- QR Code encoding `id_number` (admission number) with "Admission No." label
- Footer: org name left, "Signature of the Student" line right

### Blood Group Field

Added as a core data field (not a custom field). Available as a dropdown in `Generate.jsx`:
`A+`, `A-`, `B+`, `B-`, `AB+`, `AB-`, `O+`, `O-`

Also added to `MAPPABLE_FIELDS` and `GUESS_RULES` for Google Sheets auto-mapping (aliases: "blood group", "blood_group", "blood type", "bloodgroup").

---

## Card Component Props Interface

All 4 card components now accept this unified prop interface:

```typescript
// TypeScript-style interface (actual code is JSX, not TS)
interface CardProps {
  data: {
    name: string;
    role: string;
    id_number: string;
    dob: string;
    gender: string;
    blood_group: string; // NEW: Blood group (A+, B-, etc.)
    photo_url: string;
    address: string;
    customValues: Record<string, string>;
  };
  showBack?: boolean; // Show back side (default: false)
  orgName?: string; // Organization name
  logoUrl?: string; // Organization logo URL
  customFields?: Array<{
    // Extra field definitions
    label: string;
    side: "front" | "back";
  }>;
  watermark?: {
    // Watermark configuration
    text?: string;
    textOpacity?: number;
    imageUrl?: string;
    imageOpacity?: number;
  };
  renderSide?: "front" | "back"; // Isolate rendering for capture
  gradientColors?: {
    // Decorative gradient colors
    start: string; // hex, e.g. "#1152d4"
    end: string; // hex, e.g. "#ef4444"
  };
  cardStyles?: {
    // NEW: Visual styling overrides
    bgColor: string; // Card background color
    fontColor: string; // Primary text color
    fontFamily: string; // CSS font-family value
    accentColor: string; // Labels / subtle text color
    borderRadius: number; // Corner radius in px
  };
  orientation?: "horizontal" | "vertical"; // Card orientation
  fieldVisibility?: {
    // NEW: Toggle which fields appear on cards
    dob: boolean; //   Show/hide Date of Birth
    gender: boolean; //   Show/hide Gender
    blood_group: boolean; //   Show/hide Blood Group
    role: boolean; //   Show/hide Role / Program
    address: boolean; //   Show/hide Address
  };
  signatureUrl?: string; // NEW: Registrar/Management signature (base64 data URL)
}
```

### Props Added in This Update

| Prop              | Type                           | Default            | Purpose                                        |
| ----------------- | ------------------------------ | ------------------ | ---------------------------------------------- |
| `cardStyles`      | Object                         | Template-dependent | Controls bg, text color, font, accent, radius  |
| `orientation`     | `"horizontal"` \| `"vertical"` | `"horizontal"`     | Switches layout between landscape and portrait |
| `uploadToCloud`   | `boolean`                      | `true`             | Skip Supabase Storage upload when false        |
| `fieldVisibility` | Object                         | All `true`         | Toggle DOB, Gender, Blood Group, Role, Address |
| `signatureUrl`    | `string`                       | `""`               | Registrar signature image (local file upload)  |

---

## Sidebar UI Controls (Generate.jsx)

### Card Orientation Section

```jsx
<div className="flex gap-2">
  <button onClick={() => setOrientation("horizontal")} className={isActive styles}>
    <svg><!-- horizontal rectangle icon --></svg>
    Horizontal
  </button>
  <button onClick={() => setOrientation("vertical")} className={isActive styles}>
    <svg><!-- vertical rectangle icon --></svg>
    Vertical
  </button>
</div>
```

**UX decision:** Toggle buttons with visual rectangle icons rather than a dropdown. The icon shape directly communicates the orientation — users immediately understand what they're selecting.

### Card Styling Section

Each style control follows the same pattern:

```jsx
{
  /* Color control: swatch + hex text input */
}
<div>
  <label>Background Color</label>
  <div className="flex items-center gap-2">
    <input
      type="color"
      value={cardStyles.bgColor}
      onChange={(e) => handleStyleChange("bgColor", e.target.value)}
    />
    <input
      type="text"
      value={cardStyles.bgColor}
      maxLength={7}
      onChange={(e) => handleStyleChange("bgColor", e.target.value)}
    />
  </div>
</div>;
```

**Why both color picker AND text input?**

- Color picker: Quick visual selection
- Text input: Precise hex code entry (e.g., pasting brand colors)
- Both are bidirectionally synced via the same state

### Live Preview Swatch

```jsx
<div
  style={{
    backgroundColor: cardStyles.bgColor,
    color: cardStyles.fontColor,
    fontFamily: cardStyles.fontFamily,
    borderRadius: `${cardStyles.borderRadius}px`,
  }}
>
  Preview Text
</div>
```

Shows how bg + text + font + radius look together before checking the actual card.

---

## How BulkGenerator Receives Customization

```jsx
// Generate.jsx passes all customization props to BulkGenerator
<BulkGenerator
  members={members}
  userId={user?.id}
  ...
  gradientColors={gradientColors}
  cardStyles={cardStyles}
  orientation={orientation}
  uploadToCloud={uploadToCloud}   // NEW: skip Supabase upload when false
/>
```

BulkGenerator then passes these to both off-screen card renders:

```jsx
// BulkGenerator.jsx — off-screen capture elements
<CardComponent
  data={currentMember}
  ...
  gradientColors={gradientColors}
  cardStyles={cardStyles}
  orientation={orientation}
  renderSide="front"
/>
<CardComponent
  data={currentMember}
  ...
  cardStyles={cardStyles}
  orientation={orientation}
  renderSide="back"
/>
```

This ensures bulk-generated cards are **visually identical** to the live preview — same colors, fonts, orientation, and styling.

---

## PDF Sizing with Orientation

The `canvasesToPdfBlob()` function in `downloadHelpers.js` already handles orientation correctly because:

```javascript
const orientation = w > h ? "landscape" : "portrait";
const pdf = new jsPDF({ orientation, unit: "mm", format: [w, h] });
```

When the card is rendered in vertical mode:

- html2canvas captures a taller-than-wide canvas
- `w < h` → jsPDF selects `'portrait'` orientation
- PDF page dimensions match the canvas exactly

No changes to `downloadHelpers.js` were needed — the existing logic is orientation-agnostic.

---

## Template-Specific Defaults

| Property        | IDCard (Custom) | CorporateCard | StudentCard | EventCard   |
| --------------- | --------------- | ------------- | ----------- | ----------- |
| `bgColor`       | `#ffffff`       | `#ffffff`     | `#ffffff`   | `#1e1b4b`   |
| `fontColor`     | `#1e293b`       | `#1e293b`     | `#1e293b`   | `#e0e7ff`   |
| `accentColor`   | `#64748b`       | `#64748b`     | `#64748b`   | `#818cf8`   |
| `fontFamily`    | Public Sans     | Public Sans   | Public Sans | Public Sans |
| `borderRadius`  | 12px            | 12px          | 12px        | 12px        |
| `gradientStart` | `#1152d4`       | `#1152d4`     | `#f97316`   | `#f59e0b`   |
| `gradientEnd`   | `#ef4444`       | `#ef4444`     | `#9333ea`   | `#6366f1`   |

**Why different event defaults?** The Event template has a luxury dark-theme design (indigo/amber). Setting white background with dark text would destroy the design intent. The defaults preserve each template's visual identity while still being fully customizable.

---

## Key Code Snippets

### handleStyleChange Helper

```javascript
const handleStyleChange = (key, value) =>
  setCardStyles((prev) => ({ ...prev, [key]: value }));
```

Uses functional state update to avoid stale closures.

### Derived Variables in Card Components

```javascript
const isVertical = orientation === "vertical";
const cs = cardStyles;
// Then used throughout:
style={{ color: cs.fontColor }}
className={`${isVertical ? 'w-80' : 'w-125'}`}
```

Short aliases (`cs`, `gc`, `isVertical`) keep JSX readable.

### Conditional Flex Direction

```jsx
<div className={`flex ${isVertical ? 'flex-col items-center gap-2' : 'gap-6'}`}>
```

Single Tailwind class toggle switches the entire layout axis.

---

## Testing Scenarios

### Customization

- [ ] Change bg color → card background updates in real-time
- [ ] Change font color → all primary text updates
- [ ] Change accent color → labels and subtitles update
- [ ] Select different font → text renders in new typeface
- [ ] Adjust border radius → corners change from square to rounded
- [ ] Download PDF → captured card matches preview styling
- [ ] Bulk generate → all cards use the same styling

### Orientation

- [ ] Switch to vertical → card becomes portrait, layout reorganizes
- [ ] Switch back to horizontal → card returns to landscape
- [ ] Vertical + download PDF → PDF page is portrait-oriented
- [ ] Vertical + bulk generate → all cards in ZIP are portrait
- [ ] Vertical + all templates → each template renders correctly

### Edge Cases

- [ ] Very dark bg + very dark text → still readable (user responsibility)
- [ ] Monospace font + long name → text truncation works
- [ ] Border radius 0 → sharp corners, no rounding
- [ ] Border radius 24 → maximum rounding, card looks pill-shaped

---

## Future Improvements

1. **Style Presets** — Save/load named presets (e.g., "Company Blue", "Academic Gold")
2. **Per-template defaults** — Auto-switch defaults when changing templates
3. **Web Fonts** — Add Google Fonts with `@font-face` preloading
4. **Pattern Backgrounds** — Subtle patterns (dots, lines) as bg options
5. **Dark/Light Mode Toggle** — Quick switch instead of manual color picking
6. **Export/Import Styles** — JSON export of style configuration for sharing

---

## Supabase Cloud Upload Toggle

### Overview

By default, every generated card is uploaded to Supabase Storage (PNG) and a row is inserted into the `generated_ids` table for Dashboard access with 15-day expiry. The **Upload to Supabase** toggle lets users skip cloud upload entirely — cards are still generated locally as PDF/ZIP.

### State & Flow

```javascript
// Generate.jsx
const [uploadToCloud, setUploadToCloud] = useState(true);

// Passed to BulkGenerator as prop:
<BulkGenerator ... uploadToCloud={uploadToCloud} />
```

### BulkGenerator Behavior

```javascript
// BulkGenerator.jsx — conditional upload
if (uploadToCloud) {
  // Upload PNG to supabase.storage.from("id-cards")
  // Insert row into generated_ids with 15-day expiry
} else {
  cloudWarning = "Skipped (upload disabled)";
}
```

When upload is OFF:

- **Local PDF/ZIP** still works normally (always generated first)
- **Email delivery** still works (uses local PDF blob)
- **Dashboard** won't show the card (no `generated_ids` row)
- **Signed URLs** won't be available (no storage object)
- Progress step "upload" is skipped (faster generation)

### UI Toggle (Generation Settings panel)

An iOS-style toggle switch with cloud upload icon in the Generation Settings section:

```jsx
<button
  onClick={() => setUploadToCloud((v) => !v)}
  className={`... rounded-full ${uploadToCloud ? "bg-indigo-500" : "bg-slate-300"}`}
>
  <span
    className={`... rounded-full bg-white ${uploadToCloud ? "translate-x-5" : "translate-x-0"}`}
  />
</button>
```

---

## ID Generation Pattern

### Format: `{ORG}-{YYMM}-{NNNNN}`

Each member receives a unique ID number when added to the generation queue:

```
NAV-2603-00001
│   │     └── 5-digit zero-padded sequence number
│   └── Year (26) + Month (03) = March 2026
└── First 3 letters of organization name (uppercase)
```

### Implementation

```javascript
// Generate.jsx — generateMemberId(rowNum)
const generateMemberId = (rowNum) => {
  const prefix =
    (orgName || "ORG")
      .replace(/[^A-Za-z]/g, "")
      .slice(0, 3)
      .toUpperCase() || "ORG";
  const now = new Date();
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const seq = String(rowNum).padStart(5, "0");
  return `${prefix}-${yy}${mm}-${seq}`;
};
```

The ID is assigned when a member is added (manually or via Google Sheets import) and
stored in `member.id_number`. The sequence number is based on the member's row position
in the queue (1-based).

---

## html2canvas Compatibility Rules

### CSS Features to AVOID in Card Templates

html2canvas v1.4.1 has limited CSS support. These features cause **visual mismatches** between the live preview and captured/downloaded images:

| CSS Feature                | Issue                                                               | Solution Used                                          |
| -------------------------- | ------------------------------------------------------------------- | ------------------------------------------------------ |
| `blur()` filter            | Ignores `backdrop-filter` and `filter: blur()` entirely             | Replace with `radial-gradient()` for soft glow effects |
| `mix-blend-mode`           | Not supported — element becomes invisible                           | Remove; use direct opacity instead                     |
| `backdrop-blur`            | Ignored — backdrop effects not rendered                             | Remove; use `bg-opacity` with solid color              |
| `oklch()` / `oklab()`      | Not recognized — defaults to black                                  | `fixOklabColors()` utility converts to rgba at capture |
| `color-mix()`              | Not recognized by html2canvas color parser                          | Same `fixOklabColors()` utility handles this           |
| `background-clip: text`    | Not supported — text disappears                                     | Replace with solid color on text                       |
| SVG gradient ID collisions | Multiple cards share same `<linearGradient id>`, only first renders | Use `useId()` hook for unique IDs per instance         |

### fixOklabColors Utility

```
Frontend captures card → fixOklabColors(element) called →
  Walks all DOM descendants →
  For each element's computed style:
    - SIMPLE_COLOR_PROPS: color, backgroundColor, borderColor, outlineColor,
      borderTopColor, borderBottomColor, borderLeftColor, borderRightColor,
      fill, stroke, textDecorationColor
    - COMPLEX_PROPS: background, boxShadow
  If value contains /oklab|oklch|color-mix/i:
    - Parse to rgba via canvas 2D context
    - Inline-set the property on the element
  Returns restore() function to undo all changes
→ html2canvas runs on clean inline styles
→ restore() called in finally block
```

### Radial Gradient Blobs (replacing blur filters)

All 4 card templates replaced `blur-2xl` / `blur-3xl` divs with `radial-gradient`:

```jsx
// BEFORE (broken in html2canvas):
<div className="absolute w-56 h-56 bg-blue-500/20 blur-3xl rounded-full" />

// AFTER (works in html2canvas):
<div
  className="absolute w-56 h-56 rounded-full"
  style={{
    background: `radial-gradient(circle,
      ${gc.start}33 0%,     /* 20% opacity at center */
      ${gc.start}15 40%,    /* 8% at mid-radius */
      transparent 70%)`,    /* fade to transparent */
  }}
/>
```

### Unique SVG Gradient IDs (useId hook)

```jsx
const uid = useId().replace(/:/g, "");   // e.g. "r3" — unique per instance

// SVG linearGradient uses unique ID:
<linearGradient id={`idcard-grad-front-tr-${uid}`} ...>
<path fill={`url(#idcard-grad-front-tr-${uid})`} />
```

This prevents the "first card renders gradients, rest show black" bug when multiple
cards exist simultaneously (e.g., BulkGenerator off-screen captures).

---

## CSV & Google Sheets Export (BulkGenerator Results)

After generation completes, the results panel offers two export options:

### Download CSV

Generates a `.csv` file with columns: `Name, ID Number, Status, Email Status`

```javascript
const csv = [
  "Name,ID Number,Status,Email Status",
  ...results.map(
    (r) =>
      `"${r.name}","${r.id_number || "—"}",${r.success ? "OK" : "FAIL"},"${r.cloudWarning || "—"}"`,
  ),
].join("\n");
```

### Copy for Sheets

Copies tab-separated data to clipboard for direct Ctrl+V paste into Google Sheets:

```javascript
const tsv = results
  .map(
    (r) =>
      `${r.name}\t${r.id_number || "—"}\t${r.success ? "OK" : "FAIL"}\t${r.cloudWarning || "—"}`,
  )
  .join("\n");
navigator.clipboard.writeText(tsv);
```

---

## Decorative Corner Triangles

The IDCard template uses SVG triangles as corner accents:

| Triangle    | Size                | Position          | Opacity | Purpose                   |
| ----------- | ------------------- | ----------------- | ------- | ------------------------- |
| Top-right   | `w-28 h-28` (112px) | `top-0 right-0`   | 0.9     | Primary gradient accent   |
| Bottom-left | `w-20 h-20` (80px)  | `bottom-0 left-0` | 0.8     | Secondary gradient accent |

**Sizing rationale**: Triangles are sized to be decorative corner accents without
overlapping the content area. The content is inset `left-10 right-10 top-14 bottom-3`
(40px horizontal, 56px top, 12px bottom padding), keeping all text and photos within
the safe zone between the triangles.

Both triangles use the same SVG path with unique gradient IDs per card instance:

```svg
<path d="M0 0H100V100L50 50L0 0Z" fill={url(#unique-id)} fillOpacity="0.9" />
```

The bottom-left triangle is rotated 180° to mirror the shape into the opposite corner.
