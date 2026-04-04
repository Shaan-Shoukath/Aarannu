# 12 - Bulk Generation Pipeline (Frontend-Driven)

## Why this document matters

This file explains the actual generation pipeline running in the browser today.
Older notes in this folder described a more server-heavy flow. The current implementation is intentionally more frontend-driven:

- the browser assembles the card payload
- the browser generates the PDF
- the browser optionally uploads the generated asset
- the browser optionally asks the backend to send that PDF through Brevo

That split matters because it determines what can happen automatically and what still requires an active admin/operator tab.

---

## High-level model

`BulkGenerator.jsx` is the orchestration component. It is not just a "button + progress bar" component. It acts like a lightweight client-side job runner.

```text
Admin opens Generate page
-> members are loaded into the browser
-> BulkGenerator filters queue (range + cap + daily limits)
-> for each member:
   -> build render payload
   -> generate PDF in browser
   -> optionally upload artifact to Supabase
   -> store PDF blob in memory for optional email step
-> zip all generated PDFs
-> download ZIP locally
-> if email toggles are enabled:
   -> POST each PDF to backend /api/email/send-card
```

---

## Core file ownership

| File | Responsibility |
| --- | --- |
| `frontend/src/components/BulkGenerator.jsx` | Main queue runner, progress tracking, ZIP generation, email handoff |
| `frontend/src/utils/cardPdfSupport.js` | Chooses the best PDF path: pure browser or backend-assisted fallback |
| `frontend/src/utils/pdfCardRenderer.js` | Client-side PDF renderer |
| `frontend/src/pages/Generate.jsx` | Builds the member payloads, styling config, and hands them to `BulkGenerator` |
| `backend/src/controllers/emailController.js` | Sends already-generated PDFs through Brevo |

---

## The queue runner in `BulkGenerator.jsx`

The most important function is `handleGenerate()`.

Its responsibilities are:

1. Filter the generation list.
2. Enforce queue size and daily usage limits.
3. Generate a PDF per member.
4. Optionally upload the generated file to Supabase.
5. Build a ZIP archive of PDFs.
6. Optionally trigger email delivery for members with `sendEmail = true`.

Conceptually it works like this:

```js
for (const member of filteredMembers) {
  const pdfBlob = await renderCardPdf(member);
  zip.folder("id-cards").file(fileName, pdfBlob);
  pdfBlobsRef.current[resultKey] = { blob: pdfBlob, member };

  if (uploadToCloud) {
    await supabase.storage.from("id-cards").upload(filePath, pdfBlob);
    await supabase.from("generated_ids").insert({ user_id, file_url: filePath });
  }
}
```

This is an important architectural choice:

- the browser owns the heavy rendering work
- the backend does not need to generate every bulk PDF itself
- the admin sees progress in real time
- failure can be shown per member instead of as one opaque server job

---

## Range filtering and per-person caps

Before generation begins, the component filters members using:

- `rangeStart`
- `rangeEnd`
- `perPersonCap`

This logic exists because large event imports often contain duplicates or "generate only rows 101-200" operational needs.

The relevant helper is `getFilteredMembers()`.

It first slices by range, then applies a duplicate-name cap:

```js
const sliced = members.slice(start, end);

if (!perPersonCap || perPersonCap <= 0) return sliced;

const nameCount = {};
return sliced.filter((m) => {
  const key = (m.name || "").trim().toLowerCase();
  nameCount[key] = (nameCount[key] || 0) + 1;
  return nameCount[key] <= perPersonCap;
});
```

Why this matters:

- it keeps the UI responsive for large batches
- it prevents accidental over-generation
- it gives admins operational control without changing the backend

---

## PDF generation path selection

The browser does not always use the exact same renderer.

`renderCardPdfWithBestSupport(payload)` in `cardPdfSupport.js` chooses between:

- pure client-side PDF generation via `generateCardPdf(payload)`
- backend-assisted rendering via `/api/render/card`

Current logic:

```js
export async function renderCardPdfWithBestSupport(payload) {
  if (!needsBrowserRenderedPdf(payload)) {
    return generateCardPdf(payload);
  }

  return renderPdfViaBackend(payload);
}
```

