# 06 – Expiry Logic

## Overview

Generated ID cards have **configurable expiry** based on the subscription plan or project settings. The default is **365 days** (1 year). Expiry and cleanup are **admin-controlled** — cards are never automatically deleted.

---

## How `expires_at` Works

### On generation:

```javascript
// Backend — expiryHelper.js
const DEFAULT_EXPIRY_DAYS = 365;

const getExpiryDate = (days = DEFAULT_EXPIRY_DAYS) => {
  const now = new Date();
  now.setDate(now.getDate() + days);
  return now.toISOString();
};

// Frontend (single card upload)
const expiresAt = new Date();
expiresAt.setDate(expiresAt.getDate() + 365);

await supabase.from("generated_ids").insert({
  user_id: userId,
  file_url: filePath,
  expires_at: expiresAt.toISOString(),
});
```

- `expires_at` is an **absolute timestamp** — the exact moment the ID expires.
- It's calculated as `current time + expiryDays` at the moment of generation.
- Stored as `TIMESTAMPTZ` (timestamp with timezone) for unambiguous comparison.
- **SaaS projects** use the project's `expiry_days` setting (default 365).
- **Bulk uploads** default to 365 days (1 year).

### On dashboard load:

```javascript
const { data } = await supabase
  .from("generated_ids")
  .select("*")
  .eq("user_id", user.id)
  .order("created_at", { ascending: false });
```

- All cards are fetched (no expiry filter) — expired cards show with an "Expired" badge.
- Admins can extend or shorten expiry at any time via `PATCH /api/admin/expiry`.

---

## Expiry Sources

| Context                | Default Expiry        | Source                                     |
| ---------------------- | --------------------- | ------------------------------------------ |
| Legacy single card     | 365 days              | `DEFAULT_EXPIRY_DAYS` in `expiryHelper.js` |
| Legacy bulk upload     | 365 days              | Frontend `BulkGenerator.jsx`               |
| SaaS project (Service) | `project.expiry_days` | `projects` table, default 365              |
| SaaS project (Bulk)    | `project.expiry_days` | `projects` table, default 365              |

---

## How Expired Records Are Displayed

### Dashboard behavior:

All cards are shown regardless of expiry status. An expiry badge indicates status:

```javascript
const daysRemaining = (expiresAt) => {
  const diff = new Date(expiresAt) - new Date();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
};
```

- **Green badge** — More than 7 days remaining.
- **Amber badge** — 3 to 7 days remaining.
- **Red badge** — 3 days or fewer remaining.
- **Grey "Expired" badge** — 0 days remaining (card has expired).

Expired cards can still be viewed, downloaded, and deleted by the user.

---

## Admin Controls

### Extend/shorten expiry:

```
PATCH /api/admin/expiry
{
  "ids": ["uuid-1", "uuid-2"],
  "expiryDays": 90          // OR "expiresAt": "2027-01-01T00:00:00Z"
}
```

Updates the `expires_at` for the specified cards.

### Manual cleanup:

```
POST /api/admin/cleanup
{
  "beforeDate": "2026-01-01T00:00:00Z"  // optional cutoff
}
```

Deletes expired `generated_ids` rows AND their storage files. Only runs when explicitly invoked by an admin — **no automatic deletion**.

---

## What Happens to Expired Records?

| Stage               | Storage File | Database Record | Notes                                                    |
| ------------------- | ------------ | --------------- | -------------------------------------------------------- |
| Active              | ✅ Exists    | ✅ Exists       | Card shown with green/amber/red badge                    |
| Expired             | ✅ Exists    | ✅ Exists       | Card shown with grey "Expired" badge, still downloadable |
| After admin cleanup | ❌ Deleted   | ❌ Deleted      | Admin manually triggers via API                          |

---

## Timeline Visualization

```
Day 0          Expiry Day               Admin Cleanup
  │              │                       │
  ▼              ▼                       ▼
Generated   Badge changes          Hard-deleted (manual)
  │         to "Expired"                 │
  ├── ACTIVE ──┤                         │
  │  (green/   │                         │
  │   amber/   │                         │
  │   red      │                         │
  │   badge)   │                         │
  │            ├──── EXPIRED ────────────┤
  │            │  (grey badge,           │
  │            │   still viewable,       │
  │            │   still downloadable)   │
  │            │                         ├── DELETED
  │            │                         │   (only when admin
  │            │                         │    triggers cleanup)
```
