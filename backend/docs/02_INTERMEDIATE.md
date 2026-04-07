# Level 2 — Intermediate: Architecture, Routes, and Middleware

You've got the app running. Now understand how the backend is built.

---

## The Folder Structure

```
backend/src/
├── server.js              ← Entry point (creates Express app, mounts routes)
├── config/
│   └── supabaseClient.js  ← Two Supabase clients (service + anon)
├── routes/                ← URL → controller mapping
│   ├── authRoutes.js
│   ├── idRoutes.js
│   ├── orgRoutes.js
│   ├── projectRoutes.js
│   └── ...
├── controllers/           ← HTTP request handlers (req, res)
│   ├── authController.js
│   ├── idController.js
│   ├── orgController.js
│   └── ...
├── services/              ← Business logic (no HTTP, just functions)
│   ├── supabaseService.js
│   ├── tokenService.js
│   ├── cardRenderer.js
│   └── ...
├── middleware/            ← Reusable guards applied to routes
│   ├── verifyToken.js
│   ├── checkTokens.js
│   ├── checkApproval.js
│   ├── checkOrgRole.js
│   ├── rateLimiter.js
│   └── errorHandler.js
└── utils/
    ├── adminHelper.js     ← isAdmin() — checks ADMIN_USER_IDS env var
    └── validators.js
```

---

## The Layered Pattern

Every request goes through three layers. This keeps code clean and testable:

```
Route  →  Controller  →  Service
  │            │              │
  │       handles HTTP    contains pure
  │       (req, res)      business logic
  │
  └─ applies middleware (auth guards)
```

**Example: generating an ID card**

```
POST /api/ids/generate
     │
     ├── rateLimiter        (are you spamming?)
     ├── verifyToken        (is the JWT valid?)
     ├── checkApproval      (is your account approved?)
     ├── checkTokens(1)     (do you have ≥ 1 token?)
     │
     └── idController.generate()
               │
               └── supabaseService.insertGeneratedId()
               └── tokenService.deductTokens()
               └── storageService.getSignedUrl()
```

---

## The Middleware Pipeline

Every request runs through this chain. Middleware can either pass the request
along with `next()`, or stop it with a `res.status().json()`.

```
Incoming request
      │
      ▼
┌─────────────┐
│   helmet    │  Sets secure HTTP headers (CSP, X-Frame-Options, etc.)
└──────┬──────┘
       │
┌──────▼──────┐
│    cors     │  Only allows requests from CORS_ORIGIN env var
└──────┬──────┘
       │
┌──────▼──────┐
│ rateLimiter │  100 req/15min general, 20 req/15min auth routes
└──────┬──────┘
       │
┌──────▼──────┐
│ JSON parser │  Parses req.body (10 MB limit for PDF base64)
└──────┬──────┘
       │
┌──────▼──────┐  (applied per-route, not globally)
│ verifyToken │  Checks JWT → sets req.user
└──────┬──────┘
       │
┌──────▼──────┐  (applied per-route, not globally)
│checkApproval│  Checks members.approved = true
└──────┬──────┘
       │
┌──────▼──────┐  (applied per-route, not globally)
│checkOrgRole │  Checks org_members.role >= minRole
└──────┬──────┘
       │
┌──────▼──────┐  (applied per-route, not globally)
│checkTokens  │  Checks token balance ≥ required
└──────┬──────┘
       │
┌──────▼──────┐
│ Controller  │  Your actual handler — reads req, writes res
└──────┬──────┘
       │
┌──────▼──────┐  (only if controller throws)
│errorHandler │  Catch-all: logs the error, sends 500
└─────────────┘
```

---

## All API Routes

