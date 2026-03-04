# 10 — Token / Credit System (Frontend)

## Overview

The frontend integrates with the backend token API to provide:
1. **Token balance display** on the Dashboard (stat card + header badge)
2. **TokenDashboard page** (`/tokens`) — balance, 30-day sparkline, transaction history
3. **TokenPurchase page** (`/tokens/purchase`) — browse packages, purchase tokens
4. **402 error handling** — graceful UI when insufficient tokens during generation

## Pages

### TokenDashboard (`/tokens`)
- Fetches `/api/tokens/balance`, `/api/tokens/analytics`, `/api/tokens/transactions`
- Displays 3 stat cards: Current Balance, Lifetime Purchased, Lifetime Used
- 30-day usage sparkline chart (bar chart built with flexbox)
- Paginated transaction table with type filters (All, Purchase, Usage, Refund, Bonus)
- "Buy Tokens" button navigates to `/tokens/purchase`

### TokenPurchase (`/tokens/purchase`)
- Fetches `/api/tokens/packages` (public endpoint, no auth needed)
- Displays package cards in a grid (price, token count, price-per-token)
- "Best Value" badge on the middle package
- Purchase button calls `POST /api/tokens/purchase` with `packageId`
- Shows updated balance after purchase
- Custom/enterprise CTA section at bottom

## Dashboard Integration

The main Dashboard (`/dashboard`) includes:
- **Token Balance stat card** — 4th card in the stats grid, links to `/tokens`
- **"Tokens (N)" header button** — amber-colored, shows current balance in the button text
- Balance is fetched during `loadDashboardData()` via `/api/tokens/balance`
- Gracefully handles missing balance (shows "—" dash)

## Generation Flow Token Handling

The `BulkGenerator` component and other generation UIs don't directly handle tokens — the backend enforces token deduction. However, the frontend should:

1. **Pre-check balance** before starting generation (optional UX improvement)
2. **Handle 402 responses** from generation endpoints with a clear error message
3. **Show remaining balance** after generation completes

Currently, token enforcement is 100% server-side:
- Backend deducts tokens before card generation
- Backend refunds automatically on failure
- Frontend receives 402 status code if insufficient tokens

## API Calls

| Endpoint | Method | Auth | Used In |
|----------|--------|------|---------|
| `/api/tokens/balance` | GET | JWT | Dashboard, TokenDashboard |
| `/api/tokens/analytics` | GET | JWT | TokenDashboard |
| `/api/tokens/transactions` | GET | JWT | TokenDashboard |
| `/api/tokens/packages` | GET | None | TokenPurchase |
| `/api/tokens/purchase` | POST | JWT | TokenPurchase |

## Routes (App.jsx)

```jsx
<Route path="/tokens" element={<ProtectedRoute><TokenDashboard /></ProtectedRoute>} />
<Route path="/tokens/purchase" element={<ProtectedRoute><TokenPurchase /></ProtectedRoute>} />
```

## Error Handling

When a generation endpoint returns **402 Payment Required**:
```json
{
  "error": "Insufficient tokens. Required: 10, Available: 3",
  "code": "INSUFFICIENT_TOKENS",
  "required": 10,
  "available": 3
}
```

The frontend should display an error message and link to the purchase page.

## Future Enhancements

- **Stripe / Razorpay integration** — replace the mock purchase flow with real payments
- **Pre-flight balance check** in BulkGenerator before starting generation
- **Real-time balance updates** via Supabase Realtime subscription
- **Token usage notifications** — warn when balance is low
