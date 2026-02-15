# 08 – Production Hardening

## Overview

This document covers the security measures, deployment steps, and production considerations for taking the Community ID Platform from development to production.

---

## 1. Environment Variables

### Current setup:

| Variable                 | Purpose                    | Exposed to frontend?         |
| ------------------------ | -------------------------- | ---------------------------- |
| `VITE_SUPABASE_URL`      | Supabase project URL       | Yes (safe — public endpoint) |
| `VITE_SUPABASE_ANON_KEY` | Supabase anonymous API key | Yes (safe — respects RLS)    |

### What is NEVER exposed:

- `SUPABASE_SERVICE_ROLE_KEY` — Has full access, bypasses RLS. Only used in server-side code / Edge Functions.
- Database connection strings.
- Any third-party API secrets.

### .env file setup:

```bash
# .env (Git-ignored, local only)
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# .env.example (committed, no real values)
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

### Why `VITE_` prefix?

Vite only exposes environment variables prefixed with `VITE_` to the client bundle. Any variable without this prefix stays server-side only.

---

## 2. RLS Enforcement

### Checklist:

- [ ] RLS enabled on `members` table
- [ ] RLS enabled on `generated_ids` table
- [ ] Storage policies on `id-cards` bucket
- [ ] No service_role key in frontend code
- [ ] Tested: User A cannot read User B's data
- [ ] Tested: Unauthenticated requests return no data

### Testing RLS:

```sql
-- Test as a specific user (in SQL Editor with service_role):
SET request.jwt.claim.sub = 'user-uuid-here';
SET request.jwt.claims = '{"sub": "user-uuid-here", "role": "authenticated"}';

SELECT * FROM members;  -- Should only return this user's row
SELECT * FROM generated_ids;  -- Should only return this user's rows
```

### Common mistakes:

1. **Forgetting to enable RLS** — All data is accessible.
2. **Using `service_role` key in frontend** — Bypasses all RLS.
3. **Missing `WITH CHECK` on INSERT** — Users can insert data under other user_ids.

---

## 3. Rate Limiting Ideas

Supabase doesn't have built-in per-user rate limiting, but here are strategies:

### Option A: Supabase Edge Function middleware

```typescript
// Track requests per user per minute
const rateLimit = new Map();

Deno.serve(async (req) => {
  const userId = /* extract from JWT */;
  const now = Date.now();
  const userRequests = rateLimit.get(userId) || [];
  const recentRequests = userRequests.filter(t => now - t < 60000);

  if (recentRequests.length >= 10) {
    return new Response('Rate limited', { status: 429 });
  }

  recentRequests.push(now);
  rateLimit.set(userId, recentRequests);
  // ... handle request
});
```

### Option B: Database-level check

```sql
-- Before generating, check if user has generated too many recently
SELECT COUNT(*) FROM generated_ids
WHERE user_id = auth.uid()
  AND created_at > now() - INTERVAL '1 hour';
-- If count > 50, reject the request
```

### Option C: Frontend throttling

```javascript
// Simple debounce on the generate button
const [lastGenerated, setLastGenerated] = useState(0);
const canGenerate = Date.now() - lastGenerated > 5000; // 5 second cooldown
```

---

## 4. Input Validation

### Client-side validation (implemented):

| Field     | Validation                              |
| --------- | --------------------------------------- |
| Email     | HTML `type="email"` + `required`        |
| Password  | Minimum 8 characters                    |
| Name      | Required, trimmed                       |
| Role      | Optional, trimmed, defaults to "Member" |
| Photo URL | Optional, validated as URL              |

### Server-side validation (via RLS + Postgres):

| Constraint                     | Enforcement             |
| ------------------------------ | ----------------------- |
| `user_id` must match auth user | RLS policy `WITH CHECK` |
| `name` cannot be NULL          | `NOT NULL` constraint   |
| `file_url` cannot be NULL      | `NOT NULL` constraint   |
| `expires_at` cannot be NULL    | `NOT NULL` constraint   |

### Additional validation to consider:

```sql
-- Add check constraints for extra safety
ALTER TABLE public.members
  ADD CONSTRAINT check_name_length CHECK (char_length(name) BETWEEN 1 AND 200);

