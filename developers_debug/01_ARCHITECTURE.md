# 01 – System Architecture

## High-Level System Design

```
┌─────────────────────────────────────────────────────────┐
│                      BROWSER (Client)                    │
│                                                          │
│   ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────┐ │
│   │  Login /  │  │Dashboard │  │ Generate │  │IDCard  │ │
│   │  Signup   │  │  Page    │  │  Page    │  │Renderer│ │
│   └────┬─────┘  └────┬─────┘  └────┬─────┘  └───┬────┘ │
│        │              │              │             │      │
│        └──────────────┴──────────────┴─────────────┘      │
│                          │                                │
│                  supabaseClient.js                        │
│                   (Single SDK Instance)                   │
└──────────────────────────┬───────────────────────────────┘
                           │ HTTPS (REST + Realtime)
                           ▼
┌──────────────────────────────────────────────────────────┐
│                    SUPABASE (Backend)                     │
│                                                          │
│   ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────┐ │
│   │   Auth   │  │ Postgres │  │ Storage  │  │  RLS   │ │
│   │ (GoTrue) │  │   (DB)   │  │ (S3)     │  │Policies│ │
│   └──────────┘  └──────────┘  └──────────┘  └────────┘ │
└──────────────────────────────────────────────────────────┘
```

## Data Flow

### User Registration

```
User fills signup form
  → supabase.auth.signUp() creates auth user
  → Client inserts row into `members` table (approved = false)
  → User sees "pending approval" message
  → Admin manually sets approved = true in Supabase dashboard
```

### ID Card Generation

```
User enters member data on Generate page
  → IDCard component renders the card in the DOM (off-screen)
  → html2canvas captures the DOM node as a canvas
  → Canvas is converted to a PNG blob
  → Blob is uploaded to Supabase Storage (private bucket: "id-cards")
  → Metadata (file_url, expires_at) is inserted into `generated_ids`
  → User can view/download via signed URLs
```

### ID Card Access

```
User visits Dashboard
  → Query: SELECT * FROM generated_ids WHERE user_id = current AND expires_at > now()
  → Expired records are excluded from the result
  → Active records show download/preview buttons
  → Download generates a temporary signed URL (1-hour validity)
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

## Why No Separate Backend?

This project uses **Supabase as a Backend-as-a-Service (BaaS)**. There is no Express, Flask, or any custom server because:

1. **Auth is handled natively** — Supabase Auth (GoTrue) handles signup, login, session tokens, and JWT refresh.
2. **Database access is direct** — The Supabase client SDK communicates directly with Postgres through the PostgREST API, protected by RLS.
3. **Storage is integrated** — File uploads go directly to Supabase Storage (S3-compatible), with access controlled by storage policies.
4. **Security is at the DB level** — Row Level Security (RLS) ensures data isolation without needing a middleware layer.

The only scenario where a custom backend would be needed is for:

- Sending emails (Supabase has webhooks/edge functions for this)
- Complex business logic (Supabase Edge Functions can handle this)
- Third-party API integrations

For this project, none of those are required.

## Frontend Architecture

```
src/
├── components/           # Reusable UI components
│   ├── IDCard.jsx        # The visual ID card template
│   ├── BulkGenerator.jsx # Handles batch generation + upload
│   └── ProtectedRoute.jsx# Auth guard HOC
├── pages/                # Route-level page components
│   ├── Login.jsx         # Authentication (email + password)
│   ├── Signup.jsx        # Registration with member profile
│   ├── Dashboard.jsx     # Main hub (status, IDs, download)
│   └── Generate.jsx      # Data entry + preview + bulk gen
├── lib/
│   └── supabaseClient.js # Single Supabase client instance
├── App.jsx               # Router configuration
├── main.jsx              # React entry point
└── index.css             # Tailwind + global styles
```

### Design Decisions

- **Single Supabase client instance** — Prevents multiple GoTrue sessions and ensures consistent auth state.
- **ProtectedRoute wrapper** — Centralizes auth checks to avoid duplicating logic in every page.
- **Off-screen rendering for html2canvas** — The IDCard is rendered at full size but positioned off-screen, so html2canvas captures it at high quality without affecting the visible UI.
