# 05 - Storage & Download Flow

## Overview

Generated ID card images are stored in **Supabase Storage**, which is an S3-compatible object storage service. Files are NOT publicly accessible - they require **signed URLs** for access.

In addition to cloud storage, the platform provides **local delivery formats**:

- **Single card** - PDF (2-page front+back) or JPEG download directly from the preview
- **Bulk generation** - All cards bundled as a ZIP of 2-page PDFs, auto-downloaded after generation

---

## Bucket Configuration

### Bucket: `id-cards`

| Setting                | Value          | Reason                                      |
| ---------------------- | -------------- | ------------------------------------------- |
| **Name**               | `id-cards`     | Descriptive, matches the use case           |
| **Public**             | `false`        | Files should NOT be accessible without auth |
| **File size limit**    | 5 MB (default) | ID card PNGs are typically 200-500 KB       |
| **Allowed MIME types** | `image/png`    | Only PNG uploads are allowed                |

---

## Private vs Public Buckets

| Feature    | Public Bucket                                                      | Private Bucket (used here)                |
| ---------- | ------------------------------------------------------------------ | ----------------------------------------- |
| Access     | Anyone with the URL                                                | Only authenticated users with signed URLs |
| URL format | `https://project.supabase.co/storage/v1/object/public/bucket/file` | Signed URL with token parameter           |
| Security   | None                                                               | Signed URL has expiry time                |
| Use case   | Logos, public assets                                               | User-specific files, sensitive documents  |

### Why private?

ID cards contain **personal information** (name, photo, ID number). Making them publicly accessible would be a privacy violation. A private bucket with signed URLs ensures:

- Only the authenticated owner can access their files.
- URLs expire after a set time (1 hour in our case).
- No permanent direct link exists.

---

## File Path Convention

Files are stored using this structure:

```
id-cards/
  +-- {user_uuid}/
       +-- John_Doe_1707984000000.png
       +-- Jane_Smith_1707984001000.png
       +-- Alex_Morgan_1707984002000.png
```

### Pattern: `{user_id}/{safe_name}_{timestamp}.png`

- **`{user_id}`** - The authenticated user's UUID. Used by storage RLS policies to restrict access.
- **`{safe_name}`** - The member's name with non-alphanumeric characters replaced by underscores. Prevents path traversal attacks.
- **`{timestamp}`** - `Date.now()` ensures uniqueness even if the same name is used multiple times.

---

## Upload Flow (Bulk Generation)

```
BulkGenerator sets currentMember
    |
    v
React re-renders off-screen front + back cards (via refs)
    |
    v
html2canvas(frontRef, { scale: 2, useCORS: true })  --> front canvas
html2canvas(backRef,  { scale: 2, useCORS: true })   --> back canvas
    |
    v
canvasToPngBlob(frontCanvas)  --> PNG blob (for Supabase upload)
    |
    v
supabase.storage.from('id-cards').upload(filePath, blob, {
  contentType: 'image/png',
  upsert: false
})
    |
    v
supabase.from('generated_ids').insert({
  user_id: userId,
  file_url: filePath,
  expires_at: now + 15 days
})
    |
    v  (simultaneously)
canvasesToPdfBlob(frontCanvas, backCanvas) --> 2-page PDF blob
    |
    v
zip.file(safeFileName(name, index, 'pdf'), pdfBlob)
    |
    [repeat for all members]
    |
    v
zip.generateAsync({ type: 'blob' }) --> ZIP blob
saveAs(zipBlob, 'aarannu_id_cards.zip')   --> browser downloads
```

### Key details:

1. **`scale: 2`** - html2canvas renders at 2x resolution for crisp output.
2. **`useCORS: true`** - Allows html2canvas to capture cross-origin images (or proxied Google Drive images).
3. **Dual capture** - Two off-screen refs render the same card component with `showBack=false` and `showBack=true` respectively.
4. **PNG for cloud, PDF for user** - Supabase Storage gets the PNG (used by Dashboard). The user gets a 2-page PDF.
5. **Daily limit check** - Before starting, queries `generated_ids` for today's count. If >= 200, generation is blocked.

