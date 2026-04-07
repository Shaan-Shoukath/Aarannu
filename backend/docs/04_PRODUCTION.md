# Level 4 — Production: Deploy, Secure, and Scale

This guide covers what changes when you go from localhost to real users.

---

## What Changes in Production

| Concern | Development | Production |
|---------|------------|------------|
| URLs | localhost | Real domain |
| HTTPS | No | Yes (required) |
| Email links | localhost | Your domain |
| .env keys | Weak/dev | Strong, rotated regularly |
| Error messages | Verbose | Sanitized |
| Logging | console.log | Structured logs (e.g. Pino) |
| CORS | localhost | Your domain only |
| Rate limits | Loose | Tighter |
| Puppeteer | Local Chrome | Headless in container |

---

## Step 1 — Choose a Deployment Platform

### Recommended: Railway or Render

Both support Node.js with zero config. Connect your GitHub repo and they auto-deploy on push.

**Railway** (best for this stack):
1. railway.app → New Project → Deploy from GitHub
2. Add environment variables in the Railway dashboard
3. Railway gives you a `*.railway.app` URL

**Render**:
1. render.com → New → Web Service → Connect GitHub
2. Build command: `cd backend && npm install`
3. Start command: `node src/server.js`

### For the frontend:
**Vercel** (best for React/Vite):
1. vercel.com → Import → Select your repo
2. Framework: Vite
3. Root directory: `frontend`
4. Build command: `npm run build`
5. Output directory: `dist`

---

## Step 2 — Update Environment Variables

**Backend (Railway/Render dashboard):**
```env
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_ANON_KEY=eyJhb...
SUPABASE_SERVICE_ROLE_KEY=eyJhb...
PORT=5000
NODE_ENV=production
CORS_ORIGIN=https://yourapp.vercel.app
FRONTEND_URL=https://yourapp.vercel.app
ADMIN_USER_IDS=uuid-of-your-admin-user
```

**Frontend (Vercel dashboard):**
```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhb...
VITE_API_URL=https://your-backend.railway.app
VITE_BULK_DAILY_LIMIT=200
VITE_BULK_MAX_QUEUE=500
```

---

## Step 3 — Update Supabase Settings

### Site URL (critical for email links)
Supabase → Authentication → URL Configuration:
- **Site URL**: `https://yourapp.vercel.app`
- **Redirect URLs**: `https://yourapp.vercel.app/**`

Without this, password reset and email confirmation links point to localhost.

### CORS in Supabase
Supabase → Project Settings → API → CORS:
Add your production frontend URL here too.

---

## Step 4 — Puppeteer in Production

Puppeteer (used for card rendering) needs a Chrome binary. This works differently in production.

### On Railway/Render (Linux containers):
Install the system dependencies:

Add to `backend/package.json`:
```json
{
  "scripts": {
    "postinstall": "npx puppeteer browsers install chrome"
  }
}
```

Or use the `puppeteer` package's built-in Chrome:
```bash
# In your deployment environment
npm install puppeteer  # downloads Chrome automatically
```

### Required Linux packages (Dockerfile or nixpacks):
```
libx11-xcb1, libxcomposite1, libxdamage1, libxrandr2, libxss1,
libxtst6, libnss3, libasound2, libatk-bridge2.0-0, libdrm2,
libgbm1, libgtk-3-0
```

### Environment variable for Chrome path:
```env
PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable
```

Or let Puppeteer find it:
```js
puppeteer.launch({
  executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
  args: ['--no-sandbox', '--disable-setuid-sandbox']
});
```

`--no-sandbox` is required in containerized Linux environments.

---

## Step 5 — Production Security Checklist

### HTTP Headers (helmet is already configured)
helmet's defaults cover:
- `X-Frame-Options: DENY` — prevents clickjacking
- `X-Content-Type-Options: nosniff` — prevents MIME sniffing
- `Strict-Transport-Security` — forces HTTPS
- `Content-Security-Policy` — restricts script sources

No action needed — helmet is already in `server.js`.

### Sensitive data in errors
In production, never send stack traces to clients.
The `errorHandler.js` already sanitizes:
```js
const message = process.env.NODE_ENV === 'production'
  ? 'Internal server error'
  : err.message;
```

### Rotate keys periodically
1. Supabase → Project Settings → API → Generate new service role key
2. Update in Railway/Render env vars
3. Old key is immediately invalid

