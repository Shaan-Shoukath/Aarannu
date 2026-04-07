# Libraries Reference — Every Package Explained

All libraries used in this project, why they were chosen, and how they work.

---

## Backend Libraries (`backend/package.json`)

### Core Framework

#### `express` (v5)
**What**: The HTTP server framework. Handles routing, middleware, req/res.
**Why**: Industry standard for Node.js APIs. v5 brings async error handling
(thrown errors in async handlers automatically propagate to errorHandler).
**How used**: `const app = express()` in `server.js`. All routes and middleware are mounted here.
```js
app.use('/api/auth', authRoutes);
app.get('/api/health', (req, res) => res.json({ status: 'ok' }));
```

#### `dotenv`
**What**: Loads `.env` file into `process.env` at startup.
**Why**: Never hardcode secrets in source code. `.env` is gitignored.
**How used**: `require('dotenv').config()` — first line of `server.js`.

---

### Database & Auth

#### `@supabase/supabase-js`
**What**: Official Supabase JavaScript client. Provides typed wrappers for:
- Database queries (PostgREST under the hood)
- Auth operations (GoTrue under the hood)
- Storage file operations
**Why**: One client to rule everything — DB, auth, and storage in one SDK.
**How used**: Two clients in `config/supabaseClient.js`:
```js
const supabase = createClient(URL, SERVICE_ROLE_KEY);   // admin — bypasses RLS
const supabasePublic = createClient(URL, ANON_KEY);     // user — respects RLS
```

**PostgREST under the hood**: The Supabase client translates JS calls into
HTTP requests to PostgREST (a REST API auto-generated from your Postgres schema):
```js
supabase.from("members").select("*").eq("user_id", id)
// becomes: GET /rest/v1/members?user_id=eq.{id}
// PostgREST converts to: SELECT * FROM members WHERE user_id = {id}
```

---

### Security

#### `helmet`
**What**: Sets security-related HTTP response headers.
**Why**: Browsers implement many security features via headers. Without them,
your app is vulnerable to clickjacking, MIME sniffing, etc.
**How used**: `app.use(helmet())` — applied globally in `server.js`.

Headers it sets:
```
X-Frame-Options: DENY              ← prevents embedding in iframes (clickjacking)
X-Content-Type-Options: nosniff   ← prevents MIME type sniffing
Referrer-Policy: no-referrer      ← doesn't leak URL in Referer header
Strict-Transport-Security: ...    ← forces HTTPS after first visit
Content-Security-Policy: ...      ← restricts which scripts/styles can load
```

#### `cors`
**What**: Cross-Origin Resource Sharing middleware. Adds `Access-Control-Allow-*`
headers to responses.
**Why**: Browsers block cross-origin requests by default. The frontend on
port 5173 calling the backend on port 5000 is cross-origin.
**How used**: Custom origin checker in `server.js`:
```js
app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);  // curl/Postman — no origin
    if (allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error('CORS: origin not allowed'));
  }
}));
```

#### `express-rate-limit`
**What**: Rate limiting middleware. Counts requests per IP address in memory.
**Why**: Prevents brute-force attacks on login, DDoS abuse, and API scraping.
**How used**: Two limiters in `middleware/rateLimiter.js`:
```js
// General: 100 requests per 15 minutes
const rateLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 100 });

// Auth-specific: 20 per 15 minutes (prevents brute-force login)
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20 });
```

---

### Card Rendering

#### `puppeteer`
**What**: Controls a headless Chromium browser from Node.js.
**Why**: The cleanest way to render HTML/CSS cards to pixel-perfect images.
Other approaches (html-to-image, canvas, jsPDF) either require a DOM
environment or can't render complex CSS.
**How used**: In `services/cardRenderer.js`:
1. Launches Chrome once, keeps it alive (browser pooling)
2. Opens a new tab per render
3. Navigates to `/render-card#<encoded-card-data>`
4. Waits for `[data-render-ready='true']` selector
5. Screenshots `#card-front` and `#card-back` elements
6. Closes the tab (not the browser)

```js
const browser = await puppeteer.launch({
  headless: "new",                    // use new headless mode (not legacy)
  args: [
    '--no-sandbox',                   // required in containerized Linux
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',        // prevents Chrome OOM in Docker
    '--disable-gpu',                  // no GPU in headless environments
  ]
});

const page = await browser.newPage();
await page.goto(url, { waitUntil: 'networkidle0' }); // wait until no network activity
const screenshot = await element.screenshot({ type: 'png' });
await page.close();  // close tab, not browser
```

---

### Testing

#### `jest`
**What**: JavaScript testing framework. Runs test files, provides `describe`,
`it`, `expect`, `beforeEach`, `afterEach`, matchers, and mocks.
**Why**: Most popular JS testing framework. Zero config for Node.js.
**How used**: Test files in `backend/src/__tests__/`.
```bash
cd backend
npm test                           # runs all tests
npx jest tokenService.test.js     # runs one file
```

---

## Frontend Libraries (`frontend/package.json`)

### Core

#### `react` (v19) + `react-dom`
**What**: UI library. Components, hooks, JSX, virtual DOM diffing.
**Why**: The most popular UI library. v19 brings new hooks and performance improvements.
**How used**: Every `.jsx` file is a React component.

