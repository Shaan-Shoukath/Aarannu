# Level 12 — How to Add a New Feature End-to-End

The capstone of this course. You'll add a completely new feature — member attendance notes — from database schema to frontend API call, without touching anything that isn't necessary.

This is the pattern for every new feature in this project. Learn it once, apply it everywhere.

---

## What We're Building

**Feature:** Admins can leave a text note on any project member record (e.g. "Attended orientation", "Special accommodation needed").

This requires:
1. A new `notes` column on `project_members`
2. A SQL migration to add it
3. A service function to update it
4. A controller endpoint
5. A route definition
6. A frontend API call

---

## Step 0 — Think Before You Code

Before writing a single line, answer these questions:

1. **Where does the data live?** → `project_members` table, new `notes TEXT` column
2. **Who can do this?** → Only org admins (not members, not public)
3. **What constraints?** → Optional (NULLable), text, no length limit needed
4. **New table needed?** → No — it's just a column on an existing table
5. **Token cost?** → No — notes are free to add
6. **Does it break existing functionality?** → No — new NULLable column has no effect on existing queries

Answering these prevents 90% of bugs before writing code.

---

## Step 1 — Write the Migration

**File: `backend/migrations/001_add_member_notes.sql`**

```sql
-- Add 'notes' column to project_members
-- Safe to run multiple times (IF NOT EXISTS prevents errors on repeat runs)

ALTER TABLE public.project_members
ADD COLUMN IF NOT EXISTS notes TEXT DEFAULT NULL;

-- No index needed: this column is only updated/read per-member, not filtered across all members
-- No RLS change needed: existing policies still apply
```

**Run it:** Go to Supabase Dashboard → SQL Editor → paste → Run.

Verify it worked:
```sql
-- Check the column exists with the right type
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'project_members'
  AND column_name = 'notes';
-- Should return: notes | text | YES
```

---

## Step 2 — Add the Service Function

The service layer contains pure business logic — no HTTP, no `req`, no `res`. Just functions that talk to the database.

**File: `backend/src/services/projectMemberService.js`** (add to existing file)

```js
/**
 * Update the admin note on a project member.
 *
 * @param {string} memberId - UUID of the project_member row
 * @param {string|null} notes - The note text, or null to clear it
 * @returns {Promise<Object>} The updated member row
 */
const updateMemberNotes = async (memberId, notes) => {
  // Sanitise: empty string should be stored as null (not as empty string)
  const sanitisedNotes = notes?.trim() || null;

  const { data, error } = await supabase
    .from('project_members')
    .update({ notes: sanitisedNotes })
    .eq('id', memberId)
    .select('id, name, notes')  // return only what we need, not the whole row
    .single();

  if (error) throw error;
  if (!data) throw new Error(`Member ${memberId} not found`);

  return data;
};

module.exports = {
  // ... existing exports ...
  updateMemberNotes,
};
```

**Why a service function and not just put the DB call in the controller?**

- The controller handles HTTP (status codes, `req`, `res`)
- The service handles data (SQL, business rules)
- If you later need to update notes from somewhere else (a batch job, another controller), you reuse the service — not the controller

---

## Step 3 — Add the Controller

The controller reads the HTTP request, calls the service, and sends the response.

**File: `backend/src/controllers/projectMemberController.js`** (add to existing file)

```js
const { updateMemberNotes } = require('../services/projectMemberService');

/**
 * PATCH /api/members/:memberId/notes
 * Body: { notes: "Some note text" }
 */
const patchMemberNotes = async (req, res) => {
  const { memberId } = req.params;   // from the URL
  const { notes } = req.body;        // from the JSON body

  // Validation: notes must be a string or null (not a number, object, etc.)
  if (notes !== undefined && notes !== null && typeof notes !== 'string') {
    return res.status(400).json({
      error: 'Validation Error',
      message: 'notes must be a string or null',
    });
  }

  // Delegate to service
  const updated = await updateMemberNotes(memberId, notes);

  res.json({
    message: 'Notes updated',
    member: updated,
  });
  // Express 5: if updateMemberNotes throws, it automatically goes to errorHandler
};

module.exports = {
  // ... existing exports ...
  patchMemberNotes,
};
```

**Notice:**
- The controller does the HTTP-level validation (is `notes` the right type?)
- The service does the data-level logic (sanitise empty strings, actual DB write)
- The controller never writes raw SQL
- The controller never imports `supabase` directly

---

## Step 4 — Add the Route

Routes wire URLs to controllers. They also declare which middleware runs.

**File: `backend/src/routes/projectMemberRoutes.js`** (add to existing file)

```js
const { patchMemberNotes } = require('../controllers/projectMemberController');
const verifyToken = require('../middleware/verifyToken');
const checkOrgRole = require('../middleware/checkOrgRole');

// Existing routes above...

// PATCH /api/members/:memberId/notes
router.patch(
  '/:memberId/notes',
  verifyToken,                   // 1. Must be logged in
  checkOrgRole('admin'),         // 2. Must be at least an org admin
  patchMemberNotes               // 3. The controller
);
```

**Middleware chain explanation:**
1. `verifyToken` — reads `Authorization: Bearer <jwt>`, calls Supabase, sets `req.user`
2. `checkOrgRole('admin')` — reads `org_members` for this user, confirms role ≥ admin
3. `patchMemberNotes` — only reached if both pass

If `verifyToken` fails (bad JWT) → sends 401, stops here.  
If `checkOrgRole` fails (not an admin) → sends 403, stops here.  
Only if both pass does `patchMemberNotes` run.

---

## Step 5 — Test It (Before the Frontend)

Always test the backend independently using curl or Postman before building the frontend. This isolates where bugs are.

