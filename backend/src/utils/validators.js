/**
 * Input Validators
 * ────────────────
 * Pure validation functions used by controllers before any database
 * operation.  Never trust incoming data.
 *
 * Each function returns `{ valid, message }`.
 */

/**
 * Validates a single member object for ID generation.
 *
 * Required fields:
 *   - name   (non-empty string, max 120 chars)
 *   - role   (non-empty string, max 60 chars)
 *
 * Optional but validated if present:
 *   - id_number  (max 40 chars, alphanumeric + dashes)
 *   - dob        (ISO date string)
 *   - gender     (Male | Female | Other)
 *   - photo_url  (valid URL)
 *   - address    (max 300 chars)
 */
const validateMember = (member) => {
  if (!member || typeof member !== "object") {
    return { valid: false, message: "Member data must be an object." };
  }

  // ── Name ───────────────────────────────────────────────────
  if (!member.name || typeof member.name !== "string" || !member.name.trim()) {
    return { valid: false, message: "Name is required." };
  }
  if (member.name.trim().length > 120) {
    return { valid: false, message: "Name must not exceed 120 characters." };
  }

  // ── Role ───────────────────────────────────────────────────
  if (!member.role || typeof member.role !== "string" || !member.role.trim()) {
    return { valid: false, message: "Role is required." };
  }
  if (member.role.trim().length > 60) {
    return { valid: false, message: "Role must not exceed 60 characters." };
  }

  // ── ID Number (optional) ──────────────────────────────────
  if (member.id_number !== undefined && member.id_number !== "") {
    if (typeof member.id_number !== "string") {
      return { valid: false, message: "ID number must be a string." };
    }
    if (member.id_number.length > 40) {
      return {
        valid: false,
        message: "ID number must not exceed 40 characters.",
      };
    }
    if (!/^[a-zA-Z0-9\-_]+$/.test(member.id_number)) {
      return {
        valid: false,
        message:
          "ID number may only contain letters, digits, hyphens, and underscores.",
      };
    }
  }

  // ── DOB (optional) ────────────────────────────────────────
  if (member.dob !== undefined && member.dob !== "") {
    if (isNaN(Date.parse(member.dob))) {
      return { valid: false, message: "DOB must be a valid date." };
    }
  }

  // ── Gender (optional) ─────────────────────────────────────
  const allowedGenders = ["Male", "Female", "Other"];
  if (
    member.gender !== undefined &&
    member.gender !== "" &&
    !allowedGenders.includes(member.gender)
  ) {
    return {
      valid: false,
      message: `Gender must be one of: ${allowedGenders.join(", ")}.`,
    };
  }

  // ── Photo URL (optional) ──────────────────────────────────
  if (member.photo_url !== undefined && member.photo_url !== "") {
    try {
      new URL(member.photo_url);
    } catch {
      return { valid: false, message: "Photo URL must be a valid URL." };
    }
  }

  // ── Address (optional) ────────────────────────────────────
  if (member.address !== undefined && member.address !== "") {
    if (typeof member.address !== "string" || member.address.length > 300) {
      return {
        valid: false,
        message: "Address must be a string under 300 characters.",
      };
    }
  }

  return { valid: true, message: "OK" };
};

/** Max members per API batch (configurable via BULK_BATCH_LIMIT env var) */
const BULK_BATCH_LIMIT = parseInt(process.env.BULK_BATCH_LIMIT, 10) || 50;

/**
 * Validates the bulk-generation payload.
 * Expects `{ members: [...] }` with 1-BULK_BATCH_LIMIT members.
 */
const validateBulkPayload = (body) => {
  if (!body || !Array.isArray(body.members)) {
    return {
      valid: false,
      message: 'Request body must include a "members" array.',
    };
  }
  if (body.members.length === 0) {
    return { valid: false, message: "Members array must not be empty." };
  }
  if (body.members.length > BULK_BATCH_LIMIT) {
    return {
      valid: false,
      message: `Maximum ${BULK_BATCH_LIMIT} members per batch.`,
    };
  }

  for (let i = 0; i < body.members.length; i++) {
    const result = validateMember(body.members[i]);
    if (!result.valid) {
      return {
        valid: false,
        message: `Member at index ${i}: ${result.message}`,
      };
    }
  }

  return { valid: true, message: "OK" };
};

/**
 * Validates a UUID string (v4).
 */
const isValidUUID = (str) => {
  if (typeof str !== "string") return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    str,
  );
};

module.exports = { validateMember, validateBulkPayload, isValidUUID };
