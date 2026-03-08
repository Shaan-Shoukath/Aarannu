# 01 - System Architecture

## High-Level System Design

```
+-----------------------------------------------------------------------+
|                         BROWSER (Client)                              |
|                                                                       |
|  +--------+ +----------+ +----------+ +----------+ +-------------+   |
|  | Login/ | |Dashboard | |Templates | | Generate | | IDCard /    |   |
|  | Signup | |  Page    | |  Page    | |  Page    | | Card Comps  |   |
|  +---+----+ +----+-----+ +----+-----+ +----+-----+ +------+------+   |
|      |           |            |             |              |          |
|      +-----------+------------+-------------+--------------+          |
|                            |                                          |
|                    supabaseClient.js                                   |
|                   (Single SDK Instance)                                |
|                            |                                          |
|   +------------------------+----------------------------+             |
|   | Client-side rendering  |  downloadHelpers.js        |             |
|   | html2canvas -> jsPDF   |  JSZip + file-saver        |             |
|   +------------------------+----------------------------+             |
+------------------------------------+-------------------------------------+
                             | HTTPS (REST + Realtime)
                             v
+-----------------------------------------------------------------------+
|                       SUPABASE (Backend)                              |
|                                                                       |
|  +----------+  +----------+  +----------+  +--------+               |
|  |   Auth   |  | Postgres |  | Storage  |  |  RLS   |               |
|  | (GoTrue) |  |   (DB)   |  | (S3)     |  |Policies|               |
|  +----------+  +----------+  +----------+  +--------+               |
+-----------------------------------------------------------------------+
                             |
            +----------------+
            v
+-----------------------------------------------------------------------+
|                    EXPRESS BACKEND (API)                               |
|                                                                       |
|  +----------+  +----------+  +-----------+  +--------------------+   |
|  |  Auth    |  |   ID     |  |  Admin    |  |  Proxy (Google     |   |
|  | Routes   |  |  Routes  |  |  Routes   |  |  Drive images)     |   |
|  +----------+  +----------+  +-----------+  +--------------------+   |
|  +----------+                                                        |
|  |  Email   |  Brevo v3 REST API (transactional email w/ PDF attach) |
|  | Routes   |                                                        |
|  +----------+                                                        |
|  +----------+                                                        |
|  |  Token   |  Token wallet balance, transactions, analytics, pkgs   |
|  | Routes   |                                                        |
|  +----------+                                                        |
+-----------------------------------------------------------------------+
```

## Data Flow

### User Registration

```
User fills signup form
  -> supabase.auth.signUp() creates auth user
  -> Client inserts row into `members` table (approved = false)
  -> User sees "pending approval" message
  -> Admin manually sets approved = true in Supabase dashboard
```

### Template Selection & Configuration

```
User navigates to /templates
  -> Chooses one of 4 templates: Custom, Corporate, Event, Student
  -> Configures organization name + logo URL
  -> Optionally enables watermark (text and/or image with opacity)
  -> Clicks "Proceed" -> navigates to /generate with state:
      { template, orgName, logoUrl, watermark }
```

### Card Customization & Orientation (Generate Page)

```
User lands on Generate page
  -> Sidebar sections for customization:
     1. Gradient Colors → picks start + end colors (swatches + hex inputs)
     2. Card Orientation → toggles Horizontal / Vertical (button group)
     3. Card Styling:
        - Background Color (color picker + hex)
        - Text Color (color picker + hex)
        - Label / Accent Color (color picker + hex)
        - Font Family (dropdown: 8 system fonts)
        - Corner Radius (range slider 0-24px)
  -> All changes instantly re-render the live preview
  -> State objects passed downstream:
      cardStyles:     { bgColor, fontColor, fontFamily, accentColor, borderRadius }
      orientation:    "horizontal" | "vertical"
      gradientColors: { start, end }
  -> Passed to: renderCard() → CardComponent, BulkGenerator
```

### ID Card Generation (Single)

```
User enters member data on Generate page (manual or Google Sheets import)
  -> Clicks "Preview" to see real-time card rendering
  -> Download PDF:
    1. Both front + back captured off-screen via html2canvas
    2. canvasesToPdfBlob() creates a 2-page jsPDF document
    3. Browser downloads the PDF instantly
    4. Front PNG also uploaded to Supabase Storage (for Dashboard access)
    5. Row inserted into generated_ids (15-day expiry)
  -> Download JPEG:
    1. Currently visible side captured -> canvasToJpegBlob()
    2. Browser downloads the JPEG
    3. Front PNG uploaded to Supabase Storage
    4. Row inserted into generated_ids (15-day expiry)
```

