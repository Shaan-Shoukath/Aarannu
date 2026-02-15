# 06 – Expiry Logic

## Overview

Generated ID cards have a **15-day validity period**. After 15 days, the ID cards are hidden from the user's dashboard but NOT deleted from storage or the database.

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

This is shown as a badge:

- **Green badge** — More than 3 days remaining.
- **Red badge** — 3 days or fewer remaining (urgency indicator).

---

## What Happens to Expired Records?

### Current behavior:

| Storage File    | Database Record | Signed URL                                       |
| --------------- | --------------- | ------------------------------------------------ |
| ✅ Still exists | ✅ Still exists | ❌ Can still be generated (if user has the path) |

Expired records are **soft-expired** — they remain in the database and storage but are filtered out of the UI. The user cannot see them on the dashboard.

### Why not hard-delete?

1. **Audit trail** — Keeping records allows tracking who generated what and when.
2. **Recovery** — If a user needs an ID re-issued, the admin can check history.
3. **No immediate cost** — Supabase Storage doesn't charge significantly for stored data on lower tiers.

---

## Optional: Automated Cleanup with Cron

For true production systems, you may want to periodically delete expired records and their storage files. Here are two approaches:

### Option A: Supabase Edge Function + pg_cron

```sql
-- Install pg_cron extension (one-time)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule daily cleanup at 3 AM UTC
SELECT cron.schedule(
  'cleanup-expired-ids',
  '0 3 * * *',
  $$
    -- Delete expired records older than 30 days (15 days expiry + 15 days grace)
    DELETE FROM public.generated_ids
    WHERE expires_at < now() - INTERVAL '15 days';
  $$
);
```

### Option B: Supabase Edge Function (HTTP-triggered)

```typescript
// supabase/functions/cleanup-expired-ids/index.ts
import { createClient } from "@supabase/supabase-js";

Deno.serve(async () => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // 1. Find expired records
  const { data: expired } = await supabase
    .from("generated_ids")
    .select("id, file_url")
    .lt("expires_at", new Date().toISOString());

  if (!expired?.length) {
    return new Response("No expired records", { status: 200 });
  }

  // 2. Delete storage files
  const filePaths = expired.map((r) => r.file_url);
  await supabase.storage.from("id-cards").remove(filePaths);

  // 3. Delete database records
  const ids = expired.map((r) => r.id);
  await supabase.from("generated_ids").delete().in("id", ids);

  return new Response(`Cleaned ${expired.length} records`, { status: 200 });
});
```

### Recommendation for this project:

- **Start without cron** — soft expiry is sufficient for early usage.
- **Add cron when storage costs become relevant** — track how many expired files accumulate.

---

## Timeline Visualization

```
Day 0          Day 15           Day 30 (with cron)
  │              │                │
  ▼              ▼                ▼
Generated   Hidden from UI   Hard-deleted (optional)
  │              │                │
  ├─── ACTIVE ───┤               │
  │    (visible)  │               │
  │              ├── SOFT-EXPIRED─┤
  │              │   (in DB but   │
  │              │    hidden)     │
  │              │               ├── DELETED
  │              │               │   (removed from
  │              │               │    DB + storage)
```
