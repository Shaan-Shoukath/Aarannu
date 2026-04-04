/**
 * Validator Tests
 * ───────────────
 * Unit tests for input validation functions.
 * These are pure functions with no external dependencies.
 */

const {
  validateMember,
  validateBulkPayload,
  isValidUUID,
} = require("../utils/validators");

describe("validateMember", () => {
  const validMember = { name: "John Doe", role: "Engineer" };

  test("accepts valid member with required fields", () => {
    const result = validateMember(validMember);
    expect(result.valid).toBe(true);
  });

  test("rejects null input", () => {
    const result = validateMember(null);
    expect(result.valid).toBe(false);
    expect(result.message).toMatch(/object/i);
  });

  test("rejects non-object input", () => {
    expect(validateMember("string").valid).toBe(false);
    expect(validateMember(42).valid).toBe(false);
  });

  test("rejects missing name", () => {
    const result = validateMember({ role: "Admin" });
    expect(result.valid).toBe(false);
    expect(result.message).toMatch(/name/i);
  });

  test("rejects empty name", () => {
    const result = validateMember({ name: "   ", role: "Admin" });
    expect(result.valid).toBe(false);
  });

  test("rejects name over 120 characters", () => {
    const result = validateMember({ name: "A".repeat(121), role: "Admin" });
    expect(result.valid).toBe(false);
    expect(result.message).toMatch(/120/);
  });

  test("rejects missing role", () => {
    const result = validateMember({ name: "John" });
    expect(result.valid).toBe(false);
    expect(result.message).toMatch(/role/i);
  });

  test("rejects role over 60 characters", () => {
    const result = validateMember({ name: "John", role: "X".repeat(61) });
    expect(result.valid).toBe(false);
  });

  test("accepts valid optional id_number", () => {
    const result = validateMember({ ...validMember, id_number: "ABC-123_Z" });
    expect(result.valid).toBe(true);
  });

  test("accepts Malayalam characters in id_number", () => {
    const result = validateMember({
      ...validMember,
      id_number: "നവ-2604-00001",
    });
    expect(result.valid).toBe(true);
  });

  test("rejects id_number with special chars", () => {
    const result = validateMember({ ...validMember, id_number: "abc@#$" });
    expect(result.valid).toBe(false);
    expect(result.message).toMatch(/letters.*digits/i);
  });

  test("rejects id_number over 40 characters", () => {
    const result = validateMember({
      ...validMember,
      id_number: "A".repeat(41),
    });
    expect(result.valid).toBe(false);
  });

  test("accepts valid DOB", () => {
    const result = validateMember({ ...validMember, dob: "2000-01-15" });
    expect(result.valid).toBe(true);
  });

  test("rejects invalid DOB", () => {
    const result = validateMember({ ...validMember, dob: "not-a-date" });
    expect(result.valid).toBe(false);
  });

  test("accepts valid gender values", () => {
    expect(validateMember({ ...validMember, gender: "Male" }).valid).toBe(true);
    expect(validateMember({ ...validMember, gender: "Female" }).valid).toBe(true);
    expect(validateMember({ ...validMember, gender: "Other" }).valid).toBe(true);
  });

  test("rejects invalid gender", () => {
    const result = validateMember({ ...validMember, gender: "Unknown" });
    expect(result.valid).toBe(false);
  });

  test("accepts valid photo URL", () => {
    const result = validateMember({
      ...validMember,
      photo_url: "https://example.com/photo.jpg",
    });
    expect(result.valid).toBe(true);
  });

  test("rejects invalid photo URL", () => {
    const result = validateMember({
      ...validMember,
      photo_url: "not-a-url",
    });
    expect(result.valid).toBe(false);
  });

  test("accepts valid address", () => {
    const result = validateMember({
      ...validMember,
      address: "123 Main St, City",
    });
    expect(result.valid).toBe(true);
  });

  test("rejects address over 300 characters", () => {
    const result = validateMember({
      ...validMember,
      address: "A".repeat(301),
    });
    expect(result.valid).toBe(false);
  });

  test("skips validation for empty optional fields", () => {
    const result = validateMember({
      ...validMember,
      id_number: "",
      dob: "",
      gender: "",
      photo_url: "",
      address: "",
    });
    expect(result.valid).toBe(true);
  });
});

describe("validateBulkPayload", () => {
  test("accepts valid bulk payload", () => {
    const result = validateBulkPayload({
      members: [{ name: "Alice", role: "Dev" }],
    });
    expect(result.valid).toBe(true);
  });

  test("rejects missing members array", () => {
    expect(validateBulkPayload({}).valid).toBe(false);
    expect(validateBulkPayload(null).valid).toBe(false);
  });

  test("rejects empty members array", () => {
    const result = validateBulkPayload({ members: [] });
    expect(result.valid).toBe(false);
  });

  test("rejects batch over limit", () => {
    const members = Array.from({ length: 51 }, (_, i) => ({
      name: `User ${i}`,
      role: "Member",
    }));
    const result = validateBulkPayload({ members });
    expect(result.valid).toBe(false);
    expect(result.message).toMatch(/maximum/i);
  });

  test("reports invalid member with index", () => {
    const result = validateBulkPayload({
      members: [
        { name: "Valid", role: "Dev" },
        { name: "", role: "Dev" }, // invalid
      ],
    });
    expect(result.valid).toBe(false);
    expect(result.message).toMatch(/index 1/i);
  });
});

describe("isValidUUID", () => {
  test("accepts valid v4 UUID", () => {
    expect(isValidUUID("550e8400-e29b-41d4-a716-446655440000")).toBe(true);
  });

  test("rejects non-v4 UUID", () => {
    expect(isValidUUID("550e8400-e29b-31d4-a716-446655440000")).toBe(false);
  });

  test("rejects non-string", () => {
    expect(isValidUUID(123)).toBe(false);
    expect(isValidUUID(null)).toBe(false);
  });

  test("rejects empty string", () => {
    expect(isValidUUID("")).toBe(false);
  });

  test("rejects malformed UUID", () => {
    expect(isValidUUID("not-a-uuid")).toBe(false);
    expect(isValidUUID("550e8400-e29b-41d4-c716-446655440000")).toBe(false); // wrong variant
  });
});
