import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";

const BACKEND = import.meta.env.VITE_BACKEND_URL || "http://localhost:5000";

/**
 * ProjectCreate — Create a new project with a dynamic form builder
 * -----------------------------------------------------------------
 * URL: /org/:slug/project/new
 *
 * Features:
 *  - Basic project info (name, type, template, limits)
 *  - Dynamic form field builder with 11 field types
 *  - Field configuration (label, type, required, placeholder, description,
 *    validation_rules, options, default_value)
 *  - Live form preview panel
 *  - Saves form fields to form_fields table (versioned)
 */
export default function ProjectCreate() {
  const { slug } = useParams();
  const navigate = useNavigate();

  const [org, setOrg] = useState(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [createdProject, setCreatedProject] = useState(null);
  const [showPreview, setShowPreview] = useState(false);

  // Project form state
  const [name, setName] = useState("");
  const [type, setType] = useState("service");
  const [template, setTemplate] = useState("custom");
  const [memberLimit, setMemberLimit] = useState("");
  const [expiryDays, setExpiryDays] = useState("365");

  // Dynamic form builder state
  const [formFields, setFormFields] = useState([]);
  const [expandedFieldId, setExpandedFieldId] = useState(null);

  // Supported field types
  const fieldTypeOptions = [
    { value: "text", label: "Text", icon: "Aa" },
    { value: "email", label: "Email", icon: "\u2709" },
    { value: "phone", label: "Phone", icon: "\uD83D\uDCDE" },
    { value: "number", label: "Number", icon: "#" },
    { value: "textarea", label: "Long Text", icon: "\u00B6" },
    { value: "dropdown", label: "Dropdown", icon: "\u25BE" },
    { value: "radio", label: "Radio", icon: "\u25C9" },
    { value: "checkbox", label: "Checkbox", icon: "\u2611" },
    { value: "date", label: "Date", icon: "\uD83D\uDCC5" },
    { value: "file_upload", label: "File Upload", icon: "\uD83D\uDCCE" },
    { value: "photo_upload", label: "Photo Upload", icon: "\uD83D\uDCF7" },
  ];

  // Load org
  useEffect(() => { loadOrg(); }, [slug]);

  const loadOrg = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return navigate("/login");
      const res = await fetch(`${BACKEND}/api/org/slug/${slug}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error || "Organization not found."); setLoading(false); return; }
      setOrg(json.org);
    } catch { setError("Failed to load organization."); } finally { setLoading(false); }
  };

  // Field management
  const addField = () => {
    const newField = {
      id: Date.now(), label: "", type: "text", required: false,
      placeholder: "", description: "", options: [], default_value: "",
      validation_rules: {}, optionsText: "",
    };
    setFormFields((prev) => [...prev, newField]);
    setExpandedFieldId(newField.id);
  };

  const updateField = (id, key, value) => {
    setFormFields((prev) => prev.map((f) => (f.id === id ? { ...f, [key]: value } : f)));
  };

  const removeField = (id) => {
    setFormFields((prev) => prev.filter((f) => f.id !== id));
    if (expandedFieldId === id) setExpandedFieldId(null);
  };

  const moveField = (index, direction) => {
    const nf = [...formFields];
    const ni = index + direction;
    if (ni < 0 || ni >= nf.length) return;
    [nf[index], nf[ni]] = [nf[ni], nf[index]];
    setFormFields(nf);
  };

  const duplicateField = (index) => {
    const copy = { ...formFields[index], id: Date.now(), label: `${formFields[index].label} (copy)` };
    const nf = [...formFields];
    nf.splice(index + 1, 0, copy);
    setFormFields(nf);
  };

  // Create project
  const handleCreate = async (e) => {
    e.preventDefault();
    setCreating(true);
    setError("");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return navigate("/login");

      const formSchema = formFields.filter((f) => f.label.trim()).map((f) => {
        const field = {
          label: f.label.trim(),
          field_key: f.label.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, ""),
          type: f.type, required: f.required,
        };
        if (f.placeholder) field.placeholder = f.placeholder;
        if (f.description) field.description = f.description;
        if (f.default_value) field.default_value = f.default_value;
        if (f.validation_rules && Object.keys(f.validation_rules).length > 0) {
          field.validation_rules = f.validation_rules;
        }
        if (["dropdown", "radio", "checkbox"].includes(f.type)) {
          field.options = (f.optionsText || "").split(",").map((o) => o.trim()).filter(Boolean);
        }
        return field;
      });

      const body = {
        orgId: org.id, type, name: name.trim(), template,
        memberLimit: memberLimit ? parseInt(memberLimit, 10) : null,
        expiryDays: parseInt(expiryDays, 10) || 365, formSchema, cardConfig: {},
      };

      const res = await fetch(`${BACKEND}/api/projects`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error || "Failed to create project."); setCreating(false); return; }
      setCreatedProject(json.project);
    } catch { setError("Network error. Please try again."); } finally { setCreating(false); }
  };

  // Loading
  if (loading) {
    return (
      <div className="min-h-screen bg-linear-to-br from-slate-950 via-slate-900 to-indigo-950 flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-2 border-indigo-400 border-t-transparent rounded-full" />
      </div>
    );
  }

  // Success
  if (createdProject) {
    const formLink = `${window.location.origin}/register/${createdProject.id}`;
    return (
      <div className="min-h-screen bg-linear-to-br from-slate-950 via-slate-900 to-indigo-950 flex items-center justify-center p-4">
        <div className="w-full max-w-lg text-center">
          <div className="w-16 h-16 rounded-full bg-emerald-500/20 border-2 border-emerald-500 flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Project Created!</h1>
          <p className="text-slate-400 mb-4">
            <span className="text-white font-medium">{createdProject.name}</span> is ready.
            {createdProject.type === "service" && " Share the registration link below."}
          </p>
          {createdProject.type === "service" && (
            <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-4 mb-4">
              <p className="text-xs text-slate-400 mb-2">Public Registration Link</p>
              <code className="block text-sm text-indigo-300 break-all mb-3">{formLink}</code>
              <button onClick={() => navigator.clipboard.writeText(formLink)}
                className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-sm font-medium transition-all cursor-pointer">
                Copy
              </button>
            </div>
          )}
          <div className="flex gap-3 justify-center">
            <button onClick={() => navigate(createdProject.type === "bulk" ? `/org/${slug}/bulk/${createdProject.id}` : `/org/${slug}/project/${createdProject.id}`)}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-sm font-medium transition-all cursor-pointer">
              Go to {createdProject.type === "bulk" ? "Bulk" : "Project"} Dashboard
            </button>
            <button onClick={() => navigate(`/org/${slug}/dashboard`)}
              className="px-5 py-2.5 bg-white/10 hover:bg-white/20 rounded-lg text-sm font-medium transition-all cursor-pointer">
              Back to Org
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Preview field renderer
  const renderPreviewField = (field, idx) => {
    const ic = "w-full px-3 py-2 bg-slate-900/60 border border-slate-600/50 rounded-lg text-white text-sm placeholder-slate-500";
    switch (field.type) {
      case "textarea": return <textarea className={ic} placeholder={field.placeholder || ""} rows={3} disabled />;
      case "dropdown": return (
        <select className={ic} disabled>
          <option value="">{field.placeholder || "Select..."}</option>
          {(field.optionsText || "").split(",").filter(o => o.trim()).map((o, i) => <option key={i}>{o.trim()}</option>)}
        </select>
      );
      case "radio": return (
        <div className="space-y-1">
          {(field.optionsText || "Option A, Option B").split(",").filter(o => o.trim()).map((o, i) => (
            <label key={i} className="flex items-center gap-2 text-sm text-slate-300">
              <input type="radio" name={`preview_${idx}`} disabled className="accent-indigo-500" />{o.trim()}
            </label>
          ))}
        </div>
      );
      case "checkbox": return (
        <div className="space-y-1">
          {(field.optionsText || "Option A, Option B").split(",").filter(o => o.trim()).map((o, i) => (
            <label key={i} className="flex items-center gap-2 text-sm text-slate-300">
              <input type="checkbox" disabled className="accent-indigo-500" />{o.trim()}
            </label>
          ))}
        </div>
      );
      case "photo_upload": return (
        <div className="border-2 border-dashed border-slate-600/50 rounded-lg p-4 text-center">
          <div className="text-2xl mb-1">{"\uD83D\uDCF7"}</div>
          <p className="text-xs text-slate-500">Click or drag to upload photo</p>
        </div>
      );
      case "file_upload": return (
        <div className="border-2 border-dashed border-slate-600/50 rounded-lg p-4 text-center">
          <div className="text-2xl mb-1">{"\uD83D\uDCCE"}</div>
          <p className="text-xs text-slate-500">Click or drag to upload file</p>
        </div>
      );
      case "date": return <input type="date" className={ic} disabled />;
      case "number": return <input type="number" className={ic} placeholder={field.placeholder || "0"} disabled />;
      case "email": return <input type="email" className={ic} placeholder={field.placeholder || "email@example.com"} disabled />;
      case "phone": return <input type="tel" className={ic} placeholder={field.placeholder || "+1 (555) 000-0000"} disabled />;
      default: return <input type="text" className={ic} placeholder={field.placeholder || ""} disabled />;
    }
  };

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-950 via-slate-900 to-indigo-950 text-white">
      {/* Header */}
      <div className="sticky top-0 z-50 backdrop-blur bg-slate-950/80 border-b border-white/10">
        <div className="max-w-7xl mx-auto flex items-center justify-between px-6 py-4">
          <button onClick={() => navigate(`/org/${slug}/dashboard`)}
            className="text-sm text-indigo-300 hover:text-white transition cursor-pointer">
            {"\u2190"} {org?.name || slug}
          </button>
          <h1 className="text-lg font-bold bg-linear-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">Create Project</h1>
          <button onClick={() => setShowPreview(!showPreview)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${showPreview ? "bg-indigo-600 text-white" : "bg-white/10 text-slate-400 hover:text-white"}`}>
            {showPreview ? "Hide Preview" : "\uD83D\uDC41 Preview"}
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className={`grid gap-6 ${showPreview ? "grid-cols-1 lg:grid-cols-2" : "grid-cols-1 max-w-4xl mx-auto"}`}>
          {/* LEFT: Form Builder */}
          <form onSubmit={handleCreate} className="space-y-8">
            {/* Basic Info */}
            <section className="bg-slate-800/60 border border-slate-700/50 rounded-2xl p-6 space-y-4">
              <h2 className="text-lg font-semibold">Basic Info</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-slate-300 mb-1">Project Name *</label>
                  <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Student ID 2026" required
                    className="w-full px-4 py-2.5 bg-slate-900/60 border border-slate-600/50 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all" />
                </div>
                <div>
                  <label className="block text-sm text-slate-300 mb-1">Type *</label>
                  <select value={type} onChange={(e) => setType(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-900/60 border border-slate-600/50 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all">
                    <option value="service">Service (registration form)</option>
                    <option value="bulk">Bulk (spreadsheet / Google Sheets import)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-slate-300 mb-1">Card Template</label>
                  <select value={template} onChange={(e) => setTemplate(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-900/60 border border-slate-600/50 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all">
                    <option value="custom">Geometric Gradient</option>
                    <option value="corporate">Corporate</option>
                    <option value="student">Student</option>
                    <option value="event">Event</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-slate-300 mb-1">Member Limit <span className="text-slate-500 text-xs">(blank = unlimited)</span></label>
                  <input type="number" value={memberLimit} onChange={(e) => setMemberLimit(e.target.value)} placeholder="e.g. 500" min="1"
                    className="w-full px-4 py-2.5 bg-slate-900/60 border border-slate-600/50 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all" />
                </div>
                <div>
                  <label className="block text-sm text-slate-300 mb-1">Card Expiry (days)</label>
                  <input type="number" value={expiryDays} onChange={(e) => setExpiryDays(e.target.value)} min="1"
                    className="w-full px-4 py-2.5 bg-slate-900/60 border border-slate-600/50 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all" />
                </div>
              </div>
            </section>

            {/* Form Schema Builder */}
            <section className="bg-slate-800/60 border border-slate-700/50 rounded-2xl p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold">Custom Form Fields</h2>
                  <p className="text-xs text-slate-500 mt-0.5">Name, Email, and Photo are built-in. Add custom fields below.</p>
                </div>
                <button type="button" onClick={addField}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-sm font-medium transition-all cursor-pointer">
                  + Add Field
                </button>
              </div>

              {/* System fields indicator */}
              <div className="bg-slate-900/30 border border-slate-700/20 rounded-lg p-3">
                <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">System Fields (always included)</p>
                <div className="flex flex-wrap gap-2">
                  {[{ label: "Full Name", type: "text", icon: "Aa" }, { label: "Email", type: "email", icon: "\u2709" }, { label: "Photo", type: "photo_upload", icon: "\uD83D\uDCF7" }].map((f) => (
                    <span key={f.label} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-800/80 border border-slate-600/30 rounded-lg text-xs text-slate-300">
                      <span>{f.icon}</span><span>{f.label}</span><span className="text-indigo-400">({f.type})</span>
                    </span>
                  ))}
                </div>
              </div>

              {formFields.length === 0 && (
                <div className="text-center py-8 text-slate-500">
                  <p className="text-sm">No custom fields yet.</p>
                  <p className="text-xs mt-1">Click &quot;+ Add Field&quot; to add custom questions to your form.</p>
                </div>
              )}

              <div className="space-y-3">
                {formFields.map((field, index) => (
                  <div key={field.id}
                    className={`bg-slate-900/40 border rounded-xl overflow-hidden transition ${expandedFieldId === field.id ? "border-indigo-500/50" : "border-slate-700/30"}`}>
                    {/* Field header */}
                    <div className="flex items-center justify-between p-4 cursor-pointer"
                      onClick={() => setExpandedFieldId(expandedFieldId === field.id ? null : field.id)}>
                      <div className="flex items-center gap-3">
                        <span className="text-lg">{fieldTypeOptions.find((t) => t.value === field.type)?.icon || "Aa"}</span>
                        <div>
                          <span className="text-sm font-medium text-white">
                            {field.label || <span className="text-slate-500 italic">Untitled field</span>}
                          </span>
                          <span className="text-[10px] text-slate-500 ml-2">
                            {fieldTypeOptions.find((t) => t.value === field.type)?.label || "Text"}
                            {field.required && <span className="text-red-400 ml-1">*required</span>}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <button type="button" onClick={(e) => { e.stopPropagation(); moveField(index, -1); }} disabled={index === 0} className="p-1 text-slate-500 hover:text-white disabled:opacity-25 cursor-pointer">{"\u2191"}</button>
                        <button type="button" onClick={(e) => { e.stopPropagation(); moveField(index, 1); }} disabled={index === formFields.length - 1} className="p-1 text-slate-500 hover:text-white disabled:opacity-25 cursor-pointer">{"\u2193"}</button>
                        <button type="button" onClick={(e) => { e.stopPropagation(); duplicateField(index); }} className="p-1 text-slate-500 hover:text-indigo-400 cursor-pointer" title="Duplicate">{"\u2B25"}</button>
                        <button type="button" onClick={(e) => { e.stopPropagation(); removeField(field.id); }} className="p-1 text-red-400 hover:text-red-300 cursor-pointer">{"\u2715"}</button>
                        <span className="text-slate-500 ml-1">{expandedFieldId === field.id ? "\u25B2" : "\u25BC"}</span>
                      </div>
                    </div>

                    {/* Expanded config */}
                    {expandedFieldId === field.id && (
                      <div className="px-4 pb-4 space-y-3 border-t border-slate-700/30 pt-3">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          <div>
                            <label className="block text-xs text-slate-400 mb-1">Label *</label>
                            <input type="text" value={field.label} onChange={(e) => updateField(field.id, "label", e.target.value)} placeholder="e.g. Department"
                              className="w-full px-3 py-2 bg-slate-800/60 border border-slate-600/40 rounded-lg text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all" />
                          </div>
                          <div>
                            <label className="block text-xs text-slate-400 mb-1">Type</label>
                            <select value={field.type} onChange={(e) => updateField(field.id, "type", e.target.value)}
                              className="w-full px-3 py-2 bg-slate-800/60 border border-slate-600/40 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all">
                              {fieldTypeOptions.map((opt) => <option key={opt.value} value={opt.value}>{opt.icon} {opt.label}</option>)}
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs text-slate-400 mb-1">Placeholder</label>
                            <input type="text" value={field.placeholder} onChange={(e) => updateField(field.id, "placeholder", e.target.value)} placeholder="Hint text..."
                              className="w-full px-3 py-2 bg-slate-800/60 border border-slate-600/40 rounded-lg text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all" />
                          </div>
                        </div>

                        <div>
                          <label className="block text-xs text-slate-400 mb-1">Description <span className="text-slate-600">(help text below field)</span></label>
                          <input type="text" value={field.description} onChange={(e) => updateField(field.id, "description", e.target.value)} placeholder="e.g. Enter your official department name"
                            className="w-full px-3 py-2 bg-slate-800/60 border border-slate-600/40 rounded-lg text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all" />
                        </div>

                        {["dropdown", "radio", "checkbox"].includes(field.type) && (
                          <div>
                            <label className="block text-xs text-slate-400 mb-1">Options (comma-separated)</label>
                            <input type="text" value={field.optionsText} onChange={(e) => updateField(field.id, "optionsText", e.target.value)} placeholder="Option A, Option B, Option C"
                              className="w-full px-3 py-2 bg-slate-800/60 border border-slate-600/40 rounded-lg text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all" />
                          </div>
                        )}

                        {!["file_upload", "photo_upload"].includes(field.type) && (
                          <div>
                            <label className="block text-xs text-slate-400 mb-1">Default Value</label>
                            <input type="text" value={field.default_value} onChange={(e) => updateField(field.id, "default_value", e.target.value)} placeholder="Pre-filled value..."
                              className="w-full px-3 py-2 bg-slate-800/60 border border-slate-600/40 rounded-lg text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all" />
                          </div>
                        )}

                        {["text", "email", "phone", "number", "textarea"].includes(field.type) && (
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-xs text-slate-400 mb-1">Min Length</label>
                              <input type="number" value={field.validation_rules?.minLength || ""} min="0"
                                onChange={(e) => updateField(field.id, "validation_rules", { ...field.validation_rules, minLength: e.target.value ? parseInt(e.target.value) : undefined })}
                                className="w-full px-3 py-2 bg-slate-800/60 border border-slate-600/40 rounded-lg text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all" />
                            </div>
                            <div>
                              <label className="block text-xs text-slate-400 mb-1">Max Length</label>
                              <input type="number" value={field.validation_rules?.maxLength || ""} min="1"
                                onChange={(e) => updateField(field.id, "validation_rules", { ...field.validation_rules, maxLength: e.target.value ? parseInt(e.target.value) : undefined })}
                                className="w-full px-3 py-2 bg-slate-800/60 border border-slate-600/40 rounded-lg text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all" />
                            </div>
                          </div>
                        )}

                        <label className="flex items-center gap-2 cursor-pointer">
                          <input type="checkbox" checked={field.required} onChange={(e) => updateField(field.id, "required", e.target.checked)} className="accent-indigo-500" />
                          <span className="text-sm text-slate-300">Required</span>
                        </label>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>

            {error && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
                <p className="text-red-400 text-sm">{error}</p>
              </div>
            )}

            <button type="submit" disabled={creating || !name.trim()}
              className="w-full py-3 bg-linear-to-r from-indigo-600 to-purple-600 text-white font-semibold rounded-xl hover:from-indigo-500 hover:to-purple-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer text-lg">
              {creating ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />Creating...
                </span>
              ) : "Create Project & Get Form Link"}
            </button>
          </form>

          {/* RIGHT: Live Preview Panel */}
          {showPreview && (
            <div className="sticky top-24 h-fit">
              <div className="bg-slate-800/60 border border-slate-700/50 rounded-2xl overflow-hidden">
                <div className="bg-slate-700/30 px-4 py-3 border-b border-slate-700/50">
                  <h3 className="text-sm font-semibold text-white">Form Preview</h3>
                  <p className="text-[10px] text-slate-500">How the registration form will look to users</p>
                </div>
                <div className="p-4 space-y-4 max-h-[calc(100vh-12rem)] overflow-y-auto">
                  <div className="text-center mb-4">
                    {org?.logo_url && <img src={org.logo_url} alt="" className="w-10 h-10 rounded-lg object-cover mx-auto mb-2 ring-1 ring-slate-600" />}
                    <p className="text-xs text-slate-400">{org?.name}</p>
                    <h4 className="text-lg font-bold text-white">{name || "Project Name"}</h4>
                  </div>

                  {/* System fields */}
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">Full Name <span className="text-red-400">*</span></label>
                    <input type="text" placeholder="John Doe" disabled className="w-full px-3 py-2 bg-slate-900/60 border border-slate-600/50 rounded-lg text-white text-sm placeholder-slate-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">Email <span className="text-red-400">*</span></label>
                    <input type="email" placeholder="john@example.com" disabled className="w-full px-3 py-2 bg-slate-900/60 border border-slate-600/50 rounded-lg text-white text-sm placeholder-slate-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">Photo</label>
                    <div className="border-2 border-dashed border-slate-600/50 rounded-lg p-3 text-center">
                      <span className="text-lg">{"\uD83D\uDCF7"}</span>
                      <p className="text-[10px] text-slate-500 mt-0.5">Upload photo</p>
                    </div>
                  </div>

                  {/* Custom fields preview */}
                  {formFields.filter((f) => f.label.trim()).length > 0 && (
                    <div className="pt-2 border-t border-slate-700/40">
                      <p className="text-[10px] text-slate-500 mb-2 uppercase tracking-wider">Custom Fields</p>
                      <div className="space-y-3">
                        {formFields.filter((f) => f.label.trim()).map((field, idx) => (
                          <div key={field.id}>
                            <label className="block text-xs font-medium text-slate-300 mb-1">
                              {field.label}{field.required && <span className="text-red-400 ml-1">*</span>}
                            </label>
                            {field.description && <p className="text-[10px] text-slate-500 mb-1">{field.description}</p>}
                            {renderPreviewField(field, idx)}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <button disabled className="w-full py-2.5 bg-linear-to-r from-indigo-600 to-purple-600 text-white font-semibold rounded-lg text-sm opacity-80">
                    Submit Registration
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
