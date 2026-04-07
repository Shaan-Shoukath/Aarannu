# Level 3 — Advanced: Tokens, Card Rendering, RLS, and Auth Internals

---

## Part A — The Token (Credit) System

### Overview

Every card generation costs 1 token. Tokens are bought upfront (pre-paid credits).
This is the "usage-based billing" model used by most AI/SaaS APIs.

```
User buys 100 tokens
→ generates 100 cards
→ balance reaches 0
→ blocked with HTTP 402 (Payment Required)
→ buys more tokens
```

### Database Design

Three tables work together:

```
token_wallets
  id, user_id, org_id, balance, lifetime_purchased, lifetime_used

token_transactions  (append-only ledger — NEVER delete rows)
  id, wallet_id, user_id, amount, type, description, balance_after

token_packages
  id, name, tokens, price_cents, is_active
```

**Why an immutable ledger?**
Think of `token_transactions` like a bank statement. You never delete a bank transaction —
you add a new correcting one. This is called an "event sourcing" pattern.
If there's a dispute, you can replay all transactions to verify the current balance.

### How deduction works (race-condition proof)

Naive approach (WRONG):
```
1. Read balance   → 5 tokens
2. Check 5 >= 1   → OK
3. Write balance  → 4 tokens
```
Problem: if two requests run simultaneously, both read 5, both succeed, but you actually
had 5 tokens used twice. This is a race condition.

Our approach (CORRECT — single atomic SQL):
```sql
UPDATE token_wallets
SET balance = balance - 1
WHERE id = $wallet_id
AND balance >= 1          ← atomic guard
RETURNING *
```
If `balance >= 1` fails, zero rows are updated → Supabase returns an error → we block.
PostgreSQL guarantees this UPDATE is atomic — no two concurrent requests can
double-spend from the same wallet.

### The checkTokens middleware

```js
// Applied to generation routes:
router.post('/generate', verifyToken, checkTokens(1), controller);
//                                    ↑
//                       checks balance BEFORE the controller runs

// For bulk (dynamic count):
router.post('/bulk', verifyToken, checkTokens('body.members.length'), controller);
//                                             ↑
//                              resolves req.body.members.length at runtime
```

The middleware fails **CLOSED** — if the token service is unreachable (DB timeout),
it returns 503 instead of letting the request through. "Fail safe" = deny on uncertainty.

### Admin token bypass

Users in `ADMIN_USER_IDS` env var get unlimited tokens:
```js
// adminHelper.js
const ADMIN_IDS = new Set(
  (process.env.ADMIN_USER_IDS || "").split(",").map(id => id.trim())
);

const isAdmin = (userId) => ADMIN_IDS.has(userId);
```

In `checkTokens` and `deductTokens`, the first thing checked is `isAdmin(userId)`.
If true, skip balance check, skip deduction, set `req.tokenBalance = Infinity`.

---

## Part B — Card Rendering (The Scraping Pipeline)

This is how a card goes from React component → PNG/PDF file.

### The Problem

We want pixel-perfect card images. HTML/CSS cards look great in a browser.
But converting HTML to image on the server is hard.

### The Solution: Puppeteer + A Special Render Route

```
Backend renderCard()
      │
      ▼
Puppeteer launches a headless Chrome browser (no window)
      │
      ▼
Chrome navigates to: http://localhost:5173/render-card#<encoded-data>
      │                                    ↑
      │                    This is a special hidden route in the frontend
      │                    It reads the card data from the URL hash
      │                    and renders the card components
      ▼
Chrome waits for: [data-render-ready='true'] attribute on the page
      │
      ▼
Chrome screenshots #card-front and #card-back elements
      │
      ▼
Screenshots (PNG buffers) returned to backend
      │
      ▼
Backend builds a PDF from the PNGs using Puppeteer's PDF API
      │
      ▼
Returns: { frontPng, frontJpeg, backPng, pdfBuffer, pdfBase64 }
```

### Why use the URL hash (#)?

```js
const encodedPayload = encodeURIComponent(JSON.stringify(payload));
const renderUrl = `${frontendUrl}/render-card#${encodedPayload}`;
```

The `#fragment` part of a URL is never sent to the server (browser-only).
This means we can pass large amounts of card data to the render page
without it appearing in server access logs. It also avoids extra API round-trips.

### Browser instance pooling

Launching a Chromium browser takes ~500ms. We keep ONE browser alive
and reuse it for all renders:

```js
let browserInstance = null;

const getBrowser = async () => {
  if (browserInstance && browserInstance.connected) {
    return browserInstance;       // reuse existing
  }
  browserInstance = await puppeteer.launch({ headless: "new", ... });
  return browserInstance;
};
```

