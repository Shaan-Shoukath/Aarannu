# 07 - Libraries Used

## Dependency Overview

| Library                 | Version | Purpose                         | Required? |
| ----------------------- | ------- | ------------------------------- | --------- |
| `@supabase/supabase-js` | ^2.95.3 | Backend SDK (auth, DB, storage) | Yes       |
| `react`                 | ^19.2.0 | UI framework                    | Yes       |
| `react-dom`             | ^19.2.0 | React DOM renderer              | Yes       |
| `react-router-dom`      | ^7.x    | Client-side routing             | Yes       |
| `html2canvas`           | ^1.4.1  | DOM-to-canvas conversion        | Yes       |
| `jspdf`                 | ^3.x    | Canvas-to-PDF generation        | Yes       |
| `jszip`                 | ^3.x    | ZIP archive creation in browser | Yes       |
| `file-saver`            | ^2.x    | Trigger browser file downloads  | Yes       |
| `qrcode.react`          | ^4.x    | QR code generation on ID cards  | Yes       |
| `tailwindcss`           | ^4.x    | Utility-first CSS               | Yes       |
| `@tailwindcss/vite`     | ^4.x    | Tailwind Vite integration       | Yes (dev) |

---

## @supabase/supabase-js

### Why?

Official JavaScript SDK for Supabase. Provides a unified interface to interact with Auth, Database (PostgREST), Storage, and Realtime.

### Key functions used:

```javascript
import { createClient } from '@supabase/supabase-js';

// Initialize (once, singleton)
const supabase = createClient(url, anonKey, options);

// --- AUTH ---
supabase.auth.signUp({ email, password })
supabase.auth.signInWithPassword({ email, password })
supabase.auth.signInWithOtp({ email })             // Email OTP login
supabase.auth.verifyOtp({ email, token, type })    // Verify OTP
supabase.auth.signOut()
supabase.auth.getSession()
supabase.auth.getUser()
supabase.auth.onAuthStateChange(callback)

// --- DATABASE ---
supabase.from('table').select('*')
supabase.from('table').insert({ ... })
supabase.from('table').update({ ... }).eq(...)
supabase.from('table').delete().eq(...)
  .eq('column', value)      // WHERE column = value
  .gt('column', value)      // WHERE column > value
  .gte('column', value)     // WHERE column >= value
  .order('column', { ascending: false })
  .single()                 // Expect exactly 1 row

// --- STORAGE ---
supabase.storage.from('bucket').upload(path, file, options)
supabase.storage.from('bucket').createSignedUrl(path, expiresIn)
supabase.storage.from('bucket').remove([paths])
```

### Security note:

The `anon` key is embedded in the frontend. This is by design - it only grants access allowed by RLS policies. The `service_role` key must NEVER be used in the frontend.

---

## React

### Why?

Industry-standard library for building component-based UIs. Chosen because:

- Supabase has first-class React support.
- Component model fits the ID card use case (reusable card templates).
- Large ecosystem and community.

### Key concepts used:

```javascript
// Hooks
useState(); // Manage component state (forms, loading, errors, progress)
useEffect(); // Side effects (data fetching on mount, auth listener)
useRef(); // DOM references (for html2canvas to capture front + back)
useCallback(); // Memoized callbacks (captureRef in BulkGenerator)
forwardRef(); // Pass refs through component boundaries (all card templates)

// Patterns
// Conditional rendering (approved? -> show button)
// List rendering (map over generatedIds, members)
// Controlled components (form inputs bound to state)
// IIFE component resolution (CardComponent in BulkGenerator)
```

### Why React 19?

- Automatic batching of state updates (better performance during bulk generation).
- Improved concurrent rendering.
- Stable React Compiler compatibility.

---

## react-router-dom

### Why?

Provides client-side routing without full page reloads. Essential for SPAs.

### Key functions used:

```javascript
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useNavigate,
  useLocation,
  Link,
} from "react-router-dom";

// Router setup (App.jsx)
<BrowserRouter>
  <Routes>
    <Route path="/login" element={<Login />} />
    <Route
      path="/templates"
      element={
        <ProtectedRoute>
          <Templates />
        </ProtectedRoute>
      }
    />
    <Route
      path="/generate"
      element={
        <ProtectedRoute>
          <Generate />
        </ProtectedRoute>
      }
    />
    <Route
      path="/dashboard"
      element={
        <ProtectedRoute>
          <Dashboard />
        </ProtectedRoute>
      }
    />
  </Routes>
</BrowserRouter>;

// State passing (Templates -> Generate)
navigate("/generate", { state: { template, orgName, logoUrl, watermark } });

// Receiving state
const { template, orgName } = location.state || {};
```

