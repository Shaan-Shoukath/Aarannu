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

## Cleanup (Optional)

Expired rows remain in the database until explicitly removed. The `/api/admin/cleanup` endpoint deletes them:

```js
const cleanupExpiredIds = async () => {
  return supabase
    .from("generated_ids")
    .delete()
    .lt("expires_at", new Date().toISOString());
};
```

This can be:

- Called manually by an admin.
- Triggered by a cron job (e.g. Railway Cron, Render Cron, GitHub Actions).
- Run as a Supabase Edge Function on a schedule.

### Example Cron (Railway / Render)

```bash
# Every day at 3 AM UTC
0 3 * * * curl -X POST https://your-backend.com/api/admin/cleanup \
  -H "Authorization: Bearer <admin-token>"
```

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
