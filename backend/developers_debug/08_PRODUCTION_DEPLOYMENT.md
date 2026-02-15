# 08 — Production Deployment

## Environment Setup

### Required Environment Variables

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=eyJhbG...
SUPABASE_SERVICE_ROLE_KEY=eyJhbG...
PORT=5000
NODE_ENV=production
CORS_ORIGIN=https://your-frontend.com
```

> **CRITICAL:** `SUPABASE_SERVICE_ROLE_KEY` has full database access.  
> Never commit it. Never expose it to the frontend. Set it only in your hosting platform's environment variable settings.

---

## Deployment Platforms

### Option A: Railway

1. Push code to GitHub.
2. Create a new project on [railway.app](https://railway.app).
3. Connect GitHub repo → select `backend/` as root directory.
4. Set environment variables in Railway dashboard.
5. Railway auto-detects `npm start` and runs `node src/server.js`.
6. Custom domain + HTTPS provided automatically.

**Cron support:** Railway supports cron jobs — use for expired record cleanup:

```
0 3 * * * curl -X POST $BACKEND_URL/api/admin/cleanup -H "Authorization: Bearer $ADMIN_TOKEN"
```

### Option B: Render

1. Push code to GitHub.
2. Create a **Web Service** on [render.com](https://render.com).
3. Set root directory to `backend/`.
4. Build command: `npm install`
5. Start command: `npm start`
6. Set environment variables in Render dashboard.
7. Free SSL/TLS on all plans.

### Option C: DigitalOcean App Platform

1. Connect GitHub repo.
2. Set `backend/` as source directory.
3. Configure environment variables.
4. Auto-deploy on push.

---

## HTTPS

**All platforms above provide HTTPS automatically.**

If self-hosting (e.g. VPS):

- Use **nginx** as a reverse proxy.
- Obtain certificates via **Let's Encrypt** / **Certbot**.
- Force HTTPS redirect:

```nginx
server {
    listen 80;
    server_name api.yourdomain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl;
    server_name api.yourdomain.com;

    ssl_certificate     /etc/letsencrypt/live/api.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.yourdomain.com/privkey.pem;

    location / {
        proxy_pass http://localhost:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

---

## Logging Best Practices

### Current Approach

All errors log to `stdout` via `console.error()`. This works with:

- Railway (built-in log viewer)
- Render (log streams)
- Docker (captured by container runtime)

### Recommended Upgrades

| Tool                    | Purpose                                                     |
| ----------------------- | ----------------------------------------------------------- |
| **pino** / **winston**  | Structured JSON logging with log levels                     |
| **morgan**              | HTTP request logging middleware                             |
| **Sentry**              | Error tracking with stack traces, user context, breadcrumbs |
| **Datadog / New Relic** | APM (Application Performance Monitoring)                    |

Example with `morgan`:

```js
const morgan = require("morgan");
app.use(morgan("combined")); // Apache combined log format
```

### What to Log

- ✅ HTTP method, path, status code, response time
- ✅ Error messages and codes
- ✅ User ID (for audit trails)
- ❌ Passwords, tokens, or full request bodies (PII risk)

---

## Scaling Considerations

### Horizontal Scaling

Express is stateless — no session data is stored in memory. This means you can run **multiple instances** behind a load balancer without sticky sessions.

```
Load Balancer (Railway / Render auto-scales)
    ├── Instance 1 (Express)
    ├── Instance 2 (Express)
    └── Instance 3 (Express)
         │
         └── All connect to same Supabase project
```

### Database Connection Pooling

Supabase uses **PgBouncer** for connection pooling. With multiple backend instances, ensure you're connecting through the pooled connection string (port 6543) rather than the direct connection (port 5432).

### Caching

Future optimization: add **Redis** to cache:

- Member approval status (avoid DB hit on every request)
- Signed URLs (reuse within their 1-hour TTL)

### Rate Limiting at Scale

`express-rate-limit` stores counts **in memory** by default. With multiple instances, each has its own counter — a user could get `N × max` requests.

Fix: use `rate-limit-redis` to store counts in a shared Redis instance.

```js
const RedisStore = require("rate-limit-redis");
const rateLimit = require("express-rate-limit");
const Redis = require("ioredis");

const client = new Redis(process.env.REDIS_URL);

const limiter = rateLimit({
  store: new RedisStore({ sendCommand: (...args) => client.call(...args) }),
  windowMs: 15 * 60 * 1000,
  max: 100,
});
```

---

## Pre-Deployment Checklist

- [ ] `NODE_ENV=production` is set
- [ ] All Supabase keys are in environment variables (not source code)
- [ ] `CORS_ORIGIN` is set to the production frontend URL
- [ ] HTTPS is enabled
- [ ] RLS is enabled on all Supabase tables
- [ ] Storage bucket `id-cards` is private
- [ ] Rate limiting is active
- [ ] Error handler hides stack traces in production
- [ ] `npm audit` shows no critical vulnerabilities
- [ ] Health endpoint (`/api/health`) is accessible