**Key detail:** Every single-card download now also persists the card to
Supabase so it appears in the Dashboard. Upload failures are logged
but do not block the local download.

### Google Sheets Import (2-Phase Column Mapping)

```
User pastes a Google Sheets URL and clicks "Import"
  Phase 1 — Fetch & Map:
    -> Sheet URL converted to CSV export URL
    -> CSV fetched and parsed (custom parseCSV handles quoted fields)
    -> Headers extracted; auto-guess mapping via GUESS_RULES aliases
    -> Column Mapping UI shown: dropdowns for each standard field
       (name, email, role, id_number, dob, gender, photo_url, address)
    -> Data preview table shows first 3 rows
  Phase 2 — Confirm & Import:
    -> User adjusts mappings, clicks "Confirm & Import"
    -> Validates that 'Full Name' column is mapped
    -> Unmapped columns auto-registered as custom fields
    -> Member objects built from mapped columns -> added to queue
    -> Auto-scrolls to Generation Queue section
```

### ID Card Generation (Bulk)

```
User adds multiple members to the queue
  -> Generation Settings panel (optional):
      - Range Start / End: generate only a subset (e.g. members 5–20)
      - Per-Person Cap: max cards per unique name (0 = unlimited)
      - Email via Brevo: toggle to email each card after generation
  -> getFilteredMembers() applies range + per-person cap filters
  -> BulkGenerator processes each filtered member in sequence:
    FOR EACH member:
      1. Set currentMember -> React re-renders off-screen front + back cards
      2. html2canvas captures front ref -> PNG blob
      3. html2canvas captures back ref -> back canvas
      4. PNG blob uploaded to Supabase Storage (for Dashboard / signed URLs)
      5. Metadata inserted into generated_ids (file_url, expires_at)
      6. canvasesToPdfBlob(frontCanvas, backCanvas) -> 2-page PDF blob
      7. PDF blob stored in pdfBlobsRef (for email step)
      8. PDF added to JSZip folder
    END FOR
  -> JSZip compresses all PDFs into a single .zip
  -> file-saver triggers browser download of the ZIP
  -> IF "Email via Brevo" is enabled:
      FOR EACH member with an email address:
        1. Convert PDF blob -> base64
        2. POST /api/email/send-card { recipientEmail, pdfBase64, ... }
        3. Email delivery progress shown in dedicated panel
      END FOR
  -> Results summary displayed (success / failed counts)
```

### ID Card Access (Dashboard)

```
User visits Dashboard
  -> Query: SELECT * FROM generated_ids WHERE user_id = current AND expires_at > now()
  -> Expired records are excluded from the result
  -> Results displayed as a responsive thumbnail card grid (1-4 columns)
  -> Each DashboardCard component:
      1. Loads thumbnail via signed URL (cached in state)
      2. Shows member name, creation date, expiry badge (green/amber/red)
      3. "View" button opens full-size preview in new tab
      4. "Download" button uses supabase.storage.download() -> blob -> browser save
         (avoids cross-origin issues with signed URL + <a download>)
```

### Google Drive Image Proxy

```
Member photo URL is a Google Drive link
  -> proxyImage.js detects Google Drive URL pattern
  -> Rewrites to: /api/proxy/image?url=<encoded-direct-URL>
  -> Express backend fetches the image server-side (bypasses CORS)
  -> Returns image bytes to the browser
  -> html2canvas can now render the image (same-origin)
```

## Why Supabase?

| Factor             | Supabase                        | Express + Custom DB     |
| ------------------ | ------------------------------- | ----------------------- |
| **Auth**           | Built-in (GoTrue)               | Must implement manually |
| **Database**       | Managed Postgres with dashboard | Self-managed            |
| **Storage**        | S3-compatible with signed URLs  | Custom file handling    |
| **Security**       | RLS policies at DB level        | Middleware-based        |
| **Speed to build** | Hours                           | Days/Weeks              |
| **Cost**           | Free tier covers this project   | Hosting + DB costs      |
| **Maintenance**    | Zero server maintenance         | Server patches, uptime  |

