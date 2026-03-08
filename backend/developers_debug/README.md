# Backend — Developers Debug

Internal documentation for the Aarannu Community ID Platform backend.

> **Audience:** Developers who maintain, extend, or audit this codebase.

---

## Documents

| #   | File                                                             | Topic                                                                             |
| --- | ---------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| 01  | [01_ARCHITECTURE.md](01_ARCHITECTURE.md)                         | Why a backend exists alongside Supabase; layered architecture; Google Drive proxy |
| 02  | [02_DATABASE_SCHEMA.md](02_DATABASE_SCHEMA.md)                   | Table structures, foreign keys, indexes                                           |
| 03  | [03_AUTH_VERIFICATION.md](03_AUTH_VERIFICATION.md)               | JWT verification flow and reasoning                                               |
| 04  | [04_RLS_AND_SECURITY.md](04_RLS_AND_SECURITY.md)                 | Supabase RLS + backend defense-in-depth                                           |
| 05  | [05_STORAGE_SIGNED_URLS.md](05_STORAGE_SIGNED_URLS.md)           | Private bucket, signed URLs, TTL                                                  |
| 06  | [06_EXPIRY_LOGIC.md](06_EXPIRY_LOGIC.md)                         | 15-day expiry enforcement                                                         |
| 07  | [07_LIBRARIES_USED.md](07_LIBRARIES_USED.md)                     | Every dependency explained                                                        |
| 08  | [08_PRODUCTION_DEPLOYMENT.md](08_PRODUCTION_DEPLOYMENT.md)       | Deployment, HTTPS, logging, scaling                                               |
| 09  | [09_CARD_CUSTOMIZATION.md](09_CARD_CUSTOMIZATION.md)             | Frontend card styling/orientation — backend impact analysis                       |
| 10  | [10_TOKEN_SYSTEM.md](10_TOKEN_SYSTEM.md)                         | Token/credit system — wallets, transactions, middleware, auto-refund              |
| 11  | [11_CUSTOM_FORM_SYSTEM.md](11_CUSTOM_FORM_SYSTEM.md)             | Custom registration forms, approval flow, CSV export, renewal                     |
| 12  | [12_FORM_BUILDER_AND_IMPORTS.md](12_FORM_BUILDER_AND_IMPORTS.md) | Dynamic form builder, file uploads, Google Sheets import                          |

---

## Quick Reference

```
backend/src/
├── config/supabaseClient.js   ← service-role + anon clients
├── middleware/                 ← verifyToken → checkApproval → checkOrgRole → checkTokens → rateLimiter → errorHandler
├── services/                  ← DB queries + storage + tokenService + orgService + projectService + projectMemberService + formFieldService + googleSheetsService
├── controllers/               ← thin HTTP handlers + orgController + projectController + projectMemberController + formFieldController + sheetImportController
├── routes/                    ← Express Router wiring + orgRoutes + projectRoutes + projectMemberRoutes + formFieldRoutes + sheetImportRoutes + uploadRoutes
├── utils/                     ← validators, expiry helpers
└── server.js                  ← entry point (18+ route groups)
```
