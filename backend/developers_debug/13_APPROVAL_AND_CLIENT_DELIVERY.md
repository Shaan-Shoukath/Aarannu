# 13 - Approval, Verification Links, and Client-Generated Card Delivery

## Purpose

This document explains the backend boundary for one of the most important product decisions:

- membership approval stays authoritative on the backend
- verification records stay authoritative on the backend
- email provider secrets stay on the backend
- card/PDF generation is intended to remain client-driven where possible

This is the cleanest way to understand why some responsibilities cannot move fully into the frontend and why some cannot stay fully on the backend without increasing infrastructure complexity.

---

## The backend's job in the approval flow

The backend is the source of truth for organization registration approval.

For service-style project registrations, the approval sequence lives in:

- `backend/src/controllers/projectMemberController.js`
- `backend/src/services/projectMemberService.js`
- `backend/src/services/generateService.js`

Current approval path:

```text
PATCH /api/members/:id/approve
-> memberService.approveMember(id)
-> notifyApprovedMembers([member])
-> getProjectContext(projectId)
-> getCardMapForMembers(project, [member.id])
-> generateService.createCardRecords(...)
-> generateService.getActiveCardsForMembers(...)
-> sendApprovalEmail(member, project, orgName, card)
```

Bulk approval follows the same shape with multiple members.

---

## What the backend stores vs what it renders

The backend absolutely must own:

- approval status
- verification card IDs
- expiry timestamps
- organization/project association
- Brevo secrets

The backend does not need to own every binary rendering step if the product wants client-side generation.

That separation is the core design boundary.

### Backend-owned artifacts

| Artifact | Why backend owns it |
| --- | --- |
| `project_members.status` | Approval is a trust decision, not a UI preference |
| `generated_cards.id` / `qr_data` | Verification IDs must be durable and authoritative |
| `expires_at` | Expiry logic must be consistent across clients |
| Brevo credentials | Secrets cannot live in the browser |

### Client-owned artifacts

| Artifact | Why frontend can own it |
| --- | --- |
| PDF binary | Rendering is presentation-heavy and close to preview logic |
| ZIP assembly | Best done interactively for operator workflows |
| Per-recipient send progress UI | Easier to present live in browser |

---

## Current approval controller responsibilities

`projectMemberController.js` does three major things during approval:

1. updates the member status
2. ensures a card record exists
3. sends a notification email with a verification link

Key helper:

```js
const getCardMapForMembers = async (project, memberIds = []) => {
  await generateService.createCardRecords(
    project.org_id,
    project.id,
    project.expiry_days || 365,
    memberIds,
  );

  const { cards } = await generateService.getActiveCardsForMembers(
    project.id,
    memberIds,
  );

  return new Map(
    (cards || []).map((card) => [
      card.member_id,
      {
        ...card,
        verificationUrl: buildVerificationUrl(card.id),
      },
    ]),
  );
};
```

This is backend-owned because:

- card IDs must not depend on browser state
- verification URLs must be stable and reproducible
- the backend needs a trustworthy link even if no PDF is attached yet

---

## Why card record creation is backend-owned

`generateService.createCardRecords()` does not render the PDF.
It creates durable metadata records.

That is an important distinction.

It inserts records into `generated_cards` containing:

- `id`
- `org_id`
- `project_id`
- `member_id`
- `file_path`
- `qr_data`
- `status`
- `expires_at`

Why this belongs on the backend:

- IDs must be unique and authoritative
- verification must not depend on whichever browser happened to generate a PDF
- approval email links need to exist even before any file attachment strategy is finalized

---

## Verification links

The approval email currently builds verification links using:

```js
const buildVerificationUrl = (cardId) => `${FRONTEND_URL}/verify/${cardId}`;
```

That means `FRONTEND_URL` remains important even in a client-generated PDF strategy.

Why:

- the backend sends the email
- the backend constructs the link
- the email needs an absolute URL