### Why `replace: true` after login?

Prevents the user from pressing "Back" and landing on the login form after authentication.

---

## html2canvas

### Why?

Renders a DOM element (the ID card) into an HTML5 Canvas, which can then be exported as PNG/JPEG or fed into jsPDF. This is the core mechanism for ID card generation.

### How it works:

```
DOM Node (IDCard.jsx, CorporateCard.jsx, etc.)
    |
    v  html2canvas reads the DOM tree
    |
HTML5 Canvas (in-memory)
    |
    +--> canvas.toBlob('image/png') --> PNG for Supabase upload
    +--> fed to jsPDF.addImage()    --> PDF page
    +--> canvas.toBlob('image/jpeg') --> JPEG download
```

### Key usage:

```javascript
import html2canvas from "html2canvas";

const canvas = await html2canvas(domElement, {
  scale: 2, // 2x resolution (retina quality)
  useCORS: true, // Allow cross-origin / proxied images
  backgroundColor: "#ffffff",
  logging: false,
});
```

### Limitations:

- Cannot render CSS `backdrop-filter` (blur effects) - they're approximated.
- External fonts must be loaded before capture.
- SVGs with external references may not render.
- Performance degrades with very complex DOM trees.
- Google Drive images require the backend proxy (see proxyImage.js).

---

## jsPDF

### Why?

Client-side PDF generation. Each ID card needs to be delivered as a 2-page PDF (front + back).

### How it's used:

```javascript
import { jsPDF } from "jspdf";

// Used via downloadHelpers.js:
export function canvasesToPdfBlob(frontCanvas, backCanvas = null) {
  const w = pxToMm(frontCanvas.width); // Convert canvas px to mm
  const h = pxToMm(frontCanvas.height);
  const orientation = w > h ? "landscape" : "portrait";

  const pdf = new jsPDF({ orientation, unit: "mm", format: [w, h] });

  // Front page
  pdf.addImage(frontCanvas.toDataURL("image/png"), "PNG", 0, 0, w, h);

  // Back page (optional)
  if (backCanvas) {
    const bw = pxToMm(backCanvas.width);
    const bh = pxToMm(backCanvas.height);
    pdf.addPage([bw, bh], bw > bh ? "landscape" : "portrait");
    pdf.addImage(backCanvas.toDataURL("image/png"), "PNG", 0, 0, bw, bh);
  }

  return pdf.output("blob");
}
```

### Key details:

- **Custom page sizing** - Each page is sized exactly to the card dimensions (no margins).
- **px-to-mm conversion** - `pxToMm(px, scale=2)` accounts for html2canvas `scale: 2`.
- **No text rendering** - The entire card is an image, so fonts are pre-rendered by html2canvas.
- **Used in two contexts**: Single card preview (Generate.jsx) and bulk generation (BulkGenerator.jsx).

---

## JSZip

### Why?

When generating bulk ID cards, each member gets a 2-page PDF. JSZip bundles all PDFs into a single downloadable ZIP file, providing a clean delivery format.

### How it's used:

```javascript
import JSZip from "jszip";

const zip = new JSZip();
const folder = zip.folder("id_cards");

// During bulk generation loop:
for (const member of members) {
  const pdfBlob = canvasesToPdfBlob(frontCanvas, backCanvas);
  folder.file(safeFileName(member.name, index, "pdf"), pdfBlob);
}

// After all members processed:
const zipBlob = await zip.generateAsync(
  { type: "blob", compression: "DEFLATE", compressionOptions: { level: 6 } },
  (meta) => {
    // Progress callback - updates UI with compression percentage
    setProgress((p) => ({ ...p, zipPercent: Math.round(meta.percent) }));
  },
);
```

### Key details:

- **DEFLATE compression** at level 6 (balanced speed/size).
- **Progress callback** updates the UI during compression.
- **Folder structure** - PDFs are placed in an `id_cards/` subfolder inside the ZIP.
- **Filenames** - Zero-padded index + sanitized name: `00001_John_Doe.pdf`.

