# 12 — Dynamic Form Builder, File Uploads & Google Sheets Import

> **Added in:** Phase 4 — SaaS Platform Enhancement

---

## Overview

Three interconnected features were added:

1. **Dynamic Form Builder** — Admins define custom form fields per project (11 field types)
2. **File/Photo Uploads** — Registration forms can accept file and photo uploads via base64 encoding
3. **Google Sheets Import** — Bulk-import members from a publicly shared Google Sheet with column mapping

---

## 1. Dynamic Form Builder

### Database: `form_fields` table

```sql
CREATE TABLE form_fields (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id    UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  field_key     TEXT NOT NULL,          -- machine name (auto-generated from label)
  label         TEXT NOT NULL,
  type          TEXT NOT NULL DEFAULT 'text',
  required      BOOLEAN DEFAULT false,
  placeholder   TEXT DEFAULT '',
  description   TEXT DEFAULT '',        -- help text shown below label
  validation_rules JSONB DEFAULT '{}',  -- { minLength, maxLength, pattern, min, max }
  options       JSONB DEFAULT '[]',     -- for dropdown, radio, checkbox
  default_value TEXT DEFAULT '',
  sort_order    INT DEFAULT 0,
  is_system     BOOLEAN DEFAULT false,  -- name, email, photo are system fields
  version       INT DEFAULT 1,
  created_at    TIMESTAMPTZ DEFAULT now()
);
```

**Unique constraint:** `(project_id, field_key, version)` — allows the same field key across versions.

### System Fields

Three immutable system fields are auto-seeded when a project is created:

| field_key | type           | required | is_system |
| --------- | -------------- | -------- | --------- |
| `name`    | `text`         | true     | true      |
| `email`   | `email`        | true     | true      |
| `photo`   | `photo_upload` | false    | true      |

System fields cannot be deleted or have their `is_system` flag changed.

### Supported Field Types (11)

| Type           | Renders As            | Options Used? |
| -------------- | --------------------- | ------------- |
| `text`         | Text input            | No            |
| `email`        | Email input           | No            |
| `phone`        | Tel input             | No            |
| `number`       | Number input          | No            |
| `textarea`     | Multi-line textarea   | No            |
| `dropdown`     | `<select>` element    | Yes (array)   |
| `radio`        | Radio button group    | Yes (array)   |
| `checkbox`     | Checkbox group        | Yes (array)   |
| `date`         | Date picker           | No            |
| `file_upload`  | File upload (base64)  | No            |
| `photo_upload` | Image upload (base64) | No            |

### Versioning Strategy

The service (`formFieldService.js`) uses **smart versioning**:

- If the project has **no** pending/approved members → **edit in-place** (same version)
- If the project has members → **create new version** (copies system fields, inserts new custom fields)
- The `projects.form_version` column tracks the current active version
- The legacy `projects.form_schema` JSONB column is kept in sync for backward compatibility

### API Endpoints

| Method | Route                                 | Auth | Description                         |
| ------ | ------------------------------------- | ---- | ----------------------------------- |
| GET    | `/api/form-fields/:projectId/public`  | None | Public fields for registration form |
| GET    | `/api/form-fields/:projectId`         | JWT  | All fields (admin)                  |
| PUT    | `/api/form-fields/:projectId`         | JWT  | Save/replace custom fields          |
| POST   | `/api/form-fields/:projectId/seed`    | JWT  | Re-seed system fields               |
| GET    | `/api/form-fields/:projectId/mapping` | JWT  | Field mapping for CSV/card          |
| PATCH  | `/api/form-fields/field/:fieldId`     | JWT  | Update single field                 |
| DELETE | `/api/form-fields/field/:fieldId`     | JWT  | Delete field (not system)           |

### Backend Files

- `services/formFieldService.js` — CRUD, versioning, seeding logic
- `controllers/formFieldController.js` — HTTP handlers
- `routes/formFieldRoutes.js` — Route definitions

---

## 2. File & Photo Uploads

