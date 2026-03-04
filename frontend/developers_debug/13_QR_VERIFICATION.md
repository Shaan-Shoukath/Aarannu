# 13 – QR Verification System

## Overview

Every generated card includes a QR code that links to a public verification page. Anyone can scan the QR code to verify the card's authenticity and validity.

---

## Flow

```
User scans QR code → /verify/:cardId
Frontend calls → GET /api/verify/:cardId (public, no auth)
Backend returns → member name, org, photo, validity, expiry
Frontend displays → verification result (valid/expired/revoked)
```

---

## QR Data

The QR code on each card encodes the **card UUID**. This UUID is the `generated_cards.id` field.

```
QR Content: "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
→ Frontend resolves to: /verify/a1b2c3d4-e5f6-7890-abcd-ef1234567890
```

---

## Verification API

```
GET /api/verify/:cardId
```

**Response:**

```json
{
  "valid": true,
  "status": "active",
  "expired": false,
  "member": {
    "name": "John Doe",
    "email": "john@example.com",
    "photo_url": "https://...",
    "custom_fields": {}
  },
  "organization": {
    "name": "Acme University",
    "logo_url": "https://...",
    "slug": "acme-university"
  },
  "project": {
    "name": "Student IDs 2026",
    "type": "service"
  },
  "expires_at": "2027-01-01T00:00:00Z",
  "issued_at": "2026-01-01T00:00:00Z"
}
```

**Validity Logic:**

- `valid = true` if card is NOT expired AND NOT revoked
- `expired = true` if `expires_at < now()`
- `status` can be: `active`, `revoked`, `expired`

---

## Files

| File                                          | Purpose                   |
| --------------------------------------------- | ------------------------- |
| `backend/src/controllers/verifyController.js` | Verification logic        |
| `backend/src/routes/verifyRoutes.js`          | Public route              |
| `frontend/src/pages/VerifyCard.jsx`           | Verification display page |
