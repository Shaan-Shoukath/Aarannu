# Level 9 — Authentication and Authorisation: From Zero to Production

How identity works on the web — what every backend engineer needs to deeply understand before touching auth code.

---

## Part A — Authentication vs Authorisation

These are two different things that people constantly conflate.

**Authentication** — *Who are you?*
Proving identity. "I am Ali Hassan and my email is ali@test.com."

**Authorisation** — *What are you allowed to do?*
Checking permissions after identity is confirmed. "Ali Hassan is allowed to view his own card but not another user's."

In this project:
- **Authentication**: Supabase Auth (email + password + OTP 2FA)
- **Authorisation**: backend middleware (`checkApproval`, `checkOrgRole`, `checkTokens`) and database RLS policies

You always authenticate first. Authorisation is meaningless without identity.

---

## Part B — The Problem Auth Solves

HTTP is stateless — every request is a fresh connection with no memory of previous ones.

Without auth:
```
GET /api/tokens/balance
→ Which user's balance? The server has no idea who's asking.
→ You'd have to return every user's balance (terrible).
→ Or fail with "who are you?" (useless).
```

With auth:
```
GET /api/tokens/balance
Authorization: Bearer eyJhbGci...

→ verifyToken reads the JWT
→ Decodes user ID: "abc-123"
→ Returns the balance for user "abc-123"
```

The `Authorization: Bearer <token>` header on every request is how the server knows who you are. The token is issued once at login, then sent with every subsequent request.

---

## Part C — Sessions vs Tokens: A History

### The old way: Sessions

1. User logs in → server stores `session_id: "xyz" → user_id: "abc"` in memory
2. Server gives browser a cookie: `session-id=xyz`
3. Browser sends cookie on every request
4. Server looks up `session_id → user_id` from memory/database
5. Server knows who you are

**Problems at scale:**
- Session data is stored on the server → can't scale to multiple servers without a shared session store (Redis)
- Sessions need cleanup (they grow forever otherwise)
- Mobile apps don't use cookies well

### The modern way: JWT Tokens

1. User logs in → server creates a JWT and gives it to the browser
2. Browser stores it (usually localStorage)
3. Browser sends it as `Authorization: Bearer <JWT>` on every request
4. Server **verifies the JWT's signature** — no database lookup needed
5. Server knows who you are

**Why this is better:**
- Stateless — the token contains everything the server needs
- Works for mobile apps, SPAs, server-to-server
- No shared session state needed across servers

---

## Part D — How JWTs Work (Deep)

A JWT has three parts, separated by dots: `header.payload.signature`

```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9    ← Header (base64url encoded)
.
eyJpZCI6ImFiYy0xMjMiLCJlbWFpbCI6InVzZXJAZXhhbXBsZS5jb20iLCJleHAiOjE3MTQ1MDI0MDB9
.                                         ← Payload (base64url encoded)
abc123signatureXYZ                        ← Signature (cryptographic)
```

### Decoding the header and payload

These are just base64url encoded JSON (not encrypted — anyone can read them):

```js
// Header
JSON.parse(atob("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9"))
// → { "alg": "HS256", "typ": "JWT" }
// alg = which algorithm signs and verifies the token

// Payload
JSON.parse(atob("eyJpZCI6ImFiYy0xMjMiLCJleHAiOjE3MTQ1MDI0MDB9"))
// → { "id": "abc-123", "email": "user@example.com", "exp": 1714502400 }
// exp = expiry timestamp (Unix seconds)
```

**Important**: the payload is readable by anyone. Never put passwords, payment data, or sensitive secrets inside a JWT payload.

### The signature: what prevents forgery

The signature is computed as:
```
HMACSHA256(
  base64url(header) + "." + base64url(payload),
  SECRET_KEY
)
```

`SECRET_KEY` is a long random string known only to the server (Supabase manages this).

If an attacker modifies the payload (e.g. changes `"id": "abc"` to `"id": "admin"`), the signature no longer matches. The server rejects it.

If an attacker tries to forge a signature without the secret key — impossible (HMAC-SHA256 is computationally infeasible to reverse).

### Why `getUser()` instead of local verification

You *could* verify a JWT locally:
```js
const jwt = require('jsonwebtoken');
const decoded = jwt.verify(token, process.env.SUPABASE_JWT_SECRET);
// → { id: "abc-123", email: "...", exp: 1714502400 }
```

But this doesn't know if the token was **revoked**. If a user changes their password, old tokens should be invalidated — but a local decode can't detect that.

`supabase.auth.getUser(token)` makes a live HTTP call to Supabase Auth, which checks:
- Is the signature valid?
- Is the token expired?
- Has the token been revoked (user signed out or changed password)?

Slower (one extra network call per request) but correct.

---

## Part E — This Project's Auth Flow

### Signup