Each render opens a new **page** (tab), uses it, then closes it.
The browser stays open. This makes subsequent renders ~10x faster.

### Viewport and DPI

```js
await page.setViewport({
  width: 900,           // wide enough for a horizontal card
  height: 700,
  deviceScaleFactor: 2  // ← 2x DPI = "Retina" quality screenshots
});
```

The `deviceScaleFactor: 2` doubles the pixel density.
A card that's 350px wide becomes 700px in the PNG — crisp when printed.

### PDF page sizing (CR-80 standard)

ID cards follow the CR-80 standard (same size as a credit card):
- Horizontal: 85.6mm × 53.98mm
- Vertical: 53.98mm × 85.6mm

The PDF page is set to exactly this size with 2mm padding:
```js
await pdfPage.pdf({
  width: '89.6mm',    // 85.6 + 2mm padding each side
  height: '57.98mm',
  printBackground: true,
  margin: { top: '2mm', right: '2mm', bottom: '2mm', left: '2mm' }
});
```

This produces a PDF where the card is actual physical card size —
ready to send to a printer.

---

## Part C — Row Level Security (RLS) Deep Dive

### What is RLS?

RLS is a PostgreSQL feature that adds a WHERE clause to every query
automatically, based on who is running it.

```sql
-- Without RLS:
SELECT * FROM members;       -- returns ALL rows from ALL users

-- With RLS policy:
-- "Users can read own member" → USING (auth.uid() = user_id)
SELECT * FROM members;       -- returns ONLY your row
```

### How auth.uid() works

When the frontend sends an authenticated query to Supabase, it sends the JWT
in the `apikey` header. Supabase's PostgREST layer decodes the JWT and makes
the user's ID available as `auth.uid()` in every RLS policy.

```
Frontend request ─── JWT: eyJhbGciOiJIUz... ───►  Supabase PostgREST
                                                          │
                                                   Decode JWT
                                                   auth.uid() = "abc-123"
                                                          │
                                                   Apply RLS:
                                                   WHERE user_id = 'abc-123'
```

### Service role bypasses RLS

The backend uses `SUPABASE_SERVICE_ROLE_KEY`. This key tells PostgREST
"I am the database owner — skip all RLS checks." That's why the backend
can read any user's data and why this key must NEVER leave the server.

### The `auth.role()` check in token policies

```sql
CREATE POLICY "Service role manages wallets"
  ON token_wallets FOR ALL
  USING (auth.role() = 'service_role');
```

This policy says: only the backend (using the service role key) can
INSERT/UPDATE/DELETE wallets. Regular users can only SELECT their own
(covered by the other SELECT policy). Token balance mutations are server-only.

### Recursive RLS (org membership check)

```sql
CREATE POLICY "Org members can read their org"
  ON organizations FOR SELECT
  USING (id IN (
    SELECT org_id FROM org_members WHERE user_id = auth.uid()
  ));
```

This is a subquery — it checks the `org_members` table to determine
if you belong to the org. PostgreSQL runs this for every row it considers
returning. It's powerful but can be slow at scale (add indexes!).

---

## Part D — Authentication Deep Dive

### The Two-Factor Login Flow

```
1. User enters email + password
         │
         ▼
2. supabase.auth.signInWithPassword({ email, password })
   → returns { data, error }
   → on SUCCESS: Supabase creates a session
         │
         ▼
3. Backend signs out the session immediately
   (we don't want a session yet — we need 2FA first)
   supabase.auth.signOut()
         │
         ▼
4. supabase.auth.signInWithOtp({ email })
   → Supabase generates a 6-digit token
   → Sends it to the user's email
         │
         ▼
5. User enters the 6-digit code
         │
         ▼
6. supabase.auth.verifyOtp({ email, token, type: "email" })
   → Returns a new session (access_token + refresh_token)
         │
         ▼
7. Check members table: is this user approved?
   → No row → "Membership Record Not Found" error
   → Row, approved=false → "Account Pending Approval" error
   → Row, approved=true → proceed
         │
         ▼
8. ensureStarterTokens(accessToken)
   → Creates token wallet with 50 bonus tokens if first login
         │
         ▼
9. Navigate to /dashboard
```

### JWT Lifecycle

```
signInWithPassword or verifyOtp success
         │
         ▼
Supabase returns:
  {
    access_token: "eyJhbGci...",     ← short-lived (1 hour default)
    refresh_token: "base64...",       ← long-lived (used to get new access tokens)
    expires_in: 3600,
    user: { id, email, ... }
  }
         │
         ▼
Frontend stores these in localStorage (Supabase client handles this)
         │
         ▼
Every API request to the backend:
  Authorization: Bearer eyJhbGci...
         │
         ▼
Backend verifyToken middleware:
  supabase.auth.getUser(token)
  → Makes a LIVE call to Supabase Auth (not just decode)
  → Catches revoked tokens immediately
  → Returns fresh user object
```

