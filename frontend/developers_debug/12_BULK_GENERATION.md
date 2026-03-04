# 12 – Bulk Generation Pipeline

## Overview

The Bulk product is designed for events where an organizer needs to generate hundreds of ID cards at once using Google Sheets import or form submissions.

---

## Workflow

```
Organizer creates bulk project
→ Organizer imports Google Sheets data (POST /api/bulk/import)
→ Members auto-approved on import
→ Organizer clicks "Generate All" (POST /api/bulk/generate)
→ System generates cards in batches of 50
→ Cards uploaded to Supabase Storage
→ Emails sent to members (queued)
→ Organizer downloads ZIP archive
```

---

## API Routes

| Method | Route                           | Auth | Purpose                   |
| ------ | ------------------------------- | ---- | ------------------------- |
| `POST` | `/api/bulk/import/:projectId`   | ✅   | Import members from array |
| `POST` | `/api/bulk/generate/:projectId` | ✅   | Batch generate all cards  |
| `GET`  | `/api/bulk/status/:projectId`   | ✅   | Generation progress/stats |

---

## Batch Processing

Cards are generated in batches of 50 (`BATCH_SIZE` in `generateService.js`) to prevent:

- Memory exhaustion from html2canvas
- Supabase rate limiting
- Browser tab crashes

Each batch:

1. Creates `generated_cards` DB records with file paths
2. The frontend renders cards and uploads PNGs
3. Records are updated with final status

---

## Import Format

The import endpoint accepts an array of member objects:

```json
{
  "members": [
    {
      "name": "John Doe",
      "email": "john@example.com",
      "photo_url": "https://...",
      "custom_fields": {
        "department": "Engineering",
        "role": "Speaker"
      }
    }
  ]
}
```

Members are auto-approved on import (status = "approved").
Member limit is enforced before import.

---

## Files

| File                                           | Purpose                            |
| ---------------------------------------------- | ---------------------------------- |
| `backend/src/routes/bulkRoutes.js`             | Import, generate, status endpoints |
| `backend/src/services/generateService.js`      | Batch card record creation         |
| `backend/src/services/projectMemberService.js` | Bulk insert members                |
| `frontend/src/pages/BulkDashboard.jsx`         | Organizer dashboard                |
