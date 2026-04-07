# 15 — PDF & Image Generation Pipeline

Technical reference for how ID card PDFs and images are produced. There are **two separate approaches** in this codebase. This document covers both.

---

## Overview

| Approach | Where it runs | Library | When used |
|---|---|---|---|
| **Client-side PDFKit** | Browser | `pdfkit` + `blob-stream` | Download button on Generate page, ProjectDashboard bulk send |
| **Server-side Puppeteer** | Backend (Node.js) | `puppeteer` | `/api/ids/generate` (legacy route) |

They produce the same visual output. The architectural difference is *where* Chrome runs.

---

## Approach 1 — Client-Side PDFKit (Primary)

### What libraries are used

| Library | Purpose |
|---|---|
| `pdfkit` | Programmatic PDF construction in JavaScript |
| `blob-stream` | Bridges PDFKit's Node.js readable stream to a browser Blob |
| `qrcode` | Generates QR code as data URL |

PDFKit was built for Node.js but with the help of Vite's bundler and polyfills it runs in the browser via `pdfkit/js/pdfkit.standalone.js`.

`blob-stream` is a small shim that makes PDFKit's piped output available as a `Blob` (which you can then download or convert to base64).

### The overall flow

```
User clicks "Download PDF"
        │
        ▼
generatePDF(params)
        │
        ├── [parallel] load all images as data URLs
        │     ├── member photo       → fetchImageAsDataUrl(photoUrl)
        │     ├── org logo           → fetchImageAsDataUrl(logoUrl)
        │     ├── watermark (if any) → fetchImageAsDataUrl(watermarkUrl)
        │     └── signature (if any) → fetchImageAsDataUrl(signatureUrl)
        │
        ├── [parallel] prefetch fonts
        │     └── download .ttf files from Google Fonts CDN
        │
        ├── [parallel] generate QR code
        │     └── QRCode.toDataURL(cardId) → PNG data URL
        │
        ▼
new PDFDocument({ size: [pageWidth, pageHeight], margin: 0, compress: false })
doc.pipe(blobStream())
        │
        ├── drawFront(doc, ...)
        │
        ├── doc.addPage()
        │
        └── drawBack(doc, ...)
        │
        ▼
doc.end()
        │
        ▼
stream.on('finish') → blob = stream.toBlob('application/pdf')
        │
        ▼
downloadBlob(blob, 'MemberName_ID.pdf')
```

### Card dimensions (CR-80 standard)

ID cards worldwide follow the ISO 7810 ID-1 (CR-80) standard — same physical size as a credit card:

```
Horizontal: 85.6mm wide × 53.98mm tall
Vertical:   53.98mm wide × 85.6mm tall
```

**In PDFKit points** (1 inch = 72 points, 1mm ≈ 2.83465 points):

```js
const MM = 2.83465;
const CARD_H = { w: 85.6 * MM, h: 53.98 * MM };  // → 242.7 × 153.0 pt
const CARD_V = { w: 53.98 * MM, h: 85.6 * MM };  // → 153.0 × 242.7 pt
const PAD = 2 * MM;                                 // 2mm padding
```

The PDF page is card + 2mm padding on all sides. The card sits on a black page background (so rounded corners show cleanly against a dark border when printing).

### Font management

PDFKit only has three built-in fonts: `Helvetica`, `Courier`, and `Times-Roman`.

For custom fonts (Inter, Public Sans, etc.), the code:
1. Downloads the `.ttf` file from Google Fonts CDN as an `ArrayBuffer`
2. Registers it with PDFKit via `doc.registerFont(name, buffer)`
3. Uses it with `doc.font(name).fontSize(14).text("Hello")`

```js
// Fetching a TTF and registering it
const buffer = await fetchFontBuffer(ttfUrl);         // returns ArrayBuffer
doc.registerFont("PublicSans-Regular", buffer);
doc.font("PublicSans-Regular");
```

Fonts not in the Google Fonts URL map (Arial, Georgia, etc.) fall back to the closest PDFKit built-in automatically.

### Gradient rendering

PDFKit has limited gradient support. To get reliable cross-browser diagonal gradients, the code uses a **color interpolation strip technique**:

