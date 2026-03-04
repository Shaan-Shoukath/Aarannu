# 11 — Custom Form & Registration System

## Overview

Replaces the webhook-based workflow with a self-hosted Google-Forms-like system.
Organizations create **projects**, each with a custom **form_schema**.
A public shareable link lets members register; admins approve/reject from a dashboard.

---

## Data Flow

```
Admin: ProjectCreate page
    │
    │  POST /api/projects
    │  Body: { orgId, name, type, template, memberLimit, expiryDays, formSchema, cardConfig }
    │
    ▼
Supabase: projects table (form_schema JSONB)
    │
    │  Generates a shareable URL:
    │  https://<frontend>/register/<projectId>
    │
    ▼
Public member visits the link
    │
    │  GET /api/projects/:projectId/public   (NO AUTH)
    │  Returns: project info, form_schema, org branding, spots_remaining
    │
    ▼
RegistrationForm renders dynamic fields from form_schema
    │
    │  POST /api/members/register/:projectId  (NO AUTH)
    │  Body: { name, email, photoUrl, customFields }
    │
    ▼
Supabase: project_members (status = "pending")
    │
    ▼
Admin: ProjectDashboard
    │
    ├── PATCH /api/members/:id/approve
    │     └── Sends Brevo email notification (fire-and-forget)
    │
    ├── POST /api/members/bulk-approve
    │     └── Sends emails to all approved members
    │
    ├── GET /api/projects/:projectId/export-csv
    │     └── Downloads CSV with all base + custom fields
    │
    └── POST /api/projects/:projectId/renew
          Body: { mode: "continue" | "reset" }
```

---

## form_schema Format

The `form_schema` column is a JSONB array stored on the `projects` table.
Each element defines one custom form field:

```json
[
  {
    "label": "Department",
    "name": "department",
    "type": "select",
    "required": true,
    "placeholder": "",
    "options": ["Engineering", "Design", "Marketing"]
  },
  {
    "label": "Student ID",
    "name": "student_id",
    "type": "text",
    "required": true,
    "placeholder": "e.g. STU-2025-001"
  },
  {
    "label": "Date of Birth",
    "name": "date_of_birth",
    "type": "date",
    "required": false
  }
]
```

### Supported field types

| Type       | HTML element            | Notes                    |
| ---------- | ----------------------- | ------------------------ |
| `text`     | `<input type="text">`   | Default                  |
| `email`    | `<input type="email">`  | Browser email validation |
| `number`   | `<input type="number">` |                          |
| `tel`      | `<input type="tel">`    | Phone input              |
| `url`      | `<input type="url">`    |                          |
| `date`     | `<input type="date">`   | Native date picker       |
| `select`   | `<select>`              | Requires `options` array |
| `textarea` | `<textarea>`            | Multi-line text          |

### Built-in fields (always present, not in form_schema)

- **Full Name** — text, required
- **Email** — email, required
- **Photo URL** — url, optional

Custom fields map to `project_members.custom_fields` JSONB, keyed by `field.name`.

---

## API Endpoints

### Public (no auth)

| Method | Path                               | Handler                | Description                               |
| ------ | ---------------------------------- | ---------------------- | ----------------------------------------- |
| GET    | `/api/projects/:projectId/public`  | `getPublicProjectInfo` | Project info + form_schema + org branding |
| POST   | `/api/members/register/:projectId` | `registerMember`       | Submit registration form                  |

### Authenticated

| Method | Path                                  | Handler            | Description                           |
| ------ | ------------------------------------- | ------------------ | ------------------------------------- |
| POST   | `/api/projects`                       | `createProject`    | Create project (admin checkOrgRole)   |
| GET    | `/api/projects/org/:id`               | `listProjects`     | List org projects (member role+)      |
| GET    | `/api/projects/:projectId`            | `getProject`       | Get single project                    |
| PUT    | `/api/projects/:projectId`            | `updateProject`    | Update project                        |
| GET    | `/api/projects/:projectId/stats`      | `getProjectStats`  | Pending/approved/rejected/card counts |
| GET    | `/api/projects/:projectId/export-csv` | `exportMembersCsv` | CSV download (org member required)    |
| POST   | `/api/projects/:projectId/renew`      | _(inline handler)_ | Renew: continue or reset              |
| GET    | `/api/members/:projectId`             | `listMembers`      | List members with ?status= filter     |
| PATCH  | `/api/members/:id/approve`            | `approve`          | Approve + send email                  |
| PATCH  | `/api/members/:id/reject`             | `reject`           | Reject member                         |
| POST   | `/api/members/bulk-approve`           | `bulkApprove`      | Bulk approve + send emails            |
| DELETE | `/api/members/:id`                    | `removeMember`     | Delete member permanently             |

---

## Member Limit Logic

When `project.member_limit` is set:

1. Only **pending + approved** members count toward the limit (rejected members are excluded).
2. `getPublicProjectInfo` returns `spots_remaining` so the form can show capacity.
3. `registerMember` re-checks capacity at submit time (race-condition safe since INSERT will
   succeed and the worst case is slight over-capacity, which is acceptable).

---

## CSV Export

`GET /api/projects/:projectId/export-csv?status=approved`

- Dynamically discovers all `custom_fields` keys across all members
- Sorts custom keys alphabetically for consistent column order
- Base headers: `id, name, email, photo_url, status, created_at`
- All values are properly CSV-escaped (quotes, commas, newlines)
- Optional `?status=` query param to filter by member status

---

## Renewal Flow

`POST /api/projects/:projectId/renew`

Requires admin/owner org role.

| Mode       | Behavior                                        |
| ---------- | ----------------------------------------------- |
| `continue` | Re-activates the project. Keeps all members.    |
| `reset`    | Deletes ALL project_members, then re-activates. |

The form link (`/register/:projectId`) stays the same in both modes.
Admins should export CSV before reset.

---

## Email on Approval

When a member is approved (single or bulk):

1. `sendApprovalEmail()` is called (fire-and-forget, async, no await).
2. Uses Brevo v3 `POST /v3/smtp/email` with `BREVO_API_KEY`.
3. If `BREVO_API_KEY` is not set, email is silently skipped.
4. Email failure does **not** roll back the approval.
5. Email includes: project name, org name, styled HTML.

---

## Security Considerations

| Concern               | Mitigation                                                     |
| --------------------- | -------------------------------------------------------------- |
| Public info endpoint  | Returns only non-sensitive project metadata + form_schema      |
| Public registration   | No auth required — anyone with the link can submit             |
| Member limit bypass   | Server-side check on every submission (not just frontend)      |
| CSV export access     | `verifyToken` + org membership check (inline middleware)       |
| Renewal access        | `verifyToken` + admin/owner role check on project's org        |
| Email injection       | Brevo handles sanitization; we only send to `member.email`     |
| form_schema injection | Schema is read-only from the project — members can't modify it |

---

## File Index

| File                                     | What changed / was added                      |
| ---------------------------------------- | --------------------------------------------- |
| `controllers/projectController.js`       | + `getPublicProjectInfo`, `exportMembersCsv`  |
| `controllers/projectMemberController.js` | + `sendApprovalEmail`, email calls in approve |
| `routes/projectRoutes.js`                | + public route, CSV route, renewal route      |
| `routes/projectMemberRoutes.js`          | Public `POST /register/:projectId` route      |
| `services/projectService.js`             | Unchanged — CRUD used by new endpoints        |
| `services/projectMemberService.js`       | Unchanged — register, approve, bulk used      |
| `services/orgService.js`                 | Unchanged — getOrgById used for branding      |
