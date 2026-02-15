# 05 – Storage Flow

## Overview

Generated ID card images are stored in **Supabase Storage**, which is an S3-compatible object storage service. Files are NOT publicly accessible — they require **signed URLs** for access.

---

## Bucket Configuration

### Bucket: `id-cards`

| Setting                | Value          | Reason                                      |
| ---------------------- | -------------- | ------------------------------------------- |
| **Name**               | `id-cards`     | Descriptive, matches the use case           |
| **Public**             | `false`        | Files should NOT be accessible without auth |
| **File size limit**    | 5 MB (default) | ID card PNGs are typically 200-500 KB       |
| **Allowed MIME types** | `image/png`    | Only PNG uploads are allowed                |

### How to create the bucket:

1. Go to Supabase Dashboard → Storage.
2. Click "New Bucket".
3. Name: `id-cards`
4. **Uncheck** "Public bucket".
5. Save.

---

## Private vs Public Buckets

| Feature    | Public Bucket                                                      | Private Bucket (used here)                |
| ---------- | ------------------------------------------------------------------ | ----------------------------------------- |
| Access     | Anyone with the URL                                                | Only authenticated users with signed URLs |
| URL format | `https://project.supabase.co/storage/v1/object/public/bucket/file` | Signed URL with token parameter           |
| Security   | None                                                               | Signed URL has expiry time                |
| Use case   | Logos, public assets                                               | User-specific files, sensitive documents  |

### Why private?

ID cards contain **personal information** (name, photo, ID number). Making them publicly accessible would be a privacy violation. A private bucket with signed URLs ensures:

- Only the authenticated owner can access their files.
- URLs expire after a set time (1 hour in our case).
- No permanent direct link exists.

---

## File Path Convention

Files are stored using this structure:

```
id-cards/
  └── {user_uuid}/
       ├── John_Doe_1707984000000.png
       ├── Jane_Smith_1707984001000.png
       └── Alex_Morgan_1707984002000.png
```

### Pattern: `{user_id}/{safe_name}_{timestamp}.png`

- **`{user_id}`** — The authenticated user's UUID. Used by storage RLS policies to restrict access.
- **`{safe_name}`** — The member's name with non-alphanumeric characters replaced by underscores. Prevents path traversal attacks.
- **`{timestamp}`** — `Date.now()` ensures uniqueness even if the same name is used multiple times.

### Why this structure?

- **Security:** Storage policies check that `foldername(path)[1]` matches `auth.uid()`. This means user A cannot upload to or read from user B's folder.
- **Organization:** Easy to browse in the Supabase dashboard.
- **No collisions:** Timestamp ensures unique filenames.

---

## Upload Flow

```
IDCard rendered (off-screen)
    │
    ▼
html2canvas(cardRef.current, { scale: 2, useCORS: true })
    │
    ▼
canvas.toBlob(resolve, 'image/png', 1.0)
    │
    ▼
supabase.storage.from('id-cards').upload(filePath, blob, {
  contentType: 'image/png',
  upsert: false            // Fail if file already exists
})
    │
    ▼
supabase.from('generated_ids').insert({
  user_id: userId,
  file_url: filePath,       // Relative path, NOT full URL
  expires_at: now + 15 days
})
```

### Key details:

1. **`scale: 2`** — html2canvas renders at 2× resolution for crisp output (effectively 1000px wide for a 500px card).
2. **`useCORS: true`** — Allows html2canvas to capture cross-origin images (if photo URLs are on external domains).
3. **`upsert: false`** — Prevents overwriting existing files. If a file with the same name exists, the upload fails. Since we use timestamps, this is virtually impossible.
4. **`contentType: 'image/png'`** — Explicitly sets the MIME type for proper browser rendering.

---

## Signed URL Generation

When a user wants to view or download an ID card:

```javascript
const { data, error } = await supabase.storage
  .from("id-cards")
  .createSignedUrl(filePath, 60 * 60); // 3600 seconds = 1 hour

// Result: https://project.supabase.co/storage/v1/object/sign/id-cards/user-uuid/file.png?token=...
```

### Parameters:

- **`filePath`** — The relative path stored in `generated_ids.file_url`.
- **`60 * 60`** — Expiry time in seconds (1 hour). After this, the URL stops working.

### Why 1 hour?

- Long enough for the user to download/share.
- Short enough to limit exposure if the URL is leaked.
- The user can always generate a new signed URL by clicking the download button again.

---

## Download Implementation

```javascript
const handleDownload = async (filePath, fileName) => {
  const url = await getSignedUrl(filePath);
  if (!url) return;

  // Create a temporary anchor element to trigger download
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName || "id-card.png";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
};
```

This approach:

- Uses the `download` attribute to suggest a filename.
- Doesn't navigate away from the page.
- Works in all modern browsers.
