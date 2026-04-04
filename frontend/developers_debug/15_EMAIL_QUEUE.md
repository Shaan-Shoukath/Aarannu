# 15 - Email Delivery Orchestration (Browser -> Backend Brevo)

## Naming note

This file keeps the historical name "Email Queue", but the current implementation is not a durable backend queue.

It is a browser-orchestrated send loop:

- PDFs are generated in the client
- the client converts each PDF to base64
- the client calls the backend mail endpoint
- the backend sends through Brevo using the secret API key

That distinction is extremely important for debugging and for future planning.

---

## The real flow today

```text
BulkGenerator creates PDF blob in browser
-> PDF blob is stored in memory in pdfBlobsRef
-> operator enables sendEmail for selected members
-> handleEmailCards() loops through selected entries
-> browser POSTs pdfBase64 to /api/email/send-card
-> backend/emailController.js sends via Brevo
-> UI updates per-recipient status
```

---

## Why the PDF is not emailed directly from the browser

Brevo requires a secret API key.

That means the frontend must never call Brevo directly. If it did:

- the API key would be exposed
- anyone with browser devtools could steal it
- email sending could be abused outside the product

So the browser generates the file, but the backend performs the actual transactional email call.

---

## Frontend responsibilities

`BulkGenerator.jsx` owns:

- deciding who should get emailed
- tracking progress
- converting `Blob -> base64`
- attaching the correct filename and recipient metadata
- surfacing failures inline in the generation results panel

Relevant logic:

```js
const entries = Object.values(pdfBlobs).filter(
  (e) => e.member?.sendEmail && e.member?.email?.trim(),
);
```

Then, per member:

```js
const arrayBuf = await blob.arrayBuffer();
const base64 = btoa(
  new Uint8Array(arrayBuf).reduce(
    (data, byte) => data + String.fromCharCode(byte),
    "",
  ),
);
```

That encoded value is then sent to the backend.

---

## Backend responsibilities

`backend/src/controllers/emailController.js` owns:

- request validation
- checking `BREVO_API_KEY`
- sender identity selection
- attachment naming
- calling Brevo's SMTP API

Core backend input contract:

```json
{
  "recipientEmail": "member@example.com",
  "recipientName": "Jane Doe",
  "pdfBase64": "<base64 string>",
  "fileName": "Jane_Doe_ID.pdf",
  "orgName": "Aarannu"
}
```

The backend does not generate the PDF in this path.
It simply validates and sends the file it receives.

---

## Why this is called orchestration instead of queuing

True queues usually provide:

- persistence
- retries after process restarts
- dead-letter handling
- background workers
- rate shaping independent of the browser

The current flow provides:

- sequential browser-side sends
- progress UI
- per-recipient status
- no persistence once the tab closes

So this is better described as:

- browser-controlled delivery pipeline
- transient client-side job queue

---

## Comparison: current browser loop vs real backend queue

| Concern | Current browser loop | Durable backend queue |
| --- | --- | --- |
| Survives tab close | No | Yes |
| Keeps Brevo secret safe | Yes | Yes |
| Easy to debug visually | Yes | Usually less direct |
| Needs worker infrastructure | No | Yes |
| Good for admin-triggered batches | Yes | Yes |
| Good for unattended automation | No | Yes |

---

## Why the current design is still useful

For many admin workflows, this design is enough:

- the admin is already in the UI
- the generated PDF already exists in browser memory
- the app can show exactly which recipient failed
- the backend stays simpler than a full job system

This avoids prematurely building:

- a job broker
- retry workers
- status polling endpoints
- job persistence tables

---

## Current failure modes

Because this is browser-driven, these are the main failure cases:

1. the admin closes the tab mid-send
2. network drops while the browser is uploading `pdfBase64`
3. Brevo rejects the email
4. the PDF was generated successfully, but the email send fails afterward

The UI intentionally separates these outcomes.

That is why a row can show:

- card generation success
- email failure

instead of collapsing the entire workflow into one pass/fail result.

---

## Why this matters for approval-triggered delivery

If the product requirement is:

"The moment an organization admin clicks approve, generate the PDF and email it automatically"

then there are two different interpretations:

### Interpretation A: automatic while the admin browser is open

This is possible with a client-driven flow.

Sequence:

1. admin approves member
2. frontend receives approved member + project context
3. frontend generates PDF
4. frontend calls `/api/email/send-card`

### Interpretation B: automatic even after the browser is gone

This is not possible with a purely client-side generation model.

Once the browser closes, the frontend job disappears.

That is the core architectural tradeoff.

---

## External setup required

This flow depends on backend environment variables:

- `BREVO_API_KEY`
- `BREVO_SENDER_EMAIL`
- `BREVO_SENDER_NAME`

Without them:

- PDF generation still works in the browser
- ZIP download still works
- email delivery fails or is skipped

So email should be treated as an additional delivery channel, not as proof that generation succeeded.

---

## Key takeaway

The current email subsystem is intentionally split:

- frontend owns document creation and per-recipient orchestration
- backend owns the secret mail provider integration

That split is the reason Aarannu can keep PDF generation mostly client-side without exposing Brevo credentials.