---

## file-saver

### Why?

Provides a cross-browser `saveAs()` function that reliably triggers file download dialogs. Used after JSZip creates the ZIP blob.

### How it's used:

```javascript
import { saveAs } from "file-saver";

const zipBlob = await zip.generateAsync({ type: "blob" });
saveAs(zipBlob, "aarannu_id_cards.zip");
```

### Why not just use `<a download>`?

- `saveAs()` handles browser inconsistencies (Safari, older Edge).
- Works with large blobs without creating temporary URLs manually.
- Provides a consistent API across all browsers.

**Note:** For single card PDF/JPEG downloads, `downloadBlob()` from downloadHelpers.js is used instead (simpler, no file-saver needed for small files).

---

## qrcode.react

### Why?

Generates QR codes directly as React components, embedded inside IDCard templates. Each card gets a unique QR code containing a verification link.

### How it's used:

```jsx
import { QRCodeCanvas } from "qrcode.react";

<QRCodeCanvas
  value={verificationUrl}
  size={60}
  bgColor="transparent"
  fgColor="#1e293b"
  level="M" // Error correction level (Medium)
/>;
```

### Key details:

- **Canvas-based** (`QRCodeCanvas`) - Works with html2canvas capture (unlike SVG-based).
- **Transparent background** - Blends with the card's design.
- **Error correction M** - Allows up to 15% damage while remaining scannable.
- **Verification URL** contains member data/ID for scanning.

---

## Tailwind CSS

### Why?

Utility-first CSS framework that allows rapid UI development without writing custom CSS files. Every class maps to a single CSS property.

### Key features used:

```html
<!-- Responsive design -->
<div class="grid grid-cols-1 md:grid-cols-3">
  <!-- Tailwind v4 gradient syntax (NOT bg-gradient-to-*) -->
  <div class="bg-linear-to-br from-blue-600 to-indigo-800">
    <!-- Arbitrary values for exact specs -->
    <span class="text-[10px]">Small</span>
    <div class="w-[86mm] h-[54mm]">
      <!-- ID card dimensions -->

      <!-- Dark theme -->
      <div class="bg-slate-900 text-white"></div>
    </div>
  </div>
</div>
```

### Important: Tailwind v4 syntax

This project uses **Tailwind CSS v4**, which has breaking changes from v3:

- `bg-gradient-to-*` is now `bg-linear-to-*`
- `@apply` works differently
- Configuration is in `index.css` via `@import "tailwindcss"`, not `tailwind.config.js`

### Integration with Vite:

```javascript
// vite.config.js
import tailwindcss from "@tailwindcss/vite";
export default defineConfig({
  plugins: [react(), tailwindcss()],
});
```

```css
/* index.css */
@import "tailwindcss";
```

The `@tailwindcss/vite` plugin integrates Tailwind directly into Vite's build pipeline - no separate PostCSS config needed.

---

## Role of Libraries in Card Customization & Orientation

The card customization system (introduced in `09_CARD_CUSTOMIZATION.md`) leverages the existing library ecosystem without adding any new dependencies:

| Feature              | Library Used                       | How                                           |
| -------------------- | ---------------------------------- | --------------------------------------------- |
| Color pickers        | Native HTML `<input type="color">` | No library needed — browser-native            |
| Font selector        | Native HTML `<select>`             | System fonts, no font-loading library         |
| Border radius slider | Native HTML `<input type="range">` | CSS `borderRadius` via inline styles          |
| Orientation switch   | React state + Tailwind             | `isVertical` toggles classes/inline styles    |
| Real-time preview    | React (re-render on state change)  | `cardStyles` state triggers instant re-render |
| PDF orientation      | jsPDF                              | Existing `w > h` check auto-detects portrait  |
| Capture styled cards | html2canvas                        | Captures inline styles + Tailwind classes     |
| Bulk export          | JSZip + file-saver                 | Unchanged — works with any card dimensions    |

**Key principle:** The customization system uses **zero additional dependencies**. All visual customization is achieved through:

- CSS inline styles (`style={{ backgroundColor: ... }}`)
- Tailwind utility classes (conditional via template literals)
- Native HTML form controls (color, range, select)
- React state management (`useState`, functional updates)
