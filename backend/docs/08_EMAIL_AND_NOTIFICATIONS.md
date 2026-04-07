# Level 8 — Email: From Zero to Production

Everything about email in a web application — why it's hard, how different email systems work, and how this project handles it.

---

## Part A — Why Email Is Harder Than It Looks

Sending an email sounds simple. It isn't.

The problems:

1. **Deliverability** — Even if you send the email, it might go to spam or be silently rejected
2. **Reputation** — If your server sends spam (or looks like it might), all your emails get blocked
3. **Authentication** — Email servers verify that you own the domain you're sending from
4. **Infrastructure** — Running your own mail server is a serious operational burden (postfix, spam filtering, blacklist monitoring)

**The solution everyone uses:** A transactional email service (Brevo, SendGrid, Mailgun, Postmark) that handles reputation, deliverability, and infrastructure for you. You call their API; they handle the rest.

---

## Part B — The Two Email Systems in This Project

This is the most common source of confusion, so let's address it immediately.

```
┌──────────────────────────────────────────────────────────┐
│  EMAIL SYSTEM 1: Supabase Auth SMTP                       │
│                                                           │
│  Purpose: Auth emails (OTP codes, password reset,         │
│           email confirmation links)                        │
│                                                           │
│  Sender: Supabase → your SMTP server → user's inbox       │
│  Config: Supabase Dashboard → Auth → SMTP Settings        │
│  Library: Not your code — Supabase's internal system      │
└──────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────┐
│  EMAIL SYSTEM 2: Brevo Transactional API                  │
│                                                           │
│  Purpose: ID card PDF delivery to members                 │
│                                                           │
│  Sender: Backend → Brevo REST API → user's inbox         │
│  Config: BREVO_API_KEY in backend .env                    │
│  Library: Native fetch() in emailController.js            │
└──────────────────────────────────────────────────────────┘
```

They are completely independent. Configuring one does not configure the other. You need both if you want:
- OTP login emails (System 1)
- ID card delivery emails (System 2)

---

## Part C — Email Fundamentals

### What SMTP is

SMTP (Simple Mail Transfer Protocol) is the protocol computers use to send emails to each other. It's like the postal system for email — just a set of rules for how mail servers communicate.

When you send an email, the journey is:
```
Your code
    │
    ▼
SMTP server (Brevo's, or your own)
    │
    ▼ (SMTP protocol over TCP port 587 or 25)
Receiving mail server (Gmail, Outlook, etc.)
    │
    ▼
User's inbox
```

### What a REST API alternative is

Instead of speaking SMTP directly, you can call Brevo's REST API with a JSON payload. Brevo handles the SMTP part for you. This is what the backend does for card delivery:

```
Your code
    │
    ▼
POST https://api.brevo.com/v3/smtp/email    ← REST API call
    Body: { to, subject, htmlContent, attachment }
    Header: { "api-key": BREVO_API_KEY }
    │
    ▼
Brevo's infrastructure handles SMTP delivery
    │
    ▼
User's inbox
```

### What DKIM, SPF, and DMARC are

These are email authentication standards that prevent spoofing. When Brevo sends on your behalf, they configure these for you. If you see these terms in DNS settings:

- **SPF** — "This IP address is allowed to send email for my domain"
- **DKIM** — "This email was signed by my domain's private key" (cryptographic proof)
- **DMARC** — "If SPF or DKIM fails, treat this email as spam/reject it"

For this project you don't configure these manually — Brevo does it when you verify your sender domain.

---

## Part D — Setting Up Brevo (Email System 2: Card Delivery)

### Step 1: Create a Brevo account

1. Go to brevo.com → Sign up (free)
2. Free plan: 300 emails/day, no credit card needed

### Step 2: Get your API key

1. In Brevo: top-right avatar → SMTP & API → API Keys tab
2. Click "Create a new API key"
3. Name it (e.g. "aarannu-backend")
4. Copy the key — starts with `xkeysib-`

```env
# Add to backend/.env
BREVO_API_KEY=xkeysib-abc123...
BREVO_SENDER_EMAIL=noreply@yourcompany.com
BREVO_SENDER_NAME=Your Organization
```

### Step 3: Verify your sender email

Before you can send from `noreply@yourcompany.com`, Brevo needs to verify you own it:

1. Brevo → Senders & IPs → Add a Sender
2. Enter your email
3. Brevo sends a verification email → click the link

**Alternative for testing:** Use Brevo's default sender email. You can send without verification initially, but production emails should come from your domain.

### Step 4: Test it

