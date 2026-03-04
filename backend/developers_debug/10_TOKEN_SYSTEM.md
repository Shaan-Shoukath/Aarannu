# 10 — Token / Credit System

## Overview

The token system adds **usage-based billing** to Community ID. Every ID card generation costs **1 token**. Users pre-purchase tokens via packages and the balance is tracked per-user (or per-org for multi-tenant usage).

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│  Request → verifyToken → checkTokens(N) → Controller        │
│                                              │               │
│                              deductTokens(userId, N)         │
│                                    │                         │
│                   ┌────────────────┴────────────┐            │
│                   │  token_wallets (balance)     │            │
│                   │  token_transactions (ledger) │            │
│                   └─────────────────────────────┘            │
│                                                              │
│  On failure:  refundTokens(userId, N) → auto-refund          │
└──────────────────────────────────────────────────────────────┘
```

## Database Tables

### token_wallets
| Column | Type | Description |
|--------|------|-------------|
| id | UUID (PK) | Auto-generated |
| user_id | UUID (FK→auth.users) | Wallet owner |
| org_id | UUID (FK→organizations) | Null = personal wallet |
| balance | INTEGER | Current token balance (≥ 0) |
| lifetime_purchased | INTEGER | Total tokens ever purchased |
| lifetime_used | INTEGER | Total tokens ever used |
| created_at | TIMESTAMPTZ | Auto |
| updated_at | TIMESTAMPTZ | Auto (trigger) |

**Unique constraint:** `(user_id, org_id)` — one wallet per user per org.

### token_transactions
Immutable ledger of all token movements.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID (PK) | Auto-generated |
| wallet_id | UUID (FK→token_wallets) | Associated wallet |
| user_id | UUID (FK→auth.users) | Who performed the action |
| org_id | UUID | Org context (nullable) |
| amount | INTEGER | Positive = credit, negative = debit |
| type | TEXT | `purchase`, `usage`, `refund`, `bonus`, `adjustment` |
| description | TEXT | Human-readable reason |
| reference_id | TEXT | Link to card ID, webhook ID, payment ID |
| balance_after | INTEGER | Snapshot of balance post-transaction |
| created_at | TIMESTAMPTZ | Auto |

### token_packages
Purchasable bundles.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID (PK) | Auto-generated |
| name | TEXT | Package name (e.g., "Starter") |
| tokens | INTEGER | Number of tokens |
| price_cents | INTEGER | Price in cents (USD) |
| currency | TEXT | Default: USD |
| description | TEXT | Marketing description |
| is_active | BOOLEAN | Show in purchase UI |
| sort_order | INTEGER | Display ordering |

**Default packages:** Starter (100/$4.99), Growth (500/$19.99), Enterprise (2000/$59.99).

## Service Layer — `tokenService.js`

| Function | Description |
|----------|-------------|
| `getOrCreateWallet(userId, orgId?)` | Get or auto-create a wallet |
| `getBalance(userId, orgId?)` | Current balance |
| `deductTokens(userId, amount, desc, refId?, orgId?)` | Debit with optimistic lock |
| `addTokens(userId, amount, type, desc, refId?, orgId?)` | Credit (purchase/bonus) |
| `refundTokens(userId, amount, desc, refId?, orgId?)` | Credit back on failure |
| `getTransactions(userId, opts)` | Paginated history with filters |
| `getAnalytics(userId, orgId?)` | 30-day usage stats |
| `getPackages()` | List active purchasable packages |

### Optimistic Locking

`deductTokens` uses an optimistic lock pattern:
```sql
UPDATE token_wallets SET balance = $new
WHERE id = $id AND balance = $old_balance
```
If another request changed the balance between read and write, the update affects 0 rows and the request fails with `RACE_CONDITION`.

## Middleware — `checkTokens.js`

Pre-flight balance check before controllers run. Supports three modes:

```js
checkTokens(5)                           // Fixed amount
checkTokens('body.members.length')       // Dot-path resolved from req
checkTokens((req) => req.body.count)     // Function
```

Returns **402 Payment Required** if insufficient:
```json
{ "error": "Insufficient tokens...", "code": "INSUFFICIENT_TOKENS", "required": 10, "available": 3 }
```

**Fail-open policy:** On transient DB errors, the middleware logs and allows the request through so the service isn't blocked.

## Integration Points

| Endpoint | File | Tokens Cost | Auto-Refund |
|----------|------|-------------|-------------|
| POST /api/ids/generate | idController.js | `members.length` | Yes (DB fail) |
| POST /api/webhook/:id | webhookController.js | 1 per submission | Yes (render/upload/DB fail) |
| POST /api/generate/:projectId | generateController.js | # members needing cards | Yes (generation fail, over-deduction) |
| POST /api/generate/:memberId/single | generateController.js | 1 | Yes (fail or already existing) |
| POST /api/bulk/generate/:projectId | bulkRoutes.js | # members needing cards | Yes (generation fail, over-deduction) |

## API Endpoints — `/api/tokens/*`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | /packages | Public | List active token packages |
| GET | /balance | JWT | Current wallet balance |
| GET | /transactions | JWT | Paginated transaction history |
| GET | /analytics | JWT | 30-day usage analytics |
| POST | /purchase | JWT | Purchase a token package |
| POST | /add | JWT (admin) | Manually add tokens |

## RLS Policies

| Table | Policy | Rule |
|-------|--------|------|
| token_wallets | Users view own | `auth.uid() = user_id` |
| token_wallets | Service role all | `auth.role() = 'service_role'` |
| token_transactions | Users view own | `auth.uid() = user_id` |
| token_transactions | Service role all | `auth.role() = 'service_role'` |
| token_packages | Anyone reads active | `is_active = true` |
| token_packages | Service role all | `auth.role() = 'service_role'` |

## Failure Safety

1. **Pre-check:** `checkTokens` middleware verifies balance before the controller runs.
2. **Deduct-first:** Tokens are deducted before card generation begins.
3. **Auto-refund:** If generation fails (render error, upload error, DB error), tokens are automatically refunded.
4. **Over-deduction refund:** If fewer cards were generated than deducted (race between count and generation), the difference is refunded.
5. **Optimistic lock:** Prevents double-spending from concurrent requests.

## Migration

Run `backend/migrations/003_token_system.sql` in the Supabase SQL Editor:
- Creates `token_wallets`, `token_transactions`, `token_packages` tables
- Seeds 3 default packages
- Enables RLS with appropriate policies
- Adds indexes for performance
