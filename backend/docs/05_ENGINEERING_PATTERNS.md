# Level 5 — Engineering Patterns: Production-Grade Node/Express

This document covers patterns that separate a working backend from a
production-grade one. Read after 04_PRODUCTION.md.

---

## Part A — Graceful Shutdown

When a process exits abruptly (crash, forced kill), in-flight requests are
dropped and database connections leak. Graceful shutdown drains all open
work before closing.

```
SIGTERM received (deploy, scale-down)
         │
         ▼
Stop accepting new connections
         │
         ▼
Wait for in-flight requests to finish (with timeout)
         │
         ▼
Close DB connections, flush logs
         │
         ▼
process.exit(0)
```

### Implementation

```js
// server.js — after app.listen(PORT)
const server = app.listen(PORT, () => {
  console.log(`Listening on ${PORT}`);
});

const shutdown = async (signal) => {
  console.log(`${signal} received — starting graceful shutdown`);

  // 1. Stop accepting new connections
  server.close(async () => {
    try {
      // 2. Close any open resources (DB pools, Puppeteer, etc.)
      await browserInstance?.close();       // close Puppeteer
      console.log('All connections drained — exiting');
      process.exit(0);
    } catch (err) {
      console.error('Error during shutdown:', err);
      process.exit(1);
    }
  });

  // 3. Force-kill if drain takes too long (30s timeout)
  setTimeout(() => {
    console.error('Shutdown timeout — force exiting');
    process.exit(1);
  }, 30_000);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));  // sent by Railway/Render on deploy
process.on('SIGINT',  () => shutdown('SIGINT'));   // Ctrl+C in development
```

### Why `SIGTERM` matters in production

Railway, Render, and Kubernetes send `SIGTERM` before killing the process.
You get ~30 seconds to drain. Without a handler, Node exits immediately,
dropping all in-flight HTTP requests.

---

## Part B — Input Validation

Never trust `req.body`. Validate and sanitize at the controller boundary.

### Pattern: Schema-first validation with Zod

```bash
npm install zod
```

```js
// validators/memberSchema.js
const { z } = require('zod');

const createMemberSchema = z.object({
  name:  z.string().min(1).max(100).trim(),
  email: z.string().email(),
  role:  z.enum(['Member', 'Admin']).default('Member'),
  photo: z.string().url().optional(),
});

module.exports = { createMemberSchema };
```

```js
// middleware/validate.js — reusable validation middleware
const validate = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({
      error: 'Validation Error',
      issues: result.error.issues.map(i => ({
        field: i.path.join('.'),
        message: i.message,
      })),
    });
  }
  req.body = result.data;   // replace with parsed/coerced data
  next();
};

module.exports = validate;
```

```js
// Usage in routes
const { createMemberSchema } = require('../validators/memberSchema');
const validate = require('../middleware/validate');

router.post('/members',
  verifyToken,
  validate(createMemberSchema),    // ← runs before controller
  memberController.create
);
```

### What validation catches

| Attack | Example | Caught by |
|--------|---------|-----------|
| Missing required field | `name: undefined` | z.string().min(1) |
| Overlong string | `name: "a".repeat(10000)` | z.string().max(100) |
| Invalid email | `email: "notanemail"` | z.string().email() |
| Type coercion injection | `count: "1; DROP TABLE"` | z.number() rejects string |
| Extra fields (mass assignment) | `{ isAdmin: true }` | Zod strips unknown keys by default |

---

## Part C — Structured Logging with Pino

`console.log` is flat text. Structured logs are JSON that log aggregators
(Datadog, Logtail, Axiom) can search, filter, and alert on.

```bash
npm install pino pino-http
```

```js
// config/logger.js
const pino = require('pino');

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  // In dev: pretty-print. In prod: raw JSON (faster, parseable by log services)
  transport: process.env.NODE_ENV === 'development'
    ? { target: 'pino-pretty', options: { colorize: true } }
    : undefined,
  base: {
    service: 'aarannu-backend',
    env: process.env.NODE_ENV,
  },
  redact: ['req.headers.authorization', 'body.password'],  // never log secrets
});

module.exports = logger;
```

```js
// server.js — HTTP request logging
const pinoHttp = require('pino-http');
const logger = require('./config/logger');

app.use(pinoHttp({ logger }));
// Every request now logs: method, url, statusCode, responseTime, userId
```

```js
// In controllers/services — structured context
const logger = require('../config/logger');

const generate = async (req, res) => {
  const log = logger.child({ userId: req.user.id, requestId: req.id });

  log.info({ projectId: req.body.projectId }, 'Card generation started');

  try {
    const result = await cardRenderer.render(req.body);
    log.info({ cardId: result.id, durationMs: result.duration }, 'Card generated');
    res.json(result);
  } catch (err) {
    log.error({ err }, 'Card generation failed');
    throw err;
  }
};
```