```js
// Draw 120 thin vertical rectangles with interpolated RGB colors
// +0.3px overlap prevents hairline gaps between strips
function drawGradientH(doc, x, y, w, h, colorA, colorB, steps = 120) {
  const sw = w / steps;
  for (let i = 0; i < steps; i++) {
    const t = i / (steps - 1);
    const color = lerpColor(colorA, colorB, t);      // linear interpolate
    doc.rect(x + i * sw, y, sw + 0.3, h).fill(color);
  }
}
```

### Card background modes

| Mode | Description |
|---|---|
| `fullGradientBg: true` | Entire card face uses the gradient. A white base is drawn first, then the gradient is overlaid at `gradientOpacity` (0–1, default 0.55) |
| `fullGradientBg: false` | Card uses a solid `bgColor`. Gradient appears only as corner triangles (top-right and bottom-left) |

### Image loading (CORS problem + solution)

External images (Google Drive thumbnails, Cloudinary URLs, etc.) block browser fetch due to CORS. Solution: proxy every external image through the backend.

```js
// Every image URL is rewritten to:
/api/proxy/image?url=<encoded-original-url>

// The backend proxy endpoint fetches the image server-side
// (no CORS restriction on server) and streams the bytes back.
```

After fetching via proxy, images are converted:
```
fetch() → Blob → FileReader.readAsDataURL() → data:image/... base64 string
→ Split off the data: prefix → Buffer.from(base64, 'base64')
→ PDFKit doc.image(buffer, x, y, { width, height })
```

### QR code

```js
const qrDataUrl = await QRCode.toDataURL(cardId, {
  width: 200,
  margin: 1,
  color: { dark: '#000000', light: '#ffffff' },
});
// cardId is the UUID from generated_cards.id
// Scanning the QR navigates to: /verify/{cardId}
```

### Photo circle (clipped)

PDFKit has no circular clip built-in. To render a circular photo:
```js
// 1. Define a circular clipping path
doc.save()
   .circle(cx, cy, radius)
   .clip();

// 2. Draw the image inside the clip region
doc.image(photoBuffer, cx - radius, cy - radius, { width: radius * 2, height: radius * 2 });

// 3. Remove the clip (restore state)
doc.restore();
```

### Blob download

```js
const stream = doc.pipe(blobStream());
doc.end();

stream.on('finish', () => {
  const blob = stream.toBlob('application/pdf');
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${memberName}_ID.pdf`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);  // release memory
});
```

---

## Approach 2 — Server-Side Puppeteer (Legacy / Single-tenant)

### What is Puppeteer

Puppeteer is a Node.js library that controls a real Chromium (headless Chrome) browser programmatically. "Headless" means the browser runs without a visible window — it's fully automated.

Using a real browser means the card HTML/CSS renders identically to what a user sees in their browser. No custom PDF drawing code needed — Chrome handles fonts, gradients, shadows, and layout.

### The flow

```
POST /api/ids/generate (or internal call)
        │
        ▼
cardRenderer.renderCard(params)
        │
        ├── getBrowser()           ← launch or reuse shared Chromium instance
        ├── browser.newPage()      ← open a new tab
        ├── page.setViewport(...)  ← set pixel dimensions + DPI scaling
        │
        ├── Build render URL:
        │   ${FRONTEND_URL}/render-card#{base64-encoded card payload}
        │
        ├── page.goto(renderUrl, { waitUntil: 'networkidle0' })
        │   ← wait until all network requests finish (fonts, images loaded)
        │
        ├── page.waitForSelector("[data-render-ready='true']", { timeout: 20s })
        │   ← React component sets this attr when rendering is complete
        │
        ├── sleep(800ms)           ← let fonts/images settle visually
        │
        ├── page.$('#card-front').screenshot({ type: 'png' })  → frontPng Buffer
        ├── page.$('#card-front').screenshot({ type: 'jpeg', quality: 95 }) → frontJpeg
        ├── page.$('#card-back').screenshot({ type: 'png' })   → backPng Buffer
        │
        ├── Build PDF from screenshots:
        │   ├── Create HTML: <img src="data:image/png;base64,...">
        │   ├── Set @page { size: Wmm Hmm } in CSS
        │   ├── browser.newPage() → second temporary page
        │   ├── pdfPage.setContent(html)
        │   ├── pdfPage.pdf({ width, height, printBackground: true })
        │   └── pdfPage.close()
        │
        └── page.close()           ← close this render tab (browser stays alive)
        │
        ▼
