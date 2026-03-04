import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";

const BACKEND = import.meta.env.VITE_BACKEND_URL || "http://localhost:5000";

/**
 * ProjectCreate — Create a new project with a custom registration form
 * ────────────────────────────────────────────────────────────────────
 * URL: /org/:slug/project/new
 *
 * Admins can:
 *  1. Name the project and pick a type (service / bulk).
 *  2. Choose a card template and configure card options.
 *  3. Build custom form fields (form_schema) using a visual builder.
 *  4. Set member limits and expiry days.
 *  5. Preview shareable registration link after creation.
 */
export default function ProjectCreate() {
  const { slug } = useParams();
  const navigate = useNavigate();

  const [org, setOrg] = useState(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [createdProject, setCreatedProject] = useState(null);

  // Project form state
  const [name, setName] = useState("");
  const [type, setType] = useState("service");
  const [template, setTemplate] = useState("custom");
  const [memberLimit, setMemberLimit] = useState("");
  const [expiryDays, setExpiryDays] = useState("365");

  // Dynamic form schema builder
  const [formFields, setFormFields] = useState([]);

  // ── Load org ───────────────────────────────────────────────
  useEffect(() => {
    loadOrg();
  }, [slug]);

  const loadOrg = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return navigate("/login");

      const res = await fetch(`${BACKEND}/api/org/slug/${slug}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Organization not found.");
        setLoading(false);
        return;
      }
      setOrg(json.org);
    } catch {
      setError("Failed to load organization.");
    } finally {
      setLoading(false);
    }
  };

  // ── Form field management ──────────────────────────────────
  const addField = () => {
    setFormFields((prev) => [
      ...prev,
      {
        id: Date.now(),
        label: "",
        name: "",
        type: "text",
        required: false,
        placeholder: "",
        options: "", // comma-separated for select
      },
    ]);
  };

  const updateField = (id, key, value) => {
    setFormFields((prev) =>
      prev.map((f) => (f.id === id ? { ...f, [key]: value } : f)),
    );
  };

  const removeField = (id) => {
    setFormFields((prev) => prev.filter((f) => f.id !== id));
  };

  const moveField = (index, direction) => {
    const newFields = [...formFields];
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= newFields.length) return;
    [newFields[index], newFields[newIndex]] = [newFields[newIndex], newFields[index]];
    setFormFields(newFields);
  };

  // ── Create project ────────────────────────────────────────
  const handleCreate = async (e) => {
    e.preventDefault();
    setCreating(true);
    setError("");

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return navigate("/login");

      // Build form_schema from builder state
      const formSchema = formFields
        .filter((f) => f.label.trim())
        .map((f) => {
          const field = {
            label: f.label.trim(),
            name: f.name.trim() || f.label.trim().toLowerCase().replace(/\s+/g, "_"),
            type: f.type,
            required: f.required,
          };
          if (f.placeholder) field.placeholder = f.placeholder;
          if (f.type === "select" && f.options) {
            field.options = f.options
              .split(",")
              .map((o) => o.trim())
              .filter(Boolean);
          }
          return field;
        });

      const body = {
        orgId: org.id,
        type,
        name: name.trim(),
        template,
        memberLimit: memberLimit ? parseInt(memberLimit, 10) : null,
        expiryDays: parseInt(expiryDays, 10) || 365,
        formSchema,
        cardConfig: {},
      };

      const res = await fetch(`${BACKEND}/api/projects`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(body),
      });

      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Failed to create project.");
        setCreating(false);
        return;
      }

      setCreatedProject(json.project);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setCreating(false);
    }
  };

  // ── Loading ────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-2 border-indigo-400 border-t-transparent rounded-full" />
      </div>
    );
  }

  // ── Success — show shareable link ──────────────────────────
  if (createdProject) {
    const formLink = `${window.location.origin}/register/${createdProject.id}`;
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 flex items-center justify-center p-4">
        <div className="w-full max-w-lg text-center">
          <div className="w-16 h-16 rounded-full bg-emerald-500/20 border-2 border-emerald-500 flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Project Created!</h1>
          <p className="text-slate-400 mb-6">{createdProject.name}</p>

          {/* Shareable link */}
          <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-4 mb-4">
            <p className="text-xs text-slate-400 mb-2">
              Share this registration link with your members:
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 px-3 py-2.5 rounded-lg bg-slate-900/80 text-indigo-300 text-sm break-all text-left">
                {formLink}
              </code>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(formLink);
                }}
                className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-sm font-medium transition-all cursor-pointer shrink-0"
              >
                Copy
              </button>
            </div>
          </div>

          <div className="flex gap-3 justify-center">
            <button
              onClick={() => navigate(`/org/${slug}/project/${createdProject.id}`)}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-sm font-medium transition-all cursor-pointer"
            >
              Go to Project Dashboard
            </button>
            <button
              onClick={() => navigate(`/org/${slug}/dashboard`)}
              className="px-5 py-2.5 bg-white/10 hover:bg-white/20 rounded-lg text-sm font-medium transition-all cursor-pointer"
            >
              Back to Org
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── The form ──────────────────────────────────────────────
  const fieldTypeOptions = [
    { value: "text", label: "Text" },
    { value: "email", label: "Email" },
    { value: "number", label: "Number" },
    { value: "tel", label: "Phone" },
    { value: "url", label: "URL" },
    { value: "date", label: "Date" },
    { value: "select", label: "Dropdown" },
    { value: "textarea", label: "Long Text" },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 text-white">
      {/* Header */}
      <div className="sticky top-0 z-50 backdrop-blur bg-slate-950/80 border-b border-white/10">
        <div className="max-w-4xl mx-auto flex items-center justify-between px-6 py-4">
          <button
            onClick={() => navigate(`/org/${slug}/dashboard`)}
            className="text-sm text-indigo-300 hover:text-white transition cursor-pointer"
          >
            ← {org?.name || slug}
          </button>
          <h1 className="text-lg font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
            Create Project
          </h1>
          <div className="w-20" />
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-8">
        <form onSubmit={handleCreate} className="space-y-8">
          {/* ── Basic Info ──────────────────────────────── */}
          <section className="bg-slate-800/60 border border-slate-700/50 rounded-2xl p-6 space-y-4">
            <h2 className="text-lg font-semibold">Basic Info</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-slate-300 mb-1">Project Name *</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Student ID 2026"
                  required
                  className="w-full px-4 py-2.5 bg-slate-900/60 border border-slate-600/50 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-300 mb-1">Type *</label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-900/60 border border-slate-600/50 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
                >
                  <option value="service">Service (registration form)</option>
                  <option value="bulk">Bulk (CSV/spreadsheet import)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-slate-300 mb-1">Card Template</label>
                <select
                  value={template}
                  onChange={(e) => setTemplate(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-900/60 border border-slate-600/50 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
                >
                  <option value="custom">Geometric Gradient</option>
                  <option value="corporate">Corporate</option>
                  <option value="student">Student</option>
                  <option value="event">Event</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-slate-300 mb-1">
                  Member Limit <span className="text-slate-500 text-xs">(blank = unlimited)</span>
                </label>
                <input
                  type="number"
                  value={memberLimit}
                  onChange={(e) => setMemberLimit(e.target.value)}
                  placeholder="e.g. 500"
                  min="1"
                  className="w-full px-4 py-2.5 bg-slate-900/60 border border-slate-600/50 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-300 mb-1">Card Expiry (days)</label>
                <input
                  type="number"
                  value={expiryDays}
                  onChange={(e) => setExpiryDays(e.target.value)}
                  min="1"
                  className="w-full px-4 py-2.5 bg-slate-900/60 border border-slate-600/50 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
                />
              </div>
            </div>
          </section>

          {/* ── Form Schema Builder ────────────────────── */}
          <section className="bg-slate-800/60 border border-slate-700/50 rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">Custom Form Fields</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Name, Email, and Photo are built-in. Add extra fields here.
                </p>
              </div>
              <button
                type="button"
                onClick={addField}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-sm font-medium transition-all cursor-pointer"
              >
                + Add Field
              </button>
            </div>

            {formFields.length === 0 && (
              <div className="text-center py-8 text-slate-500">
                <p className="text-sm">No custom fields yet.</p>
                <p className="text-xs mt-1">
                  Click &quot;+ Add Field&quot; to add custom questions to your form.
                </p>
              </div>
            )}

            <div className="space-y-3">
              {formFields.map((field, index) => (
                <div
                  key={field.id}
                  className="bg-slate-900/40 border border-slate-700/30 rounded-xl p-4 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-500 font-mono">
                      Field #{index + 1}
                    </span>
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() => moveField(index, -1)}
                        disabled={index === 0}
                        className="p-1 text-slate-500 hover:text-white disabled:opacity-25 cursor-pointer"
                        title="Move up"
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        onClick={() => moveField(index, 1)}
                        disabled={index === formFields.length - 1}
                        className="p-1 text-slate-500 hover:text-white disabled:opacity-25 cursor-pointer"
                        title="Move down"
                      >
                        ↓
                      </button>
                      <button
                        type="button"
                        onClick={() => removeField(field.id)}
                        className="p-1 text-red-400 hover:text-red-300 cursor-pointer"
                        title="Remove"
                      >
                        ✕
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Label *</label>
                      <input
                        type="text"
                        value={field.label}
                        onChange={(e) => updateField(field.id, "label", e.target.value)}
                        placeholder="e.g. Department"
                        className="w-full px-3 py-2 bg-slate-800/60 border border-slate-600/40 rounded-lg text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Type</label>
                      <select
                        value={field.type}
                        onChange={(e) => updateField(field.id, "type", e.target.value)}
                        className="w-full px-3 py-2 bg-slate-800/60 border border-slate-600/40 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
                      >
                        {fieldTypeOptions.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Placeholder</label>
                      <input
                        type="text"
                        value={field.placeholder}
                        onChange={(e) => updateField(field.id, "placeholder", e.target.value)}
                        placeholder="Hint text..."
                        className="w-full px-3 py-2 bg-slate-800/60 border border-slate-600/40 rounded-lg text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
                      />
                    </div>
                  </div>

                  {/* Dropdown options */}
                  {field.type === "select" && (
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">
                        Options (comma-separated)
                      </label>
                      <input
                        type="text"
                        value={field.options}
                        onChange={(e) => updateField(field.id, "options", e.target.value)}
                        placeholder="Option A, Option B, Option C"
                        className="w-full px-3 py-2 bg-slate-800/60 border border-slate-600/40 rounded-lg text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
                      />
                    </div>
                  )}

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={field.required}
                      onChange={(e) => updateField(field.id, "required", e.target.checked)}
                      className="accent-indigo-500"
                    />
                    <span className="text-sm text-slate-300">Required</span>
                  </label>
                </div>
              ))}
            </div>
          </section>

          {/* ── Error ──────────────────────────────────── */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          {/* ── Submit ─────────────────────────────────── */}
          <button
            type="submit"
            disabled={creating || !name.trim()}
            className="w-full py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold rounded-xl hover:from-indigo-500 hover:to-purple-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer text-lg"
          >
            {creating ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Creating...
              </span>
            ) : (
              "Create Project & Get Form Link"
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