#### `react-router-dom` (v7)
**What**: Client-side routing for React SPAs.
**Why**: Declarative routing — maps URLs to components without page reloads.
**How used**: In `App.jsx`:
```jsx
<Routes>
  <Route path="/login" element={<Login />} />
  <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
  <Route path="/org/:slug/dashboard" element={<ProtectedRoute><OrgDashboard /></ProtectedRoute>} />
</Routes>
```

#### `vite`
**What**: Frontend build tool. Dev server with HMR, production bundler.
**Why**: 10-100x faster than webpack for large projects. Native ES modules in dev.
**How used**: `npm run dev` starts the Vite dev server. `npm run build` creates `dist/`.

---

### Styling

#### `tailwindcss` (v4)
**What**: Utility-first CSS framework. Write styles as class names.
**Why**: No context-switching between CSS files and JSX. Fast to prototype.
**How used**: v4 is configured via `@tailwindcss/vite` plugin (no `tailwind.config.js` needed):
```jsx
<div className="flex items-center justify-center bg-slate-900 rounded-lg p-4">
  <span className="text-white font-bold text-xl">Hello</span>
</div>
```

---

### Database & Auth (Frontend)

#### `@supabase/supabase-js`
**What**: Same library as backend, but used in the browser with the ANON key.
**Why**: Provides real-time subscriptions, auth state management, RLS-enforced queries.
**How used**: Singleton in `frontend/src/lib/supabaseClient.js`:
```js
export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);
```

The client stores the session in localStorage and auto-refreshes tokens.

---

### Card Generation (Client-Side)

#### `jspdf`
**What**: Generates PDF files in JavaScript (browser or Node.js).
**Why**: Used for client-side PDF downloads — no server round-trip needed.
**How used**: In `utils/pdfCardRenderer.js`:
```js
const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: [85.6, 53.98] });
pdf.addImage(frontCanvas, 'PNG', 0, 0, 85.6, 53.98);
pdf.addPage();
pdf.addImage(backCanvas, 'PNG', 0, 0, 85.6, 53.98);
pdf.save('id-card.pdf');
```

#### `html2canvas`
**What**: Screenshots HTML elements as `<canvas>` elements.
**Why**: Used for client-side card preview screenshots before download.
**How used**:
```js
const canvas = await html2canvas(document.getElementById('card-front'), {
  scale: 2,         // 2x DPI for crisp screenshots
  useCORS: true,    // allows cross-origin images
});
const blob = await new Promise(r => canvas.toBlob(r, 'image/png'));
```

**Difference from Puppeteer**: html2canvas runs in the browser and has
limitations with complex CSS (filters, some gradients). Puppeteer (backend)
uses real Chrome and is pixel-perfect. html2canvas is used for preview;
Puppeteer is used for final output.

#### `jszip`
**What**: Creates ZIP archives in JavaScript.
**Why**: Bulk generation produces many PNG files — ZIPped into one download.
**How used**:
```js
const zip = new JSZip();
cards.forEach((card, i) => {
  zip.file(`card-${i + 1}.png`, card.buffer, { binary: true });
});
const zipBlob = await zip.generateAsync({ type: 'blob' });
downloadBlob(zipBlob, 'id-cards.zip');
```

---

### Utilities

#### `vite-plugin-node-polyfills`
**What**: Polyfills Node.js built-in modules (Buffer, process, stream, etc.) for the browser.
**Why**: Some libraries (like pdfkit) were written for Node.js and use Node built-ins.
When imported in a browser, Vite would throw "Buffer is not defined".
This plugin patches those globals.
**How used**: In `vite.config.js`:
```js
import { nodePolyfills } from 'vite-plugin-node-polyfills';

export default defineConfig({
  plugins: [react(), nodePolyfills()]
});
```

#### `qrcode` or `qrcode.react`
**What**: Generates QR codes.
**Why**: Each ID card back has a QR code linking to its verification URL.
**How used**: Rendered as an SVG/canvas element on the card component.

---

## Why These Choices Were Made

| Decision | Alternative Considered | Reason for Choice |
|----------|----------------------|-------------------|
| Express 5 | Fastify, Hapi | Most documentation, most middleware ecosystem |
| Supabase | Firebase, PlanetScale + Auth0 | One service for DB + Auth + Storage; generous free tier |
| Puppeteer for rendering | wkhtmltopdf, html-to-image | Best CSS rendering fidelity; active maintenance |
| Tailwind v4 | CSS Modules, styled-components | Fastest iteration; no context switching |
| React 19 | Vue 3, Svelte | Largest ecosystem; team familiarity |
| Vite | webpack, Parcel | Fastest dev server; native ESM |
| express-rate-limit | Custom middleware | Battle-tested; simple API |
| Jest | Vitest, Mocha | Default for Node.js; best mock support |

---

## Dependency Security

Check for vulnerabilities periodically:
```bash
cd backend && npm audit
cd frontend && npm audit

# Auto-fix safe updates:
npm audit fix

# See what packages have issues:
npm audit --json | jq '.vulnerabilities | keys'
```

Keep Puppeteer up to date — it bundles Chromium which receives security patches:
```bash
cd backend && npm update puppeteer
```
