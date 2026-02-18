# 06 – Expiry Logic

## Overview

Generated ID cards have a **15-day validity period**. After 15 days, the ID cards are hidden from the user's dashboard. The backend automatically deletes expired records and their storage files every 6 hours.

---

## How `expires_at` Works

### On generation:

```javascript
const expiresAt = new Date();
expiresAt.setDate(expiresAt.getDate() + 15);

await supabase.from("generated_ids").insert({
  user_id: userId,
  file_url: filePath,
  expires_at: expiresAt.toISOString(), // e.g., "2026-03-02T14:30:00.000Z"
});
```

- `expires_at` is an **absolute timestamp** — the exact moment the ID expires.
- It's calculated as `current time + 15 days` at the moment of generation.
- Stored as `TIMESTAMPTZ` (timestamp with timezone) for unambiguous comparison.

### On dashboard load:

```javascript
const { data } = await supabase
  .from("generated_ids")
  .select("*")
  .eq("user_id", user.id)
  .gt("expires_at", new Date().toISOString()) // Only non-expired
  .order("created_at", { ascending: false });
```

- The `.gt('expires_at', now)` filter excludes all expired records.
- This is a simple, performant comparison handled by Postgres.

---

## Why 15 Days?

| Factor                 | Reasoning                                                  |
| ---------------------- | ---------------------------------------------------------- |
| **Security**           | Limits the window of exposure for personal information     |
| **Storage management** | Encourages users to download IDs promptly                  |
| **Freshness**          | Ensures ID cards reflect current data (name, role changes) |
| **Compliance**         | Aligns with data minimization principles                   |

The 15-day period is a balance between:

- **Too short** (e.g., 1 day) — Users might not download in time.
- **Too long** (e.g., 90 days) — Stale data, unnecessary storage usage.

This value can be easily adjusted by changing the `15` in the generation code.

---

## How Expired Records Are Filtered

### Client-side filtering:

The Dashboard page queries with:

```sql
SELECT * FROM generated_ids
WHERE user_id = '{auth.uid()}'
  AND expires_at > now()
ORDER BY created_at DESC;
```

Expired records simply don't appear in the results.

### Days remaining display:

```javascript
const daysRemaining = (expiresAt) => {
  const diff = new Date(expiresAt) - new Date();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
};
```

This is shown as a badge in the Dashboard thumbnail grid:

- **Green badge** — More than 7 days remaining.
- **Amber badge** — 3 to 7 days remaining.
- **Red badge** — 3 days or fewer remaining (urgency indicator).

---

## What Happens to Expired Records?

### Current behavior:

| Storage File | Database Record | After Auto-Cleanup          |
| ------------ | --------------- | --------------------------- |
| ✅ Exists    | ✅ Exists       | ❌ Both deleted every 6 hrs |

The backend runs an **automated cleanup scheduler** (`setInterval` in `server.js`) that:

1. Fetches all expired `generated_ids` rows
2. Deletes their PNG files from the `id-cards` storage bucket
3. Removes the expired DB rows

This runs **on server boot** and then **every 6 hours** automatically.

Additionally, admins can trigger cleanup manually via `POST /api/admin/cleanup`.

---

## Automated Cleanup (Built-In)

The backend's `server.js` includes an automatic cleanup that runs on boot and every 6 hours:

```javascript
// server.js
const CLEANUP_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6 hours

const runCleanup = async () => {
  const { error, deletedFiles } = await cleanupExpiredIds();
  console.log(
    `[auto-cleanup] Purged expired rows & ${deletedFiles} storage file(s)`,
  );
};

runCleanup(); // run once on boot
setInterval(runCleanup, CLEANUP_INTERVAL_MS); // then every 6 hours
```

The `cleanupExpiredIds()` service function:

1. **Fetches** all `generated_ids` rows where `expires_at < now()`
2. **Deletes storage files** — loops through each row's `file_url` and calls `deleteFile()` (best-effort; errors logged, not thrown)
3. **Deletes DB rows** — `supabase.from('generated_ids').delete().lt('expires_at', now)`

### Manual cleanup

Admins can also trigger cleanup via `POST /api/admin/cleanup` which calls the same function and returns `{ deletedFiles }` count.

---

## Timeline Visualization

```
Day 0          Day 15           ~Day 15.25 (next 6hr cycle)
  │              │                │
  ▼              ▼                ▼
Generated   Hidden from UI   Hard-deleted (auto)
  │              │                │
  ├─── ACTIVE ───┤               │
  │   (visible   │               │
  │   in Dashboard│              │
  │   with thumbs)│              │
  │              ├── EXPIRED ────┤
  │              │  (hidden, but │
  │              │   still in DB) │
  │              │               ├── DELETED
  │              │               │   (DB rows + storage
  │              │               │    files removed)
```