```bash
curl -X POST https://api.brevo.com/v3/smtp/email \
  -H "accept: application/json" \
  -H "content-type: application/json" \
  -H "api-key: xkeysib-YOUR-KEY" \
  -d '{
    "sender": { "name": "Test", "email": "noreply@yourcompany.com" },
    "to": [{ "email": "you@gmail.com", "name": "You" }],
    "subject": "Test email",
    "htmlContent": "<p>It works!</p>"
  }'
```

If you get back `{ "messageId": "..." }`, it worked.

---

## Part E — How the Backend Sends Emails

The backend's email controller (`emailController.js`) is a thin wrapper around Brevo's API.

### The complete flow

```
Frontend generates PDF (PDFKit in browser)
    │
    ▼
Convert PDF Blob → base64 string
    │
    ▼
POST /api/email/send-card
  Body: {
    pdfBase64: "JVBERi0xLjMu...",       ← raw base64 (no data: prefix)
    recipientEmail: "member@test.com",
    recipientName: "Ali Hassan",
    orgName: "Aarannu Tech",
    projectName: "Students 2026",
    memberId: "uuid",                    ← to update delivery status in DB
    cardId: "uuid",                      ← stored with the member record
    verificationUrl: "https://..."       ← shown in the email body
  }
    │
    ▼
Backend validates inputs:
  - recipientEmail present and valid format?
  - pdfBase64 present?
  - BREVO_API_KEY configured?
    │
    ▼
Build Brevo API payload:
  {
    sender: { name: BREVO_SENDER_NAME, email: BREVO_SENDER_EMAIL },
    to: [{ email: recipientEmail, name: recipientName }],
    subject: "Your ID Card from Aarannu Tech",
    htmlContent: `<div>...</div>`,
    attachment: [{
      content: pdfBase64,      ← raw base64 only
      name: "Ali_Hassan_ID.pdf"
    }]
  }
    │
    ▼
POST https://api.brevo.com/v3/smtp/email
  Header: { "api-key": BREVO_API_KEY }
    │
    ├── HTTP 201: success
    │     → UPDATE project_members SET delivery_status='sent', email_sent_at=now()
    │     → Return { success: true, messageId }
    │
    └── Any failure
          → UPDATE project_members SET delivery_status='failed_send', delivery_error='...'
          → Return error response
```

### Why the backend sends emails (and not the browser directly)

1. **`BREVO_API_KEY` cannot be in the browser** — it would be visible in DevTools Network tab. Anyone could extract it and send emails from your account.

2. **Delivery state needs updating** — after sending, the backend updates `project_members.delivery_status`. It uses the service role key (admin DB access) which also cannot be in the browser.

3. **Brevo has CORS restrictions** — their API does not allow direct browser-to-Brevo calls from arbitrary origins.

### The base64 attachment format

PDFKit generates a `Blob`. To send it as an email attachment:

```js
// 1. PDFKit outputs Blob via blob-stream
const blob = stream.toBlob('application/pdf');

// 2. FileReader converts Blob → data URL (base64 encoded)
const reader = new FileReader();
reader.readAsDataURL(blob);
// reader.result = "data:application/pdf;base64,JVBERi0xLjMu..."
//                   ↑ this prefix                ↑ actual base64

// 3. IMPORTANT: strip the prefix — Brevo wants raw base64 only
const pdfBase64 = reader.result.split(',')[1];
// pdfBase64 = "JVBERi0xLjMu..."

// 4. Send to backend
await fetch('/api/email/send-card', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${session.access_token}`
  },
  body: JSON.stringify({ pdfBase64, recipientEmail, ... })
});
```

If you accidentally include `data:application/pdf;base64,` in the Brevo attachment content, the PDF will be corrupt.

---

## Part F — Setting Up Supabase Auth SMTP (Email System 1: OTP Codes)

Supabase's default email sender works but uses Supabase's own domain (emails come from `noreply@mail.supabase.io`). For production, use your own domain via an SMTP relay.

### What this controls

Every email Supabase sends automatically:
- OTP login code (6-digit number)
- Email confirmation on signup
- Password reset link
- Magic link (if enabled)

### Getting Brevo SMTP credentials

Brevo serves as both a REST API (for card delivery) and an SMTP relay (for Supabase auth emails). These use different credentials.

1. Brevo → SMTP & API → **SMTP tab** (not API Keys)
2. Note or generate:
   - SMTP server: `smtp-relay.brevo.com`
   - Port: `587`
   - Login: your Brevo account email
   - Password: Click "Generate a new SMTP key" → copy the password

### Configure in Supabase

Supabase Dashboard → Authentication → SMTP Settings → toggle "Enable Custom SMTP":

```
Sender email:    noreply@yourcompany.com
Sender name:     Aarannu
Host:            smtp-relay.brevo.com
Port:            587
Username:        your-brevo-account@email.com
Password:        the SMTP key you generated (NOT the API key)
```

Click Save & Test — Supabase will send a test email. If it arrives, it's working.

### Configure the OTP email template

Without this, Supabase's email shows only a "Log In" link — not the 6-digit code:

Supabase Dashboard → Authentication → Email Templates → Magic Link:

```html
<h2 style="font-family: sans-serif;">Your verification code</h2>
<p style="font-family: sans-serif; color: #475569;">
  Use this code to verify your Aarannu account:
