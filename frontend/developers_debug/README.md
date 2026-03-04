# Developers Debug – Internal Documentation

This folder contains **advanced internal documentation** for the Aarannu Community ID Platform (frontend). It is intended for developers, interviewers, and future maintainers.

## Documents

| File                                                       | Topic                                                                 |
| ---------------------------------------------------------- | --------------------------------------------------------------------- |
| [01_ARCHITECTURE.md](./01_ARCHITECTURE.md)                 | System design, data flow, hybrid architecture, component tree         |
| [02_DATABASE_SCHEMA.md](./02_DATABASE_SCHEMA.md)           | Full SQL definitions, column rationale                                |
| [03_RLS_POLICIES.md](./03_RLS_POLICIES.md)                 | Row Level Security policies with reasoning                            |
| [04_AUTH_FLOW.md](./04_AUTH_FLOW.md)                       | Signup, login (password + OTP), session, approval gating              |
| [05_STORAGE_FLOW.md](./05_STORAGE_FLOW.md)                 | Bucket config, signed URLs, PDF/ZIP delivery, downloadHelpers         |
| [06_EXPIRY_LOGIC.md](./06_EXPIRY_LOGIC.md)                 | 15-day expiry, daily limit (200/day), filtering, cleanup              |
| [07_LIBRARIES_USED.md](./07_LIBRARIES_USED.md)             | All dependencies: Supabase, jsPDF, JSZip, file-saver, qrcode.react    |
| [08_PRODUCTION_HARDENING.md](./08_PRODUCTION_HARDENING.md) | Security, deployment, hardening checklist                             |
| [09_CARD_CUSTOMIZATION.md](./09_CARD_CUSTOMIZATION.md)     | Card styling (bg, font, accent, radius), orientation (H/V), data flow |
| [10_TOKEN_SYSTEM.md](./10_TOKEN_SYSTEM.md)                 | Token/credit system: balance, purchase, analytics, 402 handling       |
| [11_CUSTOM_FORM_SYSTEM.md](./11_CUSTOM_FORM_SYSTEM.md)     | Custom registration forms, project dashboards, approval flow          |
| [12_FORM_BUILDER_AND_IMPORTS.md](./12_FORM_BUILDER_AND_IMPORTS.md) | Dynamic form builder, file uploads, Google Sheets import      |

## Key Concepts

| Concept                  | Where documented                   |
| ------------------------ | ---------------------------------- |
| Template system          | 01_ARCHITECTURE (Frontend Arch)    |
| Custom fields            | 01_ARCHITECTURE (Design Decisions) |
| Card styling/colors      | 09_CARD_CUSTOMIZATION              |
| Card orientation (H/V)   | 09_CARD_CUSTOMIZATION              |
| Google Drive proxy       | 01_ARCHITECTURE + 05_STORAGE_FLOW  |
| PDF generation (jsPDF)   | 05_STORAGE_FLOW + 07_LIBRARIES     |
| ZIP bundling (JSZip)     | 05_STORAGE_FLOW + 07_LIBRARIES     |
| Watermarks               | 01_ARCHITECTURE (Design Decisions) |
| QR codes                 | 07_LIBRARIES (qrcode.react)        |
| Token / credit system    | 10_TOKEN_SYSTEM                    |
| Token purchase flow      | 10_TOKEN_SYSTEM (TokenPurchase)    |
| 402 insufficient funds   | 10_TOKEN_SYSTEM (Error Handling)   |
| Custom form system       | 11_CUSTOM_FORM_SYSTEM              |
| Registration form        | 11_CUSTOM_FORM_SYSTEM              |
| form_schema builder      | 11_CUSTOM_FORM_SYSTEM              |
| Project dashboards       | 11_CUSTOM_FORM_SYSTEM              |
| CSV export               | 11_CUSTOM_FORM_SYSTEM              |
| Renewal (continue/reset) | 11_CUSTOM_FORM_SYSTEM              |
| Email on approval        | 11_CUSTOM_FORM_SYSTEM              |
| Dynamic form builder     | 12_FORM_BUILDER_AND_IMPORTS        |
| 11 field types           | 12_FORM_BUILDER_AND_IMPORTS        |
| File/photo uploads       | 12_FORM_BUILDER_AND_IMPORTS        |
| Google Sheets import     | 12_FORM_BUILDER_AND_IMPORTS        |
| Bulk member import       | 12_FORM_BUILDER_AND_IMPORTS        |

## Why This Exists

Most beginner projects lack internal documentation. This folder separates this project from typical bootcamp work by demonstrating:

- **Architectural thinking** — understanding _why_ decisions were made, not just _what_ was built.
- **Security awareness** — documenting RLS, validation, and access control.
- **Professional practices** — structured knowledge that aids onboarding and debugging.

> This is documentation you'd find in a real production codebase. It's not academic — it's practical.