### Log levels and when to use them

| Level | Use case |
|-------|---------|
| `trace` | Per-line debugging (never in production) |
| `debug` | Detailed flow tracing (dev only) |
| `info` | Normal operation milestones (request received, card generated) |
| `warn` | Unexpected but recoverable (retried operation, deprecated API used) |
| `error` | A request failed — include `{ err }` with stack |
| `fatal` | The process must exit (DB unreachable at startup) |

---

## Part D — API Design Patterns

### Pagination (cursor-based > offset-based)

**Offset pagination** (simple but breaks at scale):
```js
// GET /api/members?page=2&limit=20
const { page = 1, limit = 20 } = req.query;
const offset = (page - 1) * limit;

const { data } = await supabase
  .from('members')
  .select('*')
  .range(offset, offset + limit - 1);
```

Problem: `OFFSET 10000` in SQL scans and discards 10,000 rows before returning 20.
Slow at high page numbers.

**Cursor pagination** (scales to millions of rows):
```js
// GET /api/members?cursor=2026-01-15T10:00:00Z&limit=20
const { cursor, limit = 20 } = req.query;

let query = supabase
  .from('members')
  .select('*')
  .order('created_at', { ascending: false })
  .limit(limit + 1);  // fetch one extra to know if there's a next page

if (cursor) {
  query = query.lt('created_at', cursor);  // "before this timestamp"
}

const { data } = await query;
const hasMore = data.length > limit;
const items = hasMore ? data.slice(0, limit) : data;
const nextCursor = hasMore ? items[items.length - 1].created_at : null;

res.json({ items, nextCursor, hasMore });
```

### Filtering and sorting

```js
// GET /api/members?role=Admin&approved=true&sort=created_at:desc
const buildQuery = (baseQuery, queryParams) => {
  const { role, approved, sort, limit = 20, cursor } = queryParams;

  if (role)     baseQuery = baseQuery.eq('role', role);
  if (approved !== undefined) baseQuery = baseQuery.eq('approved', approved === 'true');

  if (sort) {
    const [field, direction] = sort.split(':');
    const allowed = ['created_at', 'name', 'email'];  // whitelist — never allow raw input
    if (allowed.includes(field)) {
      baseQuery = baseQuery.order(field, { ascending: direction !== 'desc' });
    }
  }

  return baseQuery;
};
```

**Critical**: always whitelist sortable/filterable fields. Never pass raw query
params directly to the DB — that's a SQL injection vector.

### Consistent response shape

```js
// Success
res.json({
  data: { ... },           // the payload
  meta: { total, page },   // pagination, counts
});

// Error (from errorHandler)
res.status(400).json({
  error: 'Validation Error',     // machine-readable type
  message: 'Name is required',   // human-readable description
  requestId: req.id,             // for correlating logs
});
```

### API versioning

For breaking changes, version via URL prefix:
```js
app.use('/api/v1', v1Routes);
app.use('/api/v2', v2Routes);  // new version
```

Old clients hit `/v1`, new clients hit `/v2`. Run both in parallel during migration.

---

## Part E — Caching

### In-memory cache (simple, zero dependencies)

```js
// utils/cache.js — LRU cache with TTL
const cache = new Map();

const get = (key) => {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  return entry.value;
};

const set = (key, value, ttlMs = 60_000) => {
  cache.set(key, { value, expiresAt: Date.now() + ttlMs });
};

const del = (key) => cache.delete(key);

module.exports = { get, set, del };
```

Usage — cache expensive DB queries:
```js
const cache = require('../utils/cache');

const getOrgDetails = async (orgId) => {
  const cacheKey = `org:${orgId}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const { data } = await supabase.from('organizations').select('*').eq('id', orgId).single();
  cache.set(cacheKey, data, 5 * 60_000);  // cache 5 minutes
  return data;
};
```

**Invalidate on mutation**:
```js
const updateOrg = async (orgId, updates) => {
  await supabase.from('organizations').update(updates).eq('id', orgId);
  cache.del(`org:${orgId}`);   // ← clear stale cache immediately
};
```

### Redis (for multi-instance deployments)

In-memory cache doesn't share state across multiple server instances.
Redis is a separate process all instances can share:

```bash
npm install ioredis
```

```js
// config/redis.js
const Redis = require('ioredis');
const redis = new Redis(process.env.REDIS_URL);  // "redis://localhost:6379"

