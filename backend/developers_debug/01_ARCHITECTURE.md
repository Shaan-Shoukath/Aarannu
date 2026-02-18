# 01 — Architecture

## Why Does a Backend Exist When Supabase Can Handle Logic?

Supabase provides Auth, Postgres, and Storage — yet we still need a dedicated Express server.

### Reasons

| Concern              | Supabase-only approach                                                    | With backend                                                   |
| -------------------- | ------------------------------------------------------------------------- | -------------------------------------------------------------- |
| **Business rules**   | Encoded in RLS policies (SQL) — hard to test, debug, and change           | Written in JavaScript — readable, testable, version-controlled |
| **Admin API**        | Requires service-role key on the frontend (⚠ critical security flaw)      | Service-role key stays on the server — never exposed           |
| **Input validation** | RLS can reject bad rows but error messages are cryptic                    | Express validates early and returns clear 400 responses        |
| **Rate limiting**    | Not built-in (requires external proxy)                                    | `express-rate-limit` handles per-IP throttling                 |
| **Audit / logging**  | Requires Postgres triggers or third-party tools                           | `console.log` / structured logging in middleware               |
| **Scalability**      | Frontend talks directly to Supabase — harder to add caching, queues, etc. | Backend is a natural place to add Redis, BullMQ, etc. later    |

### The "Defense in Depth" Principle

```
Frontend (React)
    │
    ├── Supabase Auth (login / signup)
    │
    ▼
Backend (Express)          ← Business rules enforced here
    │
    ├── verifyToken        ← JWT verified server-side
    ├── checkApproval      ← Approval gated server-side
    ├── validators         ← Input sanitised
    │
    ▼
Supabase (Postgres + Storage)
    │
    └── RLS policies       ← Second layer of defense
```

Even if someone bypasses the frontend entirely (e.g. `curl`), the backend catches it.  
Even if the backend has a bug, RLS catches it.  
**Two independent layers = much harder to exploit.**

---

## API Layering

```
Request → Middleware → Controller → Service → Supabase
                                        │
                                   Response ← JSON
```

| Layer          | Responsibility                                         |
| -------------- | ------------------------------------------------------ |
| **Middleware** | Auth, approval, rate-limit, error handling             |
| **Controller** | Parse HTTP request, call service, format HTTP response |
| **Service**    | Pure business logic + Supabase queries                 |
| **Utils**      | Helpers (expiry math, validation rules)                |
| **Config**     | Supabase client singletons                             |
| **Routes**     | Express Router wiring + proxy routes                   |

Controllers are intentionally thin — they contain zero database logic.  
Services know nothing about HTTP — they return `{ data, error }`.

---

## Google Drive Image Proxy

### Why does it exist?

Google Drive blocks CORS on direct image fetches. When a user provides a Google Drive URL as a member's photo, `html2canvas` cannot render it due to browser security restrictions.

### How it works

```
Frontend: proxyImage.js
    │
    │ Detects Google Drive URL patterns:
    │   - drive.google.com/file/d/...
    │   - drive.google.com/open?id=...
    │   - lh3.googleusercontent.com/...
    │
    │ Rewrites to:
    │   /api/proxy/image?url=<encoded-direct-URL>
    │
    ▼
Backend: proxyRoutes.js
    │
    ├── normalizeDriveUrl()  ← converts sharing URLs to direct-download URLs
    ├── fetch(directUrl)     ← server-side fetch (no CORS issue)
    ├── Content-Type check   ← only image/* MIME types allowed
    ├── Size check           ← max 10 MB
    │
    ▼
Response: image bytes streamed to browser
    │
    └── html2canvas renders it as a same-origin image
```

### Security measures on the proxy

- **Content-type whitelist** — only `image/*` MIME types pass through (prevents fetching arbitrary files)
- **Size limit** — 10 MB maximum prevents memory exhaustion
- **Rate-limited** — same IP-based rate limits as other endpoints
- **URL validation** — rejects malformed URLs

### Route file: `src/routes/proxyRoutes.js`

```
GET /api/proxy/image?url=<encoded-url>
```

This is a standalone route file that does not use controllers or services — it's a simple pass-through proxy with security guards.