```bash
# Get a JWT: login to the frontend, open DevTools → Application → localStorage
# Copy the access_token value

JWT="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
MEMBER_ID="your-member-uuid-here"

# Test the endpoint
curl -X PATCH http://localhost:5000/api/members/$MEMBER_ID/notes \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $JWT" \
  -d '{"notes": "Attended orientation session"}'

# Expected response:
# { "message": "Notes updated", "member": { "id": "...", "name": "Ali Hassan", "notes": "Attended orientation session" } }

# Test with null (clear the note)
curl -X PATCH http://localhost:5000/api/members/$MEMBER_ID/notes \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $JWT" \
  -d '{"notes": null}'

# Test auth: no JWT
curl -X PATCH http://localhost:5000/api/members/$MEMBER_ID/notes \
  -H "Content-Type: application/json" \
  -d '{"notes": "test"}'
# Expected: 401 Unauthorized

# Test validation: wrong type
curl -X PATCH http://localhost:5000/api/members/$MEMBER_ID/notes \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $JWT" \
  -d '{"notes": 12345}'
# Expected: 400 Validation Error
```

All four cases should behave as expected before you write frontend code.

---

## Step 6 — Call It From the Frontend

Now that the backend is working, add the frontend call.

**Wherever you display a member row (e.g. `ProjectDashboard.jsx`):**

```jsx
// State for the note being edited
const [editingNoteFor, setEditingNoteFor] = useState(null); // memberId or null
const [noteText, setNoteText] = useState('');
const [savingNote, setSavingNote] = useState(false);

// Function to save the note
const saveNote = async (memberId) => {
  setSavingNote(true);
  try {
    const { data: { session } } = await supabase.auth.getSession();

    const response = await fetch(
      `${import.meta.env.VITE_API_URL}/api/members/${memberId}/notes`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ notes: noteText.trim() || null }),
      }
    );

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.message || 'Failed to save note');
    }

    // Update local state so UI reflects immediately (no need to re-fetch)
    setMembers(prev =>
      prev.map(m => m.id === memberId ? { ...m, notes: noteText.trim() || null } : m)
    );
    setEditingNoteFor(null);   // close the edit UI
  } catch (err) {
    alert(`Error saving note: ${err.message}`);
  } finally {
    setSavingNote(false);
  }
};

// In the member row JSX:
<td>
  {editingNoteFor === member.id ? (
    // Edit mode
    <div style={{ display: 'flex', gap: 8 }}>
      <input
        value={noteText}
        onChange={e => setNoteText(e.target.value)}
        placeholder="Add note..."
        autoFocus
      />
      <button onClick={() => saveNote(member.id)} disabled={savingNote}>
        {savingNote ? 'Saving...' : 'Save'}
      </button>
      <button onClick={() => setEditingNoteFor(null)}>Cancel</button>
    </div>
  ) : (
    // View mode
    <span
      onClick={() => { setEditingNoteFor(member.id); setNoteText(member.notes || ''); }}
      style={{ cursor: 'pointer', color: member.notes ? 'inherit' : '#94a3b8' }}
      title="Click to edit note"
    >
      {member.notes || 'Add note...'}
    </span>
  )}
</td>
```

**Key pattern:** Update local state immediately on success (optimistic UI), don't re-fetch the whole list. The user sees feedback instantly.

---

## Step 7 — Make Sure the Column Is Returned

The member list query on the frontend needs to include `notes` in its SELECT, otherwise it'll always be `undefined`:

```js
// Wherever you fetch project members (frontend or backend):
const { data } = await supabase
  .from('project_members')
  .select('id, name, email, status, delivery_status, notes')    // ← add notes here
  .eq('project_id', projectId);
```

If `notes` isn't in the select, the column data is silently omitted — no error. A common source of "it's always null" bugs.

---

## The Complete Map of What Changed

```
backend/migrations/
  001_add_member_notes.sql          ← NEW: ALTER TABLE ADD COLUMN

backend/src/services/
  projectMemberService.js           ← MODIFIED: added updateMemberNotes()

backend/src/controllers/
  projectMemberController.js        ← MODIFIED: added patchMemberNotes()

backend/src/routes/
  projectMemberRoutes.js            ← MODIFIED: added PATCH /:memberId/notes

frontend/src/pages/
  ProjectDashboard.jsx              ← MODIFIED: added note editing UI + fetch call
```

5 files total. Nothing else touched.

---

## The General Pattern (Apply This to Any Feature)

```
1. THINK
   ├── Which table? New column, new table, or existing column?
   ├── Who has access? (no auth / authenticated / approved / org role / admin)
   ├── What validates? (types, lengths, required fields)
   └── Any cost? (tokens, rate limits)

2. MIGRATE
   └── Write SQL — ADD COLUMN / CREATE TABLE (idempotent IF NOT EXISTS)

3. SERVICE
   └── Pure function: takes data, talks to DB, returns result or throws

4. CONTROLLER
   ├── Read req.params, req.body, req.user
   ├── Validate HTTP-level input (types, presence)
   ├── Call service
   └── Send res.json() or let error propagate to errorHandler

5. ROUTE
   ├── Choose HTTP method (GET=read, POST=create, PATCH=partial update, DELETE=remove)
   ├── Stack middleware: verifyToken → checkOrgRole → controller
   └── Mount in server.js if it's a new router

6. TEST
   └── curl / Postman before building frontend
       Test: happy path, missing auth, missing body, edge cases

7. FRONTEND
   ├── fetch() with Authorization header
   ├── Update local state immediately (don't re-fetch)
   └── Handle loading + error states
```

This is not specific to this project. It's how any layered Express backend is built correctly.
