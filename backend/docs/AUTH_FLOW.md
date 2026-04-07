# Authentication Flow — Complete Reference

Everything about how Aarannu handles identity, sessions, and access control.

---

## Overview

Aarannu uses **Supabase Auth** as the identity provider. Supabase Auth is built
on GoTrue (open-source auth server). It handles:

- Account creation (email + password)
- Email OTP verification
- JWT issuance and validation
- Session management
- Token refresh

The app adds its own layer on top:
- A `members` table that tracks approval status
- A custom 2FA flow (password check → OTP email → session grant)
- Role-based org access via `org_members`

---

## Signup Flow

```
User fills: name, email, password, role
         │
         ▼
supabase.auth.signUp({ email, password })
         │
         ├── Success (new user)
         │     → returns { user: {...}, session: null }
         │     → session is null because email confirmation is ON
         │
         └── Email already registered
               → Supabase returns { user: null, session: null }
                  (enumeration protection — doesn't say "already exists")

         ▼ (success path)
supabase.auth.signInWithOtp({ email })
         │
         → Supabase sends email with 6-digit token ({{ .Token }})
         │
         ▼
User enters 6-digit code
         │
         ▼
supabase.auth.verifyOtp({ email, token, type: "email" })
         │
         → returns { data: { user, session }, error }
         │
         ▼
supabase.from("members").insert({
  user_id: userId,
  name: name,
  role: role || "Member",
  approved: true           ← auto-approved on first signup
})
         │
         ▼
ensureStarterTokens(accessToken)
         │
         → POST /api/tokens/ensure-starter  (backend call)
         → backend calls tokenService.getOrCreateWallet(userId)
         → creates wallet with 50 token bonus if first time
         │
         ▼
setSuccess(true) → shows "Account Ready" screen → link to /dashboard
```

---

## Login Flow (2FA)

```
Step 1: Password check
──────────────────────
User enters email + password
         │
         ▼
supabase.auth.signInWithPassword({ email, password })
         │
         ├── Error: "Invalid login credentials"
         │     → show error "Invalid email or password"
         │     → STOP (don't reveal which is wrong — prevents enumeration)
         │
         └── Success → session created
               │
               ▼
         supabase.auth.signOut()
               ← destroy that session immediately
               ← we don't want the user logged in yet — they need OTP

Step 2: Send OTP
──────────────────
supabase.auth.signInWithOtp({ email })
         │
         → Supabase emails a 6-digit code
         │
         ▼
UI shows OTP input screen

Step 3: Verify OTP
───────────────────
User enters 6-digit code
         │
         ▼
supabase.auth.verifyOtp({ email, token: code, type: "email" })
         │
         ├── Error: expired or wrong code
         │     → "Invalid or expired code"
         │
         └── Success → returns { user, session }
               │
               ▼
         Look up members table:
         supabase.from("members")
           .select("approved")
           .eq("user_id", userId)
           .single()
               │
               ├── No row found
               │     → signOut() → show "Membership Record Not Found"
               │
               ├── Row found, approved = false
               │     → signOut() → show "Account Pending Approval"
               │
               └── Row found, approved = true
                     → ensureStarterTokens()
                     → navigate("/dashboard")
```

---

## Token Refresh (Automatic)

JWTs expire after 1 hour by default. The Supabase JS client handles refresh automatically:

```
Access token expires
         │
         ▼
Supabase JS client detects expiry (via onAuthStateChange)
         │
         ▼
Sends refresh_token to Supabase Auth
         │
         ▼
Supabase returns new access_token
         │
         ▼
Client updates localStorage transparently
         │
         ▼
Next API call uses new token — user never notices
```

