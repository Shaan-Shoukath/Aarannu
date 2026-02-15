# 🗂 Developers Debug – Internal Documentation

This folder contains **advanced internal documentation** for the Community ID Platform. It is intended for developers, interviewers, and future maintainers.

## Documents

| File                                                       | Topic                                            |
| ---------------------------------------------------------- | ------------------------------------------------ |
| [01_ARCHITECTURE.md](./01_ARCHITECTURE.md)                 | System design, data flow, platform justification |
| [02_DATABASE_SCHEMA.md](./02_DATABASE_SCHEMA.md)           | Full SQL definitions, column rationale           |
| [03_RLS_POLICIES.md](./03_RLS_POLICIES.md)                 | Row Level Security policies with reasoning       |
| [04_AUTH_FLOW.md](./04_AUTH_FLOW.md)                       | Signup, login, session, approval gating          |
| [05_STORAGE_FLOW.md](./05_STORAGE_FLOW.md)                 | Bucket config, signed URLs, upload flow          |
| [06_EXPIRY_LOGIC.md](./06_EXPIRY_LOGIC.md)                 | 15-day expiry, filtering, cleanup                |
| [07_LIBRARIES_USED.md](./07_LIBRARIES_USED.md)             | Library justifications and key functions         |
| [08_PRODUCTION_HARDENING.md](./08_PRODUCTION_HARDENING.md) | Security, deployment, hardening checklist        |

## Why This Exists

Most beginner projects lack internal documentation. This folder separates this project from typical bootcamp work by demonstrating:

- **Architectural thinking** — understanding _why_ decisions were made, not just _what_ was built.
- **Security awareness** — documenting RLS, validation, and access control.
- **Professional practices** — structured knowledge that aids onboarding and debugging.

> This is documentation you'd find in a real production codebase. It's not academic — it's practical.
