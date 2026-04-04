# Architecture Decision Record: Dual Card Generation Systems

**Status**: Active  
**Date**: 2026-03-31  
**Decision**: Maintain two parallel card generation systems during the
transition from single-tenant to multi-tenant architecture.

---

## Context

The project evolved from a single-user ID card generator (v1) into a
multi-tenant SaaS platform (v2). Both systems are currently operational.

## The Two Systems

### System 1: Legacy (Quick Generate)

| Component         | Details                                |
|--------------------|---------------------------------------|
| **Table**          | `generated_ids`                       |
| **Controller**     | `idController.js`                     |
| **Routes**         | `/api/ids/*`                          |
| **Auth**           | JWT + `members.approved` check        |
| **Storage path**   | `{userId}/{name}_{timestamp}.png`     |
| **Card metadata**  | Minimal: `user_id`, `file_url`, `expires_at` |

**Use case**: A single authenticated user manually enters member data
or imports from Google Sheets, picks a template, and generates cards.
No organization, no project, no registration form.

### System 2: Multi-tenant (Organization Platform)

| Component         | Details                                        |
|--------------------|-----------------------------------------------|
| **Tables**         | `organizations`, `projects`, `project_members`, `generated_cards` |
| **Controller**     | `generateController.js`                       |
| **Routes**         | `/api/generate/*`                             |
| **Auth**           | JWT + org role check (`checkOrgRole`)          |
| **Storage path**   | `{orgId}/{projectId}/{memberId}.png`          |
| **Card metadata**  | Rich: org/project/member FKs, QR data, status, revocation |

**Use case**: An organization admin creates a project with a public
registration form. Members register, admin approves, then bulk-generates
cards with QR verification.

## Why Both Exist

1. **Different user journeys**: Quick Generate is for personal/ad-hoc use.
   The org platform is for teams managing hundreds of members.

2. **Backward compatibility**: Existing users rely on the Quick Generate
   flow. Removing it would break their workflow.

3. **Complexity gradient**: Not every user needs orgs/projects. Quick
   Generate lets someone create a single card in under 60 seconds.

## Shared Infrastructure

Both systems share:
- Token billing (`tokenService.js`)
- Authentication (`verifyToken` middleware)
- Supabase Storage (`id-cards` bucket)
- Rate limiting

## Migration Path

When resources allow, consolidate into a single system:
1. Create a "Personal Workspace" auto-org for each user
2. Create a "Quick" project type that skips registration forms
3. Route Quick Generate through the multi-tenant pipeline internally
4. Mark `generated_ids` table as deprecated
5. Migrate existing `generated_ids` rows to `generated_cards`

This preserves the UX simplicity while eliminating code duplication.

## Decision

**Keep both systems** for the current release. The duplication is
documented, the shared infrastructure prevents divergence, and the
migration path is clear.