Return { frontPng, frontJpeg, backPng, pdfBuffer, pdfBase64 }
```

### The `/render-card` frontend route

This is a hidden React route (`pages/RenderCard.jsx`) that the backend navigates Puppeteer to. It:

1. Reads `window.location.hash` to get the card payload
2. `JSON.parse(decodeURIComponent(hash))` to get the card data
3. Renders `<CardFront id="card-front" ... />` and `<CardBack id="card-back" ... />`
4. Sets `document.body.setAttribute('data-render-ready', 'true')` when done

The page is never shown to users — it has no nav, no auth check, and renders in a minimal layout.

### Why pass data via URL hash (#)?

The `#` (hash / fragment) part of a URL is **browser-only**. The browser never sends it to the server. This means:

- Large amounts of JSON (50KB+) can be passed without appearing in server access logs
- No extra API call from the render page back to the backend to fetch card data
- The render page is completely stateless — anyone can open it with different data

### Browser instance pooling

Launching Chromium takes ~300–500ms the first time. The backend keeps **one browser alive** and reuses it:

```js
let browserInstance = null;

const getBrowser = async () => {
  if (browserInstance && browserInstance.connected) {
    return browserInstance;   // reuse: ~0ms
  }
  browserInstance = await puppeteer.launch({
    headless: 'new',          // uses new headless mode (not legacy)
    args: [
      '--no-sandbox',         // required in most Linux/Docker environments
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',   // prevents /dev/shm memory issues in containers
      '--disable-gpu',             // no GPU needed for screenshots
    ]
  });

  // Auto-reset if the browser crashes
  browserInstance.on('disconnected', () => { browserInstance = null; });
  return browserInstance;
};
```

Each card render opens a new **page** (tab), uses it, and closes it. The browser stays running. This makes subsequent renders essentially instant.

### Viewport and device scale

```js
await page.setViewport({
  width: isVertical ? 700 : 900,   // px — wide enough to fit the card
  height: isVertical ? 1000 : 700,
  deviceScaleFactor: 2,            // 2x = "Retina" DPI
});
```

`deviceScaleFactor: 2` means every CSS pixel becomes 2 physical pixels in the screenshot. A card declared as 350px CSS wide becomes a 700px PNG. Text is sharper, gradients smoother.

### PDF sizing (CR-80)

```js
const cardW = isVertical ? 53.98 : 85.6;  // mm
const cardH = isVertical ? 85.6 : 53.98;  // mm
const padding = 2;                          // mm

// CSS  @page inside the HTML:
@page { size: ${pageW}mm ${pageH}mm; margin: ${padding}mm; }
img { width: ${cardW}mm; height: ${cardH}mm; display: block; }
```

This creates a PDF page that is physically card-sized. Send it to any professional printer and it will print at the correct 85.6mm × 53.98mm dimensions.

---

## Common Debugging Scenarios

### PDF is blank or shows placeholder

**Cause**: The `/render-card` route didn't finish loading before the screenshot was taken.

**Check**:
1. Is `FRONTEND_URL` in `backend/.env` pointing to a running frontend?
2. Is the `[data-render-ready='true']` attribute actually being set by `RenderCard.jsx`?
3. Is there a console error in Puppeteer? Add `page.on('console', msg => console.log(msg.text()))` before `goto()`.

### Photos not loading in PDF

**Cause**: The image URL is not accessible from the server (private Google Drive link, expired Supabase signed URL, CORS-blocked CDN).

**Fix**: Use the `/api/proxy/image` endpoint for all external images.

### Font not applying in client-side PDF

**Cause**: The TTF URL for that font is not in `GOOGLE_FONT_URLS`.

**Fix**: Add the font variant's direct TTF URL from `fonts.gstatic.com`. The URL can be found by inspecting the font in Google Fonts → Inspect → Network tab → filter by `.ttf`.

### Puppeteer fails on first run (Windows)

**Cause**: Puppeteer bundles its own Chromium but Windows Defender or a firewall may block it.

**Fix**: Allow `node.exe` (or the bundled `chrome.exe`) through Windows Defender Firewall → inbound/outbound rules.

### PDF page size is wrong

**Cause**: If the Puppeteer page's `@page` CSS is not applied (`printBackground: true` is missing, or the HTML didn't load).

**Check**: Confirm `pdfPage.setContent(html, { waitUntil: 'load' })` completes before `pdfPage.pdf(...)`.
