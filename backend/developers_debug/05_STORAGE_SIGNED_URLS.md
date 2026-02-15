# 05 — Storage & Signed URLs

## Bucket Configuration

| Setting      | Value                                   | Reason                                    |
| ------------ | --------------------------------------- | ----------------------------------------- |
| Bucket name  | `id-cards`                              | Descriptive, matches the domain           |
| Visibility   | **Private**                             | ID cards contain PII — no public access   |
| File format  | PNG                                     | Rendered by `html2canvas` on the frontend |
| Path pattern | `{user_id}/{safe_name}_{timestamp}.png` | Prevents collisions, scoped to user       |

---

## Why Private?

ID card images contain:

- Full name
- Photo
- Date of birth
- Gender
- ID number
- Address (on back)

Making these publicly accessible via a permanent URL would be a **data privacy violation**. Anyone with the link could view the card forever.

---

## How Signed URLs Work

```
1. Backend receives GET /api/ids/my-ids request.
2. Fetches active (non-expired) records from `generated_ids`.
3. For each record's `file_url`, calls:
       supabase.storage
         .from('id-cards')
         .createSignedUrl(filePath, 3600)   // 1 hour TTL
4. Returns the signed URL to the frontend.
5. Frontend uses the signed URL to display / download the image.
6. After 1 hour, the URL expires and becomes a 403.
```

### Signed URL Anatomy

```
https://abc.supabase.co/storage/v1/object/sign/id-cards/userId/card.png
  ?token=eyJhbG...
  &t=2026-02-15T22:30:00.000Z
```

The `token` query parameter contains a short-lived JWT signed by Supabase. When the token expires, the URL is dead.

---

## TTL Choices

| TTL               | Use Case                                                 |
| ----------------- | -------------------------------------------------------- |
| **1 hour** (used) | `GET /my-ids` — user is actively viewing their dashboard |
| 15 minutes        | Suitable for one-time downloads                          |
| 7 days            | Too long — increases risk if link is shared              |

We chose 1 hour because:

- Long enough for the user to view and download cards in a session.
- Short enough that a leaked link expires before meaningful damage.

---

## Service Architecture

```
storageService.js
├── getSignedUrl(filePath)       → single signed URL
├── getSignedUrls(filePaths[])   → parallel batch (Promise.allSettled)
└── deleteFile(filePath)         → remove from bucket
```

`getSignedUrls` uses `Promise.allSettled` (not `Promise.all`) so that one failed URL doesn't crash the entire batch.

---

## Security Notes

- The **service-role client** is used for signing URLs because storage RLS may restrict which keys can generate signed URLs.
- The frontend **never** calls `createSignedUrl` directly — it always goes through the backend.
- If a user's card is expired in `generated_ids`, the backend won't generate a signed URL for it even if the file still exists in storage.
