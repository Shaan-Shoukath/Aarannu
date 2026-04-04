import { safeFileName } from "./downloadHelpers";
import { extractMembershipId, filterCustomMemberFields } from "./membershipId";
import { generateCardPdf } from "./pdfCardRenderer";
import { DEFAULT_CARD_FONT_FAMILY } from "./textSupport";

export const DELIVERY_PHASE_META = {
  queued: {
    label: "Queued",
    badgeClassName: "text-sky-700 bg-sky-50 border-sky-200",
    countKey: "queued",
  },
  generating_pdf: {
    label: "Generating PDF",
    badgeClassName: "text-violet-700 bg-violet-50 border-violet-200",
    countKey: "generating",
  },
  pdf_ready: {
    label: "PDF Ready",
    badgeClassName: "text-indigo-700 bg-indigo-50 border-indigo-200",
    countKey: "generated",
  },
  sending_email: {
    label: "Sending Email",
    badgeClassName: "text-amber-700 bg-amber-50 border-amber-200",
    countKey: "sending",
  },
  sent: {
    label: "Sent",
    badgeClassName: "text-emerald-700 bg-emerald-50 border-emerald-200",
    countKey: "sent",
  },
  failed_prepare: {
    label: "Prepare Failed",
    badgeClassName: "text-rose-700 bg-rose-50 border-rose-200",
    countKey: "failed",
  },
  failed_generate: {
    label: "Generate Failed",
    badgeClassName: "text-rose-700 bg-rose-50 border-rose-200",
    countKey: "failed",
  },
  failed_send: {
    label: "Send Failed",
    badgeClassName: "text-rose-700 bg-rose-50 border-rose-200",
    countKey: "failed",
  },
  skipped_no_email: {
    label: "No Email",
    badgeClassName: "text-slate-600 bg-slate-50 border-slate-200",
    countKey: "skipped",
  },
  idle: {
    label: "Not Queued",
    badgeClassName: "text-slate-500 bg-slate-50 border-slate-200",
    countKey: "idle",
  },
};

const ACTIVE_RESUME_PHASES = new Set([
  "queued",
  "generating_pdf",
  "pdf_ready",
  "sending_email",
]);

const RETRYABLE_PHASES = new Set([
  ...ACTIVE_RESUME_PHASES,
  "failed_prepare",
  "failed_generate",
  "failed_send",
]);

function getTemplateDefaults(template = "custom") {
  const isCorporate = template === "corporate" || template === "custom";
  const isStudent = template === "student";
  const isEvent = template === "event";

  return {
    gradientColors: {
      start: isCorporate ? "#2563EB" : isStudent ? "#f97316" : "#f59e0b",
      end: isCorporate ? "#ef4444" : isStudent ? "#9333ea" : "#6366f1",
    },
    cardStyles: {
      bgColor: isEvent ? "#1e1b4b" : "#ffffff",
      fontColor: isEvent ? "#e0e7ff" : "#1e293b",
      fontFamily: DEFAULT_CARD_FONT_FAMILY,
      accentColor: isEvent ? "#818cf8" : "#64748b",
      borderRadius: 12,
      nameFontSize: 20,
      valueFontSize: 14,
      labelFontSize: 9,
      photoScale: 100,
    },
    orientation: isStudent ? "vertical" : "horizontal",
    fullGradientBg: template === "custom" || template === "corporate",
    gradientOpacity: 0.55,
    validityText: isEvent
      ? "Valid for event duration only"
      : isStudent
        ? "Valid for current academic session"
        : "Valid as per subscription plan",
    fieldVisibility: {
      dob: true,
      gender: true,
      blood_group: true,
      role: true,
      address: true,
    },
  };
}

