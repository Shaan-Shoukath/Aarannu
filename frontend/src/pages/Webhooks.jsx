import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

/**
 * Webhooks Page — Admin Setup for Google Form Automation
 * ══════════════════════════════════════════════════════
 *
 * Allows admins to:
 *  1. Create webhook configurations (pick template, map form fields).
 *  2. View/copy webhook URLs + secrets.
 *  3. Get a ready-to-paste Google Apps Script.
 *  4. Edit or delete webhooks.
 */
export default function Webhooks() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [webhooks, setWebhooks] = useState([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Create form state
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    name: "",
    template: "custom",
    org_name: "",
    logo_url: "",
    auto_email: true,
    orientation: "horizontal",
    validity_text: "Valid for 1 year from issue",
    field_mapping: {
      name: "",
      role: "",
      email: "",
      id_number: "",
      dob: "",
      gender: "",
      blood_group: "",
      photo_url: "",
      address: "",
    },
  });

  // Expanded webhook (shows details)
  const [expandedId, setExpandedId] = useState(null);
  // Script modal
  const [scriptWebhook, setScriptWebhook] = useState(null);

  // ── Auth check ────────────────────────────────────────────
  useEffect(() => {
    const checkAuth = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        navigate("/login");
        return;
      }
      setUser(session.user);
      setLoading(false);
    };
    checkAuth();
  }, [navigate]);

  // ── Fetch webhooks ────────────────────────────────────────
  const fetchWebhooks = useCallback(async () => {
    if (!user) return;
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const res = await fetch(`${API_URL}/api/webhook-config`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const json = await res.json();
      if (res.ok) {
        setWebhooks(json.webhooks || []);
      }
    } catch {
      setError("Failed to fetch webhook configurations.");
    }
  }, [user]);

  useEffect(() => {
    fetchWebhooks();
  }, [fetchWebhooks]);

  // ── Create webhook ────────────────────────────────────────
  const handleCreate = async (e) => {
    e.preventDefault();
    setCreating(true);
    setError("");
    setSuccess("");

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      // Clean up empty field mappings
      const cleanMapping = {};
      for (const [key, val] of Object.entries(form.field_mapping)) {
        if (val.trim()) cleanMapping[key] = val.trim();
      }

      const res = await fetch(`${API_URL}/api/webhook-config`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          ...form,
          field_mapping: cleanMapping,
        }),
      });

      const json = await res.json();
      if (res.ok) {
        setSuccess("Webhook created! Copy the URL and secret below.");
        setShowCreate(false);
        setForm({
          name: "",
          template: "custom",
          org_name: "",
          logo_url: "",
          auto_email: true,
          orientation: "horizontal",
          validity_text: "Valid for 1 year from issue",
          field_mapping: {
            name: "",
            role: "",
            email: "",
            id_number: "",
            dob: "",
            gender: "",
            blood_group: "",
            photo_url: "",
            address: "",
          },
        });
        fetchWebhooks();
        // Auto-expand the new webhook
        if (json.webhook?.id) setExpandedId(json.webhook.id);
      } else {
        setError(json.message || "Failed to create webhook.");
      }
    } catch {
      setError("Network error creating webhook.");
    } finally {
      setCreating(false);
    }
  };

  // ── Delete webhook ────────────────────────────────────────
  const handleDelete = async (id) => {
    if (!confirm("Delete this webhook? This cannot be undone.")) return;
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const res = await fetch(`${API_URL}/api/webhook-config/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (res.ok) {
        setSuccess("Webhook deleted.");
        fetchWebhooks();
      }
    } catch {
      setError("Failed to delete webhook.");
    }
  };

  // ── Toggle active ─────────────────────────────────────────
  const handleToggleActive = async (webhook) => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      await fetch(`${API_URL}/api/webhook-config/${webhook.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ is_active: !webhook.is_active }),
      });
      fetchWebhooks();
    } catch {
      setError("Failed to toggle webhook status.");
    }
  };

  // ── Regenerate secret ─────────────────────────────────────
  const handleRegenerateSecret = async (id) => {
    if (
      !confirm(
        "Regenerate secret? You will need to update your Google Apps Script.",
      )
    )
      return;
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const res = await fetch(
        `${API_URL}/api/webhook-config/${id}/regenerate-secret`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${session.access_token}` },
        },
      );
      if (res.ok) {
        setSuccess("Secret regenerated. Update your Google Apps Script.");
        fetchWebhooks();
      }
    } catch {
      setError("Failed to regenerate secret.");
    }
  };

  // ── Generate Google Apps Script ───────────────────────────
  const getAppsScript = (webhook) => {
    const webhookUrl = `${API_URL}/api/webhook/${webhook.id}`;
    return `/**
 * Google Apps Script — Community ID Webhook
 * ══════════════════════════════════════════
 *
 * Automatically sends Google Form responses to your Community ID
 * backend to generate ID cards.
 *
 * Setup:
 *   1. Open your Google Form → ⋮ menu → Script editor
 *   2. Paste this entire script
 *   3. Run "installTrigger" once (authorize when prompted)
 *   4. Every new form submission will auto-generate an ID card!
 *
 * Webhook: ${webhook.name}
 * Template: ${webhook.template}
 */

const WEBHOOK_URL = "${webhookUrl}";
const WEBHOOK_SECRET = "${webhook.secret}";

/**
 * Run this ONCE to install the form-submit trigger.
 * Go to Run → installTrigger in the script editor.
 */
function installTrigger() {
  // Remove any existing triggers to avoid duplicates
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(t => ScriptApp.deleteTrigger(t));
  
  ScriptApp.newTrigger("onFormSubmit")
    .forForm(FormApp.getActiveForm())
    .onFormSubmit()
    .create();
  
  Logger.log("✅ Trigger installed! New submissions will now generate ID cards.");
}

/**
 * Triggered automatically on every form submission.
 * Extracts the response values and POSTs them to the webhook.
 */
function onFormSubmit(e) {
  try {
    const response = e.response;
    const items = response.getItemResponses();
    
    // Build a key-value object from the form responses
    // Keys are the question titles — these must match your field_mapping!
    const formData = {};
    items.forEach(item => {
      formData[item.getItem().getTitle()] = item.getResponse();
    });
    
    // Send to Community ID webhook
    const options = {
      method: "post",
      contentType: "application/json",
      headers: {
        "X-Webhook-Secret": WEBHOOK_SECRET
      },
      payload: JSON.stringify(formData),
      muteHttpExceptions: true
    };
    
    const result = UrlFetchApp.fetch(WEBHOOK_URL, options);
    const status = result.getResponseCode();
    const body = result.getContentText();
    
    if (status === 201) {
      Logger.log("✅ ID card generated: " + body);
    } else {
      Logger.log("⚠️ Webhook returned " + status + ": " + body);
    }
  } catch (err) {
    Logger.log("❌ Error sending to webhook: " + err.message);
  }
}
`;
  };

  // ── Copy to clipboard ─────────────────────────────────────
  const copyToClipboard = async (text, label) => {
    try {
      await navigator.clipboard.writeText(text);
      setSuccess(`${label} copied to clipboard!`);
      setTimeout(() => setSuccess(""), 3000);
    } catch {
      setError("Failed to copy to clipboard.");
    }
  };

  // ── Template labels ───────────────────────────────────────
  const templateLabels = {
    custom: "Geometric Gradient",
    corporate: "Corporate",
    student: "Student",
    event: "Event",
  };

  // ── Card field labels ─────────────────────────────────────
  const cardFieldLabels = {
    name: "Full Name *",
    role: "Role / Position",
    email: "Email (for auto-send)",
    id_number: "ID Number",
    dob: "Date of Birth",
    gender: "Gender",
    blood_group: "Blood Group",
    photo_url: "Photo URL",
    address: "Address",
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-linear-to-br from-slate-950 via-indigo-950 to-slate-950">
        <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-950 via-indigo-950 to-slate-950 text-white">
      {/* ── Header ─────────────────────────────────────────── */}
      <div className="sticky top-0 z-50 backdrop-blur bg-slate-950/80 border-b border-white/10">
        <div className="max-w-5xl mx-auto flex items-center justify-between px-6 py-4">
          <button
            onClick={() => navigate("/dashboard")}
            className="text-sm text-indigo-300 hover:text-white transition"
          >
            ← Back to Dashboard
          </button>
          <h1 className="text-xl font-bold bg-linear-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
            Webhook Automation
          </h1>
          <button
            onClick={() => setShowCreate(!showCreate)}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-sm font-medium transition"
          >
            {showCreate ? "Cancel" : "+ New Webhook"}
          </button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">
        {/* ── Status messages ──────────────────────────────── */}
        {error && (
          <div className="px-4 py-3 rounded-lg bg-red-500/20 border border-red-400/30 text-red-300 text-sm">
            {error}
            <button
              onClick={() => setError("")}
              className="float-right text-red-400 hover:text-red-200"
            >
              ✕
            </button>
          </div>
        )}
        {success && (
          <div className="px-4 py-3 rounded-lg bg-green-500/20 border border-green-400/30 text-green-300 text-sm">
            {success}
            <button
              onClick={() => setSuccess("")}
              className="float-right text-green-400 hover:text-green-200"
            >
              ✕
            </button>
          </div>
        )}

        {/* ── How it works ───────────────────────────────── */}
        <div className="rounded-xl bg-white/5 border border-white/10 p-6">
          <h2 className="text-lg font-semibold mb-3">
            How Google Form → ID Card Automation Works
          </h2>
          <ol className="list-decimal list-inside space-y-2 text-sm text-slate-300">
            <li>
              Create a webhook below — pick your card template and map your form
              fields.
            </li>
            <li>
              Copy the generated <strong>Google Apps Script</strong> and paste
              it into your Google Form's script editor.
            </li>
            <li>
              Run{" "}
              <code className="bg-white/10 px-1 rounded">installTrigger</code>{" "}
              once to activate the automation.
            </li>
            <li>
              Every new form submission automatically generates an ID card and
              emails it to the member!
            </li>
          </ol>
        </div>

        {/* ── Create form ────────────────────────────────── */}
        {showCreate && (
          <form
            onSubmit={handleCreate}
            className="rounded-xl bg-white/5 border border-white/10 p-6 space-y-6"
          >
            <h2 className="text-lg font-semibold">Create New Webhook</h2>

            {/* Basic config */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-slate-400 mb-1">
                  Webhook Name
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. Student Registration Form"
                  required
                  className="w-full px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">
                  Card Template
                </label>
                <select
                  value={form.template}
                  onChange={(e) =>
                    setForm({ ...form, template: e.target.value })
                  }
                  className="w-full px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="custom">Geometric Gradient</option>
                  <option value="corporate">Corporate</option>
                  <option value="student">Student</option>
                  <option value="event">Event</option>
                </select>
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">
                  Organization Name
                </label>
                <input
                  type="text"
                  value={form.org_name}
                  onChange={(e) =>
                    setForm({ ...form, org_name: e.target.value })
                  }
                  placeholder="e.g. Navodaya Tech Club"
                  className="w-full px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">
                  Logo URL (optional)
                </label>
                <input
                  type="url"
                  value={form.logo_url}
                  onChange={(e) =>
                    setForm({ ...form, logo_url: e.target.value })
                  }
                  placeholder="https://..."
                  className="w-full px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">
                  Card Orientation
                </label>
                <select
                  value={form.orientation}
                  onChange={(e) =>
                    setForm({ ...form, orientation: e.target.value })
                  }
                  className="w-full px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="horizontal">Horizontal (Landscape)</option>
                  <option value="vertical">Vertical (Portrait)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">
                  Validity Text
                </label>
                <input
                  type="text"
                  value={form.validity_text}
                  onChange={(e) =>
                    setForm({ ...form, validity_text: e.target.value })
                  }
                  className="w-full px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            {/* Auto-email toggle */}
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="auto-email"
                checked={form.auto_email}
                onChange={(e) =>
                  setForm({ ...form, auto_email: e.target.checked })
                }
                className="accent-indigo-500"
              />
              <label htmlFor="auto-email" className="text-sm text-slate-300">
                Auto-email ID card to member after generation (requires email
                field mapping)
              </label>
            </div>

            {/* Field mapping */}
            <div>
              <h3 className="text-sm font-semibold text-slate-200 mb-2">
                Field Mapping
              </h3>
              <p className="text-xs text-slate-400 mb-4">
                Enter the <strong>exact question title</strong> from your Google
                Form for each card field. Leave blank to skip.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {Object.entries(cardFieldLabels).map(([key, label]) => (
                  <div key={key}>
                    <label className="block text-xs text-slate-400 mb-1">
                      {label}
                    </label>
                    <input
                      type="text"
                      value={form.field_mapping[key] || ""}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          field_mapping: {
                            ...form.field_mapping,
                            [key]: e.target.value,
                          },
                        })
                      }
                      placeholder={`Google Form question title for ${key}`}
                      className="w-full px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder:text-slate-500"
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-3">
              <button
                type="submit"
                disabled={creating || !form.name}
                className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 rounded-lg text-sm font-medium transition"
              >
                {creating ? "Creating..." : "Create Webhook"}
              </button>
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className="px-6 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-sm transition"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {/* ── Webhook list ───────────────────────────────── */}
        {webhooks.length === 0 && !showCreate ? (
          <div className="text-center py-16">
            <div className="text-6xl mb-4">🔗</div>
            <h2 className="text-xl font-semibold mb-2">No webhooks yet</h2>
            <p className="text-sm text-slate-400 mb-6">
              Create your first webhook to start automatically generating ID
              cards from Google Form submissions.
            </p>
            <button
              onClick={() => setShowCreate(true)}
              className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 rounded-lg font-medium transition"
            >
              + Create First Webhook
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {webhooks.map((wh) => (
              <div
                key={wh.id}
                className={`rounded-xl border transition ${
                  wh.is_active
                    ? "bg-white/5 border-white/10"
                    : "bg-white/2 border-white/5 opacity-60"
                }`}
              >
                {/* Header */}
                <div
                  className="flex items-center justify-between p-4 cursor-pointer"
                  onClick={() =>
                    setExpandedId(expandedId === wh.id ? null : wh.id)
                  }
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`w-2.5 h-2.5 rounded-full ${
                        wh.is_active ? "bg-green-400" : "bg-red-400"
                      }`}
                    />
                    <div>
                      <h3 className="font-semibold">{wh.name}</h3>
                      <p className="text-xs text-slate-400">
                        {templateLabels[wh.template] || wh.template} •{" "}
                        {wh.org_name || "No org"} •{" "}
                        {wh.auto_email ? "Auto-email ON" : "No email"}
                      </p>
                    </div>
                  </div>
                  <span className="text-slate-400 text-sm">
                    {expandedId === wh.id ? "▲" : "▼"}
                  </span>
                </div>

                {/* Expanded details */}
                {expandedId === wh.id && (
                  <div className="px-4 pb-4 space-y-4 border-t border-white/10 pt-4">
                    {/* Webhook URL */}
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">
                        Webhook URL
                      </label>
                      <div className="flex gap-2">
                        <code className="flex-1 px-3 py-2 rounded-lg bg-black/30 text-indigo-300 text-xs break-all">
                          {API_URL}/api/webhook/{wh.id}
                        </code>
                        <button
                          onClick={() =>
                            copyToClipboard(
                              `${API_URL}/api/webhook/${wh.id}`,
                              "Webhook URL",
                            )
                          }
                          className="px-3 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-xs transition"
                        >
                          Copy
                        </button>
                      </div>
                    </div>

                    {/* Secret */}
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">
                        Secret Key
                      </label>
                      <div className="flex gap-2">
                        <code className="flex-1 px-3 py-2 rounded-lg bg-black/30 text-amber-300 text-xs break-all font-mono">
                          {wh.secret}
                        </code>
                        <button
                          onClick={() => copyToClipboard(wh.secret, "Secret")}
                          className="px-3 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-xs transition"
                        >
                          Copy
                        </button>
                      </div>
                    </div>

                    {/* Field mapping */}
                    {wh.field_mapping &&
                      Object.keys(wh.field_mapping).length > 0 && (
                        <div>
                          <label className="block text-xs text-slate-400 mb-1">
                            Field Mapping
                          </label>
                          <div className="grid grid-cols-2 gap-1 text-xs">
                            {Object.entries(wh.field_mapping).map(([k, v]) => (
                              <div key={k} className="flex gap-2">
                                <span className="text-slate-500">{k}:</span>
                                <span className="text-slate-300">"{v}"</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                    {/* Actions */}
                    <div className="flex flex-wrap gap-2 pt-2">
                      <button
                        onClick={() => setScriptWebhook(wh)}
                        className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-xs font-medium transition"
                      >
                        📋 Get Apps Script
                      </button>
                      <button
                        onClick={() => handleToggleActive(wh)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                          wh.is_active
                            ? "bg-amber-600/30 hover:bg-amber-600/50 text-amber-300"
                            : "bg-green-600/30 hover:bg-green-600/50 text-green-300"
                        }`}
                      >
                        {wh.is_active ? "⏸ Pause" : "▶ Activate"}
                      </button>
                      <button
                        onClick={() => handleRegenerateSecret(wh.id)}
                        className="px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-xs transition"
                      >
                        🔄 Regenerate Secret
                      </button>
                      <button
                        onClick={() => handleDelete(wh.id)}
                        className="px-3 py-1.5 bg-red-600/30 hover:bg-red-600/50 text-red-300 rounded-lg text-xs font-medium transition"
                      >
                        🗑 Delete
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Apps Script Modal ────────────────────────────── */}
      {scriptWebhook && (
        <div className="fixed inset-0 z-100 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-white/10 rounded-2xl max-w-3xl w-full max-h-[80vh] flex flex-col shadow-2xl">
            <div className="flex items-center justify-between p-4 border-b border-white/10">
              <h2 className="font-semibold">
                Google Apps Script — {scriptWebhook.name}
              </h2>
              <button
                onClick={() => setScriptWebhook(null)}
                className="text-slate-400 hover:text-white text-xl"
              >
                ✕
              </button>
            </div>

            <div className="p-4 space-y-3 text-sm text-slate-300">
              <p>Follow these steps:</p>
              <ol className="list-decimal list-inside space-y-1 text-xs">
                <li>
                  Open your Google Form → click the <strong>⋮</strong> menu →{" "}
                  <strong>Script editor</strong>
                </li>
                <li>Delete any existing code and paste the script below</li>
                <li>
                  Click <strong>Run</strong> → select{" "}
                  <code className="bg-white/10 px-1 rounded">
                    installTrigger
                  </code>{" "}
                  → Authorize when prompted
                </li>
                <li>
                  That's it! Every new submission will auto-generate an ID card.
                </li>
              </ol>
            </div>

            <div className="flex-1 overflow-auto mx-4 mb-4 rounded-lg bg-black/40 border border-white/10">
              <pre className="p-4 text-xs text-green-300 font-mono whitespace-pre overflow-x-auto">
                {getAppsScript(scriptWebhook)}
              </pre>
            </div>

            <div className="flex gap-2 p-4 border-t border-white/10">
              <button
                onClick={() =>
                  copyToClipboard(getAppsScript(scriptWebhook), "Apps Script")
                }
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-sm font-medium transition"
              >
                📋 Copy Script
              </button>
              <button
                onClick={() => setScriptWebhook(null)}
                className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-sm transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
