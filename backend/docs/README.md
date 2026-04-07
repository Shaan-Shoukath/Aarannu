# Aarannu Backend — Learning Course

**Who this is for:** Someone who wants to go from knowing nothing about backend development to being able to read, modify, and own this codebase confidently — without blindly copying code and hoping it works.

This is not a "paste this and move on" guide. Every section explains *why* before *how*, with real code from this project.

---

## The Full Course

| Level | File | What you'll learn |
|---|---|---|
| 0 | [00_FUNDAMENTALS.md](00_FUNDAMENTALS.md) | HTTP, APIs, servers, JSON, Node.js, async/await, databases, JWT, RLS, env vars — all from scratch |
| 1 | [01_BEGINNER.md](01_BEGINNER.md) | What this app does, how to run it locally, first account, first card |
| 2 | [02_INTERMEDIATE.md](02_INTERMEDIATE.md) | Folder structure, route/controller/service layers, middleware pipeline, request lifecycle |
| 3 | [03_ADVANCED.md](03_ADVANCED.md) | Token system deep dive, Puppeteer rendering, RLS internals, atomic SQL patterns |
| 4 | [04_PRODUCTION.md](04_PRODUCTION.md) | Deploy to Railway + Vercel, environment variables, Supabase config, HTTPS, security checklist |
| 5 | [05_ENGINEERING_PATTERNS.md](05_ENGINEERING_PATTERNS.md) | Testing (unit + integration), structured logging, caching, CI/CD, Docker, memory leaks, PM2 |
| 6 | [06_PROJECT_COMPLETE_REFERENCE.md](06_PROJECT_COMPLETE_REFERENCE.md) | Every system in this project traced from source code — tokens, forms, generation, verification |
| 7 | [07_SCRAPING_AND_DATA_IMPORT.md](07_SCRAPING_AND_DATA_IMPORT.md) | Web scraping from first principles, Google Sheets CSV approach, custom CSV state-machine parser, when to use a library vs hand-roll |
| 8 | [08_EMAIL_AND_NOTIFICATIONS.md](08_EMAIL_AND_NOTIFICATIONS.md) | Email fundamentals, SMTP vs REST API, Brevo setup end-to-end, Supabase Auth SMTP, OTP templates, delivery state tracking |
| 9 | [09_AUTH_IN_DEPTH.md](09_AUTH_IN_DEPTH.md) | Authentication vs authorisation, JWT internal structure, 2FA flow with code, middleware layers, common auth bugs, production checklist |
| 10 | [10_PDF_AND_RENDERING.md](10_PDF_AND_RENDERING.md) | PDFKit code-driven PDF (fonts, gradients, circular clips, CR-80 sizing), Puppeteer headless rendering, CORS image proxy |
| 11 | [11_POSTGRESQL_AND_SUPABASE.md](11_POSTGRESQL_AND_SUPABASE.md) | SQL from scratch (SELECT/JOIN/GROUP BY), PostgreSQL types, constraints, indexes, transactions, RLS policies, Supabase SDK patterns, Storage, migrations |
| 12 | [12_HOW_TO_ADD_A_FEATURE.md](12_HOW_TO_ADD_A_FEATURE.md) | **Capstone:** Add a real feature end-to-end — migration → service → controller → route → frontend call, with every decision explained |

### Quick Reference Files

| File | What it contains |
|---|---|
| [AUTH_FLOW.md](AUTH_FLOW.md) | Signup, login, token refresh, and backend verification as diagrams |
| [LIBRARIES.md](LIBRARIES.md) | Every npm package used and exactly why it was chosen |
| [ADMIN_ARCHITECTURE.md](ADMIN_ARCHITECTURE.md) | Platform admin vs org roles — how access levels are structured |
| [ARCHITECTURE_DECISIONS.md](ARCHITECTURE_DECISIONS.md) | Why specific architectural choices were made (e.g. PDFKit vs canvas, CSV vs Sheets API) |

---

## Recommended Reading Order

**Complete beginner (new to backend):**
```
00 → 01 → 11(SQL basics) → 02 → 03 → 07 → 08 → 09 → 10 → 04 → 05 → 12
```

**Experienced dev, new to this project:**
```
06 (full reference) → 02 (architecture) → 11 (DB layer) → 09 (auth) → 12 (add a feature)
```

**Debugging a specific area:**

| Symptom | Read |
|---|---|
| Login not working | [09_AUTH_IN_DEPTH.md](09_AUTH_IN_DEPTH.md), [AUTH_FLOW.md](AUTH_FLOW.md) |
| OTP email not arriving | [08_EMAIL_AND_NOTIFICATIONS.md](08_EMAIL_AND_NOTIFICATIONS.md) Part F |
| Card email not sending | [08_EMAIL_AND_NOTIFICATIONS.md](08_EMAIL_AND_NOTIFICATIONS.md) Parts D–E |
| PDF is blank / broken | [10_PDF_AND_RENDERING.md](10_PDF_AND_RENDERING.md) Part F |
| Google Sheets import failing | [07_SCRAPING_AND_DATA_IMPORT.md](07_SCRAPING_AND_DATA_IMPORT.md) Part D |
| Token balance wrong | [03_ADVANCED.md](03_ADVANCED.md) Part A |
| 403 Forbidden on a route | [09_AUTH_IN_DEPTH.md](09_AUTH_IN_DEPTH.md) Part F |
| DB query returns wrong data | [11_POSTGRESQL_AND_SUPABASE.md](11_POSTGRESQL_AND_SUPABASE.md) Part K |
| RLS blocking a query | [11_POSTGRESQL_AND_SUPABASE.md](11_POSTGRESQL_AND_SUPABASE.md) Part H |
| Adding a new feature | [12_HOW_TO_ADD_A_FEATURE.md](12_HOW_TO_ADD_A_FEATURE.md) |
| Production deploy failing | [04_PRODUCTION.md](04_PRODUCTION.md) |

---

## The One Thing to Understand Before Writing Any Code

The backend is a **trust boundary**, not just a data relay.

Everything that runs in the browser (React, JavaScript, localStorage) is visible and modifiable by any user. They can open DevTools, intercept requests, and call your API directly. The backend is the only place where:

- **Identity is verified** — JWT validation with Supabase (not just "is the user logged in on screen")
- **Permissions are enforced** — role checks, org membership, approval status
- **Tokens are deducted** — atomically, with a guard against race conditions
- **Secrets are kept** — Brevo API key, Supabase service role key, never in frontend code
- **Data is written authoritatively** — delivery status, card records, member approval

If a feature decision arises — "should this run in the frontend or backend?" — ask: **"would skipping this be a security problem if a user bypassed the frontend?"** If yes, it belongs in the backend.

---

## What You'll Be Able to Do After This Course

1. Read any route in this codebase and explain every line
2. Add a new feature end-to-end without touching anything unnecessary
3. Debug a broken request by reading logs and tracing the middleware chain
4. Set up Brevo email and Supabase SMTP from scratch in under 30 minutes
5. Write SQL queries and Supabase SDK calls confidently
6. Deploy to production (Railway + Vercel) and configure all environment variables
7. Recognise which patterns here are project-specific vs universal backend engineering