## Why a Hybrid Architecture (Client + Express Backend)?

The project started as a pure Supabase client-side app. The Express backend was added specifically for:

1. **Google Drive image proxy** - Google Drive blocks CORS for direct image fetches. The backend proxies image requests server-side so `html2canvas` can render member photos hosted on Drive.
2. **Server-side validation** - Bulk generation payloads are validated with max batch size (50) enforcement.
3. **Admin operations** - Approve members, cleanup expired records.
4. **Rate limiting** - Per-IP limits prevent abuse (100 req/15 min general, 20/15 min auth, 30/15 min email).
5. **Email delivery** - Sends generated ID card PDFs to members via Brevo's transactional email API.

The frontend still talks directly to Supabase for auth, database queries, and storage uploads. The Express backend supplements - it does not replace - Supabase.

## Frontend Architecture

```
src/
+-- components/              # Reusable UI components
|   +-- IDCard.jsx           # Custom/default template (geometric gradient)
|   +-- CorporateCard.jsx    # Corporate Standard (red + blue gradient)
|   +-- EventCard.jsx        # Event Access (dark royal theme)
|   +-- StudentCard.jsx      # Student ID (modern academic)
|   +-- BulkGenerator.jsx    # Batch generation + upload + ZIP download
|   +-- ProtectedRoute.jsx   # Auth guard HOC
+-- pages/                   # Route-level page components
|   +-- Login.jsx            # Email + password / Email OTP
|   +-- Signup.jsx           # Registration with member profile
|   +-- Dashboard.jsx        # Status, generated IDs, signed-URL downloads
|   +-- Templates.jsx        # Template selection + org config + watermark
|   +-- Generate.jsx         # Data entry + preview + PDF/JPEG download + bulk gen
|   +-- TokenDashboard.jsx  # Token balance, 30-day sparkline, transaction history
|   +-- TokenPurchase.jsx   # Browse token packages, purchase tokens
+-- lib/
|   +-- supabaseClient.js    # Single Supabase client instance
|   +-- proxyImage.js        # Google Drive URL -> backend proxy rewriter
+-- utils/
|   +-- downloadHelpers.js   # canvasesToPdfBlob, canvasToJpegBlob, safeFileName, etc.
+-- App.jsx                  # Router configuration
+-- main.jsx                 # React entry point
+-- index.css                # Tailwind + global styles
```

### Key Design Decisions

- **Single Supabase client instance** - Prevents multiple GoTrue sessions and ensures consistent auth state.
- **ProtectedRoute wrapper** - Centralizes auth checks to avoid duplicating logic in every page.
- **Off-screen rendering for html2canvas** - Card components are rendered off-screen at full size (positioned with `fixed -left-full`), so html2canvas captures at high quality without affecting the visible UI.
- **Dual off-screen refs (front + back)** - BulkGenerator maintains two refs: `frontRef` renders `showBack=false`, `backRef` renders `showBack=true`. Both are captured for PDF creation.
- **Template as a component** - Each template (Corporate, Event, Student, Custom) is a separate `forwardRef` component with identical props interface, making them interchangeable.
- **PDF delivery via jsPDF** - Each card becomes a 2-page PDF (front + back). For bulk, all PDFs are zipped. For single preview, PDF downloads instantly.
- **Watermark is optional** - Templates page has a collapsed watermark config section with toggle. When disabled, `watermark: null` is passed downstream.
- **Custom fields are dynamic** - Users define field label + side (front/back) at runtime. Google Sheets extra columns auto-register as custom fields.
- **Card customization (bgColor, fontColor, fontFamily, accentColor, borderRadius)** — All card visual properties are controlled via a `cardStyles` state object in `Generate.jsx`, passed as a prop to every card component. Uses inline `style={}` for bg/font/radius and Tailwind classes for layout. See `09_CARD_CUSTOMIZATION.md` for full details.
- **Horizontal / Vertical orientation** — A single `orientation` state (`"horizontal"` | `"vertical"`) switches every card between landscape (85.6 × 53.98 mm) and portrait (53.98 × 85.6 mm). Each card component derives `isVertical` and adjusts flex direction, sizing, and aspect ratio conditionally. Same component handles both layouts (no separate vertical components).
- **Gradient color picker** — Two color swatches + hex inputs (start/end) in the sidebar control the decorative gradient overlays on all 4 templates. State in `Generate.jsx` (`gradientStart`/`gradientEnd`) → `gradientColors` prop → card SVGs/backgrounds.
- **System fonts only** — 8 curated system fonts (Public Sans, Inter, Arial, Georgia, etc.) ensure html2canvas captures them reliably — no web font loading failures.
- **Single-card uploads to Supabase** - Both PDF and JPEG downloads also upload the front PNG to Supabase Storage + insert a `generated_ids` row, so every card appears in the Dashboard.
- **Column mapping for Sheets import** - 2-phase flow: Phase 1 fetches CSV and shows auto-guessed mapping UI; Phase 2 confirms mappings and imports. Unmapped columns become custom fields automatically.
- **Image preloading before capture** - `captureRef()` waits for all `<img>` elements inside the card to finish loading before calling `html2canvas`, preventing blank photos.
- **Dashboard thumbnail grid** - `DashboardCard` subcomponent loads signed-URL thumbnails with hover effects, expiry badges (green >7d, amber 3-7d, red ≤3d), and blob-based downloads.