### The service role key
This is the most sensitive credential in the system. It bypasses ALL RLS.
- Never commit it to git (use `.env` which is in `.gitignore`)
- Never expose it in frontend code
- Never log it — even partial logging can be dangerous
- Restrict access to the Railway/Render dashboard

### Rate limiting for production
The current limits in `rateLimiter.js`:
```js
100 req/15min  — general
20  req/15min  — auth routes
```

For production under real load, consider:
```js
// Tighten auth to prevent brute-force
windowMs: 15 * 60 * 1000,
max: 10,   // 10 login attempts per 15 minutes
```

---

## Step 6 — Database Performance at Scale

### Add missing indexes
For orgs with thousands of project members, add:
```sql
-- If filtering by email frequently:
CREATE INDEX IF NOT EXISTS idx_pmembers_email ON project_members(email);

-- If querying recent cards:
CREATE INDEX IF NOT EXISTS idx_gcards_created ON generated_cards(created_at DESC);

-- For token transaction queries by date:
CREATE INDEX IF NOT EXISTS idx_txn_created_user
  ON token_transactions(user_id, created_at DESC);
```

### Supabase connection pooling
By default, each Supabase request opens a new PostgreSQL connection.
Under high load, add PgBouncer (Supabase provides this):
- Supabase → Project Settings → Database → Connection pooling: ON
- Use the pooler connection string in your backend `.env`

### Expired record cleanup
Cards have an `expires_at` column. Stale records waste storage.
Trigger cleanup via:
```bash
# Admin endpoint (requires JWT of an admin user)
POST /api/admin/cleanup
Authorization: Bearer <admin-jwt>
```

Or set up a daily cron job on Railway:
```bash
curl -X POST https://your-backend.railway.app/api/admin/cleanup \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

---

## Step 7 — Monitoring

### Health check endpoint
```
GET /api/health
→ { status: "ok", timestamp: "...", uptime: "1234s" }
```

Use this with uptime monitoring services (UptimeRobot, Better Uptime).
They'll alert you if the backend goes down.

### Structured logging (upgrade from console.log)
```bash
npm install pino pino-pretty
```

```js
// Replace console.log with:
const logger = require('pino')();
logger.info({ userId, action: 'card_generated' }, 'Card generated');
logger.error({ err }, 'Token deduction failed');
```

Structured logs (JSON) can be shipped to Datadog, Logtail, or Axiom
for search and alerting.

### Supabase built-in monitoring
Supabase → Reports shows:
- API request volume
- Database query performance (slow query log)
- Storage usage
- Auth sign-up rate

---

## Step 8 — Custom Email (Brevo/SendGrid)

By default Supabase sends auth emails from a shared Supabase address.
For production, use your own domain:

Supabase → Project Settings → Auth → SMTP Settings:
```
SMTP Host:    smtp-relay.brevo.com
Port:         587
Username:     your-brevo-login
Password:     your-brevo-smtp-key
Sender email: noreply@yourdomain.com
Sender name:  Aarannu
```

Brevo free tier: 300 emails/day — sufficient for small organizations.

---

## Step 9 — Making the First Admin

After deploying and creating your account:

```sql
-- In Supabase SQL Editor
UPDATE public.members
SET approved = true, role = 'admin'
WHERE user_id = (
  SELECT id FROM auth.users WHERE email = 'your@email.com'
);
```

Then add your UUID to the backend env:
```env
ADMIN_USER_IDS=your-uuid-here
```

Get your UUID from:
```sql
SELECT id FROM auth.users WHERE email = 'your@email.com';
```

---

## Production Deployment Checklist

```
Infrastructure:
  [ ] Backend deployed (Railway/Render)
  [ ] Frontend deployed (Vercel)
  [ ] All env vars set in deployment dashboards
  [ ] HTTPS configured (auto on Railway/Vercel/Render)

Supabase:
  [ ] Site URL updated to production domain
  [ ] Redirect URLs updated
  [ ] Custom SMTP configured
  [ ] Email templates updated (include {{ .Token }})
  [ ] All SQL migrations run (000_full_setup.sql)
  [ ] id-cards storage bucket created (private)
  [ ] Storage RLS policies active

Security:
  [ ] SERVICE_ROLE_KEY is only in backend env (never frontend)
  [ ] CORS_ORIGIN set to production frontend URL only
  [ ] ADMIN_USER_IDS set
  [ ] Rate limits reviewed

First run:
  [ ] Create account → receives OTP code → logs in
  [ ] Creates an org → creates a project → generates a card
  [ ] Card download works (signed URL)
  [ ] GET /api/health returns { status: "ok" }
```
