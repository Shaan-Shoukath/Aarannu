# Level 0 — Fundamentals: What You Actually Need to Know Before Touching the Code

**Read this before anything else.** These are the core concepts every backend engineer uses daily. They are explained without jargon first, then with precise terminology second.

---

## Part A — What Is a Server?

A server is just a program that runs continuously and waits for requests.

When you type `https://google.com` in your browser:
1. Your browser sends a request over the internet to Google's server
2. The server receives it, does some work (finds search results), and sends back a response
3. Your browser shows the response

In this project:
- The **frontend** (React) is the browser — it makes requests
- The **backend** (Express + Node.js) is the server — it receives them and responds
- **Supabase** is a cloud database — it stores all the data

---

## Part B — What Is an API?

API stands for Application Programming Interface.

In web development, "API" almost always means: a set of URLs your backend exposes, where each URL does something specific.

```
GET  https://yourapp.com/api/tokens/balance   → "give me my token balance"
POST https://yourapp.com/api/org              → "create a new organization"
PATCH https://yourapp.com/api/members/uuid/approve → "approve this member"
```

The browser calls these URLs (sends HTTP requests), and the server responds with JSON data.

### HTTP methods — what they mean

| Method | What it means | Example |
|---|---|---|
| `GET` | Read data (no side effects) | Get my profile |
| `POST` | Create something new | Create an organization |
| `PATCH` | Partially update | Approve one member |
| `PUT` | Fully replace | Replace all card styles |
| `DELETE` | Remove | Delete a member |

These are conventions, not laws — but following them makes your API predictable for anyone who uses it.

---

## Part C — What Is HTTP?

HTTP (HyperText Transfer Protocol) is the language that browsers and servers use to talk to each other. Every HTTP interaction has two pieces:

### The Request

Sent by the browser (or Postman, or any code calling `fetch()`):

```
POST /api/org HTTP/1.1
Host: localhost:5000
Content-Type: application/json
Authorization: Bearer eyJhbGciOiJIUzI1NiJ...

{
  "name": "Aarannu Tech School",
  "slug": "aarannu-tech"
}
```

Breaking this down:
- `POST /api/org` — method + path
- `Host` — which server to send to
- `Content-Type: application/json` — I'm sending JSON
- `Authorization: Bearer eyJ...` — my identity proof (JWT)
- The body `{ ... }` — the data I'm sending

### The Response

Sent back by the server:

```
HTTP/1.1 201 Created
Content-Type: application/json

{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "Aarannu Tech School",
  "slug": "aarannu-tech"
}
```

- `201` — the status code
- `Content-Type: application/json` — I'm sending JSON back
- The body — the actual response data

### HTTP Status Codes — what they mean

| Code | Meaning | When |
|---|---|---|
| 200 | OK | Request succeeded, here's your data |
| 201 | Created | POST succeeded, new record made |
| 204 | No Content | Success, nothing to return |
| 400 | Bad Request | The request is malformed or missing fields |
| 401 | Unauthorized | No valid JWT / not logged in |
| 403 | Forbidden | Logged in, but not allowed to do this |
| 404 | Not Found | The resource doesn't exist |
| 402 | Payment Required | Not enough tokens |
| 409 | Conflict | Duplicate (e.g. slug already taken) |
| 500 | Internal Server Error | Something crashed on the server |
| 503 | Service Unavailable | External service (Brevo, Supabase) is down |

---

## Part D — What Is JSON?

JSON (JavaScript Object Notation) is a text format for data. It looks like this:

```json
{
  "name": "Ali Hassan",
  "email": "ali@example.com",
  "approved": true,
  "tokenBalance": 47,
  "roles": ["admin", "member"],
  "address": {
    "city": "Kozhikode",
    "state": "Kerala"
  }
}
```

Rules:
- Keys must be in double quotes
- Strings use double quotes
- Numbers, `true`, `false`, `null` are not quoted
- Arrays use `[]`
- Objects (nested) use `{}`

