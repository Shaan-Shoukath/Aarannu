# Level 10 — PDF Generation and Server-Side Rendering

How to turn HTML/CSS into a pixel-perfect PDF file — from first principles.

---

## Part A — Why Generating PDFs Is Harder Than It Sounds

### The naive approach (and why it fails)

Your first instinct might be: "HTML looks great in the browser — just print it to PDF."

The problem: there's no built-in server-side "print to PDF" in Node.js. The options are:

| Option | Problem |
|---|---|
| Tell the user to hit Ctrl+P | No control over output, not automatable |
| `canvas` + custom drawing code | You basically re-implement a browser layout engine |
| `wkhtmltopdf` | Abandoned, poor CSS support, binary dependency |
| `jsPDF` (raw) | No HTML rendering — you draw lines and text manually |
| **Puppeteer (real Chrome)** | ✅ Perfect CSS support — it IS a browser |
| **PDFKit (code-driven)** | ✅ Always consistent — you describe the PDF programmatically |

This project uses **both** depending on the context. Understanding when to use each is important.

---

## Part B — The Two Approaches Compared

```
┌──────────────────────────────────────────────────────────────────┐
│  APPROACH 1: PDFKit (client-side, in the browser)                │
│                                                                  │
│  You describe the PDF using code:                                │
│    doc.rect(x, y, w, h).fill('#2563eb')                         │
│    doc.fontSize(14).text('Ali Hassan', x, y)                     │
│    doc.image(photoBuffer, x, y, { width: 80 })                   │
│                                                                  │
│  ✅ No server round-trip — runs entirely in the browser          │
│  ✅ Consistent across environments                               │
│  ✅ Precise pixel control                                        │
│  ❌ You must manually position every element                     │
│  ❌ Cannot use CSS — everything is coordinates                   │
└──────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│  APPROACH 2: Puppeteer (server-side, backend Node.js)            │
│                                                                  │
│  1. Launch a headless Chrome browser (no visible window)         │
│  2. Navigate it to a URL that renders the card as HTML/CSS       │
│  3. Screenshot the result — browser handles layout               │
│  4. Combine screenshots into a PDF                               │
│                                                                  │
│  ✅ Perfect CSS rendering — it's real Chrome                     │
│  ✅ Reuses existing React card components (no duplication)       │
│  ❌ Requires Chrome binary running on the server                 │
│  ❌ Slower (browser startup, page navigation)                    │
│  ❌ More memory usage                                            │
└──────────────────────────────────────────────────────────────────┘
```

**In this project:**
- PDFKit → primary download (browser, no server needed)
- Puppeteer → legacy `/api/ids/generate` route, and as a render engine for high-fidelity screenshots

---

## Part C — PDFKit: Code-Driven PDF Generation

### What PDFKit is

PDFKit is a JavaScript library that creates PDF files by providing an API to draw shapes, text, and images at specific (x, y) coordinates. Think of it as "draw to a canvas, then serialize to PDF format."

It was built for Node.js but the bundler (Vite with node polyfills) makes it work in the browser too.

### Installing and basic usage

```bash
npm install pdfkit blob-stream
```

```js
const PDFDocument = require('pdfkit');         // or import in frontend
const blobStream  = require('blob-stream');     // browser-only: Blob piping

// Create a document
const doc = new PDFDocument({
  size: [242.7, 153.0],   // page size in PDFKit "points" (72pt = 1 inch)
  margin: 0,              // no automatic margins
  compress: false,        // uncompressed = faster generation (compress for production)
});

// Pipe output → Blob (browser) or file (Node.js)
const stream = doc.pipe(blobStream());          // browser
// OR: const stream = doc.pipe(fs.createWriteStream('card.pdf'));  // Node.js

// Draw a blue rectangle
doc.rect(0, 0, 242.7, 153.0).fill('#2563eb');

// Write text
doc
  .fontSize(14)
  .fillColor('#ffffff')
  .font('Helvetica-Bold')
  .text('Ali Hassan', 20, 60, { width: 150, align: 'left' });

// Add an image (from a Buffer)
doc.image(photoBuffer, 170, 20, { width: 60, height: 60 });

// Finish the document
doc.end();

// In browser: convert to Blob when done
stream.on('finish', () => {
  const blob = stream.toBlob('application/pdf');
  // download blob...
});
```

