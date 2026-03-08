# 11 — Custom Form & Registration System (Frontend)

## Overview

Four new pages implement the self-hosted registration system.
Organizations create projects with custom form schemas; members register via a public link; admins manage from dashboards.

---

## Page Architecture

```
/org/:slug/dashboard            → OrgDashboard.jsx
    │
    ├── + New Project           → /org/:slug/project/new  → ProjectCreate.jsx
    │                                  │
    │                                  └── On success: shows shareable link
    │                                        /register/:projectId
    │
    └── Open →                  → /org/:slug/project/:projectId → ProjectDashboard.jsx
                                       │
                                       ├── Member table (approve / reject / delete)
                                       ├── Bulk approve
                                       ├── CSV export download
                                       └── Renewal modal (continue / reset)

/register/:projectId            → RegistrationForm.jsx  (PUBLIC, no auth)
```

---

## RegistrationForm.jsx

**Route:** `/register/:projectId` (public, no auth)

### Data flow

1. `useEffect` → `GET /api/projects/:projectId/public` (no auth header)
2. Response provides `project.form_schema`, `organization.name`, `organization.logo_url`, `spots_remaining`
3. Renders built-in fields (name, email, photo URL) + dynamic fields from `form_schema`
4. On submit → `POST /api/members/register/:projectId` with `{ name, email, photoUrl, customFields }`

### States

| State     | Condition                       | UI                                  |
| --------- | ------------------------------- | ----------------------------------- |
| Loading   | Fetching project info           | Spinner                             |
| Error     | API error or project not found  | "Form Unavailable" with error msg   |
| Full      | `spots_remaining === 0`         | "Registrations Full" message        |
| Form      | Project is active with capacity | The registration form               |
| Submitted | After successful POST           | Success confirmation + email notice |

### Custom field rendering

`renderField(field, index)` reads `field.type` and renders:

- `select` → `<select>` with `field.options` array
- `textarea` → `<textarea>` with 3 rows
- All others → `<input type={field.type}>`

Custom field values are stored in `customFields` state object, keyed by `field.name || field.label`.

---

## ProjectCreate.jsx

**Route:** `/org/:slug/project/new` (protected)

### Form builder features

- **Basic info:** Project name, type (service/bulk), template, member limit, expiry days
- **Custom field builder:** Visual add/remove/reorder with field type selector
  - Field properties: label, name (auto-generated from label), type, placeholder, required, dropdown options
  - Drag-up/drag-down buttons for reordering
  - Type changes to "select" reveals comma-separated options input

### Submit flow

1. Builds `formSchema` array from builder state (filters empty labels, auto-generates `name` from label)
2. `POST /api/projects` with `{ orgId, type, name, template, memberLimit, expiryDays, formSchema, cardConfig }`
3. On success → displays shareable registration link + "Go to Project Dashboard" button

---

## ProjectDashboard.jsx

**Route:** `/org/:slug/project/:projectId` (protected)

### Parallel data loading

`loadData()` fetches in parallel:

- `GET /api/projects/:projectId` — project details
- `GET /api/projects/:projectId/stats` — aggregate counts
- `GET /api/members/:projectId?status=<filter>` — member list

### Member management

| Action       | API call                             | Notes                              |
| ------------ | ------------------------------------ | ---------------------------------- |
| Approve      | `PATCH /api/members/:id/approve`     | Shows email notification success   |
| Reject       | `PATCH /api/members/:id/reject`      | Immediate, no confirmation         |
| Delete       | `DELETE /api/members/:id`            | Confirmation dialog first          |
| Bulk approve | `POST /api/members/bulk-approve`     | Sends selected or all pending IDs  |
| CSV export   | `GET .../export-csv` → blob download | Creates `<a>` element for download |

### Checkbox selection

- Header checkbox toggles all **pending** members
- Individual checkboxes only shown for pending members
- Bulk approve button shows count: selected count or total pending

### Renewal modal

Two modes via radio buttons:

- **Continue** — keeps members, re-activates project (indigo styling)
- **Reset** — deletes all members, re-activates project (red styling + warning)

Calls `POST /api/projects/:projectId/renew` with `{ mode }`.

### Filter tabs

`all | pending | approved | rejected` — changes query param on API call, clears selection.

---

## OrgDashboard.jsx

**Route:** `/org/:slug/dashboard` (protected)

### Data loading sequence

1. Fetch org by slug → `GET /api/org/slug/:slug`
2. Parallel: `GET /api/org/:id/stats` + `GET /api/projects/org/:id`
3. Stats: totalProjects, totalMembers, pendingMembers, totalCards, activeCards
4. Project list with status badges (active/archived/completed)

### Per-project actions

- **Copy form link** — `navigator.clipboard.writeText(...)` with success toast
- **Open →** — navigates to `/org/:slug/project/:projectId`

### Role-gated UI

- "New Project" button only visible to `owner` or `admin` role users
- User role displayed in header next to org slug

---

## Shared Patterns

### Auth header helper

Both `ProjectDashboard` and `OrgDashboard` use:

```js
const getAuth = useCallback(async () => {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) {
    navigate("/login");
    return null;
  }
  return { Authorization: `Bearer ${session.access_token}` };
}, [navigate]);
```

Wrapped in `useCallback` with `navigate` dependency for correct `useCallback` chain.

### Backend URL

All pages read `VITE_BACKEND_URL` from env, defaulting to `http://localhost:5000`.

### Error/success toasts

Dismissible banners with green (success) or red (error) styling and ✕ close buttons.

---

## Environment Variables (Frontend)

| Variable                 | Default                 | Used by                |
| ------------------------ | ----------------------- | ---------------------- |
| `VITE_BACKEND_URL`       | `http://localhost:5000` | All API calls          |
| `VITE_SUPABASE_URL`      | —                       | Supabase client (auth) |
| `VITE_SUPABASE_ANON_KEY` | —                       | Supabase client (auth) |

---

## Route Configuration (App.jsx)

```jsx
<Route path="/register/:projectId" element={<RegistrationForm />} />        // public
<Route path="/org/:slug/dashboard" element={<ProtectedRoute><OrgDashboard /></ProtectedRoute>} />
<Route path="/org/:slug/project/new" element={<ProtectedRoute><ProjectCreate /></ProtectedRoute>} />
<Route path="/org/:slug/project/:projectId" element={<ProtectedRoute><ProjectDashboard /></ProtectedRoute>} />
```