---

## Single Card Download + Cloud Upload (Generate.jsx)

Every single-card download now **also persists the card to Supabase** so it appears in the Dashboard.

### PDF Download

```
User clicks "Download PDF" on the preview
    |
    v
captureRef(previewFrontRef) --> front canvas  (waits for images to load)
captureRef(previewBackRef)  --> back canvas
    |
    v
canvasesToPdfBlob(frontCanvas, backCanvas) --> 2-page PDF blob
downloadBlob(pdfBlob, 'name_id_card.pdf') --> triggers browser download
    |
    v  (async, non-blocking)
uploadCardToSupabase(frontCanvas, memberName)
    ├── canvasToPngBlob(frontCanvas)  --> PNG blob
    ├── supabase.storage.upload()     --> saved to id-cards bucket
    └── supabase.from('generated_ids').insert()  --> 15-day expiry row
```

### JPEG Download

```
User clicks "Download JPEG" on the preview
    |
    v
captureRef(visible-side-ref) --> canvas
canvasToJpegBlob(canvas) --> JPEG blob
downloadBlob(blob, 'name_side.jpg') --> triggers browser download
    |
    v  (async, non-blocking)
captureRef(previewFrontRef) --> front canvas
uploadCardToSupabase(frontCanvas, memberName) --> uploads front side to Supabase
```

**Key details:**

- JPEG only captures the currently visible side, while PDF always includes both pages.
- Upload failures are caught and logged via `console.warn` but **never block** the local download.
- The `uploadCardToSupabase()` helper is a standalone async function that encapsulates the upload + DB insert.

### Image Preloading

`captureRef()` now waits for **all `<img>` elements** inside the card to finish loading before invoking `html2canvas`. This prevents blank/broken photos especially with proxied Google Drive images:

```javascript
const imgs = ref.current.querySelectorAll("img");
await Promise.all(
  [...imgs].map(
    (img) =>
      new Promise((res) => {
        if (img.complete) return res();
        img.onload = res;
        img.onerror = res; // don't block on broken images
      }),
  ),
);
```

---

## downloadHelpers.js - Utility Functions

| Function              | Purpose                                            |
| --------------------- | -------------------------------------------------- |
| `pxToMm(px, scale)`   | Converts canvas pixels to millimetres for jsPDF    |
| `canvasesToPdfBlob()` | Creates a 2-page PDF blob from front + back canvas |
| `downloadBlob()`      | Triggers a browser download for any Blob           |
| `canvasToJpegBlob()`  | Converts canvas to JPEG blob (quality: 0.95)       |
| `canvasToPngBlob()`   | Converts canvas to lossless PNG blob               |
| `safeFileName()`      | Builds zero-padded safe filenames for ZIP entries  |

### PDF sizing math:

```
html2canvas captures at scale = 2
Real pixel width = canvas.width / 2
Millimetres = real_px * 25.4 / 96   (96 DPI standard screen)

Example: 500px card at scale 2 = 1000 canvas px
  -> 500 real px -> 132.3 mm wide
  -> jsPDF page sized exactly to the card
```

---

## Dashboard — Thumbnail Grid & Downloads

The Dashboard displays generated IDs as a **responsive card grid** with thumbnails.

### DashboardCard Component

Each card in the grid is rendered by a `DashboardCard` subcomponent that:

1. Loads a signed-URL thumbnail on mount (via `useEffect`)
2. Displays: member name, creation date, expiry badge
3. Expiry badge colors: **green** (>7 days), **amber** (3-7 days), **red** (≤3 days)
4. Hover effect scales the thumbnail and shows an eye icon overlay

### Signed URL Generation (for thumbnails + preview)

```javascript
const { data, error } = await supabase.storage
  .from("id-cards")
  .createSignedUrl(filePath, 60 * 60); // 3600 seconds = 1 hour
```

Signed URLs are **cached in parent state** (`signedUrls` map) to avoid re-generating on every render.

### Download (blob-based)

The download button uses `supabase.storage.download()` instead of signed URLs to avoid cross-origin `<a download>` restrictions:

```javascript
const { data, error } = await supabase.storage
  .from("id-cards")
  .download(filePath);

const blobUrl = URL.createObjectURL(data);
const a = document.createElement("a");
a.href = blobUrl;
a.download = fileName;
a.click();
URL.revokeObjectURL(blobUrl);
```

**Why not signed URL + `<a download>`?**
Browsers silently ignore the `download` attribute on cross-origin URLs. The Supabase JS client's `.download()` method fetches the file through the SDK (same-origin from the browser's perspective), returning a Blob that can be saved reliably.

Fallback: if `.download()` fails, the card opens the signed URL in a new tab.

### Why 1-hour signed URL TTL?

- Long enough for the user to browse thumbnails in a session.
- Short enough to limit exposure if the URL is leaked.
- The user can always regenerate by refreshing.

---

## Google Drive Image Proxy

Member photos hosted on Google Drive cannot be loaded by `html2canvas` due to CORS restrictions. The platform solves this with a backend proxy:

### Frontend (proxyImage.js):

```javascript
export function proxyImageUrl(url) {
  if (isGoogleDriveUrl(url)) {
    return `${BACKEND}/api/proxy/image?url=${encodeURIComponent(url)}`;
  }
  return url;
}
```

### Backend (proxyRoutes.js):

- Normalizes Drive sharing URLs to direct-download format
- Fetches the image server-side (no CORS)
- Validates content-type is `image/*`
- Limits response to 10 MB
- Returns the image bytes to the browser

This allows html2canvas to render Drive-hosted photos as same-origin images.

---

## ZIP Compression

### JSZip Configuration:

```javascript
const zipBlob = await zip.generateAsync(
  { type: "blob", compression: "DEFLATE", compressionOptions: { level: 6 } },
  (meta) => {
    setProgress((p) => ({ ...p, zipPercent: Math.round(meta.percent) }));
  },
);
```

- **DEFLATE compression** at level 6 (balanced speed/size)
- **Progress callback** updates the UI with compression percentage
- **file-saver** `saveAs()` triggers the browser download dialog

### Typical sizes:

- Single card PDF: ~150-300 KB (depends on photo)
- 50-card ZIP: ~10-15 MB
- 200-card ZIP: ~40-60 MB (max daily batch)

---

## Impact of Card Customization & Orientation on Downloads

### Orientation-Aware PDF Generation

The `canvasesToPdfBlob()` function in `downloadHelpers.js` automatically handles vertical cards:

```javascript
const w = pxToMm(frontCanvas.width); // narrower for vertical
const h = pxToMm(frontCanvas.height); // taller for vertical
const orientation = w > h ? "landscape" : "portrait"; // auto-detects

const pdf = new jsPDF({ orientation, unit: "mm", format: [w, h] });
```

- **Horizontal cards** → `w > h` → landscape PDF page
- **Vertical cards** → `w < h` → portrait PDF page
- **No code changes needed** — the existing math is orientation-agnostic

### Custom Styling Capture

All card styling (bgColor, fontColor, fontFamily, accent, borderRadius) is applied via inline CSS `style={}` attributes. html2canvas captures these accurately:

```
Card Component (React)
    │  style={{ backgroundColor: '#1e1b4b', fontFamily: 'Georgia' }}
    │
    ▼  html2canvas reads computed styles
    │
Canvas (in-memory)  → All custom colors/fonts baked into pixels
    │
    ▼
PNG/PDF → Final output reflects all customization
```

**Important:** System fonts are used exclusively to ensure html2canvas can always render text. Web fonts (Google Fonts) would risk capture failures if the font hasn't loaded when html2canvas runs.

### File Size Impact

| Customization        | Size Impact | Why                                          |
| -------------------- | ----------- | -------------------------------------------- |
| Custom bg color      | Negligible  | Flat colors compress well in PNG             |
| Gradient colors      | Negligible  | Gradients are few pixels of SVG overlay      |
| Font family          | None        | Text is rasterized, font doesn't affect size |
| Border radius        | None        | CSS property, no extra pixels                |
| Vertical orientation | Similar     | Same total pixel area as horizontal          |