---

## SaaS Platform Extension (Multi-Tenant)

The system has been extended into a multi-tenant SaaS platform with two products:

1. **Aarannu Service** — Subscription-based org workspace with member registration and card generation
2. **Aarannu Bulk** — Pay-per-use event card generation with Google Sheets import

### Extended Backend Architecture

```
Express Backend (Extended)
├── routes/
│   ├── authRoutes.js          # LEGACY
│   ├── idRoutes.js            # LEGACY
│   ├── adminRoutes.js         # LEGACY
│   ├── proxyRoutes.js         # LEGACY
│   ├── emailRoutes.js         # LEGACY
│   ├── orgRoutes.js           # NEW — /api/org
│   ├── projectRoutes.js       # NEW — /api/projects
│   ├── projectMemberRoutes.js # NEW — /api/members
│   ├── generateRoutes.js      # NEW — /api/generate
│   ├── verifyRoutes.js        # NEW — /api/verify (public)
│   └── bulkRoutes.js          # NEW — /api/bulk
├── controllers/
│   ├── orgController.js       # NEW
│   ├── projectController.js   # NEW
│   ├── projectMemberController.js # NEW
│   ├── generateController.js  # NEW
│   └── verifyController.js    # NEW
├── services/
│   ├── orgService.js          # NEW
│   ├── projectService.js      # NEW
│   ├── projectMemberService.js # NEW
│   └── generateService.js     # NEW
└── middleware/
    ├── checkOrgRole.js        # NEW — org role enforcement
    └── checkPlanLimits.js     # NEW — subscription limit enforcement
```

### Extended Frontend Architecture

```
src/pages/
├── OrgOnboarding.jsx       # NEW — Create/select organization
├── OrgDashboard.jsx        # NEW — Organization admin dashboard
├── ProjectCreate.jsx       # NEW — Create service/bulk project
├── ProjectDashboard.jsx    # NEW — Project member management
├── RegistrationForm.jsx    # NEW — Public registration form (no auth)
├── VerifyCard.jsx          # NEW — Public QR verification (no auth)
└── BulkDashboard.jsx       # NEW — Bulk generation dashboard
```

### New Route Structure

| Route                           | Page             | Auth      |
| ------------------------------- | ---------------- | --------- |
| `/org/new`                      | OrgOnboarding    | ✅        |
| `/org/:slug/dashboard`          | OrgDashboard     | ✅        |
| `/org/:slug/project/new`        | ProjectCreate    | ✅        |
| `/org/:slug/project/:projectId` | ProjectDashboard | ✅        |
| `/org/:slug/bulk/:projectId`    | BulkDashboard    | ✅        |
| `/register/:projectId`          | RegistrationForm | ❌ Public |
| `/verify/:cardId`               | VerifyCard       | ❌ Public |

See individual docs for details:

- [10_MULTI_TENANT.md](./10_MULTI_TENANT.md)
- [11_SUBSCRIPTION_PLANS.md](./11_SUBSCRIPTION_PLANS.md)
- [12_BULK_GENERATION.md](./12_BULK_GENERATION.md)
- [13_QR_VERIFICATION.md](./13_QR_VERIFICATION.md)
- [14_FORM_SYSTEM.md](./14_FORM_SYSTEM.md)
- [15_EMAIL_QUEUE.md](./15_EMAIL_QUEUE.md)
