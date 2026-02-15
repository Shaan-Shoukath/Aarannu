# 07 — Libraries Used

Every dependency and why it's here.

---

## Production Dependencies

### 1. `express` (v5)

**What:** Fast, un-opinionated web framework for Node.js.

**Why:** Industry standard for building REST APIs. Provides routing, middleware pipeline, error handling, and a massive ecosystem.

**Critical functions used:**

- `express()` — create app instance
- `app.use()` — register middleware
- `Router()` — modular route groups
- `app.listen()` — start HTTP server
- `express.json()` — parse JSON request bodies

---

### 2. `cors`

**What:** Middleware for Cross-Origin Resource Sharing.

**Why:** The frontend (localhost:5173 in dev, production domain in prod) is a different origin from the backend (localhost:5000). Without CORS, the browser blocks all API calls.

**Critical functions used:**

- `cors({ origin, credentials, methods, allowedHeaders })` — configures which origins can access the API.

---

### 3. `helmet`

**What:** Sets secure HTTP response headers automatically.

**Why:** Protects against common web vulnerabilities:

- `X-Content-Type-Options: nosniff` — prevents MIME-type sniffing
- `X-Frame-Options: DENY` — prevents clickjacking
- `Strict-Transport-Security` — enforces HTTPS
- `X-XSS-Protection` — legacy XSS filter header
- Removes `X-Powered-By` — hides that Express is being used

**Critical functions used:**

- `helmet()` — applies all defaults in one call.

---

### 4. `express-rate-limit`

**What:** Limits repeated requests to public APIs.

**Why:** Prevents:

- Brute-force password guessing
- DoS attacks that exhaust Supabase quota
- Automated scraping of generated IDs

**Critical functions used:**

- `rateLimit({ windowMs, max, message })` — creates a limiter middleware.

**Two limiters in this project:**

- `apiLimiter` — 100 requests / 15 min (general)
- `authLimiter` — 20 requests / 15 min (auth endpoints)

---

### 5. `dotenv`

**What:** Loads `.env` files into `process.env`.

**Why:** Keeps secrets (Supabase keys, configuration) out of source code.

**Critical functions used:**

- `require("dotenv").config()` — called once at the top of `server.js`.

---

### 6. `@supabase/supabase-js`

**What:** Official Supabase client for JavaScript/TypeScript.

**Why:** Single SDK to interact with:

- **Auth** — `supabase.auth.getUser(token)` for JWT verification.
- **Postgres** — `supabase.from("table").select/insert/update/delete`.
- **Storage** — `supabase.storage.from("bucket").createSignedUrl()`.

**Critical functions used:**

- `createClient(url, key, options)` — initialise client
- `.from("table").select("*").eq("col", val)` — query builder
- `.from("table").insert(rows)` — bulk insert
- `.storage.from("bucket").createSignedUrl(path, ttl)` — signed URL generation

**Two clients:** Service-role (bypasses RLS) and anon (respects RLS).

---

### 7. `uuid`

**What:** Generate RFC 4122 v4 UUIDs.

**Why:** Primary keys for `generated_ids` rows are created server-side. UUID v4 is:

- Globally unique
- Non-sequential (attacker can't guess IDs)
- Compatible with Supabase's UUID columns

**Critical functions used:**

- `v4()` (imported as `uuidv4`) — generates a random UUID.

---

## Dev Dependencies

### 8. `nodemon`

**What:** File watcher that restarts Node.js on changes.

**Why:** During development, manually restarting after every edit is tedious. `nodemon` watches all `.js` files and auto-restarts.

**Usage:**

```bash
npm run dev   # → nodemon src/server.js
```