```
1. User fills form: name, email, password, role
        │
        ▼
2. supabase.auth.signUp({ email, password })
   → Supabase creates user in auth.users
   → session is null (email confirmation required)
   → Supabase triggers an email (configured in Auth → Email Templates)
        │
        ▼
3. supabase.auth.signInWithOtp({ email })
   → Supabase sends 6-digit code to the email
        │
        ▼
4. User enters 6-digit code
        │
        ▼
5. supabase.auth.verifyOtp({ email, token: code, type: "email" })
   → Returns { data: { session, user }, error }
   → session.access_token = JWT (valid 1 hour)
   → session.refresh_token = long-lived token for refreshing
        │
        ▼
6. Insert into members table:
   supabase.from("members").insert({
     user_id: user.id,
     name: name,
     role: "Member",
     approved: true        ← auto-approved on first signup
   })
        │
        ▼
7. POST /api/tokens/ensure-starter
   → Backend creates a token wallet with 50 bonus tokens
        │
        ▼
8. Redirect to /dashboard
```

### Login (2FA: password + OTP)

```
Step 1: Verify the password
──────────────────────────
supabase.auth.signInWithPassword({ email, password })
    │
    ├── Error → "Invalid email or password" (don't say which is wrong)
    │
    └── Success → session created
          │
          ▼
    supabase.auth.signOut()
    ← IMMEDIATELY sign out this session
    ← We don't want the user active yet — they still need to pass OTP

Step 2: Send 6-digit code
──────────────────────────
supabase.auth.signInWithOtp({ email })
→ Supabase emails a code
→ UI shows OTP input screen

Step 3: Verify OTP
──────────────────
supabase.auth.verifyOtp({ email, token: code, type: "email" })
    │
    ├── Error → "Invalid or expired code"
    │
    └── Success → { session, user }
          │
          ▼
    Check members table:
    supabase.from("members").select("approved").eq("user_id", user.id)
          │
          ├── No row → signOut() → "Membership Record Not Found"
          ├── approved = false → signOut() → "Account Pending Approval"
          └── approved = true → navigate("/dashboard")
```

**Why sign out after the password check?**
Because a successful password check alone is not enough to grant access. The second factor (OTP) must also be verified. If we kept the session active between steps, a user who knew someone's password could bypass the OTP step by closing the browser.

---

## Part F — How Authorisation Works in the Backend

After authentication confirms identity, the backend enforces what that identity can do.

### Layer 1: Platform Admin (environment variable)

```js
// utils/adminHelper.js
const ADMIN_IDS = new Set(
  (process.env.ADMIN_USER_IDS || "").split(",").map(id => id.trim())
);

const isAdmin = (userId) => ADMIN_IDS.has(userId);
```

Admin users:
- Skip token balance checks (unlimited generation)
- Can access `/api/admin/*` endpoints

There's no UI to toggle this — it only changes via the environment variable. This is intentional: it prevents privilege escalation through UI bugs.

### Layer 2: Member Approval

```js
// middleware/checkApproval.js
const checkApproval = async (req, res, next) => {
  const { data: member } = await supabase
    .from("members")
    .select("approved")
    .eq("user_id", req.user.id)
    .single();

  if (!member) return res.status(403).json({ error: "Membership record not found" });
  if (!member.approved) return res.status(403).json({ error: "Account pending approval" });

  next();
};
```

Applied to any route that requires an approved account. A user who authenticated with a valid JWT but has `approved = false` is blocked here.

### Layer 3: Organization Role

```js
// middleware/checkOrgRole.js
const checkOrgRole = (minRole) => async (req, res, next) => {
  const roleLevel = { member: 1, admin: 2, owner: 3 };
  const { orgId } = req.params;

  const { data } = await supabase
    .from("org_members")
    .select("role")
    .eq("org_id", orgId)
    .eq("user_id", req.user.id)
    .single();

  if (!data) return res.status(403).json({ error: "Not a member of this org" });
  if (roleLevel[data.role] < roleLevel[minRole]) return res.status(403).json({ error: "Insufficient role" });

  req.orgRole = data.role;
  next();
};
```

Usage:
```js
router.patch("/:orgId", verifyToken, checkOrgRole("owner"), orgController.update);
// Only org owners can update the org
```

### Layer 4: Database RLS (last line of defence)