| Method | Route | Auth | What it does |
|--------|-------|------|-------------|
| GET | `/api/health` | No | Server health check |
| GET | `/api/auth/me` | JWT | Returns current user + member profile |
| GET | `/api/ids` | JWT + Approved | Lists user's generated cards |
| POST | `/api/ids/generate` | JWT + Approved + Tokens | Generates a card (renders via Puppeteer) |
| GET | `/api/admin/pending` | JWT + Admin | Lists unapproved members |
| POST | `/api/admin/approve/:userId` | JWT + Admin | Approves a member |
| GET | `/api/org` | JWT | Lists user's organizations |
| POST | `/api/org` | JWT | Creates a new organization |
| GET | `/api/org/:orgId` | JWT + OrgMember | Gets org details |
| GET | `/api/projects` | JWT + OrgMember | Lists projects for an org |
| POST | `/api/projects` | JWT + OrgAdmin | Creates a new project |
| GET | `/api/members` | JWT + OrgAdmin | Lists project members |
| POST | `/api/members/approve/:id` | JWT + OrgAdmin | Approves a submission |
| POST | `/api/generate` | JWT + OrgAdmin + Tokens | Bulk generate cards |
| GET | `/api/tokens/balance` | JWT | Current token balance |
| GET | `/api/tokens/transactions` | JWT | Transaction history |
| POST | `/api/verify/:cardId` | No | Public card verification |
| POST | `/api/proxy/image` | No | Proxies Google Drive images |
| POST | `/api/bulk/generate` | JWT + OrgAdmin + Tokens | Bulk ZIP generation |

---

## The Two Supabase Clients

```js
// config/supabaseClient.js

const supabase = createClient(URL, SERVICE_ROLE_KEY);
// ↑ Bypasses Row Level Security
// Used by: backend controllers and services
// NEVER expose this key to the browser

const supabasePublic = createClient(URL, ANON_KEY);
// ↑ Respects Row Level Security
// Used by: operations that should enforce per-user data isolation
```

**Why two clients?**
- The frontend uses the anon key and is bound by RLS
- The backend uses the service role key to do admin operations
  (approve users, run cleanup, read other users' data)
- If the backend used the anon key, it would be blocked by RLS

---

## Understanding req.user

After `verifyToken` runs, every downstream handler gets `req.user`:

```js
// What verifyToken sets:
req.user = {
  id: "uuid-of-the-user",          // use this for DB queries
  email: "user@example.com",
  role: "authenticated",
  created_at: "2026-01-01T...",
  // plus other Supabase auth fields
}
```

Controllers never need to extract the user from a JWT manually. `verifyToken`
does it and attaches the verified result.

---

## Understanding the Error Flow

Controllers don't need try/catch for unexpected errors — `errorHandler` catches them:

```js
// This is fine:
const getData = async (req, res, next) => {
  const { data, error } = await supabase.from("members").select("*");
  if (error) return next(error);   // ← sends to errorHandler
  res.json(data);
};

// errorHandler.js sends:
// { "error": "Internal Server Error", "message": "...", "requestId": "..." }
```

For expected errors (bad input, not found), controllers respond directly:
```js
if (!member) {
  return res.status(404).json({ error: "Not Found", message: "Member not found" });
}
```

---

## Running a Single Test

```bash
cd backend
npx jest --verbose --forceExit src/__tests__/tokenService.test.js
```

Test files live in `backend/src/__tests__/`. They test services in isolation
without starting the HTTP server.

---

## Environment Variable Reference

| Variable | Used by | What it does |
|----------|---------|-------------|
| `SUPABASE_URL` | backend | Your project's API URL |
| `SUPABASE_ANON_KEY` | backend | Public key (respects RLS) |
| `SUPABASE_SERVICE_ROLE_KEY` | backend | Admin key (bypasses RLS) |
| `PORT` | backend | Express port (default 5000) |
| `NODE_ENV` | backend | "development" or "production" |
| `CORS_ORIGIN` | backend | Allowed frontend URL(s), comma-separated |
| `FRONTEND_URL` | backend | Where Puppeteer navigates to render cards |
| `ADMIN_USER_IDS` | backend | Comma-separated UUIDs of platform admins |
| `VITE_SUPABASE_URL` | frontend | Same URL, different prefix for Vite |
| `VITE_SUPABASE_ANON_KEY` | frontend | Anon key for frontend client |
| `VITE_API_URL` | frontend | Backend URL (http://localhost:5000) |

---

## Next Step

Read **03_ADVANCED.md** to understand the token system, the card rendering
pipeline (how Puppeteer screenshots work), and deep authentication internals.
