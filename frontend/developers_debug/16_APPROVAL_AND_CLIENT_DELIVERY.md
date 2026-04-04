# 16 - Approval, Access Gating, and Client-Side Card Delivery

## Purpose

This document explains the most important product split in the current codebase:

1. direct Aarannu signup is self-serve and available immediately
2. organization/project registration is admin-gated and becomes active only after approval
3. card/PDF generation is intended to stay on the client side where possible

These flows look similar from the outside because both involve users, cards, and email, but the code intentionally treats them differently.

---

## Two entry paths, two trust models

### Path A: direct Aarannu account signup

Handled in `frontend/src/pages/Signup.jsx`.

This path creates a regular product account:

- Supabase Auth user is created
- email OTP confirms the email
- a `members` row is inserted with `approved: true`
- the user can access the dashboard immediately

Conceptual snippet:

```js
await supabase.from("members").insert({
  user_id: userId,
  name: name.trim(),
  role: role.trim() || "Member",
  approved: true,
});
```

Why this path is immediate:

- it is the trial/onboarding experience for Aarannu itself
- requiring org-admin approval here would block product discovery
- free starter tokens make more sense when access is immediate

### Path B: organization project registration

Handled in `frontend/src/pages/RegistrationForm.jsx` and the backend project member routes.

This path creates a `project_members` row with `status = "pending"`.

Why this path is gated:

- the applicant is requesting access to an organization-owned project
- the organization admin, not Aarannu, decides whether the applicant belongs there
- generated cards carry organizational trust, so approval cannot be automatic by default

---

## Comparison: direct signup vs org registration

| Concern | Direct Aarannu signup | Organization form submission |
| --- | --- | --- |
| Main table | `members` | `project_members` |
| Status field | `approved: true/false` | `status: pending/approved/rejected` |
| Who decides access | Product logic | Org admin |
| OTP required | Yes | Not in the public project form flow |
| Can use dashboard immediately | Yes | No |
| ID card generated automatically | Not by signup itself | Only after approval flow |

---

## Login and dashboard access gate

Even when a user has a valid Supabase session, the app still performs a second access check.

That check exists in two places:

- `frontend/src/pages/Login.jsx`
- `frontend/src/components/ProtectedRoute.jsx`

Both rely on:

```js
export async function getMemberApprovalRecord(userId) {
  return supabase
    .from("members")
    .select("id, user_id, name, role, approved")
    .eq("user_id", userId)
    .maybeSingle();
}
```

### Why check in both places?

Because login success and dashboard authorization are not the same thing.

`Login.jsx` handles the initial user experience:

- verify OTP
- load member approval status
- if unapproved, sign out and show a pending state

`ProtectedRoute.jsx` acts as the safety net for every protected page:

- refresh session state
- re-check member approval
- block access if the record is missing, pending, or lookup failed

This is defense in depth.

---

## Why the app signs out unapproved users after OTP login

This is a subtle but important design decision.

The code does not leave the user partially signed in after confirming they are unapproved.

Instead it signs them out and shows an explanatory screen.

Why:

- avoids the appearance that they have usable access
- prevents edge cases where client state says "authenticated" but the product says "blocked"
- keeps protected routes simple

In practice, this creates a cleaner mental model:

- authenticated and approved -> app access
- authenticated but not approved -> access denied screen + sign-out

---

## Client-side generation: what it means in practice

In Aarannu, "client-side generation" means:

- the browser builds the card payload
- the browser renders the card into a PDF
- the browser can optionally upload, zip, and send that output

The main frontend entry point is:

```js
export async function renderCardPdfWithBestSupport(payload) {
  if (!needsBrowserRenderedPdf(payload)) {
    return generateCardPdf(payload);
  }

  return renderPdfViaBackend(payload);
}
```

Important nuance:

- the preferred path is local/browser rendering
- the current codebase still keeps a backend-assisted fallback for difficult cases

So the architecture is best described as:

- client-first
- not yet client-only in every edge case

---

## Why client-side generation is attractive

### 1. Preview parity

The same UI that previews the card is close to the UI that generates it.

