import { useState } from "react";
import { DEFAULT_CARD_FONT_FAMILY } from "../utils/textSupport";

/**
 * useCardStyles — Custom Hook
 * ───────────────────────────
 * Encapsulates all card styling state variables:
 *   - Gradient colors & opacity
 *   - Card background, font, accent colors
 *   - Font sizes, photo scale, border radius
 *   - Orientation (horizontal/vertical)
 *   - Field visibility toggles
 *   - Validity text
 *
 * This consolidates ~15 useState calls from Generate.jsx into
 * a single hook with a clean API.
 */

/** Available font families for card styling */
export const FONT_FAMILIES = [
  { value: DEFAULT_CARD_FONT_FAMILY, label: "Public Sans" },
  { value: "Inter, sans-serif", label: "Inter" },
  { value: "Arial, sans-serif", label: "Arial" },
  { value: "Georgia, serif", label: "Georgia" },
  { value: "'Times New Roman', serif", label: "Times New Roman" },
  { value: "'Courier New', monospace", label: "Courier New" },
  { value: "Verdana, sans-serif", label: "Verdana" },
  { value: "'Trebuchet MS', sans-serif", label: "Trebuchet MS" },
];

export const TEMPLATE_LABELS = {
  custom: "Custom",
  corporate: "Corporate Standard",
  event: "Event Access",
  student: "Student ID",
};

export default function useCardStyles(templateId = "custom") {
  // Gradient colors
  const [gradientStart, setGradientStart] = useState(
    ["corporate", "custom"].includes(templateId)
      ? "#2563EB"
      : templateId === "student"
        ? "#f97316"
        : "#f59e0b",
  );
  const [gradientEnd, setGradientEnd] = useState(
    ["corporate", "custom"].includes(templateId)
      ? "#ef4444"
      : templateId === "student"
        ? "#9333ea"
        : "#6366f1",
  );

  // Card styling customization
  const [cardStyles, setCardStyles] = useState({
    bgColor: templateId === "event" ? "#1e1b4b" : "#ffffff",
    fontColor: templateId === "event" ? "#e0e7ff" : "#1e293b",
    fontFamily: DEFAULT_CARD_FONT_FAMILY,
    accentColor: templateId === "event" ? "#818cf8" : "#64748b",
    borderRadius: 12,
    nameFontSize: 20,
    valueFontSize: 14,
    labelFontSize: 9,
    photoScale: 100,
  });

  // Card orientation
  const [orientation, setOrientation] = useState("horizontal");

  // Full gradient background toggle
  const [fullGradientBg, setFullGradientBg] = useState(false);

  // Gradient background opacity
  const [gradientOpacity, setGradientOpacity] = useState(0.55);

  // Whether to upload generated cards to Supabase cloud storage
  const [uploadToCloud, setUploadToCloud] = useState(true);

  // Local file uploads for logos/signatures (base64 data URLs)
  const [localLogoUrl, setLocalLogoUrl] = useState("");
  const [signatureUrl, setSignatureUrl] = useState("");

  // Field visibility toggles
  const [fieldVisibility, setFieldVisibility] = useState({
    dob: true,
    gender: true,
    blood_group: true,
    role: true,
    address: true,
  });

  // Validity text shown on the back of the card
  const [validityText, setValidityText] = useState(
    templateId === "event"
      ? "Valid for event duration only"
      : templateId === "student"
        ? "Valid for current academic session"
        : "Valid as per subscription plan",
  );

  // Custom field definitions
  const [customFieldDefs, setCustomFieldDefs] = useState([]);
  const [newFieldLabel, setNewFieldLabel] = useState("");
  const [newFieldSide, setNewFieldSide] = useState("front");

  const handleStyleChange = (key, value) =>
    setCardStyles((prev) => ({ ...prev, [key]: value }));

  const toggleFieldVisibility = (key) =>
    setFieldVisibility((prev) => ({ ...prev, [key]: !prev[key] }));

  const gradientColors = { start: gradientStart, end: gradientEnd };

  return {
    // Gradient
    gradientStart,
    setGradientStart,
    gradientEnd,
    setGradientEnd,
    gradientColors,
    fullGradientBg,
    setFullGradientBg,
    gradientOpacity,
    setGradientOpacity,

    // Card styles
    cardStyles,
    setCardStyles,
    handleStyleChange,

    // Orientation
    orientation,
    setOrientation,

    // Cloud upload
    uploadToCloud,
    setUploadToCloud,

    // Logo/signature
    localLogoUrl,
    setLocalLogoUrl,
    signatureUrl,
    setSignatureUrl,

    // Field visibility
    fieldVisibility,
    setFieldVisibility,
    toggleFieldVisibility,

    // Validity
    validityText,
    setValidityText,

    // Custom fields
    customFieldDefs,
    setCustomFieldDefs,
    newFieldLabel,
    setNewFieldLabel,
    newFieldSide,
    setNewFieldSide,
  };
}
