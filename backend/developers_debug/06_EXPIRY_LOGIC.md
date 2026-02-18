# 06 — Expiry Logic

## The Rule

```
expires_at = created_at + 15 days
```

Every row in `generated_ids` has an `expires_at` column. When this timestamp passes, the ID card is considered **dead** — it won't be returned by the API.

---

## Why 15 Days?

| Duration       | Problem                                                             |
| -------------- | ------------------------------------------------------------------- |
| 1 day          | Too short — users must regenerate constantly                        |
| 7 days         | Usable for events but aggressive for regular use                    |
| **15 days** ✅ | Balances security (forces re-verification) with usability           |
| 30 days        | Acceptable but increases window for stale data                      |
| Permanent      | Dangerous — identity info can change, cards should not live forever |

15 days also aligns with typical "temporary credential" standards used by event management and co-working platforms.

---

## How Expiry Is Enforced

### At Creation (Insert)

```js
// utils/expiryHelper.js
const getExpiryDate = () => {
  const now = new Date();
  now.setDate(now.getDate() + 15);
  return now.toISOString();
};
```

Every `insertGeneratedIds` call sets `expires_at` using this function.

### At Fetch (Select)

```js
// services/supabaseService.js
const getActiveIds = async (userId) => {
  return supabase
    .from("generated_ids")
    .select("*")
    .eq("user_id", userId)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false });
};
```

The `.gt("expires_at", now)` filter ensures expired records are **never** returned.

### Why Server-Side Filtering?

If filtering were done on the frontend:

1. All records (including expired ones) would be sent over the network — wasteful.
2. A user could modify the frontend code to show expired cards.
3. Signed URLs would still be generated for expired records.

Server-side filtering prevents all three issues.

---

## Automated Cleanup (Built-In)

Expired rows and their storage files are **automatically deleted** by a scheduler in `server.js`.

### How It Works

```javascript
// server.js
const CLEANUP_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6 hours

const runCleanup = async () => {
  const { error, deletedFiles } = await cleanupExpiredIds();
  if (error) console.error("[auto-cleanup] DB error:", error.message);
  else
    console.log(
      `[auto-cleanup] Purged expired rows & ${deletedFiles} storage file(s)`,
    );
};

runCleanup(); // run once on boot
setInterval(runCleanup, CLEANUP_INTERVAL_MS); // then every 6 hours
```

### `cleanupExpiredIds()` — Enhanced Service Function

```javascript
const cleanupExpiredIds = async () => {
  // 1. Fetch expired rows (need file_url for storage deletion)
  const { data: expired } = await supabase
    .from("generated_ids")
    .select("id, file_url")
    .lt("expires_at", getNow());

  // 2. Delete storage files (best-effort — errors logged, not thrown)
  let deletedFiles = 0;
  for (const row of expired) {
    if (row.file_url) {
      try {
        await deleteFile(row.file_url);
        deletedFiles++;
      } catch (err) {
        console.warn(`Could not delete ${row.file_url}:`, err.message);
      }
    }
  }

  // 3. Delete DB rows
  const { data, error } = await supabase
    .from("generated_ids")
    .delete()
    .lt("expires_at", getNow());

  return { data, error, deletedFiles };
};
```

### Why Every 6 Hours?

| Interval    | Trade-off                                              |
| ----------- | ------------------------------------------------------ |
| 1 hour      | More frequent, but adds unnecessary DB load            |
| **6 hours** | Good balance — max 6 hours of stale files after expiry |
| 24 hours    | Too long — expired files accumulate all day            |

### Manual Cleanup

Admins can also trigger cleanup immediately via:

```
POST /api/admin/cleanup
Authorization: Bearer <admin-token>
```

Returns `{ message, deletedFiles }` with the count of purged storage files.

---

## Utility Functions

```js
// expiryHelper.js exports:
getExpiryDate()   → ISO string 15 days from now
getNow()          → ISO string right now
isExpired(date)   → boolean
EXPIRY_DAYS       → 15 (constant)
```

All date operations use `Date` objects and ISO strings — no external date library needed.
