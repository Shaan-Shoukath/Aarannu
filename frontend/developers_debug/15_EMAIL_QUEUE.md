# 15 – Email Queue System

## Overview

When ID cards are generated, emails are sent to members with their card PDF, a download link, and a QR verification link. Emails are queued to prevent rate spikes.

---

## Email Content

Each email includes:

- **PDF attachment**: The generated ID card as a PDF
- **Download link**: Signed URL to download the card image
- **QR verification link**: `/verify/:cardId`
- **Expiry date**: When the card will expire

---

## Queue Strategy

To prevent rate limiting from email providers:

1. Emails are batched (max 10 per second)
2. Failed sends are logged and retried
3. The existing `emailController.js` handles the actual sending

---

## Integration

The email flow is triggered after card generation:

```
Card generated → Upload to Storage → DB record created → Email queued
```

The existing email infrastructure in `backend/src/controllers/emailController.js` and `backend/src/routes/emailRoutes.js` is reused. The new generation pipeline calls into the existing email service.

---

## Files

| File                                            | Purpose                         |
| ----------------------------------------------- | ------------------------------- |
| `backend/src/controllers/emailController.js`    | Email sending (existing)        |
| `backend/src/routes/emailRoutes.js`             | Email routes (existing)         |
| `backend/src/controllers/generateController.js` | Triggers email after generation |
