import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";

const BACKEND = import.meta.env.VITE_BACKEND_URL || "http://localhost:5000";

/**
 * RegistrationForm — Public member registration page
 * ───────────────────────────────────────────────────
 * URL: /register/:projectId
 *
 * 1. Fetches project info + dynamic form_schema from the public endpoint.
 * 2. Renders a branded form (org logo, project name).
 * 3. Supports built-in fields (name, email, photo) + custom JSONB fields.
 * 4. Submits to POST /api/members/register/:projectId (no auth needed).
 * 5. Shows success / full / closed state.
 */
export default function RegistrationForm() {
  const { projectId } = useParams();

  const [project, setProject] = useState(null);
  const [org, setOrg] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");
  const [customFields, setCustomFields] = useState({});

  // ── Load project info ─────────────────────────────────────
  useEffect(() => {
    loadProject();
  }, [projectId]);

  const loadProject = async () => {
    try {
      const res = await fetch(`${BACKEND}/api/projects/${projectId}/public`);
      const json = await res.json();

      if (!res.ok) {
        setError(json.error || "This form is no longer available.");
        setLoading(false);
        return;
      }

      setProject(json.project);
      setOrg(json.organization);

      // Initialize custom fields with empty strings
      if (json.project.form_schema?.length > 0) {
        const initial = {};
        json.project.form_schema.forEach((field) => {
          initial[field.name || field.label] = "";
        });
        setCustomFields(initial);
      }
    } catch {
      setError("Failed to load registration form. Please try again later.");
    } finally {
      setLoading(false);
    }
  };

  // ── Submit handler ────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");

    try {
      const body = {
        name: name.trim(),
        email: email.trim() || undefined,
        photoUrl: photoUrl.trim() || undefined,
        customFields:
          Object.keys(customFields).length > 0 ? customFields : undefined,
      };

      const res = await fetch(
        `${BACKEND}/api/members/register/${projectId}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );

      const json = await res.json();

      if (!res.ok) {
        setError(json.error || "Registration failed. Please try again.");
        setSubmitting(false);
        return;
      }

      setSubmitted(true);
    } catch {
      setError("Network error. Please check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  };

  // ── Update a custom field ─────────────────────────────────
  const updateCustomField = (key, value) => {
    setCustomFields((prev) => ({ ...prev, [key]: value }));
  };

  // ── Render field from form_schema ─────────────────────────
  const renderField = (field, index) => {
    const key = field.name || field.label;
    const fieldType = field.type || "text";
    const required = field.required || false;
    const placeholder = field.placeholder || "";
    const value = customFields[key] || "";

    const baseClass =
      "w-full px-4 py-3 bg-slate-900/60 border border-slate-600/50 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all";

    if (fieldType === "select" && field.options) {
      return (
        <div key={index}>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">
            {field.label}
            {required && <span className="text-red-400 ml-1">*</span>}
          </label>
          <select
            value={value}
            onChange={(e) => updateCustomField(key, e.target.value)}
            required={required}
            className={baseClass}
          >
            <option value="">Select...</option>
            {field.options.map((opt, i) => (
              <option key={i} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </div>
      );
    }

    if (fieldType === "textarea") {
      return (
        <div key={index}>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">
            {field.label}
            {required && <span className="text-red-400 ml-1">*</span>}
          </label>
          <textarea
            value={value}
            onChange={(e) => updateCustomField(key, e.target.value)}
            placeholder={placeholder}
            required={required}
            rows={3}
            className={baseClass + " resize-none"}
          />
        </div>
      );
    }

    return (
      <div key={index}>
        <label className="block text-sm font-medium text-slate-300 mb-1.5">
          {field.label}
          {required && <span className="text-red-400 ml-1">*</span>}
        </label>
        <input
          type={fieldType}
          value={value}
          onChange={(e) => updateCustomField(key, e.target.value)}
          placeholder={placeholder}
          required={required}
          className={baseClass}
        />
      </div>
    );
  };

  // ── Loading state ─────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-2 border-indigo-400 border-t-transparent rounded-full" />
      </div>
    );
  }

  // ── Error / closed state ──────────────────────────────────
  if (error && !project) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 flex items-center justify-center p-4">
        <div className="w-full max-w-md text-center">
          <div className="text-6xl mb-4">🚫</div>
          <h1 className="text-2xl font-bold text-white mb-2">
            Form Unavailable
          </h1>
          <p className="text-slate-400">{error}</p>
        </div>
      </div>
    );
  }

  // ── Spots full ────────────────────────────────────────────
  if (project?.spots_remaining === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 flex items-center justify-center p-4">
        <div className="w-full max-w-md text-center">
          {org?.logo_url && (
            <img
              src={org.logo_url}
              alt={org.name}
              className="w-16 h-16 rounded-xl object-cover mx-auto mb-4 ring-2 ring-slate-700"
            />
          )}
          <div className="text-6xl mb-4">📋</div>
          <h1 className="text-2xl font-bold text-white mb-2">
            Registrations Full
          </h1>
          <p className="text-slate-400">
            {project.name} at {org?.name || "this organization"} has reached its
            member limit. No more spots are available.
          </p>
        </div>
      </div>
    );
  }

  // ── Success state ─────────────────────────────────────────
  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 flex items-center justify-center p-4">
        <div className="w-full max-w-md text-center">
          {org?.logo_url && (
            <img
              src={org.logo_url}
              alt={org.name}
              className="w-16 h-16 rounded-xl object-cover mx-auto mb-4 ring-2 ring-slate-700"
            />
          )}
          <div className="w-16 h-16 rounded-full bg-emerald-500/20 border-2 border-emerald-500 flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">
            Registration Submitted!
          </h1>
          <p className="text-slate-400 mb-2">
            Your registration for <span className="text-white font-medium">{project.name}</span> is
            pending approval.
          </p>
          <p className="text-slate-500 text-sm">
            You&apos;ll receive an email at your registered address once an admin
            approves your registration and your ID card is generated.
          </p>
        </div>
      </div>
    );
  }

  // ── The form ──────────────────────────────────────────────
  const formSchema = project?.form_schema || [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        {/* Org branding header */}
        <div className="text-center mb-6">
          {org?.logo_url && (
            <img
              src={org.logo_url}
              alt={org.name}
              className="w-14 h-14 rounded-xl object-cover mx-auto mb-3 ring-2 ring-slate-700"
            />
          )}
          {org?.name && (
            <p className="text-slate-400 text-sm mb-1">{org.name}</p>
          )}
          <h1 className="text-2xl font-bold text-white tracking-tight">
            {project?.name || "Registration"}
          </h1>
          {project?.spots_remaining !== null && project?.spots_remaining !== undefined && (
            <p className="text-xs text-slate-500 mt-1">
              {project.spots_remaining} spot{project.spots_remaining !== 1 ? "s" : ""} remaining
            </p>
          )}
        </div>

        {/* Form card */}
        <form
          onSubmit={handleSubmit}
          className="bg-slate-800/60 backdrop-blur border border-slate-700/50 rounded-2xl p-6 space-y-5"
        >
          {/* ── Built-in: Name (always required) ──────── */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">
              Full Name <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="John Doe"
              required
              className="w-full px-4 py-3 bg-slate-900/60 border border-slate-600/50 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all"
            />
          </div>

          {/* ── Built-in: Email ───────────────────────── */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">
              Email <span className="text-red-400">*</span>
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="john@example.com"
              required
              className="w-full px-4 py-3 bg-slate-900/60 border border-slate-600/50 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all"
            />
          </div>

          {/* ── Built-in: Photo URL (optional) ────────── */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">
              Photo URL{" "}
              <span className="text-slate-500 text-xs">(optional)</span>
            </label>
            <input
              type="url"
              value={photoUrl}
              onChange={(e) => setPhotoUrl(e.target.value)}
              placeholder="https://..."
              className="w-full px-4 py-3 bg-slate-900/60 border border-slate-600/50 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all"
            />
          </div>

          {/* ── Dynamic custom fields from form_schema ── */}
          {formSchema.length > 0 && (
            <div className="pt-2 border-t border-slate-700/40">
              <p className="text-xs text-slate-500 mb-3 uppercase tracking-wider">
                Additional Information
              </p>
              <div className="space-y-4">
                {formSchema.map((field, i) => renderField(field, i))}
              </div>
            </div>
          )}

          {/* ── Error message ─────────────────────────── */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          {/* ── Submit button ─────────────────────────── */}
          <button
            type="submit"
            disabled={submitting || !name.trim()}
            className="w-full py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold rounded-xl hover:from-indigo-500 hover:to-purple-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer"
          >
            {submitting ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Submitting...
              </span>
            ) : (
              "Submit Registration"
            )}
          </button>
        </form>

        {/* Footer */}
        <p className="text-center text-slate-600 text-xs mt-4">
          Powered by Community ID Platform
        </p>
      </div>
    </div>
  );
}
