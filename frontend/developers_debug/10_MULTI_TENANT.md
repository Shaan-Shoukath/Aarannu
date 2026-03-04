# 10 – Multi-Tenant Architecture

## Overview

The Aarannu Platform uses a multi-tenant architecture where each **organization** is fully isolated. Users can belong to multiple organizations with different roles.

---

## Organization Hierarchy

```
Organization (org)
├── Org Members (owner, admin, member)
├── Projects
│   ├── Service Project (subscription)
│   │   ├── Project Members (pending/approved/rejected)
│   │   └── Generated Cards
│   └── Bulk Project (pay-per-use)
│       ├── Project Members (auto-approved on import)
│       └── Generated Cards
└── Subscription Plan (free/starter/pro/enterprise)
```

---

## Tenant Isolation

### Database Level (RLS)

Every table with org data has Row Level Security policies enforcing `org_id` matches. See [03_RLS_POLICIES.md](./03_RLS_POLICIES.md) for policy SQL.

Key policies:

- **Organizations**: Only org members can SELECT
- **Projects**: Only org members can SELECT, only admins can CREATE/UPDATE/DELETE
- **Project Members**: Admins can manage, public can INSERT (registration forms)
- **Generated Cards**: Only org admins can manage

### Application Level

- `checkOrgRole` middleware verifies user's role before org-scoped operations
- Role hierarchy: `owner` > `admin` > `member`
- Backend routes extract `orgId` from params and enforce membership

### Storage Level

Files stored under `{org_id}/{project_id}/{filename}.png` path structure in Supabase Storage.

---

## Org Roles

| Role     | Permissions                                                   |
| -------- | ------------------------------------------------------------- |
| `owner`  | Full control: manage org settings, billing, members, projects |
| `admin`  | Manage projects, approve/reject members, generate cards       |
| `member` | View projects and cards only                                  |

---

## API Routes

| Route                           | Auth     | Purpose                        |
| ------------------------------- | -------- | ------------------------------ |
| `POST /api/org`                 | ✅       | Create organization            |
| `GET /api/org/my`               | ✅       | List user's organizations      |
| `GET /api/org/slug/:slug`       | ✅       | Get org by slug                |
| `PUT /api/org/:id`              | ✅ Admin | Update org                     |
| `GET /api/org/:id/stats`        | ✅ Admin | Org statistics                 |
| `GET /api/org/check-slug/:slug` | ❌       | Public slug availability check |

---

## Files

| File                                       | Purpose                     |
| ------------------------------------------ | --------------------------- |
| `backend/src/services/orgService.js`       | Org CRUD, membership, stats |
| `backend/src/controllers/orgController.js` | HTTP handlers               |
| `backend/src/routes/orgRoutes.js`          | Route definitions           |
| `backend/src/middleware/checkOrgRole.js`   | Role enforcement            |
| `frontend/src/pages/OrgOnboarding.jsx`     | Create/select org page      |
| `frontend/src/pages/OrgDashboard.jsx`      | Org admin dashboard         |