</p>
<h1 style="
  font-family: monospace;
  font-size: 40px;
  letter-spacing: 12px;
  color: #1152d4;
  margin: 24px 0;
">
  {{ .Token }}
</h1>
<p style="font-family: sans-serif; color: #94a3b8; font-size: 13px;">
  This code expires in 10 minutes.<br>
  If you didn't request this, ignore this email.
</p>
```

Template variables:
- `{{ .Token }}` — the 6-digit OTP code
- `{{ .ConfirmationURL }}` — full login URL (for email clients that can't show the code)
- `{{ .SiteURL }}` — your Site URL setting
- `{{ .Email }}` — recipient's email

### Set the Site URL (critical for email links)

Supabase → Authentication → URL Configuration:
- **Site URL**: `https://yourapp.vercel.app` (production domain)
- **Redirect URLs**: `https://yourapp.vercel.app/**`

Without this, any link in Supabase emails points to localhost, which breaks in production.

---

## Part G — Delivery Status Tracking

For card emails, the backend tracks each member's email state in `project_members.delivery_status`:

```
Member imported/registered
         │
         ▼
    (no status)
         │
         ▼  Admin generates cards
   "generated"
         │
         ▼  Admin clicks Send Email
   "sending"       ← set briefly before the API call
         │
    ┌────┴────┐
    │         │
Brevo OK   Brevo fails
    │         │
  "sent"   "failed_send"
  + timestamp  + error message stored in delivery_error
```

**Why store locally instead of relying on Brevo's dashboard?**
- Brevo's dashboard resets — you can't see sends from 6 months ago on the free plan
- The admin needs to see per-member status in *your* dashboard
- Failed sends can be retried directly from your UI
- The `message_id` from Brevo can be used to check delivery status via Brevo API if needed

---

## Part H — Error Handling and Retries

### Common errors and what they mean

| Brevo response | Meaning | Fix |
|---|---|---|
| HTTP 401 | `BREVO_API_KEY` invalid | Regenerate in Brevo dashboard |
| HTTP 400 `"empty payload"` | Request body malformed | Check that pdfBase64 has no `data:` prefix |
| HTTP 429 | Rate limit hit (300/day on free plan) | Upgrade plan or wait until next day |
| HTTP 503 | Brevo is down | Retry after a few minutes |
| Email in spam | Sender domain not verified | Verify domain in Brevo → Senders & IPs |
| No email received | Supabase SMTP misconfigured | Test SMTP using Supabase's test button |

### The request body size limit

A PDF card is typically 200–800KB. As base64, that becomes ~270–1100KB. The backend's Express JSON parser is configured for 10MB:

```js
app.use(express.json({ limit: '10mb' }));
```

This is why. If you reduce this limit, email sending breaks for large cards.

### Why there's no retry queue

The current implementation is synchronous — it tries once, succeeds or fails. There's no job queue (no BullMQ, no Redis).

For production at scale, you'd want:
1. Admin clicks "Send" → job added to queue → respond immediately with "queued"
2. Worker processes the queue → retries on failure with exponential backoff
3. Admin sees real-time status updates

This is a known architectural gap. For now, admins retry manually from the dashboard for any `failed_send` members.

---

## Part I — Production Email Checklist

```
Brevo API (card delivery):
  [ ] BREVO_API_KEY set in backend environment variables
  [ ] BREVO_SENDER_EMAIL is a verified sender in Brevo
  [ ] BREVO_SENDER_NAME set to your org name
  [ ] Test send via curl worked before deploying

Supabase Auth SMTP (OTP emails):
  [ ] Brevo SMTP credentials generated (SMTP tab, not API Keys)
  [ ] Custom SMTP enabled in Supabase Auth settings
  [ ] SMTP test in Supabase dashboard passed
  [ ] OTP email template updated to show {{ .Token }}
  [ ] Site URL set to production domain
  [ ] Redirect URLs include production domain

DNS (for better deliverability):
  [ ] Sender domain verified in Brevo (adds DKIM records)
  [ ] SPF record includes Brevo's IP ranges (Brevo provides this)

Testing after deploy:
  [ ] Create a new account → OTP email received with 6-digit code
  [ ] Login with OTP → works
  [ ] Generate a card → send via email → card PDF arrives in inbox
  [ ] Check: card PDF opens correctly in email client
  [ ] Check: verification URL in email works when clicked
```
