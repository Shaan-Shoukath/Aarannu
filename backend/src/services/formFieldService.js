/**
 * Form Field Service
 * ──────────────────
 * CRUD operations for the form_fields table.
 * Handles dynamic form definitions, versioning, and system field seeding.
 */

const { supabase } = require("../config/supabaseClient");

// ── System fields that every project gets ─────────────────────
const SYSTEM_FIELDS = [
  {
    field_key: "name",
    label: "Full Name",
    type: "text",
    required: true,
    placeholder: "John Doe",
    sort_order: 0,
  },
  {
    field_key: "email",
    label: "Email",
    type: "email",
    required: true,
    placeholder: "john@example.com",
    sort_order: 1,
  },
  {
    field_key: "photo",
    label: "Photo",
    type: "photo_upload",
    required: false,
    placeholder: "",
    sort_order: 2,
  },
];

/**
 * Seed the 3 system fields for a new project.
 * Idempotent — skips if already seeded for this version.
 */
const seedSystemFields = async (projectId, version = 1) => {
  const rows = SYSTEM_FIELDS.map((f) => ({
    project_id: projectId,
    ...f,
    is_system: true,
    version,
  }));

  return supabase
    .from("form_fields")
    .upsert(rows, { onConflict: "project_id,field_key,version" })
    .select();
};

/**
 * Get all fields for a project at a specific version.
 * If version is null, returns the latest version.
 */
const getFieldsByProject = async (projectId, version = null) => {
  if (!version) {
    // Get the latest version number from the project
    const { data: project } = await supabase
      .from("projects")
      .select("form_version")
      .eq("id", projectId)
      .single();
    version = project?.form_version || 1;
  }

  return supabase
    .from("form_fields")
    .select("*")
    .eq("project_id", projectId)
    .eq("version", version)
    .order("sort_order", { ascending: true });
};

/**
 * Get only custom fields (non-system) for a project.
 */
const getCustomFields = async (projectId, version = null) => {
  if (!version) {
    const { data: project } = await supabase
      .from("projects")
      .select("form_version")
      .eq("id", projectId)
      .single();
    version = project?.form_version || 1;
  }

  return supabase
    .from("form_fields")
    .select("*")
    .eq("project_id", projectId)
    .eq("version", version)
    .eq("is_system", false)
    .order("sort_order", { ascending: true });
};

/**
 * Save/replace all custom fields for a project.
 * System fields are never touched by this function.
 *
 * Strategy:
 *   - If the project has NO approved members, edit in-place (same version).
 *   - If it has approved members, create a NEW version (non-destructive).
 *
 * @param {string} projectId
 * @param {object[]} fields - Array of { label, type, required, placeholder, description, validation_rules, options, default_value }
 * @param {boolean} forceNewVersion - Force creating a new version even if no members exist
 * @returns {Promise<{data, error, version}>}
 */