Even if all middleware is bypassed (shouldn't happen, but defence in depth), the database enforces its own access policies. A row-level policy example:

```sql
-- Users can only see project members if they belong to the same org
CREATE POLICY "org_member_sees_project_members"
ON project_members FOR SELECT
USING (
  project_id IN (
    SELECT p.id FROM projects p
    JOIN org_members om ON p.org_id = om.org_id
    WHERE om.user_id = auth.uid()
  )
);
```

This runs for every SELECT on `project_members` when using the anon key. The backend's service role key bypasses RLS — which is why the backend is trusted to enforce its own access control correctly.

---

## Part G — JWT Storage and Security

### Where JWTs are stored

The Supabase JS client stores tokens in `localStorage`:
```
Key: sb-{project-ref}-auth-token
Value: { access_token, refresh_token, expires_at, user }
```

This means:
- Tokens survive page refresh (user stays logged in)
- Tokens are accessible to any JavaScript running on the page

### XSS risk

Cross-site scripting (XSS) — an attacker injects JavaScript into your page that reads `localStorage` and steals the token.

Mitigations in this project:
- `helmet()` sets `Content-Security-Policy` header — limits which scripts can run
- Supabase access tokens expire after 1 hour
- Refresh tokens are rotated on each use (stolen refresh token can only be used once)

### The alternative: httpOnly cookies

Tokens in httpOnly cookies cannot be read by JavaScript at all — only sent automatically by the browser. This eliminates XSS token theft.

Tradeoffs of httpOnly cookies:
- More complex setup (CSRF protection needed)
- Doesn't work as naturally for mobile API clients
- Requires backend session management for refresh

For most web apps including this one, localStorage with a short access token expiry and Content-Security-Policy is an acceptable tradeoff.

---

## Part H — Token Refresh (Automatic)

Access tokens expire after 1 hour. The Supabase client handles refresh automatically:

```
Access token expires (or 5 minutes before expiry)
         │
         ▼
Supabase JS client detects expiry (onAuthStateChange listener)
         │
         ▼
Client sends refresh_token to POST /auth/v1/token?grant_type=refresh_token
         │
         ▼
Supabase returns: { access_token: "new...", refresh_token: "new..." }
← Refresh tokens are rotated: old one is invalidated, new one issued
         │
         ▼
Client updates localStorage automatically
         │
         ▼
User never notices — next API request uses the new access token
```

If the refresh token itself expires (30-day default, or user hasn't used the app in a month), Supabase emits a `SIGNED_OUT` event, and the frontend redirects to `/login`.

---

## Part I — Common Auth Bugs and How to Avoid Them

### Bug 1: Checking auth in the frontend only

```js
// BAD — frontend auth check only
function ProtectedRoute({ children }) {
  const [user, setUser] = useState(null);
  useEffect(() => { supabase.auth.getUser().then(({ data }) => setUser(data.user)); }, []);
  if (!user) return <Navigate to="/login" />;
  return children;
}
```

If someone calls your API directly (curl, Postman), they bypass the frontend entirely. **Always validate the JWT in the backend middleware too** — frontend auth is only for UX, never for security.

### Bug 2: Trusting req.body for the user's identity

```js
// BAD — user sends their own ID in the body
const { userId } = req.body;   // ← anyone can put any UUID here
const balance = await getBalance(userId);
```

```js
// GOOD — identity comes from the verified JWT
const userId = req.user.id;    // ← set by verifyToken middleware after JWT validation
const balance = await getBalance(userId);
```

### Bug 3: Forgetting to handle token expiry

```js
// BAD — no check for expired session
const { data: { session } } = await supabase.auth.getSession();
if (session) { doAuthenticatedAction(); }
// If session is expired but still in localStorage, getSession() might still return it
```

```js
// GOOD — check if session is still valid
const { data: { user }, error } = await supabase.auth.getUser();
// getUser() makes a live network call — catches expired/revoked tokens
if (error || !user) { navigate('/login'); return; }
```

### Bug 4: Logging the JWT

```js
// BAD — JWT in logs means anyone with log access can impersonate users
console.log("Request headers:", req.headers);
// → prints "Authorization: Bearer eyJhbGci..." to your logs
```

Never log `req.headers.authorization` or any token. Use Pino's `redact` option to strip it automatically.

### Bug 5: Using the service role key in the frontend

The service role key bypasses ALL row-level security — it's the master key to your database. If it's in the frontend (Vite env, client-side code), any user can extract it from the bundle with browser DevTools.

Rule: `SUPABASE_SERVICE_ROLE_KEY` is backend-only, always. No exceptions.

---

## Part J — Production Auth Checklist

```
Supabase setup:
  [ ] Email confirmation enabled (Auth → Providers → Email)
  [ ] OTP email template shows {{ .Token }} (not just a link)
  [ ] Site URL set to production domain
  [ ] Redirect URLs include production domain

Backend:
  [ ] verifyToken middleware on all authenticated routes
  [ ] checkApproval on routes requiring an approved account
  [ ] checkOrgRole on org-scoped routes
  [ ] SUPABASE_SERVICE_ROLE_KEY only in backend env (never frontend)

Frontend:
  [ ] ProtectedRoute wraps all authenticated pages
  [ ] onAuthStateChange listener handles SIGNED_OUT event
  [ ] No JWTs or service role keys in Vite env except anon key

Security:
  [ ] helmet() applied globally in server.js
  [ ] Content-Security-Policy allows only trusted script sources
  [ ] Rate limiting on auth routes (tighter than general routes)
  [ ] Error messages don't reveal which of email/password is wrong

Testing:
  [ ] Signup → OTP email arrives → account created
  [ ] Login → OTP email arrives → lands on dashboard
  [ ] Expired/invalid JWT → 401 response
  [ ] Unapproved account → 403 response
  [ ] Wrong org role → 403 response
  [ ] Non-existent route → 404 response (not 500)
```
