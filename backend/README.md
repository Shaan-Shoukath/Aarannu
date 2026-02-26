# Aarannu Community ID Platform — Backend API

Production-grade Express 5 server for the Aarannu Community Digital ID Platform.  
Connects to Supabase (Auth, Postgres, Storage) and enforces all business rules server-side.  
Includes a Google Drive image proxy, automated cleanup scheduler, and configurable rate limits.

---

## Quick Start

```bash
cd backend
npm install

# Configure environment
cp .env.example .env
# Fill in: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY

# Development (auto-restart with nodemon)
npm run dev

# Production
npm start
```

---

## Environment Variables

| Variable                    | Default                 | Description                         |
| --------------------------- | ----------------------- | ----------------------------------- |
| `SUPABASE_URL`              | —                       | Supabase project URL (required)     |
| `SUPABASE_ANON_KEY`         | —                       | Anon key (required)                 |
| `SUPABASE_SERVICE_ROLE_KEY` | —                       | Service role key (required, secret) |
| `PORT`                      | `5000`                  | Server port                         |
| `NODE_ENV`                  | `development`           | Environment mode                    |
| `CORS_ORIGIN`               | `http://localhost:5173` | Comma-separated allowed origins     |
| `BULK_BATCH_LIMIT`          | `50`                    | Max members per API batch           |

---

## API Endpoints

| Method | Path                         | Auth | Approval | Admin | Description                        |
| ------ | ---------------------------- | ---- | -------- | ----- | ---------------------------------- |
| GET    | `/api/health`                | —    | —        | —     | Health check + uptime              |
| GET    | `/api/auth/me`               | ✅   | —        | —     | Current user + member profile      |
| POST   | `/api/ids/generate`          | ✅   | ✅       | —     | Bulk-create ID card metadata       |
| GET    | `/api/ids/my-ids`            | ✅   | —        | —     | Fetch active IDs + signed URLs     |
| GET    | `/api/proxy/image`           | —    | —        | —     | Proxy external images (Drive CORS) |
| GET    | `/api/admin/pending`         | ✅   | —        | ✅    | List unapproved members            |
| POST   | `/api/admin/approve/:userId` | ✅   | —        | ✅    | Approve a member                   |
| POST   | `/api/admin/cleanup`         | ✅   | —        | ✅    | Delete expired generated_ids rows  |

---

## Project Structure

```
backend/
├── src/
│   ├── config/
│   │   └── supabaseClient.js   # Two clients: service-role (bypasses RLS) + anon (respects RLS)
│   ├── controllers/
│   │   ├── authController.js    # GET /auth/me
│   │   ├── idController.js      # POST /ids/generate, GET /ids/my-ids
│   │   └── adminController.js   # GET /admin/pending, POST approve, POST cleanup
│   ├── middleware/
│   │   ├── verifyToken.js       # JWT verification via supabase.auth.getUser()
│   │   ├── checkApproval.js     # Approval business rule gate
│   │   ├── rateLimiter.js       # Per-IP rate limiting (100/15m + 20/15m auth)
│   │   └── errorHandler.js      # Centralized error formatter (hides stack in prod)
│   ├── routes/
│   │   ├── authRoutes.js
│   │   ├── idRoutes.js
│   │   ├── adminRoutes.js
│   │   └── proxyRoutes.js       # Google Drive image proxy with URL normalization
│   ├── services/
│   │   ├── supabaseService.js   # DB operations: members, generated_ids, cleanup
│   │   └── storageService.js    # Signed URL generation, file deletion
│   ├── utils/
│   │   ├── expiryHelper.js      # 15-day expiry logic (getExpiryDate, getNow, isExpired)
│   │   └── validators.js        # Input validation (members, bulk payload, UUID)
│   └── server.js                # Entry point + auto-cleanup scheduler (runs every 6h)
├── developers_debug/            # 8 internal architecture documents
├── .env.example
├── package.json
└── README.md
```

---

## Middleware Pipeline

Every request passes through this stack (in order):

```
Request → helmet → cors → JSON parser → [rateLimiter] → [verifyToken] → [checkApproval] → Controller → Response
                                                                                              ↓ (on error)
                                                                                         errorHandler
```

---

## Automated Cleanup

The server runs a cleanup on boot and then every 6 hours:

1. Fetches all `generated_ids` rows where `expires_at < now()`.
2. Deletes the corresponding PNG files from the `id-cards` storage bucket (best-effort).
3. Deletes the expired DB rows.

Logs the count of purged records and files to stdout.

---

## Configurable Limits

| Limit               | Default | Config             | Description                          |
| ------------------- | ------- | ------------------ | ------------------------------------ |
| API batch size      | 50      | `BULK_BATCH_LIMIT` | Max members per `/ids/generate` call |
| General rate limit  | 100/15m | `rateLimiter.js`   | Per-IP request cap                   |
| Auth rate limit     | 20/15m  | `rateLimiter.js`   | Per-IP auth endpoint cap             |
| Image proxy cap     | 10 MB   | `proxyRoutes.js`   | Max proxied image size               |
| Image proxy timeout | 15s     | `proxyRoutes.js`   | Upstream fetch timeout               |
| ID card expiry      | 15 days | `expiryHelper.js`  | Lifetime of generated ID records     |
| Cleanup interval    | 6 hours | `server.js`        | Auto-cleanup frequency               |
| JSON body limit     | 1 MB    | `server.js`        | Max request body size                |

---

## Security

- **Helmet** — sets secure HTTP headers (XSS, HSTS, content-type sniffing, etc.)
- **CORS** — origin whitelist (configurable via `CORS_ORIGIN`)
- **Rate limiting** — 100 req/15 min general, 20/15 min for auth endpoints
- **JWT verification** — server-to-server `getUser()` call (catches revoked tokens)
- **Approval gating** — generation blocked until admin-approved
- **Input validation** — all payloads validated (name ≤120 chars, role ≤60, URL format, UUID format)
- **Service-role isolation** — service key server-only, never exposed to frontend
- **Image proxy guards** — content-type whitelist (image/\* only), 10 MB size cap, 15s timeout
- **Centralized errors** — stack traces hidden in production, generic messages to clients
- **Auto-cleanup** — expired records + storage files purged automatically

---

## Key Dependencies

| Library                 | Version | Purpose                             |
| ----------------------- | ------- | ----------------------------------- |
| `express`               | ^5.2.1  | Web framework                       |
| `@supabase/supabase-js` | ^2.95.3 | Auth, Postgres, Storage SDK         |
| `cors`                  | ^2.8.6  | Cross-origin access control         |
| `helmet`                | ^8.1.0  | Secure HTTP headers                 |
| `express-rate-limit`    | ^8.2.1  | Request rate limiting               |
| `dotenv`                | ^17.3.1 | Environment variable loading        |
| `uuid`                  | ^13.0.0 | UUID v4 generation for primary keys |
| `nodemon`               | ^3.1.11 | Dev auto-restart (devDependency)    |

---

## Developer Debug Docs

See [`developers_debug/`](developers_debug/README.md) for 8 detailed documents covering architecture rationale, database schema, JWT verification, defense-in-depth security, signed URL strategy, expiry logic, library deep-dives, and production deployment.

---

## License

MIT