const get = async (key) => {
  const val = await redis.get(key);
  return val ? JSON.parse(val) : null;
};

const set = async (key, value, ttlSeconds = 60) => {
  await redis.setex(key, ttlSeconds, JSON.stringify(value));
};

module.exports = { get, set, del: (key) => redis.del(key) };
```

Use in-memory cache for single-instance/dev, Redis for production.

---

## Part F — Background Jobs

Some work shouldn't block an HTTP response:
- Sending emails
- Generating bulk cards
- Cleanup jobs
- Webhooks

### Simple: `setImmediate` for fire-and-forget

```js
const generate = async (req, res) => {
  // Respond immediately
  res.json({ jobId, status: 'queued' });

  // Do the work after response is sent
  setImmediate(async () => {
    try {
      await doBulkGeneration(jobId, members);
    } catch (err) {
      logger.error({ err, jobId }, 'Bulk job failed');
    }
  });
};
```

Problem: if the process crashes, the job is lost.

### Robust: BullMQ (Redis-backed queue)

```bash
npm install bullmq
```

```js
// queues/cardQueue.js
const { Queue, Worker } = require('bullmq');
const redis = { connection: { host: 'localhost', port: 6379 } };

// Producer — add jobs
const cardQueue = new Queue('card-generation', redis);

const enqueueCardJob = (data) => cardQueue.add('generate', data, {
  attempts: 3,              // retry up to 3 times on failure
  backoff: { type: 'exponential', delay: 2000 },
});

// Worker — process jobs (can run in a separate process/file)
const worker = new Worker('card-generation', async (job) => {
  const { members, projectId, userId } = job.data;
  logger.info({ jobId: job.id }, 'Processing card generation job');
  await doBulkGeneration(projectId, members, userId);
}, redis);

worker.on('failed', (job, err) => {
  logger.error({ jobId: job.id, err }, 'Job failed');
});

module.exports = { enqueueCardJob };
```

BullMQ persists jobs in Redis — if the server crashes and restarts, jobs resume.

---

## Part G — Testing Patterns

### The Testing Pyramid

```
           /\
          /E2E\          ← few, slow, test full user flows
         /──────\
        /Integration\    ← moderate, test routes end-to-end
       /──────────────\
      /   Unit Tests   \ ← many, fast, test individual functions
     /──────────────────\
```

**Unit tests** — pure functions, no network, no DB:
```js
// __tests__/tokenService.unit.test.js
const { calculateFee } = require('../services/tokenService');

describe('calculateFee', () => {
  it('charges 1 token per card', () => {
    expect(calculateFee(10)).toBe(10);
  });

  it('throws if count is negative', () => {
    expect(() => calculateFee(-1)).toThrow('Invalid count');
  });
});
```

**Integration tests** — test a route against a real (test) database:
```js
// __tests__/tokenRoutes.integration.test.js
const request = require('supertest');   // npm install --save-dev supertest
const app = require('../server');       // your Express app