### Why `getUser()` instead of just decoding the JWT?

JWTs are self-contained — you could decode them locally without calling Supabase.
But if a token is revoked (user signs out, password changed), a locally-decoded
JWT would still look valid.

`supabase.auth.getUser(token)` makes a real HTTP call to Supabase's auth server
to check if the token is still active. This is slower (one extra HTTP call per request)
but guarantees revoked tokens are caught immediately.

### The ProtectedRoute component

```jsx
// frontend/src/components/ProtectedRoute.jsx
// Wraps any route that requires authentication

function ProtectedRoute({ children }) {
  const [authState, setAuthState] = useState("loading");

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setAuthState("authenticated");
      } else {
        setAuthState("unauthenticated");
      }
    });
  }, []);

  if (authState === "loading")       return <Spinner />;
  if (authState === "unauthenticated") return <Navigate to="/login" />;
  return children;
}
```

---

## Part E — The Three Authorization Layers

The backend has three distinct authorization systems. Understanding all three
prevents confusion when adding new routes.

```
Layer 1: Platform Admin
  Source: ADMIN_USER_IDS environment variable
  Check:  isAdmin(userId) in adminHelper.js
  Grants: Unlimited tokens, admin endpoints

Layer 2: Legacy Member Role
  Source: members.role column = 'admin'
  Check:  requireAdmin() in adminController.js
  Grants: Approve/reject users, cleanup, expiry management

Layer 3: Organization Role
  Source: org_members.role = 'owner' | 'admin' | 'member'
  Check:  checkOrgRole(minRole) middleware
  Grants: Per-org project management, bulk generation
```

### checkOrgRole middleware

```js
// Usage:
router.patch('/:orgId', verifyToken, checkOrgRole('owner'), controller);

// How it works:
const checkOrgRole = (minRole) => async (req, res, next) => {
  const { orgId } = req.params;
  const userId = req.user.id;

  const roleLevel = { member: 1, admin: 2, owner: 3 };
  const required = roleLevel[minRole];

  // Query org_members to find the user's role in this org
  const { data } = await supabase
    .from('org_members')
    .select('role')
    .eq('org_id', orgId)
    .eq('user_id', userId)
    .single();

  if (!data) return res.status(403).json({ error: 'Not a member of this org' });
  if (roleLevel[data.role] < required) return res.status(403).json({ error: 'Insufficient role' });

  req.orgRole = data.role;
  next();
};
```

---

## Part F — Bulk Card Generation

The bulk flow handles hundreds of cards efficiently:

```
POST /api/bulk/generate
  body: { projectId, memberIds: ["uuid1", "uuid2", ...] }
         │
         ▼
checkTokens(body.memberIds.length)   ← check ALL tokens upfront
         │
         ▼
Deduct ALL tokens atomically         ← one DB write, not N writes
         │
         ▼
For each member:
  1. renderCard(memberData)           ← Puppeteer → PNG
  2. uploadToStorage(png, path)       ← Supabase Storage
  3. insertGeneratedCard(metadata)    ← DB row
         │
         ▼
Collect all storage paths
         │
         ▼
Create ZIP archive with JSZip
         │
         ▼
Return ZIP as base64 or stream

If ANY card fails:
  refundTokens(count_of_failures)    ← auto-refund on error
```

The refund mechanism ensures users aren't charged for failed generations.
The transaction ledger records: deduction, then refund as separate entries.

---

## Summary: Request Lifecycle (Complete View)

```
Browser → POST /api/ids/generate
              │
         [helmet]           → adds X-Frame-Options, CSP headers
              │
         [cors]             → checks Origin header vs CORS_ORIGIN env
              │
         [rateLimiter]      → max 100 req/15min per IP
              │
         [json parser]      → parses req.body
              │
         [verifyToken]      → verifies JWT with Supabase Auth
              │              → sets req.user = { id, email, ... }
         [checkApproval]    → queries members.approved = true
              │
         [checkTokens(1)]   → queries token_wallets.balance >= 1
              │              → sets req.tokenBalance, req.tokensRequired
         [idController]     → validates input
              │              → calls cardRenderer.renderCard()
              │              → calls tokenService.deductTokens()
              │              → calls storageService upload
              │              → calls supabaseService.insertGeneratedId()
              │              → res.json({ url, expires_at })
         [errorHandler]     → catches any thrown Error → 500 response
```
