import { useEffect, useState, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../contexts/useAuth";
import { downloadBlob } from "../utils/downloadHelpers";
import BulkGenerator from "../components/BulkGenerator";
import { renderCardPdfWithBestSupport } from "../utils/cardPdfSupport";
import {
  extractMembershipId,
  filterCustomMemberFields,
  generateMembershipId,
} from "../utils/membershipId";
import { DEFAULT_CARD_FONT_FAMILY } from "../utils/textSupport";

/**
 * Generate Page
 * --------------------------------------------------
 * Allows approved users to:
 *  1. Enter member data manually (one or multiple).
 *  2. Import members from a published Google Sheets URL.
 *  3. Preview the ID card in real-time using selected template.
 *  4. Bulk-generate and upload all cards.
 *
 * Receives via location.state:
 *  - template: "custom" | "corporate" | "event" | "student"
 *  - orgName: string
 *  - logoUrl: string
 */
export default function Generate() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  // Template info from /templates page
  const templateId = location.state?.template || "custom";
  const orgName = location.state?.orgName || "";

  const generateMemberId = (rowNum) => generateMembershipId(orgName, rowNum);
  const logoUrl = location.state?.logoUrl || "";
  const watermark = location.state?.watermark || {
    text: "",
    textOpacity: 0.08,
    imageUrl: "",
    imageOpacity: 0.06,
  };

  // Members to generate IDs for
  const [members, setMembers] = useState([]);

  // Range controls: which members (by 1-based queue position) to generate
  const [rangeStart, setRangeStart] = useState(1);
  const [rangeEnd, setRangeEnd] = useState(""); // "" means all

  // Per-person generation cap (max cards per unique person name across sessions)
  const [perPersonCap, setPerPersonCap] = useState(1); // default: 1 card per person

  // Derived: whether any member has email sending enabled
  const emailAfterGenerate = members.some((m) => m.sendEmail);

  // Custom field definitions: [{label, side: 'front'|'back'}]
  const [customFieldDefs, setCustomFieldDefs] = useState([]);
  const [newFieldLabel, setNewFieldLabel] = useState("");
  const [newFieldSide, setNewFieldSide] = useState("front");

  // Form state for adding a new member
  const [form, setForm] = useState({
    name: "",
    email: "",
    role: "",
    id_number: "",
    dob: "",
    gender: "Male",
    blood_group: "",
    photo_url: "",
    address: "",
    customValues: {},
  });

  // Preview mode
  const [previewData, setPreviewData] = useState(null);
  const [downloading, setDownloading] = useState(false);
  const [downloadStatus, setDownloadStatus] = useState(""); // status message for download

  // PDF preview state
  const [pdfBlobUrl, setPdfBlobUrl] = useState(null);
  const [pdfGenerating, setPdfGenerating] = useState(false);
  const prevBlobUrlRef = useRef(null);

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
  const gradientColors = { start: gradientStart, end: gradientEnd };

  // Card styling customization
  const [cardStyles, setCardStyles] = useState({
    bgColor: templateId === "event" ? "#1e1b4b" : "#ffffff",
    fontColor: templateId === "event" ? "#e0e7ff" : "#1e293b",
    fontFamily: DEFAULT_CARD_FONT_FAMILY,
    accentColor: templateId === "event" ? "#818cf8" : "#64748b",
    borderRadius: 12,
    nameFontSize: 20, // px – name / heading
    valueFontSize: 14, // px – detail values (dob, gender, id)
    labelFontSize: 9, // px – field labels (uppercase tiny)
    photoScale: 100, // % – photo size scale (50-150)
  });
  const handleStyleChange = (key, value) =>
    setCardStyles((prev) => ({ ...prev, [key]: value }));

  // Card orientation: "horizontal" (landscape CR-80) or "vertical" (portrait)
  const [orientation, setOrientation] = useState("horizontal");

  // Full gradient background toggle (vs corner-only triangles)
  const [fullGradientBg, setFullGradientBg] = useState(true);

  // Gradient background opacity (0 to 1)
  const [gradientOpacity, setGradientOpacity] = useState(0.55);

  // Whether to upload generated cards to Supabase cloud storage
  const [uploadToCloud] = useState(true);

  // Local file uploads for logos/signatures (base64 data URLs)
  const [localLogoUrl, setLocalLogoUrl] = useState("");
  const [signatureUrl, setSignatureUrl] = useState("");

  // Effective logo: local upload overrides the URL from Templates page
  const effectiveLogoUrl = localLogoUrl || logoUrl;

  // Field visibility toggles — which fields appear on the card
  const [fieldVisibility, setFieldVisibility] = useState({
    dob: true,
    gender: true,
    blood_group: true,
    role: true,
    address: true,
  });
  const toggleFieldVisibility = (key) =>
    setFieldVisibility((prev) => ({ ...prev, [key]: !prev[key] }));

  // Validity text shown on the back of the card
  const [validityText, setValidityText] = useState(
    templateId === "event"
      ? "Valid for event duration only"
      : templateId === "student"
        ? "Valid for current academic session"
        : "Valid as per subscription plan",
  );

  // Ref to the bulk generator section so we can scroll to it after import
  const generatorSectionRef = useRef(null);
  const importedProjectMembersRef = useRef(false);

  // Google Sheets import
  const [sheetsUrl, setSheetsUrl] = useState("");
  const [sheetsLoading, setSheetsLoading] = useState(false);
  const [sheetsError, setSheetsError] = useState("");
  const [sheetsSuccess, setSheetsSuccess] = useState("");

  // Column mapping state (2-phase import)
  const [sheetHeaders, setSheetHeaders] = useState([]); // raw header strings from CSV
  const [sheetRows, setSheetRows] = useState([]); // parsed data rows (arrays)
  const [columnMap, setColumnMap] = useState({}); // { fieldKey: headerIndex | -1 }
  const [showMapping, setShowMapping] = useState(false); // show mapping modal

  /** Standard fields the user can map sheet columns to */
  const MAPPABLE_FIELDS = [
    { key: "name", label: "Full Name", required: true },
    { key: "email", label: "Email Address" },
    { key: "role", label: "Role / Designation" },
    { key: "id_number", label: "ID Number" },
    { key: "dob", label: "Date of Birth" },
    { key: "gender", label: "Gender" },
    { key: "blood_group", label: "Blood Group" },
    { key: "photo_url", label: "Photo URL" },
    { key: "address", label: "Address" },
  ];

  const TEMPLATE_LABELS = {
    custom: "Custom",
    corporate: "Corporate Standard",
    event: "Event Access",
    student: "Student ID",
  };

  const emailEnabledCount = members.filter((member) => member.sendEmail).length;
  const memberPhotoCount = members.filter((member) =>
    member.photo_url?.trim?.(),
  ).length;
  const workspaceSteps = [
    {
      label: "Data",
      value: `${members.length} queued`,
      active: members.length > 0,
    },
    {
      label: "Design",
      value: TEMPLATE_LABELS[templateId],
      active: true,
    },
    {
      label: "Preview",
      value: previewData ? previewData.name || "Ready" : "Not selected",
      active: Boolean(previewData),
    },
    {
      label: "Generate",
      value: "Token recorded",
      active: members.length > 0,
    },
  ];

  /** Available font families for card styling */
  const FONT_FAMILIES = [
    { value: DEFAULT_CARD_FONT_FAMILY, label: "Public Sans" },
    { value: "Inter, sans-serif", label: "Inter" },
    { value: "Arial, sans-serif", label: "Arial" },
    { value: "Georgia, serif", label: "Georgia" },
    { value: "'Times New Roman', serif", label: "Times New Roman" },
    { value: "'Courier New', monospace", label: "Courier New" },
    { value: "Verdana, sans-serif", label: "Verdana" },
    { value: "'Trebuchet MS', sans-serif", label: "Trebuchet MS" },
  ];

  useEffect(() => {
    const incomingMembers = location.state?.members;
    if (
      importedProjectMembersRef.current ||
      !Array.isArray(incomingMembers) ||
      incomingMembers.length === 0
    ) {
      return;
    }

    const normalizedMembers = incomingMembers
      .filter((member) => member?.name?.trim?.())
      .map((member, index) => {
        const customFields = member?.custom_fields || {};
        const customValues = filterCustomMemberFields(customFields);

        return {
          projectMemberId: member?.id || null,
          projectCustomFields: customFields,
          name: member?.name?.trim?.() || "",
          email: member?.email?.trim?.() || "",
          role: member?.role || customFields.role || "Member",
          id_number:
            extractMembershipId(member) || generateMemberId(index + 1),
          dob: member?.dob || customFields.dob || "",
          gender: member?.gender || customFields.gender || "N/A",
          blood_group:
            member?.blood_group ||
            customFields.blood_group ||
            customFields["blood group"] ||
            "",
          photo_url: member?.photo_url || member?.photo || "",
          address: member?.address || customFields.address || "",
          customValues,
          sendEmail: false,
        };
      });

    if (normalizedMembers.length === 0) return;

    const derivedFieldLabels = new Set();
    normalizedMembers.forEach((member) => {
      Object.keys(member.customValues || {}).forEach((key) =>
        derivedFieldLabels.add(key),
      );
    });

    if (derivedFieldLabels.size > 0) {
      setCustomFieldDefs((prev) => {
        const existing = new Set(prev.map((field) => field.label.toLowerCase()));
        const nextFields = [...prev];

        derivedFieldLabels.forEach((label) => {
          if (!existing.has(label.toLowerCase())) {
            nextFields.push({ label, side: "front" });
          }
        });

        return nextFields;
      });
    }

    setMembers(normalizedMembers);
    setSheetsSuccess(
      `Loaded ${normalizedMembers.length} approved project member(s) into the queue.`,
    );
    importedProjectMembersRef.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state, orgName]);

  // Keep rangeEnd clamped when members change
  useEffect(() => {
    if (members.length > 0 && rangeEnd === "") {
      // leave as "" (meaning "all")
    }
  }, [members.length, rangeEnd]);

  const handleFormChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleAddMember = () => {
    if (!form.name.trim()) return;

    const newMember = {
      ...form,
      name: form.name.trim(),
      email: form.email.trim(),
      role: form.role.trim() || "Member",
      id_number: form.id_number.trim() || generateMemberId(members.length + 1),
      customValues: { ...form.customValues },
      sendEmail: false,
    };

    setMembers((prev) => [...prev, newMember]);
    setForm({
      name: "",
      email: "",
      role: "",
      id_number: "",
      dob: "",
      gender: "Male",
      blood_group: "",
      photo_url: "",
      address: "",
      customValues: {},
    });
  };

  const handleRemoveMember = (index) => {
    setMembers((prev) => prev.filter((_, i) => i !== index));
  };

  /**
   * Build the render payload for the client-side PDF generator.
   */
  const buildRenderPayload = (memberData) => ({
    data: memberData,
    template: templateId,
    orgName,
    logoUrl: effectiveLogoUrl,
    cardStyles,
    gradientColors,
    fieldVisibility,
    orientation,
    validityText,
    watermark,
    customFields: customFieldDefs,
    signatureUrl,
    fullGradientBg,
    gradientOpacity,
  });

  /**
   * Generate the PDF preview for the given member data.
   */
  const regeneratePreview = async (memberData) => {
    if (!memberData) return;
    setPdfGenerating(true);
    try {
      const payload = buildRenderPayload(memberData);
      const blob = await renderCardPdfWithBestSupport(payload);
      // Revoke old URL
      if (prevBlobUrlRef.current) URL.revokeObjectURL(prevBlobUrlRef.current);
      const url = URL.createObjectURL(blob);
      prevBlobUrlRef.current = url;
      setPdfBlobUrl(url);
    } catch (err) {
      console.error("PDF preview generation failed:", err);
    } finally {
      setPdfGenerating(false);
    }
  };

  /** Preview a member — generates the PDF immediately */
  const handlePreview = (data) => {
    setPreviewData(data);
    // Generate PDF right away
    regeneratePreview(data);
  };

  /**
   * Upload a rendered card to the backend API.
   * This routes through authentication, rate limiting, and the
   * middleware pipeline — instead of calling Supabase directly.
   */
  const uploadCardToBackend = async (pngBlob, memberName) => {
    if (!pngBlob) return;
    // Convert blob to base64
    const reader = new FileReader();
    const base64 = await new Promise((resolve, reject) => {
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(pngBlob);
    });

    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      throw new Error("You need to sign in again before generating cards.");
    }

    const API =
      import.meta.env.VITE_BACKEND_URL ||
      import.meta.env.VITE_API_URL ||
      "http://localhost:5000";

    const res = await fetch(`${API}/api/cards/upload`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        image: base64,
        memberName: memberName || "card",
        expiryDays: 365,
        requestId: `single-card:${user?.id}:${memberName || "card"}:${Date.now()}`,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || err.error || res.statusText);
    }
  };

  // Cleanup blob URL on unmount
  useEffect(() => {
    return () => {
      if (prevBlobUrlRef.current) URL.revokeObjectURL(prevBlobUrlRef.current);
    };
  }, []);

  // ── Auto-refresh preview when any style setting changes ────
  useEffect(() => {
    if (previewData) {
      const timer = setTimeout(() => {
        regeneratePreview(previewData);
      }, 400); // debounce 400ms
      return () => clearTimeout(timer);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    gradientStart, gradientEnd, fullGradientBg, gradientOpacity,
    orientation, cardStyles, fieldVisibility, validityText,
    customFieldDefs, signatureUrl, effectiveLogoUrl,
  ]);

  /** Download the previewed card as a PDF (client-side) */
  const handleDownloadPdf = async () => {
    if (!previewData) return;
    setDownloading(true);
    setDownloadStatus("Generating PDF...");
    try {
      const payload = buildRenderPayload(previewData);
      const blob = await renderCardPdfWithBestSupport(payload);
      const safeName = (previewData.name || "id-card").replace(
        /[^a-zA-Z0-9]/g,
        "_",
      );
      setDownloadStatus("Recording token usage...");
      await uploadCardToBackend(blob, previewData.name);
      downloadBlob(blob, `${safeName}_ID.pdf`);
      setDownloadStatus("Done!");
    } catch (err) {
      console.error("PDF download failed:", err);
      setDownloadStatus(`Error: ${err.message}`);
    } finally {
      setDownloading(false);
      setTimeout(() => setDownloadStatus(""), 3000);
    }
  };

  const handleGenerationComplete = () => {
    // Don't auto-clear members — keep results visible until user clears queue
  };

  /** ── Google Sheets CSV Import ── */
  /**
   * Phase 1: Fetch the Google Sheet, parse CSV, show column mapping UI.
   */
  const handleSheetsImport = async () => {
    if (!sheetsUrl.trim()) return;
    setSheetsLoading(true);
    setSheetsError("");
    setSheetsSuccess("");
    setShowMapping(false);

    try {
      // Convert any Google Sheets URL to CSV export URL
      let csvUrl = sheetsUrl.trim();

      const spreadsheetIdMatch = csvUrl.match(
        /\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/,
      );
      if (spreadsheetIdMatch) {
        const sheetId = spreadsheetIdMatch[1];
        const gidMatch = csvUrl.match(/gid=(\d+)/);
        const gid = gidMatch ? gidMatch[1] : "0";
        csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`;
      } else if (
        !csvUrl.includes("export?format=csv") &&
        !csvUrl.endsWith(".csv")
      ) {
        throw new Error(
          "Please paste a valid Google Sheets URL (e.g. https://docs.google.com/spreadsheets/d/...).",
        );
      }

      const res = await fetch(csvUrl);
      if (!res.ok) {
        throw new Error(
          "Could not fetch the sheet. Make sure it is published / shared as 'Anyone with the link'.",
        );
      }

      const csvText = await res.text();
      const rows = parseCSV(csvText);

      if (rows.length < 2) {
        throw new Error(
          "Sheet must have a header row and at least one data row.",
        );
      }

      const headers = rows[0].map((h) => h.trim());
      const dataRows = rows.slice(1).filter((r) => r.some((c) => c.trim()));

      if (dataRows.length === 0) {
        throw new Error("No data rows found after the header.");
      }

      // Auto-guess mappings based on header names
      const guessMap = {};
      const lowerHeaders = headers.map((h) => h.toLowerCase());

      const GUESS_RULES = {
        name: ["name", "full name", "fullname", "member name"],
        email: ["email", "e-mail", "email address", "mail", "email_address"],
        role: ["role", "designation", "title", "position"],
        id_number: ["id", "id_number", "id number", "member id", "memberid"],
        dob: ["dob", "date of birth", "birthday", "birth date"],
        gender: ["gender", "sex"],
        blood_group: ["blood group", "blood_group", "blood type", "bloodgroup"],
        photo_url: ["photo", "photo_url", "photo url", "image", "image_url"],
        address: ["address", "addr", "location"],
      };

      for (const [field, aliases] of Object.entries(GUESS_RULES)) {
        const idx = lowerHeaders.findIndex((h) => aliases.includes(h));
        guessMap[field] = idx !== -1 ? idx : -1;
      }

      setSheetHeaders(headers);
      setSheetRows(dataRows);
      setColumnMap(guessMap);
      setShowMapping(true);
    } catch (err) {
      setSheetsError(err.message);
    } finally {
      setSheetsLoading(false);
    }
  };

  /**
   * Phase 2: Apply column mapping, build member objects, add to queue.
   */
  const handleConfirmMapping = () => {
    if (columnMap.name === -1 || columnMap.name === undefined) {
      setSheetsError("You must map the 'Full Name' column.");
      return;
    }

    // Identify which headers are NOT mapped to standard fields → custom fields
    const mappedIndices = new Set(
      Object.values(columnMap).filter((v) => v !== -1),
    );
    const extraColumns = sheetHeaders
      .map((h, idx) => ({ header: h, idx }))
      .filter((c) => c.header && !mappedIndices.has(c.idx));

    // Auto-register extra columns as custom fields
    if (extraColumns.length > 0) {
      setCustomFieldDefs((prev) => {
        const existing = new Set(prev.map((f) => f.label.toLowerCase()));
        const newDefs = extraColumns
          .filter((c) => !existing.has(c.header.toLowerCase()))
          .map((c) => ({
            label: c.header.charAt(0).toUpperCase() + c.header.slice(1),
            side: "front",
          }));
        return [...prev, ...newDefs];
      });
    }

    const imported = [];
    for (let i = 0; i < sheetRows.length; i++) {
      const row = sheetRows[i];

      const getVal = (fieldKey) => {
        const idx = columnMap[fieldKey];
        if (idx === -1 || idx === undefined) return "";
        return row[idx]?.trim() || "";
      };

      const name = getVal("name");
      if (!name) continue;

      imported.push({
        name,
        email: getVal("email"),
        role: getVal("role") || "Member",
        id_number:
          getVal("id_number") ||
          generateMemberId(members.length + imported.length + 1),
        dob: getVal("dob"),
        gender: getVal("gender") || "N/A",
        blood_group: getVal("blood_group"),
        photo_url: getVal("photo_url"),
        address: getVal("address"),
        sendEmail: false,
        customValues: Object.fromEntries(
          extraColumns.map((c) => [
            c.header.charAt(0).toUpperCase() + c.header.slice(1),
            row[c.idx]?.trim() || "",
          ]),
        ),
      });
    }

    if (imported.length === 0) {
      setSheetsError("No valid rows found with a name in the mapped column.");
      return;
    }

    setMembers((prev) => [...prev, ...imported]);
    setSheetsSuccess(
      `Imported ${imported.length} member(s). Scroll down and click "Generate & Download" to create the ID cards.`,
    );
    setShowMapping(false);
    setSheetHeaders([]);
    setSheetRows([]);
    setColumnMap({});
    setSheetsUrl("");
    setSheetsError("");

    // Auto-scroll to the generator section after a short delay for React to render
    setTimeout(() => {
      generatorSectionRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }, 300);
  };

  /** Cancel column mapping and go back */
  const handleCancelMapping = () => {
    setShowMapping(false);
    setSheetHeaders([]);
    setSheetRows([]);
    setColumnMap({});
  };

  /** Minimal CSV parser that handles quoted fields */
  function parseCSV(text) {
    const rows = [];
    let current = [];
    let field = "";
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      const next = text[i + 1];

      if (inQuotes) {
        if (ch === '"' && next === '"') {
          field += '"';
          i++;
        } else if (ch === '"') {
          inQuotes = false;
        } else {
          field += ch;
        }
      } else {
        if (ch === '"') {
          inQuotes = true;
        } else if (ch === ",") {
          current.push(field);
          field = "";
        } else if (ch === "\n" || (ch === "\r" && next === "\n")) {
          current.push(field);
          field = "";
          rows.push(current);
          current = [];
          if (ch === "\r") i++;
        } else if (ch === "\r") {
          current.push(field);
          field = "";
          rows.push(current);
          current = [];
        } else {
          field += ch;
        }
      }
    }
    // last field / row
    if (field || current.length) {
      current.push(field);
      rows.push(current);
    }
    return rows;
  }

  /* Card preview is now rendered as a PDF via pdfCardRenderer */

  return (
    <div className="min-h-screen bg-[#f6f6f8] font-['Public_Sans',sans-serif] flex flex-col">
      {/* ─── Header ─── */}
      <header className="h-14 sm:h-16 bg-white/80 backdrop-blur-md border-b border-slate-200 flex items-center justify-between px-4 sm:px-6 sticky top-0 z-40">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <div className="w-7 h-7 sm:w-8 sm:h-8 bg-green-600 rounded-lg flex items-center justify-center text-white font-bold shrink-0">
            <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M3 3v8h8V3H3zm6 6H5V5h4v4zm-6 4v8h8v-8H3zm6 6H5v-4h4v4zm4-16v8h8V3h-8zm6 6h-4V5h4v4zm-6 4v8h8v-8h-8zm6 6h-4v-4h4v4z" />
            </svg>
          </div>
          <h1 className="font-bold text-sm sm:text-lg text-slate-900 truncate">
            <span className="hidden sm:inline">Bulk ID Generator </span>
            <span className="sm:hidden">ID Generator </span>
            <span className="text-slate-400 font-normal ml-1 sm:ml-2 text-xs sm:text-sm">
              | {TEMPLATE_LABELS[templateId]}
            </span>
          </h1>
        </div>
        <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
          <button
            onClick={() => navigate("/templates")}
            className="px-2.5 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-medium text-slate-600 hover:text-[#2563EB] transition-colors border border-slate-300 rounded-lg cursor-pointer"
          >
            <span className="hidden sm:inline">Back to Templates</span>
            <span className="sm:hidden">Templates</span>
          </button>
          <button
            onClick={() => navigate("/dashboard")}
            className="px-2.5 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-medium text-slate-600 hover:text-[#2563EB] transition-colors border border-slate-300 rounded-lg cursor-pointer"
          >
            Dashboard
          </button>
        </div>
      </header>

      {/* ─── Main Content ─── */}
      <main className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* ─── Left Sidebar: Data Entry ─── */}
        <aside className="w-full lg:w-100 shrink-0 bg-white border-b lg:border-b-0 lg:border-r border-slate-200 overflow-y-auto lg:max-h-full max-h-[50vh]">
          <div className="p-6 space-y-8">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                  Workspace
                </p>
                <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-semibold text-slate-500 ring-1 ring-slate-200">
                  {orgName || "No organization"}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {workspaceSteps.map((step, index) => (
                  <div
                    key={step.label}
                    className={`rounded-lg border px-3 py-2 ${
                      step.active
                        ? "border-[#2563EB]/25 bg-white text-slate-900"
                        : "border-slate-200 bg-white/60 text-slate-400"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${
                          step.active
                            ? "bg-[#2563EB] text-white"
                            : "bg-slate-200 text-slate-500"
                        }`}
                      >
                        {index + 1}
                      </span>
                      <span className="text-xs font-semibold">
                        {step.label}
                      </span>
                    </div>
                    <p className="mt-1 truncate text-[10px] text-slate-500">
                      {step.value}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Google Sheets Import */}
            <div className="space-y-3">
              <h2 className="text-sm uppercase tracking-wider text-slate-500 font-semibold mb-2 flex items-center gap-2">
                <svg
                  className="w-4 h-4 text-green-600"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V5h14v14zM7 10h2v7H7zm4-3h2v10h-2zm4 6h2v4h-2z" />
                </svg>
                Import from Google Sheets
              </h2>
              <div className="flex gap-2">
                <input
                  type="url"
                  value={sheetsUrl}
                  onChange={(e) => {
                    setSheetsUrl(e.target.value);
                    setSheetsError("");
                    setSheetsSuccess("");
                  }}
                  placeholder="Paste Google Sheets URL..."
                  className="flex-1 rounded-lg border border-slate-300 bg-slate-50 text-sm focus:border-green-500 focus:ring-green-500 py-2 px-3 outline-none"
                />
                <button
                  onClick={handleSheetsImport}
                  disabled={sheetsLoading || !sheetsUrl.trim()}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors shrink-0"
                >
                  {sheetsLoading ? "Fetching..." : "Import"}
                </button>
              </div>
              {sheetsError && (
                <p className="text-xs text-red-600 bg-red-50 p-2 rounded-lg border border-red-100">
                  {sheetsError}
                </p>
              )}
              {sheetsSuccess && (
                <p className="text-xs text-green-700 bg-green-50 p-2 rounded-lg border border-green-100">
                  {sheetsSuccess}
                </p>
              )}

              {/* ─── Column Mapping Panel ─── */}
              {showMapping && (
                <div className="rounded-lg border border-green-200 bg-green-50/50 p-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-semibold text-slate-700">
                      Map Columns ({sheetRows.length} rows found)
                    </h3>
                    <button
                      onClick={handleCancelMapping}
                      className="text-[10px] text-slate-400 hover:text-red-500 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>

                  {/* Data preview */}
                  <div className="rounded border border-slate-200 bg-white overflow-x-auto max-h-28 text-[10px]">
                    <table className="min-w-full">
                      <thead className="bg-slate-50 sticky top-0">
                        <tr>
                          {sheetHeaders.map((h, i) => (
                            <th
                              key={i}
                              className="px-2 py-1 text-left font-semibold text-slate-600 whitespace-nowrap border-b border-slate-100"
                            >
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {sheetRows.slice(0, 3).map((row, ri) => (
                          <tr key={ri} className="border-b border-slate-50">
                            {sheetHeaders.map((_, ci) => (
                              <td
                                key={ci}
                                className="px-2 py-0.5 text-slate-500 whitespace-nowrap max-w-30 truncate"
                              >
                                {row[ci] || ""}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Maps */}
                  <div className="space-y-1.5">
                    {MAPPABLE_FIELDS.map((field) => (
                      <div key={field.key} className="flex items-center gap-2">
                        <label className="text-[11px] font-medium text-slate-600 w-24 shrink-0 text-right">
                          {field.label}
                          {field.required && (
                            <span className="text-red-500 ml-0.5">*</span>
                          )}
                        </label>
                        <select
                          value={columnMap[field.key] ?? -1}
                          onChange={(e) =>
                            setColumnMap((prev) => ({
                              ...prev,
                              [field.key]: parseInt(e.target.value, 10),
                            }))
                          }
                          className={`flex-1 text-[11px] rounded border py-1 px-2 outline-none ${
                            columnMap[field.key] !== undefined &&
                            columnMap[field.key] !== -1
                              ? "border-green-300 bg-green-50 text-green-800"
                              : "border-slate-200 bg-white text-slate-500"
                          }`}
                        >
                          <option value={-1}>Skip</option>
                          {sheetHeaders.map((h, i) => (
                            <option key={i} value={i}>
                              {h}
                            </option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>

                  {/* Unmapped columns note */}
                  {(() => {
                    const mappedIdxs = new Set(
                      Object.values(columnMap).filter((v) => v !== -1),
                    );
                    const unmapped = sheetHeaders.filter(
                      (_, i) => !mappedIdxs.has(i),
                    );
                    if (unmapped.length === 0) return null;
                    return (
                      <p className="text-[10px] text-amber-600 bg-amber-50 rounded px-2 py-1 border border-amber-100">
                        Unmapped columns will become{" "}
                        <strong>custom fields</strong>: {unmapped.join(", ")}
                      </p>
                    );
                  })()}

                  <button
                    onClick={handleConfirmMapping}
                    className="w-full py-2 bg-green-600 hover:bg-green-700 text-white text-xs font-semibold rounded-lg transition-colors"
                  >
                    Confirm &amp; Import {sheetRows.length} Members
                  </button>
                </div>
              )}

              {!showMapping && (
                <p className="text-[10px] text-slate-400 leading-relaxed">
                  Sheet must have a header row. After fetching, you'll map each
                  column to a field (name, role, photo, etc.). Unmapped columns
                  become custom fields automatically. Share the sheet as
                  &quot;Anyone with the link&quot;.
                </p>
              )}
            </div>

            <hr className="border-slate-200" />

            {/* Section 1: Identity Details (manual) */}
            <div className="space-y-4">
              <h2 className="text-sm uppercase tracking-wider text-slate-500 font-semibold mb-4">
                Add Manually
              </h2>

              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => handleFormChange("name", e.target.value)}
                    placeholder="Aarav Sharma"
                    className="w-full rounded-lg border border-slate-300 bg-slate-50 text-sm focus:border-[#2563EB] focus:ring-[#2563EB] py-2 px-3 outline-none"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => handleFormChange("email", e.target.value)}
                    placeholder="aarav@example.com"
                    className="w-full rounded-lg border border-slate-300 bg-slate-50 text-sm focus:border-[#2563EB] focus:ring-[#2563EB] py-2 px-3 outline-none"
                  />
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    Used for emailing the generated ID card via Brevo
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Date of Birth
                  </label>
                  <input
                    type="date"
                    value={form.dob}
                    onChange={(e) => handleFormChange("dob", e.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-slate-50 text-sm focus:border-[#2563EB] focus:ring-[#2563EB] py-2 px-3 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Gender
                  </label>
                  <select
                    value={form.gender}
                    onChange={(e) => handleFormChange("gender", e.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-slate-50 text-sm focus:border-[#2563EB] focus:ring-[#2563EB] py-2 px-3 outline-none"
                  >
                    <option>Male</option>
                    <option>Female</option>
                    <option>Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Blood Group
                  </label>
                  <select
                    value={form.blood_group}
                    onChange={(e) =>
                      handleFormChange("blood_group", e.target.value)
                    }
                    className="w-full rounded-lg border border-slate-300 bg-slate-50 text-sm focus:border-[#2563EB] focus:ring-[#2563EB] py-2 px-3 outline-none"
                  >
                    <option value="">Select</option>
                    <option>A+</option>
                    <option>A-</option>
                    <option>B+</option>
                    <option>B-</option>
                    <option>AB+</option>
                    <option>AB-</option>
                    <option>O+</option>
                    <option>O-</option>
                  </select>
                </div>

                <div className="col-span-2">
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Role / Designation
                  </label>
                  <input
                    type="text"
                    value={form.role}
                    onChange={(e) => handleFormChange("role", e.target.value)}
                    placeholder="Member"
                    className="w-full rounded-lg border border-slate-300 bg-slate-50 text-sm focus:border-[#2563EB] focus:ring-[#2563EB] py-2 px-3 outline-none"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Unique ID Number
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
                      <svg
                        className="w-4 h-4"
                        fill="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path d="M17.81 4.47c-.08 0-.16-.02-.23-.06C15.66 3.42 14 3 12.01 3c-1.98 0-3.86.47-5.57 1.41-.24.13-.54.04-.68-.2-.13-.24-.04-.55.2-.68C7.82 2.52 9.86 2 12.01 2c2.13 0 3.99.47 6.03 1.52.25.13.34.43.21.67-.09.18-.26.28-.44.28z" />
                      </svg>
                    </span>
                    <input
                      type="text"
                      value={form.id_number}
                      onChange={(e) =>
                        handleFormChange("id_number", e.target.value)
                      }
                      placeholder="Auto-generated if empty"
                      className="pl-9 w-full rounded-lg border border-slate-300 bg-slate-50 text-sm font-mono tracking-wide focus:border-[#2563EB] focus:ring-[#2563EB] py-2 px-3 outline-none"
                    />
                  </div>
                </div>
              </div>
            </div>

            <hr className="border-slate-200" />

            {/* Section 2: Photo URL & Media Uploads */}
            <div className="space-y-4">
              <h2 className="text-sm uppercase tracking-wider text-slate-500 font-semibold mb-4">
                Media Assets
              </h2>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Photo URL
                </label>
                <input
                  type="url"
                  value={form.photo_url}
                  onChange={(e) =>
                    handleFormChange("photo_url", e.target.value)
                  }
                  placeholder="https://example.com/photo.jpg"
                  className="w-full rounded-lg border border-slate-300 bg-slate-50 text-sm focus:border-[#2563EB] focus:ring-[#2563EB] py-2 px-3 outline-none"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  Direct link to an image (JPG/PNG)
                </p>
              </div>

              {/* Organization Logo Upload */}
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Organization Logo (local upload)
                </label>
                <div className="flex items-center gap-2">
                  <label className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-dashed border-slate-300 bg-slate-50 cursor-pointer hover:bg-slate-100 transition-colors">
                    <svg
                      className="w-4 h-4 text-slate-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                      />
                    </svg>
                    <span className="text-xs text-slate-500">
                      {localLogoUrl ? "Logo selected" : "Choose file..."}
                    </span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        const reader = new FileReader();
                        reader.onload = (ev) =>
                          setLocalLogoUrl(ev.target.result);
                        reader.readAsDataURL(file);
                      }}
                    />
                  </label>
                  {localLogoUrl && (
                    <button
                      onClick={() => setLocalLogoUrl("")}
                      className="text-red-400 hover:text-red-600 text-xs"
                      title="Remove logo"
                    >
                      Remove
                    </button>
                  )}
                </div>
                {localLogoUrl && (
                  <img
                    src={localLogoUrl}
                    alt="Logo preview"
                    className="w-12 h-12 object-contain rounded mt-1.5 border border-slate-200"
                  />
                )}
                <p className="text-[10px] text-slate-400 mt-1">
                  Overrides the logo from Templates page. Accepts JPG/PNG/SVG.
                </p>
              </div>

              {/* Registrar Signature Upload */}
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Registrar / Management Signature
                </label>
                <div className="flex items-center gap-2">
                  <label className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-dashed border-slate-300 bg-slate-50 cursor-pointer hover:bg-slate-100 transition-colors">
                    <svg
                      className="w-4 h-4 text-slate-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                      />
                    </svg>
                    <span className="text-xs text-slate-500">
                      {signatureUrl ? "Signature selected" : "Choose file..."}
                    </span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        const reader = new FileReader();
                        reader.onload = (ev) =>
                          setSignatureUrl(ev.target.result);
                        reader.readAsDataURL(file);
                      }}
                    />
                  </label>
                  {signatureUrl && (
                    <button
                      onClick={() => setSignatureUrl("")}
                      className="text-red-400 hover:text-red-600 text-xs"
                      title="Remove signature"
                    >
                      Remove
                    </button>
                  )}
                </div>
                {signatureUrl && (
                  <img
                    src={signatureUrl}
                    alt="Signature preview"
                    className="h-8 object-contain mt-1.5 border border-slate-200 rounded px-2 py-0.5 bg-white"
                  />
                )}
                <p className="text-[10px] text-slate-400 mt-1">
                  Shown on the back of the card (e.g. Registrar
                  stamp/signature).
                </p>
              </div>
            </div>

            <hr className="border-slate-200" />

            {/* Section 3: Address */}
            <div className="space-y-4">
              <h2 className="text-sm uppercase tracking-wider text-slate-500 font-semibold mb-4">
                Address & Contact
              </h2>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Full Address
                </label>
                <textarea
                  value={form.address}
                  onChange={(e) => handleFormChange("address", e.target.value)}
                  placeholder="H.No 45, Lotus Boulevard, Sector 100, Noida, UP - 201304"
                  rows={3}
                  className="w-full rounded-lg border border-slate-300 bg-slate-50 text-sm focus:border-[#2563EB] focus:ring-[#2563EB] py-2 px-3 outline-none resize-none"
                />
              </div>
            </div>

            <hr className="border-slate-200" />

            {/* Section 3b: Gradient Colors */}
            <div className="space-y-4">
              <h2 className="text-sm uppercase tracking-wider text-slate-500 font-semibold mb-2 flex items-center gap-2">
                <svg
                  className="w-4 h-4 text-pink-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01"
                  />
                </svg>
                Card Gradient Colors
              </h2>
              <div className="flex gap-3 items-end">
                <div className="flex-1">
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Start Color
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={gradientStart}
                      onChange={(e) => setGradientStart(e.target.value)}
                      className="w-10 h-10 rounded-lg border border-slate-300 cursor-pointer p-0.5"
                    />
                    <input
                      type="text"
                      value={gradientStart}
                      onChange={(e) => setGradientStart(e.target.value)}
                      className="flex-1 rounded-lg border border-slate-300 bg-slate-50 text-xs font-mono focus:border-pink-500 focus:ring-pink-500 py-2 px-2 outline-none uppercase"
                      maxLength={7}
                    />
                  </div>
                </div>
                <div className="flex-1">
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    End Color
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={gradientEnd}
                      onChange={(e) => setGradientEnd(e.target.value)}
                      className="w-10 h-10 rounded-lg border border-slate-300 cursor-pointer p-0.5"
                    />
                    <input
                      type="text"
                      value={gradientEnd}
                      onChange={(e) => setGradientEnd(e.target.value)}
                      className="flex-1 rounded-lg border border-slate-300 bg-slate-50 text-xs font-mono focus:border-pink-500 focus:ring-pink-500 py-2 px-2 outline-none uppercase"
                      maxLength={7}
                    />
                  </div>
                </div>
              </div>
              {/* Gradient preview */}
              <div
                className="h-6 rounded-lg border border-slate-200 overflow-hidden"
                style={{
                  background: `linear-gradient(to right, ${gradientStart}, ${gradientEnd})`,
                }}
              />
              <p className="text-[10px] text-slate-400 leading-relaxed">
                These colors control the decorative gradients on your ID cards.
                Click the color swatch or type a hex code.
              </p>

              {/* Full Gradient Background Toggle */}
              <div className="flex items-center justify-between mt-3 p-3 rounded-lg border border-slate-200 bg-slate-50/50">
                <div>
                  <p className="text-xs font-medium text-slate-700">Full Gradient Background</p>
                  <p className="text-[10px] text-slate-400">Fill entire card with gradient instead of corner accents</p>
                </div>
                <button
                  onClick={() => setFullGradientBg((v) => !v)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    fullGradientBg ? "bg-pink-500" : "bg-slate-300"
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${
                      fullGradientBg ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </button>
              </div>

              {/* Gradient Background Opacity Slider */}
              {fullGradientBg && (
                <div className="mt-3 p-3 rounded-lg border border-slate-200 bg-slate-50/50">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-medium text-slate-700">Background Opacity</p>
                    <span className="text-xs font-mono text-slate-500">{Math.round(gradientOpacity * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={Math.round(gradientOpacity * 100)}
                    onChange={(e) => setGradientOpacity(parseInt(e.target.value, 10) / 100)}
                    className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-pink-500"
                  />
                  <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                    <span>Transparent</span>
                    <span>Full</span>
                  </div>
                </div>
              )}
            </div>

            <hr className="border-slate-200" />

            {/* Section: Card Orientation */}
            <div className="space-y-4">
              <h2 className="text-sm uppercase tracking-wider text-slate-500 font-semibold mb-2 flex items-center gap-2">
                <svg
                  className="w-4 h-4 text-teal-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z"
                  />
                </svg>
                Card Orientation
              </h2>
              <div className="flex gap-2">
                <button
                  onClick={() => setOrientation("horizontal")}
                  className={`flex-1 py-2.5 px-3 rounded-lg border text-xs font-medium flex items-center justify-center gap-2 transition-colors ${
                    orientation === "horizontal"
                      ? "border-teal-500 bg-teal-50 text-teal-700"
                      : "border-slate-300 text-slate-500 hover:bg-slate-50"
                  }`}
                >
                  <svg
                    className="w-5 h-3"
                    viewBox="0 0 20 12"
                    fill="currentColor"
                  >
                    <rect width="20" height="12" rx="2" />
                  </svg>
                  Horizontal
                </button>
                <button
                  onClick={() => setOrientation("vertical")}
                  className={`flex-1 py-2.5 px-3 rounded-lg border text-xs font-medium flex items-center justify-center gap-2 transition-colors ${
                    orientation === "vertical"
                      ? "border-teal-500 bg-teal-50 text-teal-700"
                      : "border-slate-300 text-slate-500 hover:bg-slate-50"
                  }`}
                >
                  <svg
                    className="w-3 h-5"
                    viewBox="0 0 12 20"
                    fill="currentColor"
                  >
                    <rect width="12" height="20" rx="2" />
                  </svg>
                  Vertical
                </button>
              </div>
              <p className="text-[10px] text-slate-400 leading-relaxed">
                Choose landscape (standard CR-80) or portrait orientation for
                all generated cards.
              </p>
            </div>

            <hr className="border-slate-200" />

            {/* Section: Card Styling */}
            <div className="space-y-4">
              <h2 className="text-sm uppercase tracking-wider text-slate-500 font-semibold mb-2 flex items-center gap-2">
                <svg
                  className="w-4 h-4 text-amber-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"
                  />
                </svg>
                Card Styling
              </h2>

              {/* Background Color */}
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Background Color
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={cardStyles.bgColor}
                    onChange={(e) =>
                      handleStyleChange("bgColor", e.target.value)
                    }
                    className="w-10 h-10 rounded-lg border border-slate-300 cursor-pointer p-0.5"
                  />
                  <input
                    type="text"
                    value={cardStyles.bgColor}
                    onChange={(e) =>
                      handleStyleChange("bgColor", e.target.value)
                    }
                    className="flex-1 rounded-lg border border-slate-300 bg-slate-50 text-xs font-mono focus:border-amber-500 focus:ring-amber-500 py-2 px-2 outline-none uppercase"
                    maxLength={7}
                  />
                </div>
              </div>

              {/* Text Color */}
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Text Color
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={cardStyles.fontColor}
                    onChange={(e) =>
                      handleStyleChange("fontColor", e.target.value)
                    }
                    className="w-10 h-10 rounded-lg border border-slate-300 cursor-pointer p-0.5"
                  />
                  <input
                    type="text"
                    value={cardStyles.fontColor}
                    onChange={(e) =>
                      handleStyleChange("fontColor", e.target.value)
                    }
                    className="flex-1 rounded-lg border border-slate-300 bg-slate-50 text-xs font-mono focus:border-amber-500 focus:ring-amber-500 py-2 px-2 outline-none uppercase"
                    maxLength={7}
                  />
                </div>
              </div>

              {/* Accent Color */}
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Label / Accent Color
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={cardStyles.accentColor}
                    onChange={(e) =>
                      handleStyleChange("accentColor", e.target.value)
                    }
                    className="w-10 h-10 rounded-lg border border-slate-300 cursor-pointer p-0.5"
                  />
                  <input
                    type="text"
                    value={cardStyles.accentColor}
                    onChange={(e) =>
                      handleStyleChange("accentColor", e.target.value)
                    }
                    className="flex-1 rounded-lg border border-slate-300 bg-slate-50 text-xs font-mono focus:border-amber-500 focus:ring-amber-500 py-2 px-2 outline-none uppercase"
                    maxLength={7}
                  />
                </div>
              </div>

              {/* Font Family */}
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Font Family
                </label>
                <select
                  value={cardStyles.fontFamily}
                  onChange={(e) =>
                    handleStyleChange("fontFamily", e.target.value)
                  }
                  className="w-full rounded-lg border border-slate-300 bg-slate-50 text-sm focus:border-amber-500 focus:ring-amber-500 py-2 px-3 outline-none"
                >
                  {FONT_FAMILIES.map((f) => (
                    <option key={f.value} value={f.value}>
                      {f.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Border Radius */}
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Corner Radius: {cardStyles.borderRadius}px
                </label>
                <input
                  type="range"
                  min={0}
                  max={24}
                  value={cardStyles.borderRadius}
                  onChange={(e) =>
                    handleStyleChange(
                      "borderRadius",
                      parseInt(e.target.value, 10),
                    )
                  }
                  className="w-full accent-amber-500"
                />
              </div>

              {/* Font Size Controls */}
              <div className="space-y-3 pt-2 border-t border-slate-100">
                <p className="text-[10px] text-slate-400 uppercase font-semibold tracking-wide">
                  Text &amp; Photo Sizes
                </p>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Photo: {cardStyles.photoScale}%
                  </label>
                  <input
                    type="range"
                    min={50}
                    max={150}
                    step={5}
                    value={cardStyles.photoScale}
                    onChange={(e) =>
                      handleStyleChange(
                        "photoScale",
                        parseInt(e.target.value, 10),
                      )
                    }
                    className="w-full accent-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Name: {cardStyles.nameFontSize}px
                  </label>
                  <input
                    type="range"
                    min={12}
                    max={32}
                    value={cardStyles.nameFontSize}
                    onChange={(e) =>
                      handleStyleChange(
                        "nameFontSize",
                        parseInt(e.target.value, 10),
                      )
                    }
                    className="w-full accent-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Details: {cardStyles.valueFontSize}px
                  </label>
                  <input
                    type="range"
                    min={8}
                    max={20}
                    value={cardStyles.valueFontSize}
                    onChange={(e) =>
                      handleStyleChange(
                        "valueFontSize",
                        parseInt(e.target.value, 10),
                      )
                    }
                    className="w-full accent-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Labels: {cardStyles.labelFontSize}px
                  </label>
                  <input
                    type="range"
                    min={6}
                    max={14}
                    value={cardStyles.labelFontSize}
                    onChange={(e) =>
                      handleStyleChange(
                        "labelFontSize",
                        parseInt(e.target.value, 10),
                      )
                    }
                    className="w-full accent-amber-500"
                  />
                </div>
              </div>

              {/* Preview swatch */}
              <div
                className="h-10 rounded-lg border border-slate-200 flex items-center justify-center text-sm"
                style={{
                  backgroundColor: cardStyles.bgColor,
                  color: cardStyles.fontColor,
                  fontFamily: cardStyles.fontFamily,
                  borderRadius: `${cardStyles.borderRadius}px`,
                }}
              >
                Preview Text
              </div>

              <p className="text-[10px] text-slate-400 leading-relaxed">
                Customize the card appearance. Background, text, and accent
                colors apply to all cards in this session.
              </p>
            </div>

            <hr className="border-slate-200" />

            {/* Section: Validity Text */}
            <div className="space-y-4">
              <h2 className="text-sm uppercase tracking-wider text-slate-500 font-semibold mb-2 flex items-center gap-2">
                <svg
                  className="w-4 h-4 text-green-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                  />
                </svg>
                Card Validity
              </h2>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Validity Text (shown on back)
                </label>
                <input
                  type="text"
                  value={validityText}
                  onChange={(e) => setValidityText(e.target.value)}
                  placeholder="e.g. Valid for 30 days from issue"
                  className="w-full rounded-lg border border-slate-300 bg-slate-50 text-sm focus:border-green-500 focus:ring-green-500 py-2 px-3 outline-none"
                />
              </div>
              <p className="text-[10px] text-slate-400 leading-relaxed">
                This text appears at the bottom of the back side of every card.
              </p>
            </div>

            <hr className="border-slate-200" />

            {/* Section: Field Visibility Toggles */}
            <div className="space-y-3">
              <h2 className="text-sm uppercase tracking-wider text-slate-500 font-semibold mb-2 flex items-center gap-2">
                <svg
                  className="w-4 h-4 text-cyan-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                  />
                </svg>
                Card Fields
              </h2>
              <p className="text-[10px] text-slate-400 leading-relaxed">
                Choose which fields appear on the card. Unchecked fields will be
                hidden from all card layouts.
              </p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { key: "dob", label: "Date of Birth" },
                  { key: "gender", label: "Gender" },
                  { key: "blood_group", label: "Blood Group" },
                  { key: "role", label: "Role / Program" },
                  { key: "address", label: "Address" },
                ].map((f) => (
                  <label
                    key={f.key}
                    className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg border cursor-pointer transition-colors text-xs ${
                      fieldVisibility[f.key]
                        ? "border-cyan-300 bg-cyan-50 text-cyan-800"
                        : "border-slate-200 bg-slate-50 text-slate-400"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={fieldVisibility[f.key]}
                      onChange={() => toggleFieldVisibility(f.key)}
                      className="rounded border-slate-300 text-cyan-500 focus:ring-cyan-400 w-3.5 h-3.5"
                    />
                    {f.label}
                  </label>
                ))}
              </div>
            </div>

            <hr className="border-slate-200" />
            <div className="space-y-4">
              <h2 className="text-sm uppercase tracking-wider text-slate-500 font-semibold mb-2 flex items-center gap-2">
                <svg
                  className="w-4 h-4 text-purple-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                  />
                </svg>
                Custom Fields
              </h2>

              {/* Add new field definition */}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newFieldLabel}
                  onChange={(e) => setNewFieldLabel(e.target.value)}
                  placeholder="Field name (e.g. Register No)"
                  className="flex-1 rounded-lg border border-slate-300 bg-slate-50 text-sm focus:border-purple-500 focus:ring-purple-500 py-2 px-3 outline-none"
                />
                <select
                  value={newFieldSide}
                  onChange={(e) => setNewFieldSide(e.target.value)}
                  className="rounded-lg border border-slate-300 bg-slate-50 text-xs focus:border-purple-500 focus:ring-purple-500 py-2 px-2 outline-none"
                >
                  <option value="front">Front</option>
                  <option value="back">Back</option>
                </select>
                <button
                  onClick={() => {
                    if (!newFieldLabel.trim()) return;
                    setCustomFieldDefs((prev) => [
                      ...prev,
                      { label: newFieldLabel.trim(), side: newFieldSide },
                    ]);
                    setNewFieldLabel("");
                  }}
                  disabled={!newFieldLabel.trim()}
                  className="px-3 py-2 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shrink-0"
                >
                  +
                </button>
              </div>

              {/* List defined custom fields */}
              {customFieldDefs.length > 0 && (
                <div className="space-y-2">
                  {customFieldDefs.map((field, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold uppercase bg-purple-50 text-purple-600 border border-purple-200">
                        {field.side}
                      </span>
                      <span className="flex-1 text-xs font-medium text-slate-700">
                        {field.label}
                      </span>
                      <input
                        type="text"
                        value={form.customValues[field.label] || ""}
                        onChange={(e) =>
                          setForm((prev) => ({
                            ...prev,
                            customValues: {
                              ...prev.customValues,
                              [field.label]: e.target.value,
                            },
                          }))
                        }
                        placeholder={`Enter ${field.label}`}
                        className="w-40 rounded-lg border border-slate-300 bg-slate-50 text-xs focus:border-purple-500 focus:ring-purple-500 py-1.5 px-2 outline-none"
                      />
                      <button
                        onClick={() =>
                          setCustomFieldDefs((prev) =>
                            prev.filter((_, i) => i !== idx),
                          )
                        }
                        className="text-red-400 hover:text-red-600 transition-colors"
                        title="Remove field"
                      >
                        <svg
                          className="w-4 h-4"
                          fill="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <p className="text-[10px] text-slate-400 leading-relaxed">
                Define extra fields like Register No, Blood Group, Department,
                etc. Choose if they appear on the front or back of the card.
                Extra columns in Google Sheets are auto-detected as custom
                fields.
              </p>
            </div>

            {/* Add member button */}
            <div className="flex gap-3">
              <button
                onClick={handleAddMember}
                disabled={!form.name.trim()}
                className="flex-1 py-2.5 bg-[#2563EB] text-white text-sm font-medium rounded-lg hover:bg-[#2563EB]/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                + Add to Queue
              </button>
              <button
                onClick={() => handlePreview(form)}
                className="px-4 py-2.5 border border-slate-300 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-50 transition-colors"
              >
                Preview
              </button>
            </div>

            {/* Org Info Badge */}
            {orgName && (
              <div className="bg-indigo-50 p-3 rounded-lg border border-indigo-100 flex items-center gap-2">
                {effectiveLogoUrl && (
                  <img
                    src={effectiveLogoUrl}
                    alt=""
                    className="w-8 h-8 object-contain rounded"
                  />
                )}
                <div>
                  <p className="text-xs font-semibold text-indigo-800">
                    {orgName}
                  </p>
                  <p className="text-[10px] text-indigo-600">
                    Organization configured for this template
                  </p>
                </div>
              </div>
            )}

            {/* Mapping Guide */}
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
              <div className="flex gap-2">
                <svg
                  className="w-4 h-4 text-[#2563EB] mt-0.5 shrink-0"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z" />
                </svg>
                <div>
                  <h4 className="text-xs font-bold text-[#2563EB] mb-1">
                    How it works
                  </h4>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Add members manually or import from Google Sheets. When
                    ready, click &quot;Generate All IDs&quot; to create and
                    upload all cards to secure storage. Cards are stored based
                    on your subscription plan.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </aside>

        {/* ─── Right Side: Preview + Queue ─── */}
        <div className="flex-1 flex flex-col overflow-hidden min-h-[50vh] lg:min-h-0">
          {/* Toolbar */}
          <div className="min-h-12 border-b border-slate-200 bg-white/80 backdrop-blur-sm flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                PDF Preview
              </span>
              {pdfGenerating && (
                <svg className="animate-spin h-4 w-4 text-[#2563EB]" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2 text-[11px] font-medium text-slate-500">
              <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1">
                {members.length} member{members.length !== 1 ? "s" : ""}
              </span>
              <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1">
                {memberPhotoCount} photo{memberPhotoCount !== 1 ? "s" : ""}
              </span>
              <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1">
                {emailEnabledCount} email enabled
              </span>
              <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1">
                {orientation}
              </span>
            </div>
          </div>

          {/* Canvas area */}
          <div
            className="flex-1 overflow-auto p-4 sm:p-6"
            style={{
              backgroundImage:
                "radial-gradient(rgba(0,0,0,0.05) 1px, transparent 1px)",
              backgroundSize: "20px 20px",
            }}
          >
            <div className="flex flex-col sm:flex-row gap-4 sm:gap-6 items-start">
              {/* ── Sticky Card Preview Column ── */}
              <div
                className="sm:sticky sm:top-0 shrink-0 self-start pt-2 sm:pt-6 flex flex-col items-center w-full sm:w-auto"
                style={{
                  minWidth: orientation === "vertical" ? "260px" : "min(380px, 100%)",
                }}
              >
                {/* Live Preview */}
                {previewData && (
                  <div className="space-y-4">
                    <h3 className="text-sm font-semibold text-slate-500 text-center uppercase tracking-wider">
                      PDF Preview
                    </h3>

                    {/* PDF Preview Iframe */}
                    {pdfBlobUrl ? (
                      <div className="rounded-xl overflow-hidden border border-slate-200 shadow-sm bg-white">
                        <iframe
                          src={pdfBlobUrl}
                          title="Card PDF Preview"
                          className="w-full border-0"
                          style={{ height: orientation === "vertical" ? "550px" : "380px" }}
                        />
                      </div>
                    ) : pdfGenerating ? (
                      <div className="flex items-center justify-center py-16">
                        <div className="text-center space-y-3">
                          <svg className="animate-spin h-8 w-8 text-[#2563EB] mx-auto" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                          </svg>
                          <p className="text-sm text-slate-500">Generating PDF...</p>
                        </div>
                      </div>
                    ) : null}

                    {/* Download PDF button */}
                    <div className="flex items-center justify-center gap-3 flex-wrap">
                      <button
                        onClick={handleDownloadPdf}
                        disabled={downloading || pdfGenerating}
                        className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg flex items-center gap-2 transition-colors disabled:opacity-50 shadow-sm"
                      >
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm-1 1.5L18.5 9H13V3.5zM6 20V4h5v7h7v9H6z" />
                        </svg>
                        {downloading ? "Processing..." : "Download PDF"}
                      </button>
                      <button
                        onClick={() => regeneratePreview(previewData)}
                        disabled={pdfGenerating}
                        className="px-4 py-2.5 border border-slate-300 text-slate-600 text-sm font-medium rounded-lg flex items-center gap-2 hover:bg-slate-50 transition-colors disabled:opacity-50"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        Refresh
                      </button>
                    </div>
                    {/* Download status bar */}
                    {downloadStatus && (
                      <div
                        className={`text-center text-xs font-medium py-1.5 px-3 rounded-lg border ${
                          downloadStatus.startsWith("Error")
                            ? "bg-red-50 text-red-600 border-red-200"
                            : downloadStatus === "Done!"
                              ? "bg-green-50 text-green-600 border-green-200"
                              : "bg-blue-50 text-blue-600 border-blue-200"
                        }`}
                      >
                        {downloadStatus.startsWith("Error")
                          ? ""
                          : downloadStatus === "Done!"
                            ? "Done: "
                            : "Working: "}
                        {downloadStatus}
                      </div>
                    )}
                    <p className="text-[10px] text-slate-400 text-center">
                      PDF generated client-side. Front and back pages.
                    </p>
                  </div>
                )}

                {!previewData && (
                  <div className="text-center py-20">
                    <svg
                      className="w-16 h-16 text-slate-300 mx-auto mb-4"
                      fill="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 14H4V6h16v12z" />
                    </svg>
                    <h3 className="text-lg font-semibold text-slate-500 mb-1">
                      No cards yet
                    </h3>
                    <p className="text-sm text-slate-400">
                      Add members and click &quot;Preview&quot;
                    </p>
                  </div>
                )}
              </div>

              {/* ── Scrollable Queue + Settings Column ── */}
              <div className="flex-1 min-w-0 space-y-6 pb-6">
                {/* Queue + Bulk Generator */}
                {members.length > 0 && (
                  <div
                    ref={generatorSectionRef}
                    className="w-full max-w-2xl space-y-6"
                  >
                    {/* Member queue */}
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                      <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-slate-700">
                          Generation Queue
                        </h3>
                        {members.some((m) => m.email?.trim()) && (
                          <button
                            onClick={() => {
                              const hasEmailMembers = members.filter((m) =>
                                m.email?.trim(),
                              );
                              const allOn = hasEmailMembers.every(
                                (m) => m.sendEmail,
                              );
                              setMembers((prev) =>
                                prev.map((m) =>
                                  m.email?.trim()
                                    ? { ...m, sendEmail: !allOn }
                                    : m,
                                ),
                              );
                            }}
                            className="text-[10px] font-medium text-blue-600 hover:text-blue-800 transition-colors"
                          >
                            {members
                              .filter((m) => m.email?.trim())
                              .every((m) => m.sendEmail)
                              ? "Deselect all emails"
                              : "Select all emails"}
                          </button>
                        )}
                      </div>
                      <div className="divide-y divide-slate-100 max-h-60 overflow-y-auto">
                        {members.map((m, i) => (
                          <div
                            key={i}
                            className="px-4 py-3 flex items-center justify-between"
                          >
                            <div className="flex items-center gap-3">
                              <span className="w-7 h-7 bg-[#2563EB]/10 text-[#2563EB] rounded-full flex items-center justify-center text-xs font-bold">
                                {i + 1}
                              </span>
                              <div>
                                <p className="text-sm font-medium text-slate-800">
                                  {m.name}
                                </p>
                                <p className="text-xs text-slate-500">
                                  {m.role} / {m.id_number}
                                  {m.email && (
                                    <span className="text-blue-500 ml-1">
                                      / {m.email}
                                    </span>
                                  )}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {/* Per-member email toggle */}
                              {m.email?.trim() && (
                                <button
                                  onClick={() =>
                                    setMembers((prev) =>
                                      prev.map((mem, idx) =>
                                        idx === i
                                          ? {
                                              ...mem,
                                              sendEmail: !mem.sendEmail,
                                            }
                                          : mem,
                                      ),
                                    )
                                  }
                                  title={
                                    m.sendEmail
                                      ? "Email ON - click to disable"
                                      : "Email OFF - click to enable"
                                  }
                                  className={`flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium transition-all ${
                                    m.sendEmail
                                      ? "bg-blue-100 text-blue-700 hover:bg-blue-200"
                                      : "bg-slate-100 text-slate-400 hover:bg-slate-200 hover:text-slate-600"
                                  }`}
                                >
                                  <svg
                                    className="w-3 h-3"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                    strokeWidth={2}
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                                    />
                                  </svg>
                                  {m.sendEmail ? "Email ON" : "Email"}
                                </button>
                              )}
                              <button
                                onClick={() => handlePreview(m)}
                                className="text-xs text-[#2563EB] hover:underline"
                              >
                                Preview
                              </button>
                              <button
                                onClick={() => handleRemoveMember(i)}
                                className="text-xs text-red-500 hover:underline"
                              >
                                Remove
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                      {emailAfterGenerate && (
                        <div className="px-4 py-2 bg-amber-50 border-t border-amber-200">
                          <p className="text-[10px] text-amber-700">
                            <strong>Brevo API key required</strong> in backend
                            env var{" "}
                            <code className="bg-amber-100 px-1 py-0.5 rounded text-[10px]">
                              BREVO_API_KEY
                            </code>
                            . {members.filter((m) => m.sendEmail).length}{" "}
                            member(s) will receive email after generation.
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Bulk generation controls: range, cap, email */}
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                      <div className="px-4 py-3 border-b border-slate-200 bg-slate-50">
                        <h3 className="text-sm font-semibold text-slate-700">
                          Generation Settings
                        </h3>
                      </div>
                      <div className="p-4 space-y-4">
                        {/* Range Start / End */}
                        <div>
                          <label className="block text-xs font-medium text-slate-700 mb-1.5">
                            Generate Range (Member #)
                          </label>
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              min={1}
                              max={members.length}
                              value={rangeStart}
                              onChange={(e) =>
                                setRangeStart(
                                  Math.max(
                                    1,
                                    parseInt(e.target.value, 10) || 1,
                                  ),
                                )
                              }
                              className="w-24 rounded-lg border border-slate-300 bg-slate-50 text-sm text-center focus:border-[#2563EB] focus:ring-[#2563EB] py-2 px-2 outline-none"
                              placeholder="From"
                            />
                            <span className="text-slate-400 text-xs">to</span>
                            <input
                              type="number"
                              min={rangeStart}
                              max={members.length}
                              value={rangeEnd}
                              onChange={(e) =>
                                setRangeEnd(
                                  e.target.value === ""
                                    ? ""
                                    : Math.max(
                                        rangeStart,
                                        parseInt(e.target.value, 10) ||
                                          rangeStart,
                                      ),
                                )
                              }
                              className="w-24 rounded-lg border border-slate-300 bg-slate-50 text-sm text-center focus:border-[#2563EB] focus:ring-[#2563EB] py-2 px-2 outline-none"
                              placeholder={`${members.length}`}
                            />
                            <span className="text-[10px] text-slate-400">
                              of {members.length} total
                            </span>
                          </div>
                          <p className="text-[10px] text-slate-400 mt-1">
                            Leave &ldquo;to&rdquo; empty to generate all from
                            the start position.
                          </p>
                        </div>

                        {/* Per-Person Generation Cap */}
                        <div>
                          <label className="block text-xs font-medium text-slate-700 mb-1.5">
                            Per-Person Cap
                          </label>
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              min={1}
                              value={perPersonCap}
                              onChange={(e) =>
                                setPerPersonCap(
                                  e.target.value === ""
                                    ? ""
                                    : Math.max(
                                        1,
                                        parseInt(e.target.value, 10) || 1,
                                      ),
                                )
                              }
                              className="w-24 rounded-lg border border-slate-300 bg-slate-50 text-sm text-center focus:border-[#2563EB] focus:ring-[#2563EB] py-2 px-2 outline-none"
                              placeholder="No limit"
                            />
                            <span className="text-[10px] text-slate-400">
                              max cards per person
                            </span>
                          </div>
                          <p className="text-[10px] text-slate-400 mt-1">
                            If a person appears multiple times in the queue,
                            only the first N are generated. Leave empty for no
                            limit.
                          </p>
                        </div>

                        {/* Cloud Upload Status */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <svg
                              className="w-4 h-4 text-indigo-500"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                              strokeWidth={2}
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                              />
                            </svg>
                            <div>
                              <label className="text-xs font-medium text-slate-700">
                                Token-recorded storage
                              </label>
                              <p className="text-[10px] text-slate-400">
                                Every generated card is saved through the backend
                              </p>
                            </div>
                          </div>
                          <span className="rounded-full bg-indigo-100 px-2 py-1 text-[10px] font-semibold text-indigo-700">
                            Required
                          </span>
                        </div>

                        {/* Email info */}
                        <div className="rounded-lg bg-slate-50 border border-slate-200 p-3">
                          <div className="flex items-center gap-2 mb-1">
                            <svg
                              className="w-3.5 h-3.5 text-blue-500"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                              strokeWidth={2}
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                              />
                            </svg>
                            <span className="text-xs font-medium text-slate-700">
                              Email Delivery
                            </span>
                          </div>
                          <p className="text-[10px] text-slate-500">
                            Toggle email per member in the queue above using the
                            <span className="inline-flex items-center mx-1 px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 text-[9px] font-medium">
                              Email
                            </span>
                            button. Only members with email ON will receive
                            their card as a PDF attachment via Brevo after
                            generation.
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Bulk generator */}
                    <BulkGenerator
                      members={members}
                      userId={user?.id}
                      projectId={location.state?.projectId || null}
                      onComplete={handleGenerationComplete}
                      templateId={templateId}
                      orgName={orgName}
                      logoUrl={logoUrl}
                      customFields={customFieldDefs}
                      watermark={watermark}
                      gradientColors={gradientColors}
                      cardStyles={cardStyles}
                      orientation={orientation}
                      validityText={validityText}
                      rangeStart={rangeStart}
                      rangeEnd={rangeEnd === "" ? members.length : rangeEnd}
                      perPersonCap={perPersonCap === "" ? 0 : perPersonCap}
                      emailAfterGenerate={emailAfterGenerate}
                      uploadToCloud={uploadToCloud}
                    />
                  </div>
                )}

                {members.length === 0 && (
                  <div className="text-center py-12">
                    <p className="text-sm text-slate-400">
                      Add members from the left panel to see queue here
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
