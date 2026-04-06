import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";

const BACKEND = import.meta.env.VITE_BACKEND_URL || "http://localhost:5000";

/**
 * BulkDashboard -- Google Sheets Import + Bulk Operations
 * --------------------------------------------------------
 * URL: /org/:slug/bulk/:projectId
 *
 * Features:
 *  - Paste a Google Sheets URL to fetch headers + preview rows
 *  - Column mapping UI: map sheet columns to project form fields
 *  - Import with validation summary
 *  - View imported members
 *  - Trigger bulk card generation
 */
export default function BulkDashboard() {
  const { slug, projectId } = useParams();
  const navigate = useNavigate();

  // Auth
  const [token, setToken] = useState(null);
  useEffect(() => {
    supabase.auth
      .getSession()
      .then(({ data }) => setToken(data?.session?.access_token));
  }, []);
  const authHeaders = useCallback(
    () => ({
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    }),
    [token],
  );

  // Project / form fields
  const [project, setProject] = useState(null);
  const [formFields, setFormFields] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Sheet fetch
  const [sheetUrl, setSheetUrl] = useState("");
  const [gid, setGid] = useState("");
  const [fetching, setFetching] = useState(false);
  const [sheetHeaders, setSheetHeaders] = useState([]);
  const [previewRows, setPreviewRows] = useState([]);
  const [totalRows, setTotalRows] = useState(0);

  // Column mapping: sheetColumn -> formFieldKey
  const [columnMapping, setColumnMapping] = useState({});

  // Import
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [autoApprove, setAutoApprove] = useState(false);

  // Step tracking
  const [step, setStep] = useState(1); // 1=URL, 2=map, 3=result

  // Load project + form fields
  useEffect(() => {
    if (!token) return;
    (async () => {
      try {
        const [projRes, fieldsRes] = await Promise.all([
          fetch(`${BACKEND}/api/projects/${projectId}`, {
            headers: authHeaders(),
          }),
          fetch(`${BACKEND}/api/form-fields/${projectId}`, {
            headers: authHeaders(),
          }),
        ]);
        const projJson = await projRes.json();
        const fieldsJson = await fieldsRes.json();
        if (!projRes.ok) {
          setError(projJson.error || "Failed to load project");
          setLoading(false);
          return;
        }
        setProject(projJson.project || projJson);
        setFormFields(fieldsJson.fields || fieldsJson || []);
      } catch {
        setError("Failed to load project data.");
      } finally {
        setLoading(false);
      }
    })();
  }, [token, projectId]);

  // Fetch sheet
  const handleFetchSheet = async () => {
    if (!sheetUrl.trim()) return;
    setFetching(true);
    setError("");
    setSuccess("");
    setImportResult(null);
    try {
      const res = await fetch(`${BACKEND}/api/sheets/fetch`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          sheetUrl: sheetUrl.trim(),
          gid: gid.trim() || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Failed to fetch sheet.");
        setFetching(false);
        return;
      }
      setSheetHeaders(json.headers || []);
      setPreviewRows(json.previewRows || []);
      setTotalRows(json.totalRows || 0);

      // Auto-map: exact label match
      const mapping = {};
      const fieldLabels = {};
      const fieldKeys = {};
      formFields.forEach((f) => {
        fieldLabels[f.label?.toLowerCase()] = f.field_key;
        fieldKeys[f.field_key?.toLowerCase()] = f.field_key;
      });
      (json.headers || []).forEach((h) => {
        const lower = h.toLowerCase().trim();
        if (fieldLabels[lower]) mapping[h] = fieldLabels[lower];
        else if (fieldKeys[lower]) mapping[h] = fieldKeys[lower];
        else if (lower === "name" || lower === "full name") mapping[h] = "name";
        else if (lower === "email" || lower === "email address")
          mapping[h] = "email";
        else if (lower === "photo" || lower === "photo url")
          mapping[h] = "photo";
      });
      setColumnMapping(mapping);
      setStep(2);
    } catch {
      setError("Network error fetching sheet.");
    } finally {
      setFetching(false);
    }
  };

  // Update a column mapping
  const updateMapping = (sheetCol, fieldKey) => {
    setColumnMapping((prev) => {
      const next = { ...prev };
      if (!fieldKey) delete next[sheetCol];
      else next[sheetCol] = fieldKey;
      return next;
    });
  };

  // Import
  const handleImport = async () => {
    setImporting(true);
    setError("");
    setSuccess("");
    try {
      const res = await fetch(`${BACKEND}/api/sheets/import/${projectId}`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          sheetUrl: sheetUrl.trim(),
          gid: gid.trim() || undefined,
          columnMapping,
          autoApprove,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Import failed.");
        setImporting(false);
        return;
      }
      setImportResult(json);
      setSuccess(
        `Successfully imported ${json.imported || json.count || 0} members.`,
      );
      setStep(3);
    } catch {
      setError("Network error during import.");
    } finally {
      setImporting(false);
    }
  };

  // Reset to start
  const resetAll = () => {
    setSheetUrl("");
    setGid("");
    setSheetHeaders([]);
    setPreviewRows([]);
    setTotalRows(0);
    setColumnMapping({});
    setImportResult(null);
    setError("");
    setSuccess("");
    setStep(1);
  };

  // List of mappable target fields
  const targetFields = [
    { key: "name", label: "Name (system)", system: true },
    { key: "email", label: "Email (system)", system: true },
    { key: "photo", label: "Photo URL (system)", system: true },
    ...formFields
      .filter((f) => !f.is_system)
      .map((f) => ({ key: f.field_key, label: f.label, system: false })),
  ];

  // Which field keys are already mapped
  const usedFieldKeys = new Set(Object.values(columnMapping));

  if (loading) {
    return (
      <div className="min-h-screen bg-linear-to-br from-slate-950 via-slate-900 to-indigo-950 flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-2 border-indigo-400 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-950 via-slate-900 to-indigo-950 p-4 sm:p-6">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 sm:gap-4 mb-4 sm:mb-6">
          <button
            onClick={() => navigate(`/org/${slug}/project/${projectId}`)}
            className="px-2.5 sm:px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-slate-300 hover:text-white text-xs sm:text-sm transition cursor-pointer shrink-0"
          >
            {"\u2190"} Back
          </button>
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              Google Sheets Import
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 truncate">
              {project?.name || "Project"}
            </p>
          </div>
        </div>

        {/* Steps indicator */}
        <div className="flex items-center gap-2 sm:gap-3 mb-4 sm:mb-6 overflow-x-auto pb-1">
          {[
            { n: 1, label: "Paste URL" },
            { n: 2, label: "Map Columns" },
            { n: 3, label: "Results" },
          ].map(({ n, label }) => (
            <div
              key={n}
              className={`flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs sm:text-sm whitespace-nowrap ${step >= n ? "bg-indigo-600/20 text-indigo-400 border border-indigo-500/30" : "bg-slate-800/50 text-slate-500 border border-slate-700/30"}`}
            >
              <span
                className={`w-4 h-4 sm:w-5 sm:h-5 rounded-full flex items-center justify-center text-[10px] sm:text-xs font-bold ${step > n ? "bg-emerald-500 text-white" : step === n ? "bg-indigo-500 text-white" : "bg-slate-700 text-slate-500"}`}
              >
                {step > n ? "\u2713" : n}
              </span>
              {label}
            </div>
          ))}
        </div>

        {/* Error / Success */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 mb-4">
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}
        {success && (
          <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-3 mb-4">
            <p className="text-emerald-400 text-sm">{success}</p>
          </div>
        )}

        {/* Step 1: Enter URL */}
        {step === 1 && (
          <div className="bg-slate-800/60 backdrop-blur border border-slate-700/50 rounded-2xl p-6">
            <h2 className="text-lg font-semibold text-white mb-1">
              Google Sheet URL
            </h2>
            <p className="text-sm text-slate-400 mb-4">
              Paste the URL of a <strong>publicly shared</strong> Google Sheet.
              The sheet must be accessible via &quot;Anyone with the link&quot;.
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-sm text-slate-300 mb-1">
                  Sheet URL <span className="text-red-400">*</span>
                </label>
                <input
                  type="url"
                  value={sheetUrl}
                  onChange={(e) => setSheetUrl(e.target.value)}
                  placeholder="https://docs.google.com/spreadsheets/d/..."
                  className="w-full px-4 py-3 bg-slate-900/60 border border-slate-600/50 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-300 mb-1">
                  Sheet Tab (gid){" "}
                  <span className="text-slate-500 text-xs">
                    optional, default first tab
                  </span>
                </label>
                <input
                  type="text"
                  value={gid}
                  onChange={(e) => setGid(e.target.value)}
                  placeholder="0"
                  className="w-full px-4 py-2.5 bg-slate-900/60 border border-slate-600/50 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all text-sm"
                />
              </div>
              <button
                onClick={handleFetchSheet}
                disabled={fetching || !sheetUrl.trim()}
                className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-medium transition cursor-pointer"
              >
                {fetching ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Fetching...
                  </span>
                ) : (
                  "Fetch & Preview"
                )}
              </button>
            </div>

            {/* Help */}
            <div className="mt-6 p-4 bg-slate-900/40 border border-slate-700/30 rounded-xl">
              <p className="text-sm font-medium text-slate-300 mb-2">
                {"\uD83D\uDCA1"} How it works
              </p>
              <ol className="text-xs text-slate-400 space-y-1 list-decimal list-inside">
                <li>
                  Make your Google Sheet public (Share {"\u2192"} Anyone with
                  the link {"\u2192"} Viewer)
                </li>
                <li>
                  Paste the URL above and click &quot;Fetch &amp; Preview&quot;
                </li>
                <li>Map each sheet column to a form field</li>
                <li>Review and import the data</li>
              </ol>
            </div>
          </div>
        )}

        {/* Step 2: Column Mapping */}
        {step === 2 && (
          <div className="space-y-6">
            {/* Summary */}
            <div className="bg-slate-800/60 backdrop-blur border border-slate-700/50 rounded-2xl p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-lg font-semibold text-white">
                    Map Columns
                  </h2>
                  <p className="text-sm text-slate-400">
                    {totalRows} rows found &middot; {sheetHeaders.length}{" "}
                    columns
                  </p>
                </div>
                <button
                  onClick={resetAll}
                  className="text-sm text-slate-400 hover:text-white transition cursor-pointer"
                >
                  {"\u2190"} Change Sheet
                </button>
              </div>

              {/* Mapping table */}
              <div className="space-y-2">
                {sheetHeaders.map((header) => (
                  <div
                    key={header}
                    className="flex items-center gap-3 bg-slate-900/40 border border-slate-700/30 rounded-lg p-3"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white font-medium truncate">
                        {header}
                      </p>
                      <p className="text-xs text-slate-500 truncate">
                        {previewRows.length > 0 && previewRows[0][header]
                          ? `e.g. "${previewRows[0][header]}"`
                          : "No preview data"}
                      </p>
                    </div>
                    <span className="text-slate-600">{"\u2192"}</span>
                    <select
                      value={columnMapping[header] || ""}
                      onChange={(e) => updateMapping(header, e.target.value)}
                      className="w-56 px-3 py-2 bg-slate-800 border border-slate-600/50 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                    >
                      <option value="">-- Skip --</option>
                      {targetFields.map((f) => (
                        <option
                          key={f.key}
                          value={f.key}
                          disabled={
                            usedFieldKeys.has(f.key) &&
                            columnMapping[header] !== f.key
                          }
                        >
                          {f.label}
                          {f.system ? " *" : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>

              {/* Mapped count */}
              <p className="text-xs text-slate-500 mt-3">
                {Object.keys(columnMapping).length} of {sheetHeaders.length}{" "}
                columns mapped
                {!Object.values(columnMapping).includes("name") && (
                  <span className="text-amber-400 ml-2">
                    {"\u26A0"} Name column not mapped
                  </span>
                )}
              </p>
            </div>

            {/* Preview table */}
            {previewRows.length > 0 && (
              <div className="bg-slate-800/60 backdrop-blur border border-slate-700/50 rounded-2xl p-5 overflow-hidden">
                <h3 className="text-sm font-semibold text-white mb-3">
                  Preview (first {previewRows.length} rows)
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-slate-700/50">
                        {sheetHeaders.map((h) => (
                          <th
                            key={h}
                            className={`text-left px-3 py-2 font-medium ${columnMapping[h] ? "text-indigo-400" : "text-slate-500"}`}
                          >
                            {h}
                            {columnMapping[h] && (
                              <span className="ml-1 text-[10px] text-emerald-400">
                                ({columnMapping[h]})
                              </span>
                            )}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {previewRows.map((row, i) => (
                        <tr key={i} className="border-b border-slate-800/50">
                          {sheetHeaders.map((h) => (
                            <td
                              key={h}
                              className={`px-3 py-2 truncate max-w-50 ${columnMapping[h] ? "text-slate-300" : "text-slate-600"}`}
                            >
                              {row[h] || ""}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Import controls */}
            <div className="bg-slate-800/60 backdrop-blur border border-slate-700/50 rounded-2xl p-5">
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoApprove}
                    onChange={(e) => setAutoApprove(e.target.checked)}
                    className="accent-indigo-500 w-4 h-4"
                  />
                  <span className="text-sm text-slate-300">
                    Auto-approve imported members
                  </span>
                </label>
                <button
                  onClick={handleImport}
                  disabled={
                    importing || Object.keys(columnMapping).length === 0
                  }
                  className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-medium transition cursor-pointer"
                >
                  {importing ? (
                    <span className="flex items-center gap-2">
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Importing...
                    </span>
                  ) : (
                    `Import ${totalRows} Members`
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Import Results */}
        {step === 3 && importResult && (
          <div className="space-y-4">
            <div className="bg-slate-800/60 backdrop-blur border border-slate-700/50 rounded-2xl p-6 text-center">
              <div className="w-16 h-16 rounded-full bg-emerald-500/20 border-2 border-emerald-500 flex items-center justify-center mx-auto mb-4">
                <svg
                  className="w-8 h-8 text-emerald-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
              <h2 className="text-xl font-bold text-white mb-2">
                Import Complete
              </h2>
              <p className="text-slate-400">
                {importResult.imported || importResult.count || 0} members
                imported
                {importResult.skipped
                  ? ` \u00B7 ${importResult.skipped} skipped`
                  : ""}
                {autoApprove ? " (auto-approved)" : " (pending approval)"}
              </p>
            </div>

            {/* Validation errors if any */}
            {importResult.validationErrors &&
              importResult.validationErrors.length > 0 && (
                <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-5">
                  <h3 className="text-sm font-semibold text-amber-400 mb-2">
                    {"\u26A0"} Validation Issues (
                    {importResult.validationErrors.length})
                  </h3>
                  <div className="max-h-48 overflow-y-auto space-y-1">
                    {importResult.validationErrors.slice(0, 50).map((e, i) => (
                      <p key={i} className="text-xs text-amber-300/80">
                        Row {e.row}: {e.message || e.error || JSON.stringify(e)}
                      </p>
                    ))}
                    {importResult.validationErrors.length > 50 && (
                      <p className="text-xs text-amber-400">
                        ...and {importResult.validationErrors.length - 50} more
                      </p>
                    )}
                  </div>
                </div>
              )}

            {/* Actions */}
            <div className="flex items-center gap-3">
              <button
                onClick={resetAll}
                className="px-5 py-2.5 bg-slate-800 border border-slate-700 hover:bg-slate-700 text-white rounded-xl font-medium transition cursor-pointer"
              >
                Import Another Sheet
              </button>
              <button
                onClick={() => navigate(`/org/${slug}/project/${projectId}`)}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-medium transition cursor-pointer"
              >
                Go to Project Dashboard
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