function normalizeCardConfig(project = {}) {
  const defaults = getTemplateDefaults(project?.template || "custom");
  const config = project?.card_config || {};

  return {
    gradientColors: {
      ...defaults.gradientColors,
      ...(config.gradientColors || config.gradient_colors || {}),
    },
    cardStyles: {
      ...defaults.cardStyles,
      ...(config.cardStyles || config.card_styles || {}),
    },
    orientation: config.orientation || defaults.orientation,
    validityText: config.validityText || config.validity_text || defaults.validityText,
    fieldVisibility: {
      ...defaults.fieldVisibility,
      ...(config.fieldVisibility || config.field_visibility || {}),
    },
    customFields: Array.isArray(config.customFields)
      ? config.customFields
      : Array.isArray(config.custom_fields)
        ? config.custom_fields
        : [],
    watermark: config.watermark || null,
    signatureUrl: config.signatureUrl || config.signature_url || "",
    fullGradientBg:
      typeof config.fullGradientBg === "boolean"
        ? config.fullGradientBg
        : typeof config.full_gradient_bg === "boolean"
          ? config.full_gradient_bg
          : defaults.fullGradientBg,
    gradientOpacity:
      typeof config.gradientOpacity === "number"
        ? config.gradientOpacity
        : typeof config.gradient_opacity === "number"
          ? config.gradient_opacity
          : defaults.gradientOpacity,
  };
}

function getCustomFieldDefinitions(member, configCustomFields = []) {
  if (Array.isArray(configCustomFields) && configCustomFields.length > 0) {
    return configCustomFields;
  }

  const customValues = filterCustomMemberFields(member?.custom_fields || {});
  return Object.keys(customValues).map((label) => ({
    label,
    side: "front",
  }));
}

function buildFallbackIdNumber(member) {
  const cardId = member?.delivery_card_id || "";
  if (cardId) {
    return `CARD-${String(cardId).slice(0, 8).toUpperCase()}`;
  }

  const memberId = member?.id || "";
  if (memberId) {
    return `MEM-${String(memberId).slice(0, 8).toUpperCase()}`;
  }

  return "CARD-PENDING";
}

export function getDeliveryMeta(phase) {
  if (!phase) return DELIVERY_PHASE_META.idle;
  return DELIVERY_PHASE_META[phase] || DELIVERY_PHASE_META.idle;
}

export function canRetryDelivery(member) {
  return member?.status === "approved" && RETRYABLE_PHASES.has(member?.delivery_phase);
}

export function canResumeDelivery(member) {
  return member?.status === "approved" && ACTIVE_RESUME_PHASES.has(member?.delivery_phase);
}

export function isDeliveryQueuedMember(member) {
  return member?.status === "approved" && (
    canRetryDelivery(member) || member?.delivery_phase === "queued"
  );
}

export function countDeliveryPhases(members = []) {
  return members.reduce(
    (acc, member) => {
      const countKey = getDeliveryMeta(member?.delivery_phase).countKey;
      acc[countKey] = (acc[countKey] || 0) + 1;
      return acc;
    },
    {
      queued: 0,
      generating: 0,
      generated: 0,
      sending: 0,
      sent: 0,
      failed: 0,
      skipped: 0,
      idle: 0,
    },
  );
}

export function buildDeliveryPayload({ member, project, org }) {
  const config = normalizeCardConfig(project);
  const customFields = member?.custom_fields || {};

  return {
    data: {
      name: member?.name || "Member",
      email: member?.email || "",
      role: customFields.role || "Member",
      id_number: extractMembershipId(member) || buildFallbackIdNumber(member),
      dob: customFields.dob || "",
      gender: customFields.gender || "",
      blood_group:
        customFields.blood_group || customFields["blood group"] || "",
      photo_url: member?.photo_url || "",
      address: customFields.address || "",
      customValues: filterCustomMemberFields(customFields),
    },
    template: project?.template || "custom",
    orgName: org?.name || project?.org_name || "Aarannu",
    logoUrl: org?.logo_url || project?.org_logo_url || "",
    cardStyles: config.cardStyles,
    gradientColors: config.gradientColors,
    fieldVisibility: config.fieldVisibility,
    orientation: config.orientation,
    validityText: config.validityText,
    watermark: config.watermark,
    customFields: getCustomFieldDefinitions(member, config.customFields),
    signatureUrl: config.signatureUrl,
    fullGradientBg: config.fullGradientBg,
    gradientOpacity: config.gradientOpacity,
  };
}

export async function generateDeliveryPdf(context) {
  return generateCardPdf(buildDeliveryPayload(context));
}

export function buildDeliveryFileName(member, index = 0) {
  return safeFileName(member?.name || "member", index, "pdf");
}

export async function blobToBase64(blob) {
  const buffer = await blob.arrayBuffer();
  let binary = "";
  const bytes = new Uint8Array(buffer);

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary);
}