So even if PDF rendering becomes strictly client-only, `FRONTEND_URL` is still required for link generation unless another absolute URL strategy replaces it.

---

## Current mail split

There are two related but distinct mail paths in the backend:

### 1. Approval notification mail

In `projectMemberController.js`, `sendApprovalEmail()` sends a styled HTML approval message.

Current payload includes:

- approval confirmation
- project name
- organization name
- verification link when a card record exists

This path does not currently generate the PDF itself.

### 2. Attachment mail endpoint

In `backend/src/controllers/emailController.js`, `sendCard()` accepts:

- `recipientEmail`
- `recipientName`
- `pdfBase64`
- `fileName`
- `orgName`

This endpoint is intentionally generic.

It assumes the PDF already exists.

That makes it the correct backend counterpart for a client-generated PDF flow.

---

## Comparison: backend-rendered automatic delivery vs client-generated delivery

| Concern | Backend-rendered automatic delivery | Client-generated delivery |
| --- | --- | --- |
| Can run without any browser | Yes | No |
| Keeps rendering logic near UI components | No | Yes |
| Requires backend browser/runtime | Yes | Usually not for the main path |
| Keeps provider secrets safe | Yes | Yes, if mail send stays backend |
| Easier to scale as a background job | Yes | No |
| Easier to match preview exactly | Usually harder | Usually easier |

---

## Why a pure client-side model cannot be fully automatic

This is the most important architectural constraint:

the frontend only exists while a browser is open.

So if the product requirement is:

"After org admin approval, generate the PDF and email it automatically"

there are two cases:

### Case A: automatic while the admin is on the page

Possible.

The backend approves membership, returns the approved member/project context, and the frontend then:

1. generates the PDF
2. posts it to `/api/email/send-card`

### Case B: automatic with no active browser

Not possible with a client-only renderer.

At that point the system needs one of:

- backend rendering
- a worker process
- an automation browser service

This is a product requirement question, not just an implementation detail.

---

## Recommended boundary if client-side generation is the product direction

### Backend should keep

- `approve` / `bulkApprove`
- `createCardRecords`
- verification URL generation
- email provider integration
- card status / expiry / audit data

### Frontend should own

- PDF generation
- ZIP generation
- rendering fidelity
- per-member delivery orchestration after approval

### Why this split works

- the backend keeps trust, identity, and secrets
- the frontend keeps presentation-heavy rendering work
- neither layer has to imitate the other's strengths

---

## A practical future implementation plan

If the product wants approval-triggered delivery while keeping rendering in the client, the cleanest migration is:

1. backend approval returns the approved member(s) plus card IDs and project context
2. frontend admin dashboard immediately queues those approved members for local PDF generation
3. frontend calls `/api/email/send-card` for each finished PDF
4. frontend shows per-recipient send status and warns the operator not to close the tab

This would preserve client-side rendering without pretending it is a durable unattended job system.

---

## External setup required

### Always required for approval emails

- `BREVO_API_KEY`
- `BREVO_SENDER_EMAIL`
- `BREVO_SENDER_NAME`
- `FRONTEND_URL`

### Required for current data layer

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

### Required only if backend PDF rendering remains in use

- a working Puppeteer/Chromium runtime
- reachable frontend render page at `${FRONTEND_URL}/render-card`

If the product fully removes backend render fallback, that last group can eventually disappear.

---

## Important phrasing for maintainers

Use the following language when describing the current backend:

- "backend-owned approval and verification metadata"
- "client-generated PDF, backend-sent email"
- "verification-link email on approval"
- "client-first rendering with backend secret boundary"

Avoid saying:

- "the backend generates every card automatically"
- "approval emails always include attached PDFs"

unless the implementation is actually changed to do so.

---

## Key takeaway

The backend is the trust anchor for:

- approval
- identity metadata
- verification URLs
- secret provider access

But that does not mean it must own PDF rendering.

Understanding that distinction is the key to evolving Aarannu without mixing up "authoritative state" and "presentation rendering".