const saveCustomFields = async (projectId, fields, forceNewVersion = false) => {
  // Get current project version
  const { data: project } = await supabase
    .from("projects")
    .select("form_version")
    .eq("id", projectId)
    .single();

  const currentVersion = project?.form_version || 1;
  let targetVersion = currentVersion;

  // Check if we need a new version (non-destructive edit)
  if (forceNewVersion) {
    targetVersion = currentVersion + 1;
  } else {
    // Check for approved members — if any exist, create new version
    const { count } = await supabase
      .from("project_members")
      .select("id", { count: "exact", head: true })
      .eq("project_id", projectId)
      .in("status", ["approved", "pending"]);

    if (count > 0) {
      targetVersion = currentVersion + 1;
    }
  }

  // If new version, copy system fields to the new version
  if (targetVersion > currentVersion) {
    const { data: sysFields } = await supabase
      .from("form_fields")
      .select("*")
      .eq("project_id", projectId)
      .eq("version", currentVersion)
      .eq("is_system", true);

    if (sysFields && sysFields.length > 0) {
      const newSysRows = sysFields.map(
        ({ id, created_at, updated_at, ...rest }) => ({
          ...rest,
          version: targetVersion,
          updated_at: new Date().toISOString(),
        }),
      );
      await supabase.from("form_fields").insert(newSysRows);
    }
  } else {
    // Delete existing custom fields for this version (replace mode)
    await supabase
      .from("form_fields")
      .delete()
      .eq("project_id", projectId)
      .eq("version", targetVersion)
      .eq("is_system", false);
  }

  // Insert new custom fields
  const systemFieldCount = SYSTEM_FIELDS.length; // 3
  const rows = fields.map((f, idx) => ({
    project_id: projectId,
    field_key:
      f.field_key ||
      f.label
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_|_$/g, ""),
    label: f.label,
    type: f.type || "text",
    required: f.required || false,
    placeholder: f.placeholder || "",
    description: f.description || "",
    validation_rules: f.validation_rules || {},
    options: f.options || [],
    default_value: f.default_value || "",
    sort_order: systemFieldCount + idx,
    is_system: false,
    version: targetVersion,
  }));

  let insertResult = { data: null, error: null };
  if (rows.length > 0) {
    insertResult = await supabase.from("form_fields").insert(rows).select();
  }

  // Update project form_version
  if (targetVersion !== currentVersion) {
    await supabase
      .from("projects")
      .update({ form_version: targetVersion })
      .eq("id", projectId);
  }

  // Also sync to form_schema JSONB for backward compatibility
  const allFields = [
    ...SYSTEM_FIELDS.map((f) => ({ ...f, is_system: true })),
    ...fields,
  ];
  await supabase
    .from("projects")
    .update({ form_schema: allFields })
    .eq("id", projectId);

  return {
    data: insertResult.data,
    error: insertResult.error,
    version: targetVersion,
  };
};

/**
 * Update a single field.
 */
const updateField = async (fieldId, updates) => {
  const payload = {};
  const allowed = [
    "label",
    "type",
    "required",
    "placeholder",
    "description",
    "validation_rules",
    "options",
    "default_value",
    "sort_order",
  ];
  for (const key of allowed) {
    if (updates[key] !== undefined) payload[key] = updates[key];
  }
  payload.updated_at = new Date().toISOString();

  return supabase
    .from("form_fields")
    .update(payload)
    .eq("id", fieldId)
    .select()
    .single();
};

/**
 * Delete a custom field (system fields cannot be deleted).
 */
const deleteField = async (fieldId) => {
  // Ensure it's not a system field
  const { data: field } = await supabase
    .from("form_fields")
    .select("is_system")
    .eq("id", fieldId)
    .single();

  if (field?.is_system) {
    return {
      error: { message: "Cannot delete system fields (name, email, photo)." },
    };
  }

  return supabase.from("form_fields").delete().eq("id", fieldId);
};

/**
 * Get the field mapping for CSV import.
 * Returns all field keys with their labels and types.
 */
const getFieldMapping = async (projectId) => {
  const { data, error } = await getFieldsByProject(projectId);
  if (error) return { mapping: null, error };

  const mapping = (data || []).map((f) => ({
    field_key: f.field_key,
    label: f.label,
    type: f.type,
    required: f.required,
    is_system: f.is_system,
  }));

  return { mapping, error: null };
};

/**
 * Get fields formatted for public registration form rendering.
 * Returns system fields + custom fields in order.
 */
const getPublicFormFields = async (projectId) => {
  const { data, error } = await getFieldsByProject(projectId);
  if (error) return { fields: null, error };

  const fields = (data || []).map((f) => ({
    field_key: f.field_key,
    label: f.label,
    type: f.type,
    required: f.required,
    placeholder: f.placeholder,
    description: f.description,
    options: f.options || [],
    default_value: f.default_value,
    is_system: f.is_system,
    validation_rules: f.validation_rules || {},
  }));

  return { fields, error: null };
};

module.exports = {
  SYSTEM_FIELDS,
  seedSystemFields,
  getFieldsByProject,
  getCustomFields,
  saveCustomFields,
  updateField,
  deleteField,
  getFieldMapping,
  getPublicFormFields,
};