If the refresh token is also expired (e.g. user hasn't used the app for 30+ days),
the client emits a SIGNED_OUT event → ProtectedRoute redirects to /login.

---

## How the Backend Verifies Tokens

```
Frontend:  Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
                                                │
                                                ▼
Backend verifyToken.js:
   const token = req.headers.authorization.split(" ")[1];
                                                │
                                                ▼
   supabase.auth.getUser(token)
   // Makes a LIVE HTTP call to Supabase Auth API
   // Supabase validates signature + expiry + revocation status
                                                │
                                        ┌───────┴───────┐
                                      Error            User object
                                        │                │
                                 401 Unauthorized   req.user = user
                                                         │
                                                      next()
```

**Why not just decode the JWT locally?**
A JWT signature can be verified locally using the public JWKS key.
But decoded doesn't mean valid — the token might have been revoked.
`getUser()` checks revocation status. Slower, but correct.

---

## Session Storage

Supabase JS client v2 stores the session in **localStorage** by default:

```
localStorage['sb-<project-id>-auth-token'] = {
  access_token: "...",
  refresh_token: "...",
  expires_at: 1234567890,
  user: { id, email, ... }
}
```

The client reads this on page load and rehydrates the session automatically.
No Redux, no custom session management needed.

---

## OTP Email Template (what Supabase sends)

The template is configured in Supabase → Authentication → Email Templates.

### Default (magic link only — NOT what we want):
```html
<h2>Magic Link</h2>
<p><a href="{{ .ConfirmationURL }}">Log in</a></p>
```

### What you should configure:
```html
<h2>Your verification code</h2>
<p>Enter this code in the app:</p>
<h1 style="letter-spacing:8px;font-size:36px;font-family:monospace;">
  {{ .Token }}
</h1>
<p style="color:#888;font-size:12px;">
  This code expires in 10 minutes.<br>
  Or click: <a href="{{ .ConfirmationURL }}">Log in directly</a>
</p>
```

Template variables:
| Variable | Value |
|----------|-------|
| `{{ .Token }}` | The 6-digit OTP code |
| `{{ .ConfirmationURL }}` | Full magic link URL (uses Site URL from dashboard) |
| `{{ .SiteURL }}` | Your Site URL setting |
| `{{ .Email }}` | The user's email address |

---

## Security Properties

### What prevents attackers from logging in as someone else?

1. **Password required first** — even with someone's email, you need their password
2. **OTP sent to their email** — even with password, you need access to their inbox
3. **JWT is signed** — cannot be forged without the Supabase secret key
4. **Backend re-validates** — even if a JWT is somehow stolen, `getUser()` catches revoked tokens
5. **RLS** — even if backend is bypassed, Supabase DB enforces per-user data isolation

### What prevents token theft?

localStorage is accessible to JavaScript. To prevent XSS stealing tokens:
- helmet's CSP header limits which scripts can run
- Supabase access tokens are short-lived (1 hour)
- Refresh tokens are rotated on each use

---

## Auth State Changes

The frontend listens for auth state changes globally:

```js
// Usually in App.jsx or a context provider
supabase.auth.onAuthStateChange((event, session) => {
  // event = "SIGNED_IN" | "SIGNED_OUT" | "TOKEN_REFRESHED" | "USER_UPDATED"

  if (event === "SIGNED_OUT") {
    // Clear any user-specific state
    // ProtectedRoute will redirect to /login
  }

  if (event === "TOKEN_REFRESHED") {
    // New access token is available
    // Supabase client updates localStorage automatically
  }
});
```

---

## Manual Account Management (SQL)

### Approve a user:
```sql
UPDATE public.members
SET approved = true
WHERE user_id = (SELECT id FROM auth.users WHERE email = 'user@example.com');
```

### Revoke access:
```sql
UPDATE public.members SET approved = false
WHERE user_id = (SELECT id FROM auth.users WHERE email = 'user@example.com');
```

### Delete a user completely:
```sql
-- This cascades to members, generated_ids, token_wallets due to ON DELETE CASCADE
DELETE FROM auth.users WHERE email = 'user@example.com';
```

### List all users and their approval status:
```sql
SELECT
  u.email,
  u.created_at,
  m.name,
  m.role,
  m.approved
FROM auth.users u
LEFT JOIN public.members m ON m.user_id = u.id
ORDER BY u.created_at DESC;
```

### Give a user tokens:
```sql
-- First, find their wallet:
SELECT id, balance FROM token_wallets
WHERE user_id = (SELECT id FROM auth.users WHERE email = 'user@example.com');

-- Then update the balance and log the transaction:
-- (Normally done via the API, but for emergencies:)
UPDATE token_wallets SET balance = balance + 100
WHERE user_id = (SELECT id FROM auth.users WHERE email = 'user@example.com')
AND org_id IS NULL;
```