ALTER TABLE public.members
  ADD CONSTRAINT check_role_length CHECK (char_length(role) BETWEEN 1 AND 100);
```

---

## 5. XSS Considerations

### React's built-in protection:

React automatically escapes all values rendered in JSX. This means:

```jsx
// SAFE — React escapes this automatically
<h3>{user.name}</h3>
// If user.name = "<script>alert('xss')</script>"
// React renders: &lt;script&gt;alert('xss')&lt;/script&gt;
```

### Potential XSS vectors and mitigations:

| Vector                    | Risk                    | Mitigation                                     |
| ------------------------- | ----------------------- | ---------------------------------------------- |
| User name in IDCard       | Low (React escapes)     | React auto-escaping                            |
| Photo URL                 | Medium (external image) | `crossOrigin="anonymous"`, validate URL format |
| `dangerouslySetInnerHTML` | High                    | **Not used anywhere in this project**          |
| URL parameters            | Medium                  | Not used for data rendering                    |

### Content Security Policy (CSP):

For production deployment, add this to your hosting config:

```
Content-Security-Policy:
  default-src 'self';
  script-src 'self';
  style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
  font-src 'self' https://fonts.gstatic.com;
  img-src 'self' https://*.supabase.co data: blob:;
  connect-src 'self' https://*.supabase.co;
```

---

## 6. Deployment Steps

### Option A: Vercel (Recommended)

1. **Push to GitHub:**

   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/your-username/community-id.git
   git push -u origin main
   ```

2. **Import in Vercel:**
   - Go to [vercel.com](https://vercel.com)
   - Click "Import Project" → Select your GitHub repo
   - Framework Preset: **Vite**
   - Build Command: `npm run build`
   - Output Directory: `dist`

3. **Set environment variables in Vercel:**
   - `VITE_SUPABASE_URL` → your project URL
   - `VITE_SUPABASE_ANON_KEY` → your anon key

4. **Deploy** — Vercel builds and deploys automatically on push.

### Option B: Netlify

1. Push to GitHub (same as above).
2. Import in Netlify → Build command: `npm run build`, publish dir: `dist`.
3. Set env vars in Netlify dashboard.
4. Add `_redirects` file for SPA routing:
   ```
   /* /index.html 200
   ```

### Option C: Cloudflare Pages

1. Push to GitHub.
2. Create new Pages project → Build command: `npm run build`, output: `dist`.
3. Set env vars.
4. Cloudflare handles SPA routing automatically.

---

## 7. Pre-Deployment Checklist

### Security

- [ ] `.env` is in `.gitignore`
- [ ] No service_role key in code
- [ ] RLS enabled on all tables
- [ ] Storage bucket is private
- [ ] Password minimum length enforced
- [ ] Error messages are vague (no user enumeration)

### Performance

- [ ] `npm run build` produces optimized output
- [ ] Images are reasonably sized
- [ ] No console.log in production (or use conditional logging)

### Functionality

- [ ] Signup → Login → Dashboard flow works
- [ ] Approval gating blocks unapproved users
- [ ] ID generation works end-to-end
- [ ] Expired IDs are hidden
- [ ] Download via signed URLs works
- [ ] Sign out clears session

### Infrastructure

- [ ] Supabase tables created
- [ ] RLS policies applied
- [ ] Storage bucket created
- [ ] Environment variables set in hosting platform
- [ ] Custom domain configured (optional)
- [ ] HTTPS enabled (automatic on Vercel/Netlify/Cloudflare)

---

## 8. Monitoring & Maintenance

### Supabase Dashboard:

- Monitor auth user count
- Check storage usage
- Review database size
- Check for failed requests in logs

### Future improvements:

- [ ] Add an admin panel for user approval
- [ ] Implement email notifications on approval
- [ ] Add pg_cron for expired record cleanup
- [ ] Add error tracking (Sentry)
- [ ] Add analytics (PostHog or similar)
- [ ] Implement password reset flow
- [ ] Add 2FA support
