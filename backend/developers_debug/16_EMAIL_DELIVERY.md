# 16 — Email Delivery System (Brevo)

Technical reference for how ID card PDFs are emailed to members.

---

## Architecture: Who Does What

There are **two completely separate email systems** in this project. Confusing them is a common mistake.

| System | Purpose | Config location |
|---|---|---|
| **Supabase Auth SMTP** | Sends OTP codes, password reset, email verification | Supabase Dashboard → Auth → SMTP |
| **Brevo Transactional API** | Sends ID card PDFs as email attachments | `BREVO_API_KEY` in `backend/.env` |

They are independent. Configuring one does not configure the other.

---

## Brevo: How It Works

### What is Brevo

Brevo (formerly Sendinblue) is a transactional email service. You call their REST API with a JSON payload, and they handle the actual email delivery, spam filtering, and tracking. You get 300 free emails per day on the free plan.

### The flow

```
Admin clicks "Send Email" in ProjectDashboard
        │
        ▼
Browser (React)
  1. Generates PDF as base64 string (PDFKit)
  2. Calls POST /api/email/send-card with:
       {
         pdfBase64: "JVBERi0xLjMu...",   ← 100-500KB base64 encoded PDF
         recipientEmail: "student@example.com",
         recipientName: "Ali Hassan",
         orgName: "Aarannu Tech School",
         projectName: "Students 2026",
         memberId: "uuid-of-member",
         cardId: "uuid-of-generated-card",
         verificationUrl: "https://aarannu.shaans.works/verify/uuid"
       }
        │
        ▼
Backend (emailController.js)
  3. Validates: recipientEmail present? pdfBase64 present? BREVO_API_KEY set?
  4. Builds Brevo API payload (see below)
  5. POST https://api.brevo.com/v3/smtp/email
     Headers: { "api-key": BREVO_API_KEY }
        │
        ├── Success (HTTP 201):
        │     6. UPDATE project_members SET
        │           delivery_status = 'sent',
        │           email_sent_at = now(),
        │           card_id = cardId,
        │           verification_url = verificationUrl,
        │           message_id = brevo_messageId,
        │           delivery_error = NULL
        │        WHERE id = memberId
        │     7. Return { success: true, messageId }
        │
        └── Failure:
              6. UPDATE project_members SET
                    delivery_status = 'failed_send',
                    delivery_error = 'error message'
                 WHERE id = memberId
              7. Return { error: "Email Send Failed", message }
```

### Why the backend handles this (not the browser directly)

1. **Secret key exposure**: `BREVO_API_KEY` in the browser is visible to anyone via DevTools → Network. The backend keeps it server-side only.
2. **DB state update**: After sending, the backend needs to update `delivery_status` using the service role key (bypasses RLS). The frontend doesn't have that key.
3. **Audit trail**: The backend persists failures even if the browser closes — admin can see which emails failed and retry.

---

## The Brevo API Payload

```js
// Sent to: POST https://api.brevo.com/v3/smtp/email
// Header: { "api-key": process.env.BREVO_API_KEY }

{
  sender: {
    name: "Aarannu Tech School",          // process.env.BREVO_SENDER_NAME
    email: "noreply@aarannu.example.com"  // process.env.BREVO_SENDER_EMAIL
  },
  to: [
    { email: "student@example.com", name: "Ali Hassan" }
  ],
  subject: "Your ID Card from Aarannu Tech School",
  htmlContent: `
    <div style="font-family: Segoe UI, Arial, sans-serif; max-width: 600px;">
      <h2>Hello Ali Hassan,</h2>
      <p>Your registration for <strong>Students 2026</strong> has been approved.
         Your digital ID card is attached.</p>
      <p>Verify your card:
         <a href="https://aarannu.shaans.works/verify/uuid">
           https://aarannu.shaans.works/verify/uuid
         </a>
      </p>
      <p>Card ID: <strong>uuid</strong></p>
    </div>
  `,
  attachment: [
    {
      content: "JVBERi0xLjMu...",    // raw base64, NO "data:application/pdf;base64," prefix
      name: "Ali_Hassan_ID.pdf"
    }
  ]
}
```

**Important**: Brevo's attachment `content` field expects **raw base64** only. If you accidentally include the `data:application/pdf;base64,` prefix, the PDF attachment will be corrupted.

---

## Environment Variables

All three must be set in `backend/.env`:

```env
BREVO_API_KEY=xkeysib-abc123...
BREVO_SENDER_EMAIL=noreply@yourdomain.com
BREVO_SENDER_NAME=Your Organization Name
```

