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

## Single Card Download (Generate.jsx)

```
User clicks "Download PDF" on the preview
    |
    v
captureRef(previewFrontRef) --> front canvas
captureRef(previewBackRef)  --> back canvas
    |
    v
canvasesToPdfBlob(frontCanvas, backCanvas) --> 2-page PDF blob
downloadBlob(pdfBlob, 'name_id_card.pdf') --> triggers browser download
```

```
User clicks "Download JPEG" on the preview
    |
    v
captureRef(currently-visible-ref)  --> canvas
canvasToJpegBlob(canvas) --> JPEG blob
downloadBlob(blob, 'name_id_card.jpg') --> triggers browser download
```

**Note:** JPEG only captures the currently visible side (front or back), while PDF always includes both pages.

---

## downloadHelpers.js - Utility Functions

| Function               | Purpose                                             |
| ---------------------- | --------------------------------------------------- |
| `pxToMm(px, scale)`   | Converts canvas pixels to millimetres for jsPDF     |
| `canvasesToPdfBlob()`  | Creates a 2-page PDF blob from front + back canvas  |
| `downloadBlob()`       | Triggers a browser download for any Blob            |
| `canvasToJpegBlob()`   | Converts canvas to JPEG blob (quality: 0.95)        |
| `canvasToPngBlob()`    | Converts canvas to lossless PNG blob                |
| `safeFileName()`       | Builds zero-padded safe filenames for ZIP entries    |

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

## Signed URL Generation (Dashboard)

When a user wants to view or download from the Dashboard:

```javascript
const { data, error } = await supabase.storage
  .from("id-cards")
  .createSignedUrl(filePath, 60 * 60); // 3600 seconds = 1 hour
```

### Why 1 hour?

- Long enough for the user to download/share.
- Short enough to limit exposure if the URL is leaked.
- The user can always generate a new signed URL by clicking the download button again.

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
  (meta) => { setProgress(p => ({ ...p, zipPercent: Math.round(meta.percent) })); }
);
```

- **DEFLATE compression** at level 6 (balanced speed/size)
- **Progress callback** updates the UI with compression percentage
- **file-saver** `saveAs()` triggers the browser download dialog

### Typical sizes:
- Single card PDF: ~150-300 KB (depends on photo)
- 50-card ZIP: ~10-15 MB
- 200-card ZIP: ~40-60 MB (max daily batch)
