# Admin Architecture — Three Authorization Layers

The Aarannu platform implements authorization at three distinct levels, each
serving a different scope. This is intentional — not duplication.

---

## Layer 1: Platform Admin (`adminHelper.js`)

**Scope**: Global platform privileges.
**How it works**: User IDs are listed in the `ADMIN_USER_IDS` environment
variable (comma-separated UUIDs). Parsed once at module load into a `Set`.

**Grants**:
- Unlimited (infinite) tokens — no balance checks, no deductions
- Bypass `checkTokens` middleware
- Access to platform-wide admin endpoints (`/api/admin/*`)
- Balance endpoints show `∞`

**Where checked**: `utils/adminHelper.js → isAdmin(userId)`

**Trade-off**: Requires server restart to add/remove admins. Acceptable for
a small team; a production system would use a database role.

---

## Layer 2: Legacy Admin (`members.role`)

**Scope**: Legacy single-tenant admin operations.
**How it works**: The `members` table has a `role` column. Admin controllers
call `requireAdmin()` which queries `members.role === 'admin'` for the
authenticated user.

**Grants**:
- View pending member approvals
- Approve/reject users
- Trigger expired card cleanup
- Modify card expiry dates

**Where checked**: `controllers/adminController.js → requireAdmin()`

**Note**: This is the legacy system's authorization. The multi-tenant system
uses Layer 3 instead.

---

## Layer 3: Organization Role (`org_members.role`)

**Scope**: Per-organization, multi-tenant authorization.
**How it works**: The `org_members` junction table stores a `role` per user
per organization. Roles have hierarchical levels:

| Role     | Level | Grants                                          |
|----------|-------|-------------------------------------------------|
| `member` | 1     | View org data, view projects                    |
| `admin`  | 2     | Manage projects, approve members, bulk generate |
| `owner`  | 3     | Full control, delete org, manage billing         |

The `checkOrgRole(minRole)` middleware compares the user's level against
the required minimum.

**Where checked**: `middleware/checkOrgRole.js`

---

## When Each Layer Applies

| Endpoint Group      | Layer Used | Example                              |
|---------------------|-----------|---------------------------------------|
| `/api/admin/*`      | Layer 2   | `POST /api/admin/approve/:userId`     |
| `/api/tokens/*`     | Layer 1   | Admin bypass for balance checks       |
| `/api/org/:id/*`    | Layer 3   | `PATCH /api/org/:id` (owner only)     |
| `/api/projects/*`   | Layer 3   | `POST /api/projects` (admin+)         |
| `/api/members/*`    | Layer 3   | `POST /api/members/bulk-approve`      |
| `/api/ids/generate` | Layer 1   | Admin gets infinite tokens            |

---

## Migration Path

Long-term, Layers 1 and 2 should converge into Layer 3:
1. Create a system-level "platform" organization
2. Assign platform admins as `owner` of this org
3. Remove `ADMIN_USER_IDS` env var
4. Remove `members.role` column (or mark deprecated)

This gives a single, database-driven authorization model.