describe('GET /api/tokens/balance', () => {
  it('returns 401 without auth', async () => {
    const res = await request(app).get('/api/tokens/balance');
    expect(res.status).toBe(401);
  });

  it('returns balance for authenticated user', async () => {
    const res = await request(app)
      .get('/api/tokens/balance')
      .set('Authorization', `Bearer ${TEST_JWT}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('balance');
    expect(typeof res.body.balance).toBe('number');
  });
});
```

### Mocking external services

```js
// Mock Supabase to avoid hitting real DB in unit tests
jest.mock('../config/supabaseClient', () => ({
  supabase: {
    from: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        data: { id: 'uuid', balance: 50 },
        error: null,
      }),
    }),
  },
}));
```

### What to test (priority order)

1. **Business logic** — token deduction, balance checks, role enforcement
2. **Middleware** — verifyToken, checkTokens, validate
3. **Error paths** — what happens when DB is down, JWT is invalid, tokens = 0
4. **Happy paths** — normal successful flows
5. **Edge cases** — concurrent requests, zero balances, empty lists

---

## Part H — Docker

Running in a container guarantees the same environment in dev, CI, and production.

### `backend/Dockerfile`

```dockerfile
# ─── Build stage ───────────────────────────────────────────────
FROM node:20-slim AS base

# Install Chrome deps for Puppeteer
RUN apt-get update && apt-get install -y \
    chromium \
    libx11-xcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    libxtst6 \
    libnss3 \
    libasound2 \
    libatk-bridge2.0-0 \
    libdrm2 \
    libgbm1 \
    libgtk-3-0 \
    --no-install-recommends \
  && rm -rf /var/lib/apt/lists/*

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production     # install only production deps

COPY src/ ./src/

EXPOSE 5000

CMD ["node", "src/server.js"]
```

### `docker-compose.yml` (for local dev)

```yaml
version: '3.9'
services:
  backend:
    build: ./backend
    ports:
      - "5000:5000"
    env_file:
      - ./backend/.env
    volumes:
      - ./backend/src:/app/src   # hot-reload via nodemon
    command: npm run dev

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
```

```bash
docker compose up          # start all services
docker compose up backend  # start backend only
docker compose down        # stop everything
```

### Multi-stage build (smaller production image)

```dockerfile
# Install all deps (including devDeps for build step if needed)
FROM node:20-slim AS installer
WORKDIR /app
COPY package*.json ./
RUN npm ci

# Production image — copy only runtime artifacts
FROM node:20-slim AS production
WORKDIR /app
COPY --from=installer /app/node_modules ./node_modules
COPY src/ ./src/
COPY package.json .
CMD ["node", "src/server.js"]
```

This prevents devDependencies (Jest, nodemon) from ending up in the production image.

---

## Part I — CI/CD with GitHub Actions

Every push should automatically: lint → test → build → (optionally deploy).

### `.github/workflows/backend-ci.yml`

```yaml
name: Backend CI

on:
  push:
    branches: [main, develop]
    paths: [backend/**]       # only run when backend files change
  pull_request:
    paths: [backend/**]

jobs:
  test:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: backend

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
          cache-dependency-path: backend/package-lock.json

      - name: Install dependencies
        run: npm ci

      - name: Run tests
        env:
          NODE_ENV: test
          # Inject test secrets from GitHub Secrets
          SUPABASE_URL: ${{ secrets.TEST_SUPABASE_URL }}
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.TEST_SUPABASE_SERVICE_ROLE_KEY }}
        run: npm test

  deploy:
    needs: test          # only deploy if tests pass
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - name: Deploy to Railway
        run: |
          curl -X POST "${{ secrets.RAILWAY_DEPLOY_WEBHOOK }}"
```

### What to store in GitHub Secrets

Go to: repo → Settings → Secrets and variables → Actions

| Secret name | Value |
|-------------|-------|
| `TEST_SUPABASE_URL` | Your test Supabase project URL |
| `TEST_SUPABASE_SERVICE_ROLE_KEY` | Service key for test DB |
| `RAILWAY_DEPLOY_WEBHOOK` | Railway deploy hook URL |

Never put these in `.yml` files directly — they'd be committed to git.

---

## Part J — Process Management with PM2

In production VMs (not containers), PM2 keeps your Node process alive
and enables clustering.

```bash
npm install -g pm2
```

### `ecosystem.config.js` (root of backend)

```js
module.exports = {
  apps: [{
    name: 'aarannu-backend',
    script: 'src/server.js',
    instances: 'max',           // one per CPU core (cluster mode)
    exec_mode: 'cluster',       // share port across instances
    max_memory_restart: '500M', // auto-restart if memory leaks past 500MB
    env: {
      NODE_ENV: 'production',
      PORT: 5000,
    },
    error_file: 'logs/err.log',
    out_file: 'logs/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
  }],
};
```

```bash
pm2 start ecosystem.config.js     # start in cluster mode
pm2 status                        # show all processes
pm2 logs                          # tail all logs
pm2 reload aarannu-backend        # zero-downtime reload (sends SIGTERM then starts new workers)
pm2 save                          # persist config — survives reboots
pm2 startup                       # generate init script for auto-start
```

**Cluster mode note**: each worker is a separate process with its own memory.
An in-memory cache (Part E) won't be shared across workers — use Redis instead.

---

## Part K — Common Memory Leak Patterns

Node.js leaks memory when references accumulate. The most common patterns:

### 1. Uncleared setInterval / event listeners

```js
// LEAK — setInterval keeps a reference; nothing clears it
const startPolling = () => {
  setInterval(() => checkDatabase(), 5000);
};

// FIXED
const startPolling = () => {
  const id = setInterval(() => checkDatabase(), 5000);
  return () => clearInterval(id);  // return cleanup function
};
```

### 2. Growing Map/Set (e.g. rate limiting, caching without eviction)

```js
// LEAK — rateLimitMap grows forever
const rateLimitMap = new Map();

// FIXED — schedule cleanup
setInterval(() => {
  const cutoff = Date.now() - 15 * 60_000;
  for (const [key, time] of rateLimitMap) {
    if (time < cutoff) rateLimitMap.delete(key);
  }
}, 60_000);
```

### 3. Event listener accumulation

```js
// LEAK — adds a new listener on every request
app.use((req, res, next) => {
  process.on('uncaughtException', handler);  // ← adds every request!
  next();
});

// FIXED — register once at module level
process.on('uncaughtException', (err) => {
  logger.fatal({ err }, 'Uncaught exception');
  process.exit(1);
});
```

### Diagnosing leaks

```bash
# Watch memory over time
pm2 monit

# Take heap snapshot
node --inspect src/server.js
# Open chrome://inspect → take heap snapshot → compare before/after load
```

---

## Part L — Uncaught Errors and Process Stability

```js
// server.js — register these at the top, before anything else

// Unhandled promise rejections (e.g. forgot await, missing try/catch)
process.on('unhandledRejection', (reason, promise) => {
  logger.error({ reason }, 'Unhandled Promise Rejection');
  // In production: alert your team but keep running
  // In a critical system: process.exit(1) then let PM2 restart
});

// Synchronous uncaught exceptions
process.on('uncaughtException', (err) => {
  logger.fatal({ err }, 'Uncaught Exception — shutting down');
  // Always exit after uncaughtException — the process is in unknown state
  process.exit(1);
});
```

**Express 5 async errors**: In Express 5, if an async controller throws, it
automatically propagates to your error handler — no `try/catch` needed in
controllers. This is a major Express 5 improvement over v4.

```js
// Express 5 — this is safe, no try/catch needed:
router.get('/cards', async (req, res) => {
  const { data } = await supabase.from('generated_ids').select('*');  // throws → errorHandler
  res.json(data);
});
```

---

## Part M — Database Transactions

Multiple related DB writes that must all succeed or all fail together.

### The problem without transactions

```
1. Deduct 10 tokens ✓
2. Insert 10 card records ✗  (error — network blip)
Result: tokens deducted, no cards created. User lost tokens.
```

### Supabase / PostgreSQL transactions via RPC

For multi-step atomicity, use a Postgres function (RPC):

```sql
-- In Supabase SQL Editor: create an atomic deduct-and-log function
CREATE OR REPLACE FUNCTION deduct_tokens_and_log(
  p_wallet_id UUID,
  p_amount INT,
  p_description TEXT
) RETURNS JSONB AS $$
DECLARE
  v_wallet token_wallets%ROWTYPE;
BEGIN
  -- Atomic update with guard
  UPDATE token_wallets
  SET balance = balance - p_amount,
      lifetime_used = lifetime_used + p_amount
  WHERE id = p_wallet_id AND balance >= p_amount
  RETURNING * INTO v_wallet;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Insufficient balance';
  END IF;

  -- Insert transaction log in same atomic operation
  INSERT INTO token_transactions (wallet_id, user_id, amount, type, description, balance_after)
  VALUES (p_wallet_id, v_wallet.user_id, -p_amount, 'deduction', p_description, v_wallet.balance);

  RETURN jsonb_build_object('balance', v_wallet.balance);
END;
$$ LANGUAGE plpgsql;
```

```js
// Call from Node:
const { data, error } = await supabase.rpc('deduct_tokens_and_log', {
  p_wallet_id: walletId,
  p_amount: count,
  p_description: `Generated ${count} cards`,
});

if (error) throw new Error(`Token deduction failed: ${error.message}`);
```

Everything inside the function runs in one PostgreSQL transaction.
If any statement fails, the entire operation rolls back.

---

## Quick Reference: Production Checklist (Engineering)

```
Code quality:
  [ ] All req.body validated with Zod/Joi before use
  [ ] Whitelist-only DB column filtering (never raw query params)
  [ ] No console.log — use pino logger with child context
  [ ] Express 5 async errors propagate to errorHandler

Reliability:
  [ ] SIGTERM/SIGINT graceful shutdown handler registered
  [ ] process.on('unhandledRejection') and 'uncaughtException' registered
  [ ] Long-running jobs in BullMQ (or at least fire-and-forget with logging)
  [ ] PM2 cluster mode or containerized with restart policy

Testing:
  [ ] Unit tests for all business logic (tokenService, validators)
  [ ] Integration tests for critical routes (generate, bulk, auth)
  [ ] CI pipeline runs tests on every push (GitHub Actions)

Performance:
  [ ] DB indexes on all WHERE / ORDER BY columns
  [ ] Cache hot, rarely-changing queries (org details, config)
  [ ] Cursor-based pagination for large lists
  [ ] Browser instance pooled (not launched per request)

Observability:
  [ ] Structured JSON logs with requestId, userId, duration
  [ ] /api/health endpoint monitored by uptime service
  [ ] Memory usage monitored (pm2 monit or Datadog)
  [ ] Slow query log enabled in Supabase
```
