# Webhook Automation Setup Guide

## Google Form → Automatic ID Card Generation

This guide walks you through setting up automatic ID card generation triggered by Google Form submissions.

---

## Architecture Overview

```
Google Form → Google Apps Script → Backend Webhook → Puppeteer Renders Card → Supabase Storage → Email to Member
```

---

## Step 1: Run the Database Migration

Open your **Supabase Dashboard → SQL Editor** and run the migration file:

📄 `backend/migrations/001_webhook_configs.sql`

This creates the `webhook_configs` table that stores your webhook configurations.

---

## Step 2: Set Environment Variables

### Backend `.env`

Add these to your backend `.env` file:

```env
# ── Existing vars (should already be set) ──
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
SUPABASE_ANON_KEY=your_anon_key
BREVO_API_KEY=your_brevo_api_key

# ── New: Frontend URL for Puppeteer card rendering ──
# In development:
FRONTEND_URL=http://localhost:5173
# In production:
# FRONTEND_URL=https://your-frontend-domain.com
```

### Frontend `.env`

Ensure this is set (should already be):

```env
VITE_API_URL=http://localhost:5000
# In production:
# VITE_API_URL=https://your-backend-domain.com
```

---

## Step 3: Install Dependencies

```bash
cd backend
npm install puppeteer
```

> **Note:** Puppeteer downloads Chromium (~170MB) on first install. On production servers, you may want to use `puppeteer-core` with a system Chromium instead.

---

## Step 4: Start Both Servers

The **frontend must be running** for Puppeteer to render cards:

```bash
# Terminal 1: Frontend
cd frontend
npm run dev

# Terminal 2: Backend
cd backend
npm run dev
```

---

## Step 5: Create a Webhook (Web UI)

1. Log in to the app and navigate to **Dashboard**
2. Click the **Webhooks** button in the top bar
3. Click **+ New Webhook**
4. Fill in:
   - **Webhook Name**: e.g., "Student Registration Form"
   - **Card Template**: Choose the card design
   - **Organization Name**: Your org name
   - **Field Mapping**: Map your Google Form question titles to card fields

### Field Mapping Example

If your Google Form has these questions:
| Google Form Question | Card Field |
|---|---|
| "What is your full name?" | `name` |
| "Your email address" | `email` |
| "Role/Position" | `role` |
| "Date of Birth" | `dob` |
| "Gender" | `gender` |
| "Profile Photo URL" | `photo_url` |
| "Home Address" | `address` |

Then your field mapping would be:

- **Full Name**: `What is your full name?`
- **Email**: `Your email address`
- **Role / Position**: `Role/Position`
- etc.

> **Important:** The mapping value must be the **exact question title** from your Google Form.

---

## Step 6: Set Up Google Apps Script

1. After creating the webhook, click **📋 Get Apps Script**
2. Copy the generated script
3. Open your **Google Form** → click the **⋮ (three dots)** menu → **Script editor**
4. Delete any existing code and paste the script
5. Click **Run** → select `installTrigger` from the dropdown
6. **Authorize** the script when prompted (it needs permission to run on form submit and make HTTP requests)
7. Done! Every new submission will automatically generate an ID card.

---

## How It Works (Technical Flow)

```
1. User submits Google Form
         ↓
2. Google Apps Script trigger fires (onFormSubmit)
         ↓
3. Script extracts form responses as key-value pairs
   (keys = question titles, values = answers)
         ↓
4. Script POSTs to: POST /api/webhook/:webhookId
   Headers: { X-Webhook-Secret: "..." }
   Body: { "What is your full name?": "John Doe", ... }
         ↓
5. Backend looks up webhook config by ID
         ↓
6. Backend verifies the secret (timing-safe comparison)
         ↓
6b. Backend deducts 1 TOKEN from webhook owner's wallet
    (returns 402 if insufficient tokens)
         ↓
7. Backend maps form fields → card data using field_mapping
   e.g., mapping.name = "What is your full name?"
         → cardData.name = formData["What is your full name?"]
         ↓
8. Puppeteer opens frontend at /render-card#<encoded data>
         ↓
9. React renders the card component (IDCard/CorporateCard/etc.)
         ↓
10. Puppeteer screenshots front + back → PNG + PDF
         ↓
11. PNG uploaded to Supabase Storage (id-cards bucket)
         ↓
12. generated_ids row inserted in database
         ↓
13. If auto_email=true + email field present →
    PDF emailed to member via Brevo
         ↓
14. Response: { success: true, card: { id, member_name, email_sent } }

> **Token Note:** Each webhook submission costs 1 token from the webhook owner's wallet.
> If the card render, upload, or DB insert fails, the token is automatically refunded.
> If the owner has no tokens, the webhook returns 402 Payment Required.
```

---

## API Reference

### Webhook Submission (no JWT — uses secret)

```
POST /api/webhook/:webhookId
Headers: X-Webhook-Secret: <secret>
Body: { "Form Question 1": "Answer 1", ... }

Response 201: { success: true, message: "...", card: { id, file_path, member_name, email_sent } }
```

### Webhook Config CRUD (requires JWT)

```
POST   /api/webhook-config              → Create webhook
GET    /api/webhook-config              → List your webhooks
GET    /api/webhook-config/:id          → Get one webhook
PUT    /api/webhook-config/:id          → Update webhook
DELETE /api/webhook-config/:id          → Delete webhook
POST   /api/webhook-config/:id/regenerate-secret → New secret
```

---

## Troubleshooting

### "Failed to render the ID card. Is the frontend running?"

The frontend dev server must be running at the URL specified in `FRONTEND_URL`. Puppeteer navigates to it to render cards.

### "Invalid webhook secret"

The `X-Webhook-Secret` header doesn't match. Check that the Apps Script has the correct secret. You can regenerate it from the Webhooks page.

### Cards are generated but email not sent

- Check that `BREVO_API_KEY` is set in backend `.env`
- Check that the email field mapping is correct (the form question title for email must match exactly)
- Check that `auto_email` is enabled for the webhook

### Form submissions not triggering

- Make sure you ran `installTrigger` in the Apps Script editor
- Check the Apps Script execution log: **Script editor → Executions** (left sidebar)
- The trigger must be of type "On form submit"

### Photo not showing on card

- The photo URL must be publicly accessible
- Google Drive sharing links don't work directly — use the direct download URL format:
  `https://drive.google.com/uc?export=view&id=FILE_ID`

---

## Production Deployment Notes

1. **Puppeteer on production servers**: Install system Chromium and use `puppeteer-core`:

   ```bash
   # On Ubuntu/Debian:
   apt-get install chromium-browser

   # Then in code, point to the system binary:
   # puppeteer.launch({ executablePath: '/usr/bin/chromium-browser' })
   ```

2. **Frontend must be accessible**: The `FRONTEND_URL` must point to a running frontend instance (can be the production build served by a static host).

3. **CORS**: The webhook endpoint doesn't need CORS (it's called server-to-server from Google), but the webhook-config endpoints need your frontend origin allowed.

4. **Rate limiting**: Webhook submissions are rate-limited to 60 per 15 minutes per IP. Google's servers typically use consistent IPs, so this should be fine for moderate volumes.
