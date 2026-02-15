# Community ID Platform — Backend API

Production-grade Express server for the Community Digital ID Platform.  
Connects to Supabase (Auth, Postgres, Storage) and enforces all business rules server-side.

---

## Quick Start

```bash
cd backend
npm install

# Configure environment
cp .env.example .env
# Fill in your Supabase URL, anon key, and service role key

# Development (auto-restart with nodemon)
npm run dev

# Production
npm start
```

---

## API Endpoints

| Method | Path                         | Auth | Approval | Admin | Description                       |
| ------ | ---------------------------- | ---- | -------- | ----- | --------------------------------- |
| GET    | `/api/health`                | —    | —        | —     | Health check                      |
| GET    | `/api/auth/me`               | ✅   | —        | —     | Current user + member profile     |
| POST   | `/api/ids/generate`          | ✅   | ✅       | —     | Bulk-create ID card metadata      |
| GET    | `/api/ids/my-ids`            | ✅   | —        | —     | Fetch active IDs + signed URLs    |
| GET    | `/api/admin/pending`         | ✅   | —        | ✅    | List unapproved members           |
| POST   | `/api/admin/approve/:userId` | ✅   | —        | ✅    | Approve a member                  |
| POST   | `/api/admin/cleanup`         | ✅   | —        | ✅    | Delete expired generated_ids rows |

---

## Project Structure

```
backend/
├── src/
│   ├── config/
│   │   └── supabaseClient.js   # Supabase service-role + anon clients
│   ├── controllers/
│   │   ├── authController.js    # /auth/me
│   │   ├── idController.js      # /ids/generate, /ids/my-ids
│   │   └── adminController.js   # /admin/pending, approve, cleanup
│   ├── middleware/
│   │   ├── verifyToken.js       # JWT verification gate
│   │   ├── checkApproval.js     # Approval business rule
│   │   ├── rateLimiter.js       # Per-IP rate limiting
│   │   └── errorHandler.js      # Centralized error formatter
│   ├── routes/
│   │   ├── authRoutes.js
│   │   ├── idRoutes.js
│   │   └── adminRoutes.js
│   ├── services/
│   │   ├── supabaseService.js   # DB query abstraction
│   │   └── storageService.js    # Signed URL generation
│   ├── utils/
│   │   ├── expiryHelper.js      # 15-day expiry logic
│   │   └── validators.js        # Input validation
│   └── server.js                # Express entry point
├── developers_debug/            # Internal documentation
├── .env.example
├── package.json
└── README.md
```

---

## Security

- **Helmet** — sets secure HTTP headers
- **CORS** — origin whitelist
- **Rate limiting** — 100 req / 15 min (20 for auth)
- **JWT verification** — every protected route verifies tokens via Supabase Auth
- **Approval gating** — generation blocked until admin-approved
- **Input validation** — all payloads validated before DB operations
- **Service-role isolation** — service key never exposed to frontend
- **Centralized errors** — stack traces hidden in production

---

## License

MIT
