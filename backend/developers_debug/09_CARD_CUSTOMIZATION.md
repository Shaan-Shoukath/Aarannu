# 09 – Card Customization & Orientation (Backend Perspective)

## Overview

While the card customization and orientation system is entirely **frontend-driven** (no backend API changes required), the backend is affected in the following areas:

1. **Storage** — Vertical cards produce taller PNG files; the storage bucket handles them identically
2. **Proxy** — Custom-styled cards with Google Drive photos still route through the image proxy
3. **Cleanup** — Expired cards (regardless of styling/orientation) are cleaned up by the same scheduler
4. **No new endpoints needed** — All customization state is client-side; nothing is persisted to the DB

This document explains why no backend changes were needed and what would change if customization data were persisted.

---

## Why No Backend Changes?

### Current Architecture Decision

```
                           ┌─────────────────────────┐
                           │  Card Customization      │
                           │  (bgColor, fontColor,    │
                           │   fontFamily, accentColor,│
                           │   borderRadius,           │
                           │   orientation)            │
                           └──────────┬──────────────┘
                                      │
                                      │  Lives entirely in
                                      │  React state (Generate.jsx)
                                      │
                          ┌───────────▼───────────────┐
                          │   html2canvas captures     │
                          │   the styled card as PNG   │
                          │                            │
                          │   PNG is "baked" — contains │
                          │   all visual styling       │
                          └───────────┬───────────────┘
                                      │
                                      ▼
                          ┌───────────────────────────┐
                          │   Supabase Storage         │
                          │   Stores the final PNG     │
                          │   (styling already applied)│
                          └───────────────────────────┘
```

**Key insight:** The PNG uploaded to Supabase Storage is a **rasterized image** — it already contains all the visual customization (colors, fonts, layout). The backend never needs to know what colors or fonts were used because the output is a flat image.

> **Note — oklch/oklab color compatibility:**  
> Tailwind CSS v4 internally outputs colors in `oklch()` format, which `html2canvas` and `jsPDF` cannot parse.  
> This is fixed on the frontend via HEX-only `@theme` overrides in `index.css` (see `frontend/developers_debug/07_LIBRARIES_USED.md`, Tailwind CSS section).  
> The backend is unaffected since it never processes CSS colors — it only stores the final rasterized PNG.

### Comparison: Client-Side vs Server-Side Customization

| Approach              | Client-Side (current)            | Server-Side (alternative)      |
| --------------------- | -------------------------------- | ------------------------------ |
| Rendering             | html2canvas in browser           | Puppeteer/Playwright on server |
| Customization storage | React state (ephemeral)          | Database table (persistent)    |
| Performance           | Zero server load                 | CPU-intensive rendering        |
| Latency               | Instant preview                  | Network round-trip per render  |
| Scalability           | Unlimited (each browser renders) | Server bottleneck              |
| Offline               | Views work offline               | Requires connectivity          |
| Complexity            | Simple                           | Needs headless browser setup   |

**Why client-side was chosen:**

- No extra server infrastructure (Puppeteer is heavy)
- Instant real-time preview as users tweak colors
- No additional Supabase tables or API endpoints
- Scales naturally — each user's browser does the rendering work

---

## Storage Impact

### File Size Variations

| Orientation            | Typical PNG Size | Notes                                   |
| ---------------------- | ---------------- | --------------------------------------- |
| Horizontal (landscape) | 200–500 KB       | Standard CR-80 at 2x scale              |
| Vertical (portrait)    | 200–500 KB       | Same pixel area, different aspect ratio |
| Custom bg color        | No change        | Flat color compresses well in PNG       |
| Gradient-heavy         | Slight increase  | Gradients compress less efficiently     |

The 5 MB bucket file size limit is never reached regardless of customization choices.

### Storage Path Convention (Unchanged)

```
id-cards/{user_id}/{safe_name}_{timestamp}.png
```

No orientation or style metadata is encoded in the path. The PNG is self-contained.

---

## Proxy Route Impact

The Google Drive image proxy (`GET /api/proxy/image`) is **unaffected** by card customization:

```
1. User sets custom bgColor, fontFamily, etc. in sidebar
2. Card component renders with custom styles
3. Member photo (if Google Drive URL) is proxied through backend
4. html2canvas captures the styled card (including proxied photo)
5. PNG uploaded to Supabase Storage
```

The proxy only cares about the image URL — it doesn't know or care what styling the card uses.

---

## What Would Change If Customization Were Persisted

If a future version needs to save card styles per template or per user:

### New Table (Hypothetical)

```sql
CREATE TABLE public.card_styles (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id      UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  template_id  TEXT NOT NULL DEFAULT 'custom',
  style_name   TEXT DEFAULT 'Default',
  bg_color     TEXT DEFAULT '#ffffff',
  font_color   TEXT DEFAULT '#1e293b',
  font_family  TEXT DEFAULT '''Public Sans'', sans-serif',
  accent_color TEXT DEFAULT '#64748b',
  border_radius INTEGER DEFAULT 12,
  gradient_start TEXT DEFAULT '#1152d4',
  gradient_end   TEXT DEFAULT '#ef4444',
  orientation  TEXT DEFAULT 'horizontal' CHECK (orientation IN ('horizontal', 'vertical')),
  created_at   TIMESTAMPTZ DEFAULT now(),
  updated_at   TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_card_styles_user ON public.card_styles(user_id);

-- RLS
ALTER TABLE public.card_styles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own styles"
  ON public.card_styles
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
```

### New Backend Endpoints (Hypothetical)

```
GET    /api/styles           → List user's saved styles
POST   /api/styles           → Save a new style preset
PUT    /api/styles/:id       → Update a style preset
DELETE /api/styles/:id       → Delete a style preset
```

### New Service Functions (Hypothetical)

```javascript
// services/styleService.js
export async function getUserStyles(userId) { ... }
export async function saveStyle(userId, styleData) { ... }
export async function updateStyle(userId, styleId, styleData) { ... }
export async function deleteStyle(userId, styleId) { ... }
```

**Current decision:** Not implemented. The ephemeral React state approach is simpler and sufficient for the current feature set. Style persistence would add value only if users need to share styles across sessions or devices.

---

## Automated Cleanup (Unchanged)

The cleanup scheduler in `server.js` is **completely unaffected** by customization:

```javascript
// server.js — runs every 6 hours
const runCleanup = async () => {
  const { error, deletedFiles } = await cleanupExpiredIds();
  // Deletes expired generated_ids rows + their PNG files
};
```

- Cleanup looks at `expires_at` timestamp only
- Doesn't inspect file contents, orientation, or styling
- Same 15-day expiry regardless of customization

---

## Rate Limiting (Unchanged)

The daily upload limit (200 cards/day) applies equally regardless of card styling or orientation:

```javascript
// BulkGenerator.jsx — client-side check
const { used } = await checkDailyUsage();
const remaining = DAILY_LIMIT - used;
```

Each card counts as 1 upload, whether it's horizontal, vertical, custom-colored, or default.

---

## Key Takeaway

The card customization system demonstrates good **separation of concerns**:

- **Frontend** owns all visual customization logic
- **Backend** owns storage, authentication, and cleanup
- **The PNG file** is the boundary — it's the serialized output of all styling decisions
- No new API surface area was needed

This is a deliberate architectural choice that keeps the backend simple while giving users maximum creative freedom on the client side.
