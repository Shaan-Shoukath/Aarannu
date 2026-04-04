# Backend - Developers Debug

Internal backend documentation for the Aarannu Community ID Platform.

These notes explain not just what the backend does, but why particular responsibilities are kept server-side even in flows that appear heavily frontend-driven.

---

## Documents

| # | File | Topic |
| --- | --- | --- |
| 01 | [01_ARCHITECTURE.md](01_ARCHITECTURE.md) | Why the backend exists, layering, route/service/controller separation |
| 02 | [02_DATABASE_SCHEMA.md](02_DATABASE_SCHEMA.md) | Tables, relationships, indexes, and schema intent |
| 03 | [03_AUTH_VERIFICATION.md](03_AUTH_VERIFICATION.md) | JWT verification and request identity trust |
| 04 | [04_RLS_AND_SECURITY.md](04_RLS_AND_SECURITY.md) | RLS plus backend defense-in-depth |
| 05 | [05_STORAGE_SIGNED_URLS.md](05_STORAGE_SIGNED_URLS.md) | Signed URL strategy and private storage access |
| 06 | [06_EXPIRY_LOGIC.md](06_EXPIRY_LOGIC.md) | Expiry rules and lifecycle state changes |
| 07 | [07_LIBRARIES_USED.md](07_LIBRARIES_USED.md) | Dependency rationale |
| 08 | [08_PRODUCTION_DEPLOYMENT.md](08_PRODUCTION_DEPLOYMENT.md) | Deployment, scaling, production expectations |
| 09 | [09_CARD_CUSTOMIZATION.md](09_CARD_CUSTOMIZATION.md) | Backend impact of card customization decisions |
| 10 | [10_TOKEN_SYSTEM.md](10_TOKEN_SYSTEM.md) | Wallets, purchases, deductions, refunds |
| 11 | [11_CUSTOM_FORM_SYSTEM.md](11_CUSTOM_FORM_SYSTEM.md) | Public registration, approvals, CSV export, renewal |
| 12 | [12_FORM_BUILDER_AND_IMPORTS.md](12_FORM_BUILDER_AND_IMPORTS.md) | Form builder and bulk import backend support |
| 13 | [13_APPROVAL_AND_CLIENT_DELIVERY.md](13_APPROVAL_AND_CLIENT_DELIVERY.md) | Approval ownership, verification links, and client-generated card delivery boundary |

---

## Best reading order for current architecture

For the flows most likely to be edited next, read:

1. [01_ARCHITECTURE.md](01_ARCHITECTURE.md)
2. [03_AUTH_VERIFICATION.md](03_AUTH_VERIFICATION.md)
3. [11_CUSTOM_FORM_SYSTEM.md](11_CUSTOM_FORM_SYSTEM.md)
4. [13_APPROVAL_AND_CLIENT_DELIVERY.md](13_APPROVAL_AND_CLIENT_DELIVERY.md)

That sequence gives the clearest picture of why approval, verification metadata, and provider secrets stay on the backend even when rendering is pushed toward the client.

---

## Quick reference

```text
backend/src/
|- config/supabaseClient.js       <- service-role + anon clients
|- middleware/                    <- verifyToken, checkApproval, checkOrgRole, checkTokens, rate limiting
|- services/                      <- projectService, projectMemberService, generateService, orgService, tokenService
|- controllers/                   <- thin HTTP handlers and flow orchestration
|- routes/                        <- Express route wiring
|- server.js                      <- app bootstrap and route registration
```

---

## Key concepts

| Concept | Best document |
| --- | --- |
| Approval as a trust decision | [13_APPROVAL_AND_CLIENT_DELIVERY.md](13_APPROVAL_AND_CLIENT_DELIVERY.md) |
| Verification-link generation | [13_APPROVAL_AND_CLIENT_DELIVERY.md](13_APPROVAL_AND_CLIENT_DELIVERY.md) |
| Public project registration | [11_CUSTOM_FORM_SYSTEM.md](11_CUSTOM_FORM_SYSTEM.md) |
| Card record creation vs PDF rendering | [13_APPROVAL_AND_CLIENT_DELIVERY.md](13_APPROVAL_AND_CLIENT_DELIVERY.md) |
| Secret email provider boundary | [13_APPROVAL_AND_CLIENT_DELIVERY.md](13_APPROVAL_AND_CLIENT_DELIVERY.md) |
| Storage and signed access | [05_STORAGE_SIGNED_URLS.md](05_STORAGE_SIGNED_URLS.md) |
| Token enforcement | [10_TOKEN_SYSTEM.md](10_TOKEN_SYSTEM.md) |

---

## Why this folder exists

Several backend flows can be misunderstood if viewed only from the UI:

- approval status is not the same as authentication
- card metadata creation is not the same as PDF rendering
- frontend-driven delivery still depends on backend-owned secrets

These docs make those boundaries explicit so future contributors can change the system without collapsing distinct responsibilities into one "do everything in one place" implementation.
