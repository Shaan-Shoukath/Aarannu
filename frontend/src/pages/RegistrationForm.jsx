import { useState, useEffect, useRef } from "react";
import { Link, useParams } from "react-router-dom";

const BACKEND = import.meta.env.VITE_BACKEND_URL || "http://localhost:5000";

/**
 * RegistrationForm -- Public member registration page
 * ----------------------------------------------------
 * URL: /register/:projectId
 *
 * Reads form_fields from the public API and renders:
 *   - System fields: name (text), email (email), photo (photo_upload)
 *   - Custom fields: text, email, phone, number, textarea, dropdown,
 *     radio, checkbox, date, file_upload, photo_upload
 *
 * Photo/file uploads use base64 encoding sent to /api/uploads/photo
 * or /api/uploads/file endpoints.
 */
export default function RegistrationForm() {
  const { projectId } = useParams();

  const [project, setProject] = useState(null);
  const [org, setOrg] = useState(null);
  const [formFields, setFormFields] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form state -- system fields
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");

  // Photo state (uploaded via API)
  const [photoPreview, setPhotoPreview] = useState(null);
  const [photoPath, setPhotoPath] = useState(""); // Storage path after upload
  const [photoUploading, setPhotoUploading] = useState(false);
  const photoRef = useRef(null);

  // Custom fields (keyed by field_key)
  const [customFields, setCustomFields] = useState({});
  // Upload paths for file_upload/photo_upload custom fields
  const [uploadPaths, setUploadPaths] = useState({});
  const [uploadPreviews, setUploadPreviews] = useState({});
  const [uploadingField, setUploadingField] = useState(null);

  // Load project info + form fields
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadProject(); }, [projectId]);

  const loadProject = async () => {
    try {
      const res = await fetch(`${BACKEND}/api/projects/${projectId}/public`);
      const json = await res.json();
      if (!res.ok) { setError(json.error || "This form is no longer available."); setLoading(false); return; }

      setProject(json.project);
      setOrg(json.organization);

      // Use form_fields if available, else fall back to form_schema
      const fields = json.project.form_fields && json.project.form_fields.length > 0
        ? json.project.form_fields
        : (json.project.form_schema || []).map((f, i) => ({
            field_key: f.name || f.field_key || f.label?.toLowerCase().replace(/[^a-z0-9]+/g, "_") || `field_${i}`,
            label: f.label, type: f.type || "text", required: f.required || false,
            placeholder: f.placeholder || "", description: f.description || "",
            options: f.options || [], default_value: f.default_value || "",
            is_system: false, validation_rules: f.validation_rules || {},
          }));

      setFormFields(fields);

      // Initialize custom fields with default values
      const initial = {};
      fields.filter(f => !f.is_system).forEach((f) => {
        initial[f.field_key] = f.default_value || (f.type === "checkbox" ? [] : "");
      });
      setCustomFields(initial);
    } catch { setError("Failed to load registration form."); } finally { setLoading(false); }
  };

  // Upload a file (photo or generic)
  const uploadFile = async (file, fieldKey, isPhoto = true) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const base64 = reader.result.split(",")[1];
          const endpoint = isPhoto ? "photo" : "file";
          const res = await fetch(`${BACKEND}/api/uploads/${endpoint}/${projectId}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              fileName: file.name, fileData: base64, mimeType: file.type, fieldKey,
            }),
          });
          const json = await res.json();
          if (!res.ok) { reject(new Error(json.error || "Upload failed")); return; }
          resolve(json);
        } catch (err) { reject(err); }
      };
      reader.onerror = () => reject(new Error("Failed to read file"));
      reader.readAsDataURL(file);
    });
  };

  // Handle system photo upload
  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { setError("Photo must be under 5 MB."); return; }
    setPhotoUploading(true);
    setError("");
    try {
      const result = await uploadFile(file, "photo", true);
      setPhotoPath(result.filePath);
      setPhotoPreview(result.signedUrl || URL.createObjectURL(file));
    } catch (err) { setError(`Photo upload failed: ${err.message}`); }
    finally { setPhotoUploading(false); }
  };

  // Handle custom field file/photo upload
  const handleFieldUpload = async (file, fieldKey, isPhoto) => {
    if (file.size > 5 * 1024 * 1024) { setError("File must be under 5 MB."); return; }
    setUploadingField(fieldKey);
    setError("");
    try {
      const result = await uploadFile(file, fieldKey, isPhoto);
      setUploadPaths(prev => ({ ...prev, [fieldKey]: result.filePath }));
      setUploadPreviews(prev => ({ ...prev, [fieldKey]: result.signedUrl || URL.createObjectURL(file) }));
      setCustomFields(prev => ({ ...prev, [fieldKey]: result.filePath }));
    } catch (err) { setError(`Upload failed: ${err.message}`); }
    finally { setUploadingField(null); }
  };

  // Submit handler
  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      // Build custom fields payload (exclude system fields)
      const cfPayload = {};
      formFields.filter(f => !f.is_system).forEach(f => {
        const val = customFields[f.field_key];
        if (val !== undefined && val !== "" && !(Array.isArray(val) && val.length === 0)) {
          cfPayload[f.field_key] = val;
        }
      });

      const body = {
        name: name.trim(),
        email: email.trim() || undefined,
        photoUrl: photoPath || undefined,
        customFields: Object.keys(cfPayload).length > 0 ? cfPayload : undefined,
      };

      const res = await fetch(`${BACKEND}/api/members/register/${projectId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error || "Registration failed."); setSubmitting(false); return; }
      setSubmitted(true);
    } catch { setError("Network error. Please try again."); } finally { setSubmitting(false); }
  };

  // Update a custom field
  const updateCustomField = (key, value) => setCustomFields(prev => ({ ...prev, [key]: value }));

  // Toggle checkbox value in array
  const toggleCheckbox = (key, option) => {
    setCustomFields(prev => {
      const arr = Array.isArray(prev[key]) ? [...prev[key]] : [];
      const idx = arr.indexOf(option);
      if (idx >= 0) arr.splice(idx, 1); else arr.push(option);
      return { ...prev, [key]: arr };
    });
  };

  // Render a custom field
  const renderField = (field) => {
    const key = field.field_key;
    const value = customFields[key] || "";
    const bc = "w-full px-4 py-3 bg-zinc-900 border border-zinc-700 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-cyan-300/30 focus:border-cyan-300 transition-all";

    const label = (
      <>
        <label className="block text-sm font-medium text-zinc-300 mb-1.5">
          {field.label}{field.required && <span className="text-red-400 ml-1">*</span>}
        </label>
        {field.description && <p className="text-xs text-zinc-500 mb-2">{field.description}</p>}
      </>
    );

    switch (field.type) {
      case "textarea":
        return <div key={key}>{label}<textarea value={value} onChange={(e) => updateCustomField(key, e.target.value)} placeholder={field.placeholder || ""} required={field.required} rows={3} className={bc + " resize-none"} /></div>;

      case "dropdown":
        return <div key={key}>{label}<select value={value} onChange={(e) => updateCustomField(key, e.target.value)} required={field.required} className={bc}><option value="">Select...</option>{(field.options || []).map((o, i) => <option key={i} value={o}>{o}</option>)}</select></div>;

      case "radio":
        return (
          <div key={key}>{label}
            <div className="space-y-2 mt-1">
              {(field.options || []).map((o, i) => (
                <label key={i} className="flex items-center gap-2.5 cursor-pointer group">
                  <input type="radio" name={`reg_${key}`} value={o} checked={value === o} onChange={() => updateCustomField(key, o)} required={field.required && !value} className="accent-cyan-300 w-4 h-4" />
                  <span className="text-sm text-zinc-300 group-hover:text-white transition">{o}</span>
                </label>
              ))}
            </div>
          </div>
        );

      case "checkbox":
        return (
          <div key={key}>{label}
            <div className="space-y-2 mt-1">
              {(field.options || []).map((o, i) => (
                <label key={i} className="flex items-center gap-2.5 cursor-pointer group">
                  <input type="checkbox" checked={(Array.isArray(customFields[key]) ? customFields[key] : []).includes(o)} onChange={() => toggleCheckbox(key, o)} className="accent-cyan-300 w-4 h-4" />
                  <span className="text-sm text-zinc-300 group-hover:text-white transition">{o}</span>
                </label>
              ))}
            </div>
          </div>
        );

      case "photo_upload":
        return (
          <div key={key}>{label}
            <div className="relative">
              {uploadPreviews[key] ? (
                <div className="relative">
                  <img src={uploadPreviews[key]} alt="Upload" className="w-24 h-24 rounded-xl object-cover border-2 border-zinc-700" />
                  <button type="button" onClick={() => { setUploadPreviews(p => { const n = {...p}; delete n[key]; return n; }); setUploadPaths(p => { const n = {...p}; delete n[key]; return n; }); updateCustomField(key, ""); }}
                    className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 rounded-full text-white text-xs flex items-center justify-center cursor-pointer">{"\u2715"}</button>
                </div>
              ) : (
                <label className="block border-2 border-dashed border-zinc-700 rounded-xl p-6 text-center cursor-pointer hover:border-cyan-300/40 transition">
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && handleFieldUpload(e.target.files[0], key, true)} />
                  {uploadingField === key ? (
                    <div className="animate-spin h-6 w-6 border-2 border-cyan-300 border-t-transparent rounded-full mx-auto" />
                  ) : (
                    <><div className="text-3xl mb-1">{"\uD83D\uDCF7"}</div><p className="text-xs text-zinc-500">Click to upload photo</p><p className="text-[10px] text-zinc-600 mt-1">JPG, PNG, WebP (max 5 MB)</p></>
                  )}
                </label>
              )}
            </div>
          </div>
        );

      case "file_upload":
        return (
          <div key={key}>{label}
            {uploadPaths[key] ? (
              <div className="flex items-center gap-2 bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2">
                <span className="text-cyan-300">{"\uD83D\uDCCE"}</span>
                <span className="text-sm text-zinc-300 truncate flex-1">File uploaded</span>
                <button type="button" onClick={() => { setUploadPaths(p => { const n = {...p}; delete n[key]; return n; }); updateCustomField(key, ""); }}
                  className="text-red-400 hover:text-red-300 text-xs cursor-pointer">{"\u2715"}</button>
              </div>
            ) : (
              <label className="block border-2 border-dashed border-zinc-700 rounded-xl p-6 text-center cursor-pointer hover:border-cyan-300/40 transition">
                <input type="file" className="hidden" onChange={(e) => e.target.files?.[0] && handleFieldUpload(e.target.files[0], key, false)} />
                {uploadingField === key ? (
                  <div className="animate-spin h-6 w-6 border-2 border-cyan-300 border-t-transparent rounded-full mx-auto" />
                ) : (
                  <><div className="text-3xl mb-1">{"\uD83D\uDCCE"}</div><p className="text-xs text-zinc-500">Click to upload file</p><p className="text-[10px] text-zinc-600 mt-1">PDF, DOC, Images (max 5 MB)</p></>
                )}
              </label>
            )}
          </div>
        );

      case "date":
        return <div key={key}>{label}<input type="date" value={value} onChange={(e) => updateCustomField(key, e.target.value)} required={field.required} className={bc} /></div>;

      case "number":
        return <div key={key}>{label}<input type="number" value={value} onChange={(e) => updateCustomField(key, e.target.value)} placeholder={field.placeholder || ""} required={field.required} className={bc} /></div>;

      case "email":
        return <div key={key}>{label}<input type="email" value={value} onChange={(e) => updateCustomField(key, e.target.value)} placeholder={field.placeholder || ""} required={field.required} className={bc} /></div>;

      case "phone":
        return <div key={key}>{label}<input type="tel" value={value} onChange={(e) => updateCustomField(key, e.target.value)} placeholder={field.placeholder || "+1 (555) 000-0000"} required={field.required} className={bc} /></div>;

      default:
        return <div key={key}>{label}<input type="text" value={value} onChange={(e) => updateCustomField(key, e.target.value)} placeholder={field.placeholder || ""} required={field.required} className={bc} /></div>;
    }
  };

  // Loading
  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-2 border-cyan-300 border-t-transparent rounded-full" />
      </div>
    );
  }

  // Error / closed
  if (error && !project) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4">
        <div className="w-full max-w-md text-center">
          <div className="text-6xl mb-4">{"\uD83D\uDEAB"}</div>
          <h1 className="text-2xl font-bold text-white mb-2">Form Unavailable</h1>
          <p className="text-zinc-400">{error}</p>
        </div>
      </div>
    );
  }

  // Spots full
  if (project?.spots_remaining === 0) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4">
        <div className="w-full max-w-md text-center">
          {org?.logo_url && <img src={org.logo_url} alt={org.name} className="w-16 h-16 rounded-xl object-cover mx-auto mb-4 ring-2 ring-slate-700" />}
          <div className="text-6xl mb-4">{"\uD83D\uDCCB"}</div>
          <h1 className="text-2xl font-bold text-white mb-2">Registrations Full</h1>
          <p className="text-slate-400">{project.name} has reached its member limit.</p>
        </div>
      </div>
    );
  }

  // Success
  if (submitted) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4">
        <div className="w-full max-w-md text-center">
          {org?.logo_url && <img src={org.logo_url} alt={org.name} className="w-16 h-16 rounded-xl object-cover mx-auto mb-4 ring-2 ring-slate-700" />}
          <div className="w-16 h-16 rounded-full bg-emerald-500/20 border-2 border-emerald-500 flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Registration Submitted!</h1>
          <p className="text-zinc-400 mb-2">Your registration for <span className="text-white font-medium">{project.name}</span> is pending approval.</p>
          <p className="text-zinc-500 text-sm">You&apos;ll receive an email once approved.</p>
        </div>
      </div>
    );
  }

  // Separate system and custom fields
  const customFormFields = formFields.filter(f => !f.is_system);

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        {/* Org branding */}
        <div className="text-center mb-5 sm:mb-6">
          {org?.logo_url && <img src={org.logo_url} alt={org.name} className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl object-cover mx-auto mb-3 ring-2 ring-white/20" />}
          {org?.name && <p className="text-zinc-400 text-xs sm:text-sm mb-1">{org.name}</p>}
          <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">{project?.name || "Registration"}</h1>
          {project?.spots_remaining != null && (
            <p className="text-xs text-zinc-500 mt-1">{project.spots_remaining} spot{project.spots_remaining !== 1 ? "s" : ""} remaining</p>
          )}
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="bg-zinc-950 border border-white/12 rounded-2xl p-4 sm:p-6 space-y-4 sm:space-y-5">
          {/* System: Name */}
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-1.5">Full Name <span className="text-red-400">*</span></label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="John Doe" required
              className="w-full px-4 py-3 bg-zinc-900 border border-zinc-700 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-cyan-300/30 focus:border-cyan-300 transition-all" />
          </div>

          {/* System: Email */}
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-1.5">Email <span className="text-red-400">*</span></label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="john@example.com" required
              className="w-full px-4 py-3 bg-zinc-900 border border-zinc-700 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-cyan-300/30 focus:border-cyan-300 transition-all" />
          </div>

          {/* System: Photo Upload */}
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-1.5">Photo <span className="text-zinc-500 text-xs">(optional)</span></label>
            {photoPreview ? (
              <div className="flex items-center gap-4">
                <img src={photoPreview} alt="Photo" className="w-20 h-20 rounded-xl object-cover border-2 border-zinc-700" />
                <button type="button" onClick={() => { setPhotoPreview(null); setPhotoPath(""); if (photoRef.current) photoRef.current.value = ""; }}
                  className="px-3 py-1.5 bg-red-500/20 text-red-400 hover:bg-red-500/30 rounded-lg text-xs transition cursor-pointer">Remove</button>
              </div>
            ) : (
              <label className="block border-2 border-dashed border-zinc-700 rounded-xl p-5 text-center cursor-pointer hover:border-cyan-300/40 transition">
                <input ref={photoRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
                {photoUploading ? (
                  <div className="animate-spin h-6 w-6 border-2 border-cyan-300 border-t-transparent rounded-full mx-auto" />
                ) : (
                  <><div className="text-3xl mb-1">{"\uD83D\uDCF7"}</div><p className="text-xs text-zinc-500">Click to upload your photo</p><p className="text-[10px] text-zinc-600 mt-1">JPG, PNG, WebP (max 5 MB)</p></>
                )}
              </label>
            )}
          </div>

          {/* Custom fields */}
          {customFormFields.length > 0 && (
            <div className="pt-2 border-t border-slate-700/40">
              <p className="text-xs text-slate-500 mb-3 uppercase tracking-wider">Additional Information</p>
              <div className="space-y-4">
                {customFormFields.map(field => renderField(field))}
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          {/* Submit */}
          <button type="submit" disabled={submitting || !name.trim() || photoUploading || uploadingField}
            className="w-full py-3 bg-cyan-300 hover:bg-white text-black font-semibold rounded-xl shadow-sm shadow-cyan-300/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer">
            {submitting ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Submitting...
              </span>
            ) : "Submit Registration"}
          </button>
        </form>

        <Link
          to="/"
          className="mt-4 inline-flex items-center justify-center gap-2 text-zinc-500 hover:text-zinc-300 transition"
        >
          <span className="inline-flex shrink-0 overflow-hidden rounded-[22%]" style={{ lineHeight: 0 }}>
              <img src="/aarannu.png" alt="" className="h-7 w-auto" />
            </span>
          <span className="text-xs font-medium">Powered by Aarannu</span>
        </Link>
      </div>
    </div>
  );
}
