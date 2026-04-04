import {
  firstGrapheme,
  splitGraphemes,
  uppercaseLatinOnly,
} from "./textSupport";

const RESERVED_MEMBERSHIP_KEYS = new Set([
  "membership_id",
  "membership id",
  "membershipid",
  "membership-id",
  "id_number",
  "id number",
  "idnumber",
]);

const STANDARD_MEMBER_KEYS = new Set([
  ...RESERVED_MEMBERSHIP_KEYS,
  "name",
  "email",
  "role",
  "dob",
  "gender",
  "blood_group",
  "blood group",
  "bloodgroup",
  "photo",
  "photo_url",
  "photo url",
  "address",
]);

function tokenizeWords(value) {
  return String(value || "")
    .normalize("NFC")
    .match(/[\p{L}\p{N}\p{M}]+/gu) || [];
}

function normalizeKey(key) {
  return String(key || "").trim().toLowerCase().replace(/\s+/g, " ");
}

export function buildOrganizationAbbreviation(orgName) {
  const words = tokenizeWords(orgName);
  if (words.length === 0) return "ORG";

  if (words.length === 1) {
    const shortWord = splitGraphemes(words[0]).slice(0, 3).join("");
    return uppercaseLatinOnly(shortWord || "ORG");
  }

  const initials = words
    .slice(0, 3)
    .map((word) => firstGrapheme(word))
    .join("");

  return uppercaseLatinOnly(initials || "ORG");
}

export function generateMembershipId(orgName, rowNum, date = new Date()) {
  const prefix = buildOrganizationAbbreviation(orgName);
  const yy = String(date.getFullYear()).slice(-2);
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const seq = String(Math.max(1, Number(rowNum) || 1)).padStart(5, "0");
  return `${prefix}-${yy}${mm}-${seq}`;
}

export function extractMembershipId(source) {
  const directCandidates = [
    source?.id_number,
    source?.membership_id,
    source?.membershipId,
  ];

  const directMatch = directCandidates.find(
    (value) => typeof value === "string" && value.trim(),
  );
  if (directMatch) return directMatch.trim();

  const customFields = source?.custom_fields || source?.projectCustomFields;
  if (!customFields || typeof customFields !== "object") return "";

  for (const [key, value] of Object.entries(customFields)) {
    if (
      RESERVED_MEMBERSHIP_KEYS.has(normalizeKey(key)) &&
      typeof value === "string" &&
      value.trim()
    ) {
      return value.trim();
    }
  }

  return "";
}

export function filterCustomMemberFields(customFields = {}) {
  return Object.fromEntries(
    Object.entries(customFields).filter(
      ([key]) => !STANDARD_MEMBER_KEYS.has(normalizeKey(key)),
    ),
  );
}
