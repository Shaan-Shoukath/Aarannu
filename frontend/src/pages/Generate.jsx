import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import BulkGenerator from "../components/BulkGenerator";
import IDCard from "../components/IDCard";
import CorporateCard from "../components/CorporateCard";
import EventCard from "../components/EventCard";
import StudentCard from "../components/StudentCard";

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

  // Template info from /templates page
  const templateId = location.state?.template || "custom";
  const orgName = location.state?.orgName || "";
  const logoUrl = location.state?.logoUrl || "";
  const watermark = location.state?.watermark || {
    text: "",
    textOpacity: 0.08,
    imageUrl: "",
    imageOpacity: 0.06,
  };

  const [user, setUser] = useState(null);
  const [_member, setMember] = useState(null);
  const [loading, setLoading] = useState(true);

  // Members to generate IDs for
  const [members, setMembers] = useState([]);

  // Custom field definitions: [{label, side: 'front'|'back'}]
  const [customFieldDefs, setCustomFieldDefs] = useState([]);
  const [newFieldLabel, setNewFieldLabel] = useState("");
  const [newFieldSide, setNewFieldSide] = useState("front");

  // Form state for adding a new member
  const [form, setForm] = useState({
    name: "",
    role: "",
    id_number: "",
    dob: "",
    gender: "Male",
    photo_url: "",
    address: "",
    customValues: {},
  });

  // Preview mode
  const [previewData, setPreviewData] = useState(null);
  const [showBack, setShowBack] = useState(false);

  // Google Sheets import
  const [sheetsUrl, setSheetsUrl] = useState("");
  const [sheetsLoading, setSheetsLoading] = useState(false);
  const [sheetsError, setSheetsError] = useState("");
  const [sheetsSuccess, setSheetsSuccess] = useState("");

  const TEMPLATE_LABELS = {
    custom: "Custom",
    corporate: "Corporate Standard",
    event: "Event Access",
    student: "Student ID",
  };

  const checkAccess = async () => {
    setLoading(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    setUser(user);

    if (!user) {
      navigate("/login", { replace: true });
      return;
    }

    const { data: memberData } = await supabase
      .from("members")
      .select("*")
      .eq("user_id", user.id)
      .single();

    setMember(memberData);

    if (!memberData?.approved) {
      navigate("/dashboard", { replace: true });
      return;
    }

    setLoading(false);
  };

  useEffect(() => {
    checkAccess();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleFormChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleAddMember = () => {
    if (!form.name.trim()) return;

    const newMember = {
      ...form,
      name: form.name.trim(),
      role: form.role.trim() || "Member",
      id_number:
        form.id_number.trim() || `ID-${Date.now().toString(36).toUpperCase()}`,
      customValues: { ...form.customValues },
    };

    setMembers((prev) => [...prev, newMember]);
    setForm({
      name: "",
      role: "",
      id_number: "",
      dob: "",
      gender: "Male",
      photo_url: "",
      address: "",
      customValues: {},
    });
  };

  const handleRemoveMember = (index) => {
    setMembers((prev) => prev.filter((_, i) => i !== index));
  };

  const handlePreview = (data) => {
    setPreviewData(data);
  };

  const handleGenerationComplete = () => {
    setMembers([]);
  };

  /** ── Google Sheets CSV Import ── */
  const handleSheetsImport = async () => {
    if (!sheetsUrl.trim()) return;
    setSheetsLoading(true);
    setSheetsError("");
    setSheetsSuccess("");

    try {
      // Convert any Google Sheets URL to CSV export URL
      let csvUrl = sheetsUrl.trim();

      // Handle various Google Sheets URL formats
      const spreadsheetIdMatch = csvUrl.match(
        /\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/,
      );
      if (spreadsheetIdMatch) {
        const sheetId = spreadsheetIdMatch[1];
        // Extract gid if present
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

      const headers = rows[0].map((h) => h.trim().toLowerCase());
      const imported = [];

      // Known standard column keys (all lowercase)
      const STANDARD_KEYS = new Set([
        "name",
        "full name",
        "fullname",
        "member name",
        "role",
        "designation",
        "title",
        "position",
        "id",
        "id_number",
        "id number",
        "member id",
        "memberid",
        "dob",
        "date of birth",
        "birthday",
        "birth date",
        "gender",
        "sex",
        "photo",
        "photo_url",
        "photo url",
        "image",
        "image_url",
        "address",
        "addr",
        "location",
      ]);

      // Detect extra columns that become custom fields
      const extraColumns = headers
        .map((h, idx) => ({ header: h, idx }))
        .filter((c) => c.header && !STANDARD_KEYS.has(c.header));

      // Auto-register detected custom fields (skip if already defined)
      if (extraColumns.length > 0) {
        setCustomFieldDefs((prev) => {
          const existing = new Set(prev.map((f) => f.label.toLowerCase()));
          const newDefs = extraColumns
            .filter((c) => !existing.has(c.header))
            .map((c) => ({
              label: c.header.charAt(0).toUpperCase() + c.header.slice(1),
              side: "front",
            }));
          return [...prev, ...newDefs];
        });
      }

      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (row.every((c) => !c.trim())) continue; // skip empty rows

        const get = (keys) => {
          for (const k of keys) {
            const idx = headers.indexOf(k);
            if (idx !== -1 && row[idx]?.trim()) return row[idx].trim();
          }
          return "";
        };

        const name = get(["name", "full name", "fullname", "member name"]);
        if (!name) continue; // name is required

        imported.push({
          name,
          role: get(["role", "designation", "title", "position"]) || "Member",
          id_number:
            get(["id", "id_number", "id number", "member id", "memberid"]) ||
            `ID-${Date.now().toString(36).toUpperCase()}-${i}`,
          dob: get(["dob", "date of birth", "birthday", "birth date"]),
          gender: get(["gender", "sex"]) || "N/A",
          photo_url: get([
            "photo",
            "photo_url",
            "photo url",
            "image",
            "image_url",
          ]),
          address: get(["address", "addr", "location"]),
          customValues: Object.fromEntries(
            extraColumns.map((c) => [
              c.header.charAt(0).toUpperCase() + c.header.slice(1),
              row[c.idx]?.trim() || "",
            ]),
          ),
        });
      }

      if (imported.length === 0) {
        throw new Error(
          'No valid rows found. Make sure column headers include at least "name".',
        );
      }

      setMembers((prev) => [...prev, ...imported]);
      setSheetsSuccess(
        `Imported ${imported.length} member(s) from Google Sheets.`,
      );
      setSheetsUrl("");
    } catch (err) {
      setSheetsError(err.message);
    } finally {
      setSheetsLoading(false);
    }
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

  /** Render the correct card component based on selected template */
  const renderCard = (data, ref = null, back = showBack) => {
    const props = {
      data,
      showBack: back,
      orgName,
      logoUrl,
      ref,
      customFields: customFieldDefs,
      watermark,
    };
    switch (templateId) {
      case "corporate":
        return <CorporateCard {...props} />;
      case "event":
        return <EventCard {...props} />;
      case "student":
        return <StudentCard {...props} />;
      default:
        return <IDCard {...props} />;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f6f6f8]">
        <svg
          className="animate-spin h-8 w-8 text-[#1152d4]"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
          />
        </svg>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f6f6f8] font-['Public_Sans',sans-serif] flex flex-col">
      {/* ─── Header ─── */}
      <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-green-600 rounded-lg flex items-center justify-center text-white font-bold text-lg">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M3 3v8h8V3H3zm6 6H5V5h4v4zm-6 4v8h8v-8H3zm6 6H5v-4h4v4zm4-16v8h8V3h-8zm6 6h-4V5h4v4zm-6 4v8h8v-8h-8zm6 6h-4v-4h4v4z" />
            </svg>
          </div>
          <h1 className="font-bold text-lg text-slate-900">
            Bulk ID Generator{" "}
            <span className="text-slate-400 font-normal ml-2 text-sm">
              | {TEMPLATE_LABELS[templateId]} Template
            </span>
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/templates")}
            className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-[#1152d4] transition-colors border border-slate-300 rounded-lg"
          >
            ← Change Template
          </button>
          <button
            onClick={() => navigate("/dashboard")}
            className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-[#1152d4] transition-colors border border-slate-300 rounded-lg"
          >
            Dashboard
          </button>
        </div>
      </header>

      {/* ─── Main Content ─── */}
      <main className="flex-1 flex overflow-hidden">
        {/* ─── Left Sidebar: Data Entry ─── */}
        <aside className="w-100 shrink-0 bg-white border-r border-slate-200 overflow-y-auto">
          <div className="p-6 space-y-8">
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
                  {sheetsLoading ? "..." : "Import"}
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
              <p className="text-[10px] text-slate-400 leading-relaxed">
                Sheet must have a header row with columns like:{" "}
                <strong>name</strong>, role, id_number, dob, gender, photo_url,
                address. Any extra columns (e.g. register_no, blood_group) are
                auto-added as custom fields. Share the sheet as &quot;Anyone
                with the link&quot;.
              </p>
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
                    className="w-full rounded-lg border border-slate-300 bg-slate-50 text-sm focus:border-[#1152d4] focus:ring-[#1152d4] py-2 px-3 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Date of Birth
                  </label>
                  <input
                    type="date"
                    value={form.dob}
                    onChange={(e) => handleFormChange("dob", e.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-slate-50 text-sm focus:border-[#1152d4] focus:ring-[#1152d4] py-2 px-3 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Gender
                  </label>
                  <select
                    value={form.gender}
                    onChange={(e) => handleFormChange("gender", e.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-slate-50 text-sm focus:border-[#1152d4] focus:ring-[#1152d4] py-2 px-3 outline-none"
                  >
                    <option>Male</option>
                    <option>Female</option>
                    <option>Other</option>
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
                    className="w-full rounded-lg border border-slate-300 bg-slate-50 text-sm focus:border-[#1152d4] focus:ring-[#1152d4] py-2 px-3 outline-none"
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
                      className="pl-9 w-full rounded-lg border border-slate-300 bg-slate-50 text-sm font-mono tracking-wide focus:border-[#1152d4] focus:ring-[#1152d4] py-2 px-3 outline-none"
                    />
                  </div>
                </div>
              </div>
            </div>

            <hr className="border-slate-200" />

            {/* Section 2: Photo URL */}
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
                  className="w-full rounded-lg border border-slate-300 bg-slate-50 text-sm focus:border-[#1152d4] focus:ring-[#1152d4] py-2 px-3 outline-none"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  Direct link to an image (JPG/PNG)
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
                  className="w-full rounded-lg border border-slate-300 bg-slate-50 text-sm focus:border-[#1152d4] focus:ring-[#1152d4] py-2 px-3 outline-none resize-none"
                />
              </div>
            </div>

            <hr className="border-slate-200" />

            {/* Section 4: Custom Fields */}
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
                className="flex-1 py-2.5 bg-[#1152d4] text-white text-sm font-medium rounded-lg hover:bg-[#1152d4]/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
                {logoUrl && (
                  <img
                    src={logoUrl}
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
                  className="w-4 h-4 text-[#1152d4] mt-0.5 shrink-0"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z" />
                </svg>
                <div>
                  <h4 className="text-xs font-bold text-[#1152d4] mb-1">
                    How it works
                  </h4>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Add members manually or import from Google Sheets. When
                    ready, click &quot;Generate All IDs&quot; to create and
                    upload all cards to secure storage. Cards expire after 15
                    days.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </aside>

        {/* ─── Right Side: Preview + Queue ─── */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Toolbar */}
          <div className="h-12 border-b border-slate-200 bg-white/50 backdrop-blur-sm flex items-center justify-between px-6">
            <div className="flex bg-slate-100 rounded-lg p-1">
              <button
                onClick={() => setShowBack(false)}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                  !showBack
                    ? "bg-white text-[#1152d4] shadow-sm"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                Front Only
              </button>
              <button
                onClick={() => setShowBack(true)}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                  showBack
                    ? "bg-white text-[#1152d4] shadow-sm"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                Both Sides
              </button>
            </div>
            <span className="text-xs text-slate-400">
              {members.length} member{members.length !== 1 ? "s" : ""} in queue
            </span>
          </div>

          {/* Canvas area */}
          <div
            className="flex-1 overflow-auto p-12 flex flex-col items-center justify-start gap-8"
            style={{
              backgroundImage:
                "radial-gradient(rgba(0,0,0,0.05) 1px, transparent 1px)",
              backgroundSize: "20px 20px",
            }}
          >
            {/* Live Preview */}
            {previewData && (
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-slate-500 text-center uppercase tracking-wider">
                  Live Preview
                </h3>
                <div className="transform transition-transform hover:scale-[1.02] duration-300">
                  {renderCard(previewData)}
                </div>
              </div>
            )}

            {!previewData && members.length === 0 && (
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
                  Fill in the form on the left, import from Google Sheets, or
                  click &quot;Preview&quot;
                </p>
              </div>
            )}

            {/* Queue + Bulk Generator */}
            {members.length > 0 && (
              <div className="w-full max-w-2xl space-y-6">
                {/* Member queue */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="px-4 py-3 border-b border-slate-200 bg-slate-50">
                    <h3 className="text-sm font-semibold text-slate-700">
                      Generation Queue
                    </h3>
                  </div>
                  <div className="divide-y divide-slate-100 max-h-60 overflow-y-auto">
                    {members.map((m, i) => (
                      <div
                        key={i}
                        className="px-4 py-3 flex items-center justify-between"
                      >
                        <div className="flex items-center gap-3">
                          <span className="w-7 h-7 bg-[#1152d4]/10 text-[#1152d4] rounded-full flex items-center justify-center text-xs font-bold">
                            {i + 1}
                          </span>
                          <div>
                            <p className="text-sm font-medium text-slate-800">
                              {m.name}
                            </p>
                            <p className="text-xs text-slate-500">
                              {m.role} · {m.id_number}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handlePreview(m)}
                            className="text-xs text-[#1152d4] hover:underline"
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
                </div>

                {/* Bulk generator */}
                <BulkGenerator
                  members={members}
                  userId={user?.id}
                  onComplete={handleGenerationComplete}
                  templateId={templateId}
                  orgName={orgName}
                  logoUrl={logoUrl}
                  customFields={customFieldDefs}
                  watermark={watermark}
                />
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
