# 14 – Dynamic Form System

## Overview

Each project has a configurable registration form with dynamic custom fields. The form schema is stored as JSONB in the `projects.form_schema` column.

---

## Form Schema Format

```json
[
  { "label": "Department", "type": "text", "required": true },
  {
    "label": "Year",
    "type": "select",
    "options": ["1st", "2nd", "3rd", "4th"],
    "required": true
  },
  {
    "label": "Blood Group",
    "type": "select",
    "options": ["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"],
    "required": false
  },
  { "label": "Role", "type": "text", "required": false }
]
```

### Field Types

| Type       | Description                      |
| ---------- | -------------------------------- |
| `text`     | Single line text input           |
| `select`   | Dropdown with predefined options |
| `textarea` | Multi-line text                  |
| `email`    | Email input with validation      |
| `date`     | Date picker                      |
| `file`     | File upload (photo)              |

---

## How It Works

1. **Admin creates project** with `form_schema` defining custom fields
2. **Registration form** (`/register/:projectId`) renders fields dynamically from schema
3. **Member submits form** → data stored in `project_members.custom_fields` as JSONB
4. **Card generation** reads `custom_fields` and maps to card layout

---

## Standard Fields (always present)

These fields are part of the `project_members` table columns (not custom):

- `name` (required)
- `email` (optional)
- `photo_url` (via file upload)

Custom fields go into the `custom_fields` JSONB column.

---

## API

**Public registration:**

```
POST /api/members/register/:projectId
Body: { name, email, photoUrl, customFields: { Department: "CS", Year: "3rd" } }
```

**Admin configuring form:**

```
PUT /api/projects/:projectId
Body: { formSchema: [...field definitions...] }
```

---

## Files

| File                                                 | Purpose              |
| ---------------------------------------------------- | -------------------- |
| `frontend/src/pages/RegistrationForm.jsx`            | Public dynamic form  |
| `frontend/src/pages/ProjectCreate.jsx`               | Form schema builder  |
| `backend/src/controllers/projectMemberController.js` | Registration handler |