Despite the slightly confusing helper name, the intent is:

- use local rendering for normal cases
- fall back to the backend when content includes edge cases such as Malayalam text or SVG assets

### Why a fallback exists

Pure client-side generation is faster to iterate on and cheaper to host, but some fonts and asset combinations are more reliable in a real browser rendering context controlled by the backend render route.

### If the product moves to strict client-only rendering

Then the backend render fallback becomes a migration target. That would require:

1. improving the browser renderer until it can cover those edge cases
2. removing or deprecating `/api/render/card`
3. updating docs and operational expectations so `FRONTEND_URL` is no longer part of the PDF pipeline

---

## Upload behavior

Bulk generation does not require cloud upload to succeed in order to complete local generation.

That is a deliberate resilience choice.

The flow is:

1. generate the PDF locally
2. add it to the ZIP immediately
3. try cloud upload if `uploadToCloud` is enabled
4. record upload warnings separately from generation success

This means the admin still gets the downloadable ZIP even when:

- Supabase Storage is temporarily failing
- the insert into `generated_ids` fails
- network connectivity becomes unstable

That is why result rows may show success plus a `cloudWarning`.

---

## Membership ID persistence

Bulk generation also writes membership IDs back to `project_members.custom_fields` when the queue originated from approved project members.

This is handled by `persistProjectMembershipIds()`.

Why this exists:

- exported CSVs should reflect the same membership IDs that were printed on generated cards
- downstream admin tooling should not treat card output and project data as separate realities

Conceptual snippet:

```js
await supabase
  .from("project_members")
  .update({
    custom_fields: {
      ...(member.projectCustomFields || {}),
      membership_id: member.id_number,
    },
  })
  .eq("id", member.projectMemberId);
```

---

## ZIP assembly

The ZIP output is created in-browser using `JSZip`.

Important points:

- generation happens per member
- zipping happens after the individual PDFs exist
- the ZIP file is downloaded locally using `file-saver`

This keeps the user's browser as the primary output environment.

Why not upload the ZIP first and then download it?

- it adds unnecessary round trips
- it increases backend storage and cleanup burden
- it makes operator feedback slower

---

## Email handoff after generation

Bulk email is not a backend queue today. It is a browser-driven loop.

After generation, `handleEmailCards()` iterates over PDFs stored in memory and sends them one by one to `/api/email/send-card`.

```js
const res = await fetch(`${backendUrl}/api/email/send-card`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    recipientEmail: member.email.trim(),
    recipientName: member.name,
    pdfBase64: base64,
    fileName: safeFileName(member.name, i, "pdf"),
    orgName: orgName || "Community ID",
  }),
});
```

That means:

- the browser generates the binary
- the backend keeps the Brevo secret
- the browser remains responsible for sequencing and progress UI

---

## Comparison: browser-driven vs server-driven bulk generation

| Concern | Browser-driven pipeline | Server-driven pipeline |
| --- | --- | --- |
| Rendering cost | Paid by the admin's machine | Paid by backend CPU/RAM |
| Progress visibility | Excellent, immediate | Usually requires polling |
| Secret handling | Safe, because Brevo stays on backend | Safe |
| "Fire and forget" automation | Weak | Strong |
| Large batch reliability | Depends on keeping tab open | Depends on worker infrastructure |
| Deployment complexity | Lower | Higher |

### Why the current code leans browser-driven

- the card preview and card output stay close to the same UI layer
- rendering bugs are easier to reproduce during development
- the platform avoids turning PDF generation into a mandatory backend compute workload

### Main limitation

If the browser tab closes, the client job stops.

That limitation becomes especially important for approval-triggered automatic delivery. The frontend can automate while a trusted operator is online, but not as a detached background worker.

---

## Key takeaway

`BulkGenerator.jsx` is effectively a client-side batch processor.

The logic is intentionally split like this:

- frontend: render, zip, progress, retry surface, optional upload, optional email orchestration
- backend: secrets, email provider access, verification records, storage APIs, auth boundaries

That split is the most important mental model for understanding the current Aarannu generation pipeline.