**Where to get your API key:**
1. Log in at app.brevo.com
2. Top-right avatar → SMTP & API → API Keys
3. Create a new API key (name it anything, e.g. "aarannu-backend")
4. Copy the key — it starts with `xkeysib-`

**Sender verification:**
- The `BREVO_SENDER_EMAIL` must be verified in Brevo → Senders & IPs → Add a Sender
- Or use Brevo's default sender for the free plan (from a brevo subdomain)

---

## Delivery Status State Machine

The `delivery_status` column on `project_members` tracks each member's email state:

```
(member created)
      │
      ▼
  [no status]
      │
      ▼  admin clicks "Generate Cards"
 "generated"
      │
      ▼  admin clicks "Send Email"
  "sending"     ← briefly set before the API call
      │
      ├── Brevo returns HTTP 201 → "sent"
      │     email_sent_at = timestamp
      │     message_id = "brevo-msg-id"
      │
      └── Any failure → "failed_send"
            delivery_error = "error description"
```

The admin dashboard reads `delivery_status` per row and shows:
- ✅ `sent` → show sent timestamp
- ❌ `failed_send` → show error, offer retry button
- ⏳ `generated` → not yet sent

---

## How the PDF Gets to Brevo

The PDF is generated client-side (in the browser) using PDFKit. After generation:

```js
// 1. PDFKit outputs a Blob
const blob = stream.toBlob('application/pdf');

// 2. Convert Blob → base64 string
const reader = new FileReader();
reader.readAsDataURL(blob);
// result: "data:application/pdf;base64,JVBERi0xLjMu..."

// 3. Strip the data: prefix — Brevo only wants the raw base64
const pdfBase64 = reader.result.split(',')[1];

// 4. Send to backend
await fetch('/api/email/send-card', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${jwt}` },
  body: JSON.stringify({ pdfBase64, recipientEmail, ... })
});
```

The request body can be up to **10MB** (Express is configured with `express.json({ limit: '10mb' })`). A typical card PDF is 200–800KB as base64 (base64 adds ~33% overhead over binary).

---

## Supabase Auth SMTP (The Other Email System)

This configures the emails Supabase itself sends: OTP login codes, password reset, email confirmation.

### How to configure Brevo SMTP for Supabase Auth

This uses Brevo as an **SMTP relay** (different from the REST API). You're giving Supabase a mail server to use.

1. In Brevo: SMTP & API → SMTP tab
   - Note the SMTP host: `smtp-relay.brevo.com`
   - Note the port: `587`
   - Your login: your Brevo account email
   - Password: Generate an SMTP password (different from API key)

2. In Supabase Dashboard → Authentication → SMTP Settings:
   ```
   Sender email: noreply@yourdomain.com
   Sender name:  Aarannu
   Host:         smtp-relay.brevo.com
   Port:         587
   Username:     your-brevo-account@email.com
   Password:     your-brevo-smtp-password
   ```

3. The OTP email template must also be customized (see `01_BEGINNER.md`, Step 1e).

### What each system sends

| Email type | Sent by | Goes through |
|---|---|---|
| Login OTP (6-digit code) | Supabase Auth | Brevo SMTP |
| Password reset link | Supabase Auth | Brevo SMTP |
| Email verification | Supabase Auth | Brevo SMTP |
| ID card PDF attachment | Backend emailController.js | Brevo REST API |

---

## Error Reference

| Error | Meaning | Fix |
|---|---|---|
| `"Brevo API key is not configured"` | `BREVO_API_KEY` missing from `.env` | Add it and restart the backend |
| `"Invalid email address format"` | `recipientEmail` failed regex check | Check the email value being passed from the frontend |
| Brevo returns HTTP 401 | API key invalid | Regenerate key in Brevo dashboard |
| Brevo returns HTTP 400 `"empty payload"` | The request body was malformed | Check that `pdfBase64` has no `data:` prefix |
| PDF attachment opens as blank | Base64 includes data URI prefix | Strip everything before and including the comma: `base64.split(',')[1]` |
| `"failed_send"` but no error message | Network error reaching Brevo | Check internet connectivity from server, check firewall |

---

## Rate Limits

Brevo free plan: **300 emails/day**, no sending rate limit within that.

If you need more:
- Brevo Starter: 20,000/month (~$25/mo)
- Brevo Business: custom

The backend does not implement retry logic or a queue. If Brevo is unavailable, the send fails immediately and is recorded as `failed_send`. The admin can manually retry from the dashboard.
