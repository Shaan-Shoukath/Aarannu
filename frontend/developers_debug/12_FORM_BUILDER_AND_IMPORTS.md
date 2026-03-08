# 12 — Dynamic Form Builder, File Uploads & Google Sheets Import (Frontend)

> **Added in:** Phase 4 — SaaS Platform Enhancement

---

## Components Modified/Created

### ProjectCreate.jsx — Form Builder UI

**Location:** `src/pages/ProjectCreate.jsx`

The form builder allows admins to define custom fields for their project's registration form.

**Capabilities:**

- 11 field types with per-type icons (text, email, phone, number, textarea, dropdown, radio, checkbox, date, file_upload, photo_upload)
- Expandable/collapsible field cards for configuration
- Per-field settings: label, type, placeholder, description (help text), options (comma-separated), default_value, validation_rules (minLength/maxLength), required toggle
- Duplicate field button
- System fields (name, email, photo) displayed as non-editable badges
- Live preview panel: toggleable via header button, renders a mock registration form showing how fields will look
- Layout: single column without preview, two-column grid with preview enabled

**Data flow:** Fields are serialized into the `form_schema` array and POST'd with the project creation payload. Backend then saves to both `form_schema` JSONB column and `form_fields` table.

### RegistrationForm.jsx — Public Registration

**Location:** `src/pages/RegistrationForm.jsx`

The public form that members fill out to register.

**Key changes:**

- Reads from `project.form_fields` array (new) with fallback to `project.form_schema` (legacy)
- System fields rendered separately at the top (name, email, photo)
- Photo field is now a **real file upload** (not URL input):
  - Reads file as base64 via FileReader
  - POSTs to `/api/uploads/photo/:projectId`
  - Shows preview thumbnail with remove button
  - 5 MB limit enforced client-side
- Custom field rendering supports all 11 types:
  - `radio`: renders radio button group from `field.options`
  - `checkbox`: renders checkbox group, values stored as arrays
  - `photo_upload`: same upload UX as system photo
  - `file_upload`: drag-style upload area, shows "File uploaded" after success
  - `date`: native date picker
  - `phone`: tel input with placeholder
  - All others: standard input with correct `type` attribute
- Field descriptions shown as help text below labels
- Upload progress spinners per field
- Submit button disabled while any upload is in progress

### BulkDashboard.jsx — Google Sheets Import

**Location:** `src/pages/BulkDashboard.jsx`

**Route:** `/org/:slug/bulk/:projectId`

3-step wizard for importing members from Google Sheets:

**Step 1 — Paste URL:**

- Input for Google Sheet URL
- Optional GID input for specific tab
- "How it works" help section
- Fetches via POST `/api/sheets/fetch`

**Step 2 — Map Columns:**

- Shows all sheet columns with preview data
- Dropdown per column to map → form field key
- Auto-mapping: exact match on field label or field key (case-insensitive)
- System fields marked with asterisk
- Already-mapped fields disabled in other dropdowns (prevents double-mapping)
- Preview table with mapped columns highlighted
- Auto-approve toggle checkbox
- Mapped column count indicator

**Step 3 — Results:**

- Success summary with import count
- Validation errors listed (with row numbers)
- "Import Another Sheet" and "Go to Project Dashboard" buttons

---

## State Management

All components use local `useState` + `useEffect`. No global state library.

**RegistrationForm upload state:**

```
photoPreview   — ObjectURL or signedUrl for system photo
photoPath      — Storage path returned by upload API
uploadPaths    — { [fieldKey]: storagePath } for custom file/photo fields
uploadPreviews — { [fieldKey]: previewUrl } for custom photo fields
uploadingField — fieldKey currently uploading (null when idle)
```

**BulkDashboard flow state:**

```
step           — 1 (URL) | 2 (mapping) | 3 (results)
sheetHeaders   — string[] from sheet
previewRows    — object[] (first 10 rows)
columnMapping  — { [sheetColumn]: fieldKey }
importResult   — { imported, skipped, validationErrors }
```

---

## API Integration

| Component        | Endpoints Used                                                                                                                |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| ProjectCreate    | `POST /api/projects` (existing, now includes form_schema)                                                                     |
| RegistrationForm | `GET /api/projects/:id/public`, `POST /api/uploads/photo/:id`, `POST /api/uploads/file/:id`, `POST /api/members/register/:id` |
| BulkDashboard    | `GET /api/projects/:id`, `GET /api/form-fields/:id`, `POST /api/sheets/fetch`, `POST /api/sheets/import/:id`                  |
