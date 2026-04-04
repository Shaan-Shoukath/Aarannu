# Developers Debug - Internal Documentation

This folder contains internal frontend-facing documentation for the Aarannu Community ID Platform.

It is written for:

- maintainers onboarding into the codebase
- reviewers trying to understand architectural intent
- future contributors debugging complex product behavior

---

## Documents

| File | Topic |
| --- | --- |
| [01_ARCHITECTURE.md](./01_ARCHITECTURE.md) | Frontend system design, component responsibilities, high-level data flow |
| [02_DATABASE_SCHEMA.md](./02_DATABASE_SCHEMA.md) | Database structures the frontend relies on |
| [03_RLS_POLICIES.md](./03_RLS_POLICIES.md) | RLS assumptions that shape frontend query behavior |
| [04_AUTH_FLOW.md](./04_AUTH_FLOW.md) | Auth, sessions, OTP, approval gating |
| [05_STORAGE_FLOW.md](./05_STORAGE_FLOW.md) | Storage access, downloads, signed URL behavior |
| [06_EXPIRY_LOGIC.md](./06_EXPIRY_LOGIC.md) | Expiry handling and client-side filtering expectations |
| [07_LIBRARIES_USED.md](./07_LIBRARIES_USED.md) | Frontend dependency rationale |
| [08_PRODUCTION_HARDENING.md](./08_PRODUCTION_HARDENING.md) | Frontend security and deployment hardening |
| [09_CARD_CUSTOMIZATION.md](./09_CARD_CUSTOMIZATION.md) | Card style system, orientation, theme controls |
| [10_MULTI_TENANT.md](./10_MULTI_TENANT.md) | Multi-tenant organization/project isolation model |
| [10_TOKEN_SYSTEM.md](./10_TOKEN_SYSTEM.md) | Token/credit UX and billing-related frontend flows |
| [11_CUSTOM_FORM_SYSTEM.md](./11_CUSTOM_FORM_SYSTEM.md) | Public registration forms and project dashboards |
| [11_SUBSCRIPTION_PLANS.md](./11_SUBSCRIPTION_PLANS.md) | Plan-related UI assumptions and limits |
| [12_BULK_GENERATION.md](./12_BULK_GENERATION.md) | Current browser-driven bulk generation pipeline |
| [12_FORM_BUILDER_AND_IMPORTS.md](./12_FORM_BUILDER_AND_IMPORTS.md) | Dynamic form builder, file uploads, Google Sheets imports |
| [13_QR_VERIFICATION.md](./13_QR_VERIFICATION.md) | QR scanning and verification UX |
| [14_FORM_SYSTEM.md](./14_FORM_SYSTEM.md) | Supplemental dynamic form system details |
| [15_EMAIL_QUEUE.md](./15_EMAIL_QUEUE.md) | Browser-orchestrated email delivery via backend Brevo handoff |
| [16_APPROVAL_AND_CLIENT_DELIVERY.md](./16_APPROVAL_AND_CLIENT_DELIVERY.md) | Approval split, access gating, and client-side card delivery architecture |

---

## Best reading order for the current product

If you are new to the codebase, read these first:

1. [01_ARCHITECTURE.md](./01_ARCHITECTURE.md)
2. [04_AUTH_FLOW.md](./04_AUTH_FLOW.md)
3. [11_CUSTOM_FORM_SYSTEM.md](./11_CUSTOM_FORM_SYSTEM.md)
4. [12_BULK_GENERATION.md](./12_BULK_GENERATION.md)
5. [15_EMAIL_QUEUE.md](./15_EMAIL_QUEUE.md)
6. [16_APPROVAL_AND_CLIENT_DELIVERY.md](./16_APPROVAL_AND_CLIENT_DELIVERY.md)

That sequence gives the clearest view of how signup, approval, generation, and delivery connect.

---

## Key concepts

| Concept | Best document |
| --- | --- |
| Self-serve Aarannu signup | [16_APPROVAL_AND_CLIENT_DELIVERY.md](./16_APPROVAL_AND_CLIENT_DELIVERY.md) |
| Org-admin approval flow | [11_CUSTOM_FORM_SYSTEM.md](./11_CUSTOM_FORM_SYSTEM.md) |
| Protected route approval gating | [16_APPROVAL_AND_CLIENT_DELIVERY.md](./16_APPROVAL_AND_CLIENT_DELIVERY.md) |
| Bulk generation job runner | [12_BULK_GENERATION.md](./12_BULK_GENERATION.md) |
| Client-first PDF generation | [12_BULK_GENERATION.md](./12_BULK_GENERATION.md) |
| Browser -> backend email handoff | [15_EMAIL_QUEUE.md](./15_EMAIL_QUEUE.md) |
| Card customization | [09_CARD_CUSTOMIZATION.md](./09_CARD_CUSTOMIZATION.md) |
| Google Sheets import | [12_FORM_BUILDER_AND_IMPORTS.md](./12_FORM_BUILDER_AND_IMPORTS.md) |
| QR verification | [13_QR_VERIFICATION.md](./13_QR_VERIFICATION.md) |
| Token UX | [10_TOKEN_SYSTEM.md](./10_TOKEN_SYSTEM.md) |

---

## Why these docs exist

The frontend contains several flows that look similar in the UI but operate under different trust and execution models:

- direct product signup vs organization membership approval
- local rendering vs backend-assisted fallback rendering
- UI-triggered delivery vs unattended backend automation

Without explicit docs, those differences are easy to blur together. This folder exists to preserve the reasoning, not just the behavior.