When a browser sends a request with a JSON body, it sets the `Content-Type: application/json` header. Express's JSON parser reads this header, parses the body string into a JavaScript object, and puts it in `req.body`.

When the backend responds with `res.json(data)`, Express serializes the JavaScript object back to a JSON string and sets `Content-Type: application/json` automatically.

---

## Part E — What Is Node.js?

Browsers have JavaScript engines (Chrome's V8 engine). Node.js is that same engine, running outside the browser, on a server.

This means you can write JavaScript to:
- Read and write files
- Listen for incoming HTTP connections
- Query databases
- Run scheduled tasks

Without Node.js, you'd have to write server code in Python, Java, Go, etc. Node.js lets JavaScript run on the server.

**Key difference from browser JavaScript:**
- Browser JS runs in a sandbox (no file system access, no raw network sockets)
- Node.js has full system access (can read files, open ports, install packages)

---

## Part F — What Is Express?

Express is a library for Node.js that makes building HTTP servers easier.

Without Express, building an HTTP server in Node.js requires a lot of boilerplate:

```js
// Raw Node.js HTTP server (tedious)
const http = require('http');
const server = http.createServer((req, res) => {
  if (req.method === 'GET' && req.url === '/api/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok' }));
  } else {
    res.writeHead(404);
    res.end('Not Found');
  }
});
server.listen(5000);
```

With Express (same thing, cleaner):

```js
const express = require('express');
const app = express();

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.listen(5000);
```

Express adds:
- URL routing with parameters (`/api/members/:id`)
- Middleware (functions that run before your handler)
- JSON body parsing
- Error handling

---

## Part G — What Is Middleware?

Middleware is a function that runs in the **middle** of an HTTP request — after the request is received but before the final handler responds.

Think of it like a pipeline of security checkpoints at an airport:

```
Request arrives
     │
     ▼
[Check ID]          ← Is this a real person? (verifyToken middleware)
     │
     ▼
[Approved member?]  ← Are they allowed in? (checkApproval)
     │
     ▼
[Have credits?]     ← Do they have enough tokens? (checkTokens)
     │
     ▼
[Boarding gate]     ← The actual handler (controller)
     │
     ▼
Response sent
```

Each middleware either:
- **Calls `next()`** — passes the request to the next middleware/handler
- **Calls `res.json()` / `res.status().json()`** — stops the chain and responds

```js
// Example middleware: check if user has enough tokens
const checkTokens = (required) => async (req, res, next) => {
  const balance = await getBalance(req.user.id);
  if (balance < required) {
    return res.status(402).json({ error: 'Insufficient tokens' });
    // ↑ Chain stops here — controller never runs
  }
  req.tokenBalance = balance;  // pass data to the next function
  next();                       // ← continue to the controller
};
```

---

## Part H — What Is a JWT?

JWT = JSON Web Token. It is the mechanism that proves "I am who I say I am" in this backend.

### The problem it solves

HTTP is stateless — every request is independent. The server has no memory of previous requests. So how does it know who you are on each request?

**Old approach (sessions)**: Server stores a session ID in memory. Client sends it as a cookie. Problem: doesn't scale (session is tied to one server instance).

**Modern approach (JWT)**: Server gives you a token after login. You send this token with every request. The server verifies the token's signature to confirm it's real — no database lookup needed.

### What a JWT looks like

```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6ImFiYy0xMjMiLCJlbWFpbCI6InVzZXJAZXhhbXBsZS5jb20iLCJleHAiOjE3MTQ1MDI0MDB9.abc123signature
```

Three parts separated by dots:
- `eyJhbGci...` — Header (base64): algorithm used to sign this token
- `eyJpZCI6...` — Payload (base64): the data inside (user ID, email, expiry time)
- `abc123...` — Signature: cryptographic proof the token hasn't been tampered with

**The payload is NOT encrypted** — anyone can decode it (try jwt.io). But it IS signed. If someone modifies the payload, the signature won't match, and the server will reject it.

### How this backend uses it

1. User logs in → Supabase issues a JWT
2. Frontend stores it in localStorage
3. Every API request sends it: `Authorization: Bearer eyJhbGci...`
4. `verifyToken` middleware calls `supabase.auth.getUser(token)` — this asks Supabase "is this token still valid?"
5. If yes, `req.user` is set with the user's ID, email, etc.
6. All downstream code uses `req.user.id` — it trusts this because `verifyToken` already verified it

---

## Part I — What Is async/await?

JavaScript is single-threaded — it can only do one thing at a time. But many operations take time (reading from a database, calling an API). If JS waited synchronously for each one, everything would freeze.

**Async/await** lets JavaScript start a slow operation and come back to it when it's done, without blocking other work.

### The problem

```js
// WRONG — synchronous, would freeze Node.js
const data = supabase.from('members').select('*');  // this takes time!
console.log(data);  // runs BEFORE data is ready — undefined
```

### The solution

```js
// CORRECT — async/await
const getData = async () => {
  const { data } = await supabase.from('members').select('*');
  // ↑ await = "pause here until the query finishes, then continue"
  console.log(data);  // now data is ready
};
```

The function must be marked `async` to use `await` inside it.

### What actually happens

- `await` doesn't block the entire program — it frees up the event loop
- While waiting for the DB query, Node.js can handle other incoming requests
- When the query finishes, execution resumes after the `await`

### Try/catch with async/await

Database calls and API calls can fail. Always handle errors:

```js
const getBalance = async (userId) => {
  try {
    const { data, error } = await supabase
      .from('token_wallets')
      .select('balance')
      .eq('user_id', userId)
      .single();

    if (error) throw error;  // Supabase returns errors in the error field
    return data.balance;
  } catch (err) {
    console.error('Failed to get balance:', err.message);
    throw err;  // re-throw so the caller knows it failed
  }
};
```

---

## Part J — What Is a Database? What Is SQL?

A database is a program specifically designed to store and retrieve data efficiently, even with millions of records.

This project uses **PostgreSQL** (via Supabase). PostgreSQL is a relational database — data is organized into tables, like spreadsheets, with strict column types.

### A table

```
Table: project_members
┌──────────────────────┬──────────────────┬──────────────────┬──────────┐
│ id (UUID)            │ name (TEXT)      │ email (TEXT)     │ status   │
├──────────────────────┼──────────────────┼──────────────────┼──────────┤
│ 550e8400-e29b-41d4.. │ Ali Hassan       │ ali@example.com  │ approved │
│ 660f9500-f30c-52e5.. │ Priya Nair       │ priya@test.com   │ pending  │
└──────────────────────┴──────────────────┴──────────────────┴──────────┘
```

### SQL — the language of databases

SQL (Structured Query Language) is how you talk to the database:

```sql
-- Read all approved members for a project
SELECT id, name, email
FROM project_members
WHERE project_id = 'abc' AND status = 'approved'
ORDER BY created_at DESC;

-- Insert a new member
INSERT INTO project_members (id, project_id, name, email, status)
VALUES ('uuid', 'project-uuid', 'Ali Hassan', 'ali@example.com', 'pending');

-- Update a member's status
UPDATE project_members
SET status = 'approved'
WHERE id = 'member-uuid';
```

### In this codebase: the Supabase SDK

You rarely write raw SQL. The Supabase SDK provides a cleaner API:

```js
// Read (equivalent to SELECT)
const { data, error } = await supabase
  .from('project_members')
  .select('id, name, email')
  .eq('project_id', 'abc')
  .eq('status', 'approved')
  .order('created_at', { ascending: false });

// Insert
const { data, error } = await supabase
  .from('project_members')
  .insert({ project_id: 'abc', name: 'Ali', email: 'ali@test.com', status: 'pending' })
  .select()
  .single();

// Update
const { data, error } = await supabase
  .from('project_members')
  .update({ status: 'approved' })
  .eq('id', 'member-uuid')
  .select()
  .single();
```

The SDK converts these into SQL queries. But understanding SQL helps you understand what's actually happening and debug issues in the Supabase SQL editor.

---

## Part K — What Is Row Level Security (RLS)?

RLS is a PostgreSQL feature that automatically filters data based on who is asking.

Without RLS:
```sql
SELECT * FROM project_members;
-- Returns EVERY member from EVERY project of EVERY organization
-- A user could theoretically read other org's data
```

With RLS:
```sql
-- Policy: "Users can only read members in projects they belong to"
CREATE POLICY "user_sees_own_org_members"
ON project_members
FOR SELECT
USING (
  project_id IN (
    SELECT p.id FROM projects p
    JOIN org_members om ON p.org_id = om.org_id
    WHERE om.user_id = auth.uid()
  )
);
```

Now the same query automatically appends a WHERE clause based on the JWT. Users can't see data they don't have access to, even if they call the API directly.

**The backend bypasses RLS** using the service role key — because the backend needs to do admin operations (approve users, read all data for aggregation). That's why the service role key must never leave the server.

---

## Part L — What Is an Environment Variable?

An environment variable is a configuration value stored *outside* the code.

### Why not hardcode values?

```js
// BAD — secret is in the code, gets committed to git
const supabase = createClient(
  'https://myproject.supabase.co',
  'eyJhbGciOiJIUzI1NiJ...'   // ← This is now in your git history FOREVER
);
```

```js
// GOOD — value comes from the environment, not the code
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);
```

### How it works

Values are stored in a `.env` file (never committed to git — it's in `.gitignore`):

```env
SUPABASE_URL=https://myproject.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiJ...
```

`dotenv` reads this file at startup and puts values into `process.env`:

```js
require('dotenv').config();   // reads .env → loads into process.env

console.log(process.env.SUPABASE_URL);  // "https://myproject.supabase.co"
```

On production (Railway, Render, Vercel), you set environment variables via their dashboard — no `.env` file needed.

### Consequences of getting this wrong

- Committing `.env` to git exposes all your secrets to anyone who can see the repo
- Using `SUPABASE_SERVICE_ROLE_KEY` in the frontend gives any user admin DB access
- A leaked Brevo API key allows anyone to send emails from your account

---

## Part M — The Concepts Behind This Stack

### Why Express over other frameworks?

Express is minimal — it doesn't make decisions for you. This forces you to understand what you're building rather than hiding it behind conventions. For learning, this is a feature.

Alternative: NestJS (more opinionated, better for large teams). We use Express here because you can see every part of the system.

### Why Supabase over plain PostgreSQL?

Supabase gives you:
- A hosted PostgreSQL database
- An auto-generated REST API (PostgREST)
- Auth (user management, JWTs, OTP)
- Storage (files, images)
- Real-time subscriptions

Without Supabase, you'd write all of this yourself. For this project size, Supabase is the right tradeoff.

### Why not use localStorage for auth state?

Supabase's client library manages auth state automatically via `localStorage`. This is acceptable for most web apps. The alternative (httpOnly cookies) is more secure against XSS but requires more backend setup. This is a conscious tradeoff documented in `AUTH_FLOW.md`.

---

## Now you are ready

You understand:
- ✅ What a server is and how HTTP works
- ✅ What JSON is and how it travels between client and server
- ✅ What Node.js and Express are
- ✅ What middleware does
- ✅ What JWTs are and how they prove identity
- ✅ What async/await is and why it exists
- ✅ What a database is and what SQL does
- ✅ What RLS is and why it matters
- ✅ What environment variables are and why they must stay secret

Read **01_BEGINNER.md** next to set up the project and run it locally.