### CR-80: the physical card size standard

Every ID card in the world (credit cards, driver's license, ID cards) follows ISO 7810 ID-1 standard — called "CR-80":

```
Horizontal: 85.6mm wide  × 53.98mm tall
Vertical:   53.98mm wide × 85.6mm tall
```

PDFKit uses "points" (1 inch = 72 points, 1mm ≈ 2.83465 points):

```js
const MM_TO_PT = 2.83465;   // conversion factor

const CARD_HORIZONTAL = {
  w: 85.6  * MM_TO_PT,  // → 242.65 points
  h: 53.98 * MM_TO_PT,  // → 153.0 points
};

const CARD_VERTICAL = {
  w: 53.98 * MM_TO_PT,  // → 153.0 points
  h: 85.6  * MM_TO_PT,  // → 242.65 points
};

// With 2mm padding around the card:
const PAGE_PAD = 2 * MM_TO_PT;  // → 5.67 points

const doc = new PDFDocument({
  size: [
    CARD_HORIZONTAL.w + PAGE_PAD * 2,   // page slightly bigger than card
    CARD_HORIZONTAL.h + PAGE_PAD * 2,
  ],
  margin: 0,
});
```

Why use CR-80 exactly? So you can send the PDF to any professional ID card printer and it will print at the correct physical size without scaling.

### Coordinate system

PDFKit uses top-left as (0, 0), x increases right, y increases down:

```
(0,0) ──────────────────────► x (width)
  │
  │     doc.rect(20, 30, 100, 50)
  │          ↑    ↑    ↑    ↑
  │        x=20 y=30 w=100 h=50
  │
  ▼
  y (height)
```

```js
// Draw a rectangle at (x=20, y=30), 100 wide, 50 tall, blue fill
doc.rect(20, 30, 100, 50).fill('#2563eb');

// Text at (x=20, y=30), with max-width constraint
doc.fontSize(12).fillColor('#fff').text('Hello', 20, 30, { width: 100 });

// Image at (x=170, y=20), 60×60 pixels
doc.image(buffer, 170, 20, { width: 60, height: 60 });
```

### Fonts: the gotcha

PDFKit ships with only three built-in fonts: `Helvetica`, `Courier`, `Times-Roman` (and their Bold variants).

For custom fonts (Inter, Public Sans), you must download the `.ttf` file and register it:

```js
// Fetch TTF from Google Fonts CDN as ArrayBuffer
const response = await fetch('https://fonts.gstatic.com/s/inter/v13/.../Inter-Regular.ttf');
const buffer = await response.arrayBuffer();

// Register the font with this document
doc.registerFont('Inter-Regular', buffer);

// Use it
doc.font('Inter-Regular').fontSize(14).text('Hello');
```

The font is fetched once and cached — don't re-fetch for every card:

```js
const fontCache = new Map();

async function getFont(url) {
  if (fontCache.has(url)) return fontCache.get(url);

  const buf = await fetch(url).then(r => r.arrayBuffer());
  fontCache.set(url, buf);
  return buf;
}
```

### Gradients: the workaround

PDFKit's `linearGradient` works for vertical/horizontal gradients but can be unreliable across environments. For a guaranteed smooth diagonal gradient, use the "strip" technique:

```js
function drawGradient(doc, x, y, w, h, colorA, colorB) {
  const STEPS = 120;    // more steps = smoother, slightly slower
  const stripW = w / STEPS;

  for (let i = 0; i < STEPS; i++) {
    const t = i / (STEPS - 1);   // 0.0 to 1.0 progress

    // Linearly interpolate between two hex colors
    const r = Math.round(colorA.r + (colorB.r - colorA.r) * t);
    const g = Math.round(colorA.g + (colorB.g - colorA.g) * t);
    const b = Math.round(colorA.b + (colorB.b - colorA.b) * t);

    const hex = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;

    // +0.3 overlap prevents hair-thin gaps between strips
    doc.rect(x + i * stripW, y, stripW + 0.3, h).fill(hex);
  }
}

// Usage:
drawGradient(doc, 0, 0, 242.7, 153.0,
  { r: 37, g: 99, b: 235 },    // #2563eb (blue)
  { r: 239, g: 68, b: 68 }     // #ef4444 (red)
);
```

### Circular photo clip

PDFKit has no `borderRadius`. To clip an image into a circle:

```js
function drawCircularPhoto(doc, photoBuffer, cx, cy, radius) {
  // 1. Push the current graphics state onto a stack
  doc.save();

  // 2. Define a circular path and clip all subsequent drawing to it
  doc.circle(cx, cy, radius).clip();

  // 3. Draw the image — it will be clipped to the circle
  doc.image(photoBuffer, cx - radius, cy - radius, {
    width:  radius * 2,
    height: radius * 2,
    cover:   [radius * 2, radius * 2],   // crop to fill (no letterboxing)
  });

  // 4. Pop the graphics state — removes the clip, restores normal drawing
  doc.restore();
}
```

### Downloading the PDF

```js
doc.end();   // signal that drawing is complete

stream.on('finish', () => {
  // Convert the stream to a Blob
  const pdfBlob = stream.toBlob('application/pdf');

  // Browser download trick: create an invisible link and click it
  const url = URL.createObjectURL(pdfBlob);
  const link = document.createElement('a');
  link.href     = url;
  link.download = 'Ali_Hassan_ID.pdf';
  link.click();

  // Free the object URL after a moment (prevents memory leak)
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});
```

---

## Part D — Puppeteer: Browser-as-a-Service

### What Puppeteer does

Puppeteer gives Node.js control over a real Chrome or Chromium browser. The browser has no visible window — it runs entirely in memory (that's what "headless" means).

With Puppeteer you can:
- Navigate to any URL
- Click, type, scroll
- Wait for specific elements to appear
- Take screenshots of the page or specific elements
- Print the page to PDF (Chrome's native PDF engine)

### Why use a real browser to generate card images?

Because your card is a React component with CSS. The only software that can render React + CSS perfectly is a browser — specifically, Chrome's Blink rendering engine.

The alternative (using `html2canvas` in the browser) has known bugs with certain CSS properties (box-shadow, some gradients, filter). Puppeteer uses the same engine, but server-side, for consistency.

### The flow in this project

```
renderCard(params)
    │
    ├── 1. Get or launch a shared Chrome instance
    │        getBrowser()
    │          if (browserInstance && browserInstance.connected)
    │            return browserInstance        ← reuse (fast: ~0ms)
    │          else
    │            puppeteer.launch(...)         ← start new  (~500ms)
    │
    ├── 2. Open a new browser tab
    │        const page = await browser.newPage()
    │
    ├── 3. Set the viewport (affects screenshot size)
    │        await page.setViewport({
    │          width: 900,
    │          height: 700,
    │          deviceScaleFactor: 2,   // 2x = "Retina" quality
    │        })
    │        // A 350px card becomes 700px in the PNG → crisp
    │
    ├── 4. Build the render URL
    │        // All card data goes in the URL hash (#)
    │        // Hash is never sent to the server — stays in the browser
    │        const payload = JSON.stringify({ data, template, ... })
    │        const url = `${FRONTEND_URL}/render-card#${encodeURIComponent(payload)}`
    │
    ├── 5. Navigate Chrome to that URL
    │        await page.goto(url, { waitUntil: 'networkidle0' })
    │        // networkidle0 = wait until no network requests for 500ms
    │        // This ensures fonts, images, and CSS are fully loaded
    │
    ├── 6. Wait for the React component to finish rendering
    │        await page.waitForSelector("[data-render-ready='true']")
    │        // RenderCard.jsx sets this attribute when done
    │
    ├── 7. Wait a bit more for fonts/images to paint
    │        await new Promise(r => setTimeout(r, 800))
    │
    ├── 8. Screenshot specific elements
    │        const frontEl = await page.$('#card-front')
    │        const frontPng = await frontEl.screenshot({ type: 'png' })
    │        // Returns a Buffer (raw PNG bytes)
    │
    ├── 9. Build PDF from the screenshots
    │        // New page with HTML that contains the PNG as base64
    │        const pdfPage = await browser.newPage()
    │        await pdfPage.setContent(`
    │          <html><head><style>
    │            @page { size: 89.6mm 57.98mm; margin: 2mm; }
    │            img { width: 85.6mm; height: 53.98mm; }
    │          </style></head>
    │          <body><img src="data:image/png;base64,${frontB64}"/></body>
    │        `)
    │        const pdfBuffer = await pdfPage.pdf({ printBackground: true })
    │        await pdfPage.close()
    │
    └── 10. Close the render tab (NOT the browser)
             await page.close()
             // Browser stays alive for the next renderCard() call
```

### The `/render-card` frontend route

This is a special hidden React page that Puppeteer navigates to:

```jsx
// frontend/src/pages/RenderCard.jsx
import { useEffect, useState } from 'react';
import CardFront from '../components/CardFront';
import CardBack  from '../components/CardBack';

export default function RenderCard() {
  const [payload, setPayload] = useState(null);

  useEffect(() => {
    // Read all card data from the URL hash
    const hash = window.location.hash.slice(1);  // remove the #
    if (hash) {
      const decoded = JSON.parse(decodeURIComponent(hash));
      setPayload(decoded);
    }
  }, []);

  useEffect(() => {
    if (!payload) return;

    // Signal to Puppeteer that the card is ready for screenshot
    // waitForSelector("[data-render-ready='true']") catches this
    document.body.setAttribute('data-render-ready', 'true');
  }, [payload]);

  if (!payload) return null;

  return (
    <div style={{ background: 'transparent', padding: '20px' }}>
      <div id="card-front">
        <CardFront {...payload} />
      </div>
      <div id="card-back" style={{ marginTop: '20px' }}>
        <CardBack {...payload} />
      </div>
    </div>
  );
}
```

This page has no nav, no auth, no layout — it exists purely to be screenshotted.

### Browser instance management

Starting Chrome takes ~300–500ms. For an app that generates cards frequently, this is too slow per-request. The solution: keep one browser alive, open a new *tab* per render, close the tab after.

```js
let browserInstance = null;

const getBrowser = async () => {
  // Reuse if still alive
  if (browserInstance && browserInstance.connected) {
    return browserInstance;
  }

  // Launch a new instance
  browserInstance = await puppeteer.launch({
    headless: 'new',          // use modern headless mode
    args: [
      '--no-sandbox',              // required in Docker/Linux containers
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',   // prevents Chrome crash in containers with small /dev/shm
      '--disable-gpu',             // no need for GPU in headless mode
    ],
  });

  // Auto-cleanup: if Chrome crashes, reset so next call relaunches
  browserInstance.on('disconnected', () => {
    browserInstance = null;
  });

  return browserInstance;
};

// Each render uses a new tab:
const browser = await getBrowser();    // ~0ms if reused
const page = await browser.newPage(); // ~10ms
// ... render ...
await page.close();                    // close tab, not browser
```

### QR code generation

Each card back has a QR code that encodes the verification URL:

```js
import QRCode from 'qrcode';

// Generate as data URL (PNG)
const qrDataUrl = await QRCode.toDataURL(cardId, {
  width: 200,
  margin: 1,
  color: {
    dark: '#000000',   // QR modules color
    light: '#ffffff',  // background color
  },
});
// qrDataUrl = "data:image/png;base64,iVBORw0KGgo..."

// In PDFKit:
const qrBuffer = Buffer.from(qrDataUrl.split(',')[1], 'base64');
doc.image(qrBuffer, x, y, { width: 60, height: 60 });
```

The QR encodes the card's UUID. When scanned, it opens:
```
https://yourapp.com/verify/{card-uuid}
```

The `VerifyCard` page fetches `/api/verify/{cardId}` (no auth required — it's public) and shows the card's status.

---

## Part E — CORS and Image Loading

PDF cards often include photos hosted on external services (Google Drive, Cloudinary, Supabase Storage, etc.).

### The CORS problem

Cross-Origin Resource Sharing (CORS): browsers block JavaScript from fetching resources from a different domain unless that domain explicitly allows it.

```
Your frontend (aarannu.vercel.app)
  → fetch('https://drive.google.com/...')   ← BLOCKED by browser CORS
```

Google Drive doesn't include `Access-Control-Allow-Origin: *` in its response headers — so the browser refuses to let JavaScript use that image.

### The solution: backend image proxy

The backend has no CORS restrictions (CORS only applies to browsers). Route all external image fetches through the backend:

```
Frontend
  → fetch('/api/proxy/image?url=https://drive.google.com/...')
  → Backend fetches the URL server-side (no CORS)
  → Streams the response back to the frontend
```

```js
// Backend: proxyRoutes.js
router.get('/image', async (req, res) => {
  const { url } = req.query;

  // Security: validate it's a real URL, not a local file path
  const parsed = new URL(url);
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    return res.status(400).json({ error: 'Invalid URL' });
  }

  const response = await fetch(url, {
    headers: { 'User-Agent': 'CommunityID-ImageProxy/1.0' },
  });

  // Pass through content-type
  res.setHeader('Content-Type', response.headers.get('content-type'));
  response.body.pipe(res);   // stream bytes directly to client
});
```

In the frontend, every external image URL is rewritten before use:

```js
const proxyUrl = (url) => {
  if (!url) return '';
  // Don't proxy data: URLs or localhost
  if (url.startsWith('data:') || url.includes('localhost')) return url;
  return `/api/proxy/image?url=${encodeURIComponent(url)}`;
};

// Then in PDFKit generation:
const imageUrl = proxyUrl(member.photo_url);
const response = await fetch(imageUrl);
const arrayBuffer = await response.arrayBuffer();
const buffer = Buffer.from(arrayBuffer);

doc.image(buffer, x, y, { width: 60, height: 60 });
```

---

## Part F — Production Considerations

### Memory usage with Puppeteer

Each browser tab uses ~50–80MB RAM. Since the browser is shared and tabs are closed after each render, memory stays bounded. But if many renders happen simultaneously, multiple tabs are open at once.

For high load, consider:
```js
// Limit concurrent renders with a semaphore
let activeRenders = 0;
const MAX_CONCURRENT = 3;

const renderCard = async (params) => {
  while (activeRenders >= MAX_CONCURRENT) {
    await new Promise(r => setTimeout(r, 100));   // wait 100ms and retry
  }
  activeRenders++;
  try {
    return await doRender(params);
  } finally {
    activeRenders--;
  }
};
```

### PDF file size

A typical card PDF (2 pages of PNG screenshots) is 200–500KB. If you send many:
- As email attachment: fine (Brevo's 10MB limit is generous)
- As API response: fine
- In a ZIP of 500 cards: 100–250MB — consider streaming instead of buffering

### Font preloading

In the client-side PDFKit approach, fonts are fetched from Google Fonts CDN on every page load. Cache the result in a module-level Map:

```js
// This Map persists for the lifetime of the browser tab
const fontCache = new Map();

async function prefetchFonts(fontFamily) {
  if (fontCache.has(fontFamily)) return fontCache.get(fontFamily);

  const urls = GOOGLE_FONT_URLS[fontFamily];
  if (!urls) return null;   // fall back to built-in font

  const [regular, bold] = await Promise.all([
    fetch(urls.regular).then(r => r.arrayBuffer()),
    fetch(urls.bold).then(r => r.arrayBuffer()),
  ]);

  const result = { regular, bold };
  fontCache.set(fontFamily, result);
  return result;
}
```

### Testing PDF output

During development, write PDFs to disk rather than downloading them:

```js
// Node.js test script
const fs = require('fs');
const PDFDocument = require('pdfkit');

const doc = new PDFDocument({ size: [242.7, 153.0], margin: 0 });
doc.pipe(fs.createWriteStream('/tmp/test-card.pdf'));

// ... draw the card ...

doc.end();
// Open /tmp/test-card.pdf in a PDF viewer to inspect
```

This is much faster than running the full frontend + backend for each tweak.
