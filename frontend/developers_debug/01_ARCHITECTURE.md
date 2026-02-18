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
       (name, role, id_number, dob, gender, photo_url, address)
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
  -> BulkGenerator processes each member in sequence:
    FOR EACH member:
      1. Set currentMember -> React re-renders off-screen front + back cards
      2. html2canvas captures front ref -> PNG blob
      3. html2canvas captures back ref -> back canvas
      4. PNG blob uploaded to Supabase Storage (for Dashboard / signed URLs)
      5. Metadata inserted into generated_ids (file_url, expires_at)
      6. canvasesToPdfBlob(frontCanvas, backCanvas) -> 2-page PDF blob
      7. PDF added to JSZip folder
    END FOR
  -> JSZip compresses all PDFs into a single .zip
  -> file-saver triggers browser download of the ZIP
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
4. **Rate limiting** - Per-IP limits prevent abuse (100 req/15 min general, 20/15 min auth).

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
- **Single-card uploads to Supabase** - Both PDF and JPEG downloads also upload the front PNG to Supabase Storage + insert a `generated_ids` row, so every card appears in the Dashboard.
- **Column mapping for Sheets import** - 2-phase flow: Phase 1 fetches CSV and shows auto-guessed mapping UI; Phase 2 confirms mappings and imports. Unmapped columns become custom fields automatically.
- **Image preloading before capture** - `captureRef()` waits for all `<img>` elements inside the card to finish loading before calling `html2canvas`, preventing blank photos.
- **Dashboard thumbnail grid** - `DashboardCard` subcomponent loads signed-URL thumbnails with hover effects, expiry badges (green >7d, amber 3-7d, red ≤3d), and blob-based downloads.
