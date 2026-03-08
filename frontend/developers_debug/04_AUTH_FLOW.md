# 04 – Authentication Flow

## Overview

Authentication is handled entirely by **Supabase Auth** (powered by GoTrue). No custom auth server is needed.

Supported method: **Email + Password** (the only method implemented in this project).

---

## Signup Flow

```
┌──────────┐     ┌─────────────┐     ┌──────────┐     ┌──────────┐
│  Signup   │────▶│ supabase    │────▶│ auth.users│────▶│ members  │
│  Form     │     │ .auth       │     │ (row     │     │ (profile │
│           │     │ .signUp()   │     │  created) │     │  created)│
└──────────┘     └─────────────┘     └──────────┘     └──────────┘
                                                            │
                                                     approved = false
```

### Step-by-step:

1. **User fills the form** — name, email, password, role.
2. **Client-side validation**:
   - All fields required.
   - Password min 8 characters.
   - Password and confirm password must match.
3. **`supabase.auth.signUp({ email, password })`** — Creates a user in `auth.users`.
   - Supabase hashes the password with bcrypt server-side.
   - Returns the user object with `user.id` (UUID).
4. **Insert into `members` table** — `{ user_id, name, role }`.
   - `approved` defaults to `false` (DB default).
   - RLS policy ensures `user_id` must match `auth.uid()`.
5. **Success screen** — User sees "Account created, pending approval".

### Error handling:

- If auth signup fails (e.g., email already registered), the error is shown.
- If member insert fails (unlikely, but possible), the user is told to contact admin.
- We do NOT delete the auth user on member insert failure (to avoid orphans, the user can retry).

---

## Login Flow

```
┌──────────┐     ┌─────────────┐     ┌──────────┐     ┌──────────┐
│  Login    │────▶│ supabase    │────▶│ JWT      │────▶│ Dashboard│
│  Form     │     │ .auth       │     │ issued   │     │ (redirect│
│           │     │ .signIn     │     │ & stored │     │  on      │
│           │     │ WithPassword│     │ in       │     │  success)│
│           │     │ ()          │     │ localStorage│  │          │
└──────────┘     └─────────────┘     └──────────┘     └──────────┘
```

### Step-by-step:

1. **User enters email + password.**
2. **Client-side validation** — both fields required.
3. **`supabase.auth.signInWithPassword({ email, password })`**
   - Supabase verifies credentials server-side.
   - On success: returns a session with access_token (JWT) and refresh_token.
   - The SDK automatically stores these in `localStorage`.
4. **Navigate to `/dashboard`** — `react-router-dom`'s `useNavigate()` handles the redirect.

### Error handling:

- Invalid credentials → vague error message: "Invalid email or password."  
  **Why vague?** To prevent **user enumeration** attacks. If we said "email not found" vs "wrong password", an attacker could determine which emails are registered.

---

## Session Handling

### How the session persists:

```javascript
// In supabaseClient.js:
export const supabase = createClient(url, key, {
  auth: {
    persistSession: true, // Store in localStorage
    autoRefreshToken: true, // Refresh JWT before it expires
    detectSessionInUrl: true, // For OAuth/magic link flows
  },
});
```

### Session lifecycle:

1. **On login** — JWT (access_token) + refresh_token stored in `localStorage`.
2. **On page load** — `supabase.auth.getSession()` retrieves the stored session.
3. **Token expiry** — The SDK automatically refreshes the JWT using the refresh_token (default: every 1 hour).
4. **On logout** — `supabase.auth.signOut()` clears the session from localStorage and invalidates the refresh_token.

### Cross-tab behavior:

The `onAuthStateChange` listener in `ProtectedRoute.jsx` detects auth changes:

- If the user signs out in Tab A, Tab B receives the `SIGNED_OUT` event and redirects to `/login`.

---

## Approval Gating Logic

### The problem:

Any registered user could access the Generate page without admin approval.

### The solution:

Two-layer gating:

**Layer 1: ProtectedRoute (auth check)**

```
Is the user logged in?
  YES → render the page
  NO  → redirect to /login
```

**Layer 2: Approval check (inside Dashboard & Generate)**

```
Is member.approved === true?
  YES → show "Generate IDs" button / allow access
  NO  → show "Pending Approval" banner / redirect to dashboard
```

### How approval works:

1. New users always have `approved = false` (DB default).
2. An **admin** must go to the Supabase Dashboard → Table Editor → `members` → find the user → set `approved = true`.
3. The next time the user loads the Dashboard, the query fetches their updated `approved` status.

### Future improvements:

- Build an admin panel within the app.
- Use Supabase Edge Functions for automated approval workflows.
- Send email notifications when a user is approved (via Brevo transactional email).

---

## Security Considerations

| Aspect               | Implementation                                                         |
| -------------------- | ---------------------------------------------------------------------- |
| Password storage     | bcrypt (handled by Supabase, never touches our code)                   |
| JWT storage          | localStorage (acceptable for SPAs; httpOnly cookies require a backend) |
| Token refresh        | Automatic via Supabase SDK                                             |
| Error messages       | Intentionally vague to prevent enumeration                             |
| Session invalidation | `signOut()` clears local + server-side                                 |
| CSRF                 | Not applicable (no cookie-based auth; JWT in header)                   |
