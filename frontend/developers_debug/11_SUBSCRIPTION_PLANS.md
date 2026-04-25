# 11 – Subscription Plans

## Overview

Organizations operate on tiered subscription plans that enforce limits on members, projects, storage, and API rates.

---

## Plan Tiers

| Plan       | Members   | Projects  | Storage   | Rate Limit | Price  |
| ---------- | --------- | --------- | --------- | ---------- | ------ |
| Free       | 50        | 3         | 500 MB    | 60 RPM     | $0     |
| Starter    | 500       | 10        | 2 GB      | 120 RPM    | $29/mo |
| Pro        | 5,000     | 50        | 10 GB     | 300 RPM    | $99/mo |
| Enterprise | Unlimited | Unlimited | Unlimited | Unlimited  | Custom |

---

## Database

```sql
-- Reference table (seeded in migration 002)
CREATE TABLE public.subscription_plans (
  id             TEXT PRIMARY KEY,    -- 'free','starter','pro','enterprise'
  display_name   TEXT NOT NULL,
  max_members    INT,                 -- NULL = unlimited
  max_projects   INT,
  max_storage_mb INT,
  rate_limit_rpm INT,
  price_monthly  NUMERIC(10,2)
);
```

Organizations reference plans via `organizations.plan` → `subscription_plans.id`.

---

## Enforcement

### Middleware: `checkPlanLimits.js`

```js
// Usage in routes:
router.post("/", verifyToken, checkPlanLimits("members"), controller);
router.post("/", verifyToken, checkPlanLimits("projects"), controller);
```

Checks current count against plan limit before allowing the operation. Returns HTTP 403 with `PLAN_LIMIT_*` error code if exceeded.

### Behavior

- **Fails open**: If plan check errors occur, the request proceeds (to avoid blocking)
- **NULL = unlimited**: Enterprise plan has NULL limits
- **Expired plans**: Treated as free tier

---

## Files

| File                                        | Purpose                          |
| ------------------------------------------- | -------------------------------- |
| `backend/migrations/000_full_setup.sql`     | Plan table + seed data (Step 2)  |
| `backend/src/middleware/checkPlanLimits.js` | Limit enforcement                |
