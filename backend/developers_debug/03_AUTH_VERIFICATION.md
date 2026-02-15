# 03 — Auth Verification

## How JWT Verification Works

### Token Flow

```
1. User logs in via Supabase Auth (frontend).
2. Supabase returns a JWT access token.
3. Frontend stores the token and includes it in every API request:
       Authorization: Bearer eyJhbG...
4. Backend middleware (`verifyToken.js`) intercepts the request.
5. Token is sent to Supabase Auth for verification.
6. If valid → user object attached to `req.user`, request continues.
7. If invalid → 401 Unauthorized returned immediately.
```

### Why the Backend Must Verify Tokens

| Risk                     | Without server-side verification                                                                |
| ------------------------ | ----------------------------------------------------------------------------------------------- |
| **Forged tokens**        | Anyone can craft a JWT with a random payload. Without verification, the backend would trust it. |
| **Expired tokens**       | JWTs have an `exp` claim. If not checked, stale sessions persist.                               |
| **Revoked users**        | A deleted or banned user's old token would still be accepted.                                   |
| **Privilege escalation** | A normal user could set `role: "admin"` in a crafted token.                                     |

### Verification Method

We use `supabase.auth.getUser(token)`:

```js
const {
  data: { user },
  error,
} = await supabase.auth.getUser(token);
```

This makes a **server-to-server call** to Supabase Auth, which:

1. Validates the JWT signature (using Supabase's signing secret).
2. Checks the `exp` (expiry) claim.
3. Looks up the user in `auth.users` — confirming they still exist and aren't banned.
4. Returns a fresh `user` object (not decoded claims — an actual DB lookup).

> **Why not just decode the JWT locally?**  
> Local decoding (e.g. with `jsonwebtoken`) is faster but **cannot detect revoked tokens**.  
> `getUser()` hits Supabase on every call, which trades a few milliseconds of latency for guaranteed accuracy.

### What Gets Attached to `req.user`

```js
req.user = {
  id: "a1b2c3d4-...", // UUID
  email: "user@example.com",
  created_at: "2026-01-15T...",
  // ... other Supabase user fields
};
```

Downstream middleware and controllers use `req.user.id` to scope all queries to the authenticated user.

### Error Responses

| Scenario                  | Status | Message                                   |
| ------------------------- | ------ | ----------------------------------------- |
| No `Authorization` header | 401    | Missing or malformed Authorization header |
| Token too short / empty   | 401    | Invalid token format                      |
| Supabase rejects token    | 401    | Token verification failed                 |
| Unexpected server error   | 500    | Authentication check failed               |

All error messages are intentionally **vague** — they never reveal whether the user exists, reducing information leakage for attackers.