That reduces "preview looks right, exported file looks different" problems.

### 2. Lower backend cost

If every card were rendered server-side, the backend would need to own:

- PDF generation compute
- browser automation / Chromium runtime
- retries
- worker capacity planning

Client-side generation shifts that cost to the active operator session.

### 3. Better UX for admin batches

The admin can see:

- which row is processing
- which card failed
- which email failed
- when the ZIP is ready

That visibility is much harder with a detached background worker unless extra job dashboards are built.

---

## The hard limit of client-side generation

The browser only works while someone has the page open.

That single fact explains the main tradeoff:

### What client-side generation can do

- generate instantly while an admin is present
- assemble PDFs with the latest UI styling
- upload/send files with visible progress

### What it cannot do by itself

- keep running after the tab closes
- continue overnight with no user session
- behave like a durable background worker

This matters directly for approval-triggered delivery.

---

## Approval-triggered card delivery: two different meanings

The phrase "send the card automatically after approval" can mean two different things.

### Meaning 1: automatic from the admin browser

Possible with a client-driven design.

Flow:

```text
admin clicks Approve
-> backend marks member approved
-> frontend receives approved member and project context
-> frontend generates PDF
-> frontend calls backend email endpoint
-> backend sends through Brevo
```

This works only while the admin tab stays open.

### Meaning 2: automatic from the system with no browser needed

This requires server-side or worker-side generation.

A purely client-side renderer cannot satisfy this requirement because no browser code exists once the operator leaves.

---

## Recommended architecture boundary

If the product direction is "keep card generation on the client side", the clean boundary is:

- frontend
  - generate card PDF
  - show progress
  - decide which approved members should receive email now
  - call the backend email endpoint with `pdfBase64`

- backend
  - approve membership
  - create card/verification records
  - construct verification URLs
  - keep Brevo secrets
  - send transactional email

This lets the frontend own rendering while the backend still owns secrets and durable identity metadata.

---

## Function-level map

### Access checking

| Function | Why it exists |
| --- | --- |
| `getMemberApprovalRecord(userId)` | Centralizes the `members.approved` lookup |
| `handleVerifyOtp()` in `Login.jsx` | Blocks unapproved/missing members immediately after OTP |
| `verifyAccess()` in `ProtectedRoute.jsx` | Re-validates approval before protected routes render |

### Card generation

| Function | Why it exists |
| --- | --- |
| `renderCardPdfWithBestSupport(payload)` | Chooses the best renderer for the payload |
| `renderCardPdf(memberData)` in `BulkGenerator.jsx` | Creates the exact payload used for generation |
| `handleGenerate()` in `BulkGenerator.jsx` | Runs the batch pipeline and coordinates ZIP/email phases |

### Email handoff

| Function | Why it exists |
| --- | --- |
| `handleEmailCards()` in `BulkGenerator.jsx` | Converts browser `Blob`s into base64 and calls backend email API |
| `sendCard()` in backend `emailController.js` | Sends the already-generated PDF attachment via Brevo |

---

## Comparison: client-side delivery vs server-side delivery

| Concern | Client-side delivery | Server-side delivery |
| --- | --- | --- |
| Best source of styling truth | Frontend | Backend must replicate frontend styling |
| Can run unattended | No | Yes |
| Easy visual debugging | Yes | Medium |
| Infra complexity | Lower | Higher |
| Requires active browser | Yes | No |
| Secret safety | Good if email stays backend | Good |

---

## Best practical reading of the current codebase

The current system is not "all client" or "all server".

It is a deliberate hybrid:

- self-serve product signup
- admin-gated organization membership
- client-first card generation
- backend-owned verification records and email secrets

That hybrid model is why some flows feel immediate and others deliberately wait for admin approval.

---

## What to tell future contributors

If someone asks:

"Why don't we just generate and email the card automatically after approval?"

the accurate answer is:

1. we can do that from the admin browser
2. we cannot do that as a purely client-side background process after the browser disappears
3. if unattended automation is required, a backend render/worker system must own that job

That is the key architectural boundary to preserve while making future changes.