### Approach

Instead of multipart/form-data (which would require `multer`), uploads use **base64 JSON bodies**:

```json
{
  "fileName": "avatar.jpg",
  "fileData": "iVBORw0KGgo...", // base64 string (no prefix)
  "mimeType": "image/jpeg",
  "fieldKey": "photo"
}
```

The server body limit is 10 MB (`server.js` → `express.json({ limit: "10mb" })`).

### Storage

- **Bucket:** `member-uploads` (private, Supabase Storage)
- **Path format:** `{projectId}/{fieldKey}/{timestamp}_{sanitizedFilename}`
- **Tracking table:** `member_uploads` records each upload

### Size & Type Limits

| Endpoint                        | Max Size | Allowed Types                                       |
| ------------------------------- | -------- | --------------------------------------------------- |
| `/api/uploads/photo/:projectId` | 5 MB     | jpeg, png, webp, gif                                |
| `/api/uploads/file/:projectId`  | 5 MB     | jpeg, png, webp, gif, pdf, msword, docx, plain text |

### Signed URLs

`GET /api/uploads/signed-url?path=...` returns a 1-hour signed URL for any uploaded file.

### Backend Files

- `routes/uploadRoutes.js` — All upload endpoints

---

## 3. Google Sheets Import

### Flow

1. Admin pastes a **publicly shared** Google Sheet URL
2. Backend extracts the Sheet ID and fetches CSV via `https://docs.google.com/spreadsheets/d/{id}/export?format=csv`
3. Returns headers + 10 preview rows to the frontend
4. Admin maps sheet columns → form field keys using a dropdown UI
5. Admin clicks "Import" — backend applies mapping, validates against form fields, bulk-inserts members

### Column Mapping

```json
{
  "Full Name": "name",
  "Email Address": "email",
  "Department": "department",
  "Roll Number": "roll_number"
}
```

The frontend auto-maps columns whose names exactly match field labels or field keys (case-insensitive).

### Validation

- Required fields must be present and non-empty
- Email fields are validated with a regex
- Rows that fail validation are reported but don't block valid rows

### API Endpoints

| Method | Route                           | Auth | Description                    |
| ------ | ------------------------------- | ---- | ------------------------------ |
| POST   | `/api/sheets/fetch`             | JWT  | Fetch sheet and return preview |
| POST   | `/api/sheets/import/:projectId` | JWT  | Import with column mapping     |

### Backend Files

- `services/googleSheetsService.js` — Fetch, parse CSV, map columns, validate
- `controllers/sheetImportController.js` — HTTP handlers
- `routes/sheetImportRoutes.js` — Route definitions

---

## 4. Frontend Components

### ProjectCreate.jsx (Form Builder)

- 11 field types with per-type icons
- Expandable/collapsible field configuration cards
- Field properties: label, type, placeholder, description, options, default_value, validation_rules, required
- Duplicate field button
- Live preview panel (toggleable) showing how the form will look
- System fields shown as badges (not editable)

### RegistrationForm.jsx (Public Form)

- Reads from `form_fields` API with fallback to legacy `form_schema`
- Renders all 11 field types including photo/file upload
- Photo upload uses base64 encoding → `/api/uploads/photo/:projectId`
- File upload uses base64 encoding → `/api/uploads/file/:projectId`
- Shows field descriptions as help text
- Checkbox fields stored as arrays
- Upload progress indicators

### BulkDashboard.jsx (Sheets Import)

- 3-step wizard: Paste URL → Map Columns → Results
- Auto-maps columns by label/key matching
- Preview table shows mapped vs unmapped columns
- Auto-approve toggle for imported members
- Validation error summary after import

---

## 5. Migration

Run `backend/migrations/001_form_fields.sql` to create:

- `form_fields` table with indexes and RLS policies
- `member_uploads` table with RLS policies
- `form_version` and `card_field_mapping` columns on `projects`
- `seed_system_fields()` PL/pgSQL function
- `member-uploads` storage bucket (private)
