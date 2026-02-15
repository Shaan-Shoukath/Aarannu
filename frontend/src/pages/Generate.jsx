import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import BulkGenerator from "../components/BulkGenerator";
import IDCard from "../components/IDCard";

/**
 * Generate Page
 * --------------------------------------------------
 * Allows approved users to:
 *  1. Enter member data manually (one or multiple).
 *  2. Preview the ID card in real-time.
 *  3. Bulk-generate and upload all cards.
 *
 * Only accessible if the user's member.approved === true.
 * If not approved, they're redirected to the dashboard.
 */
export default function Generate() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [_member, setMember] = useState(null);
  const [loading, setLoading] = useState(true);

  // Members to generate IDs for
  const [members, setMembers] = useState([]);

  // Form state for adding a new member
  const [form, setForm] = useState({
    name: "",
    role: "",
    id_number: "",
    dob: "",
    gender: "Male",
    photo_url: "",
    address: "",
  });

  // Preview mode
  const [previewData, setPreviewData] = useState(null);
  const [showBack, setShowBack] = useState(false);

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
    // Optionally navigate to dashboard to see results
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
              | Data Entry
            </span>
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/dashboard")}
            className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-[#1152d4] transition-colors border border-slate-300 rounded-lg"
          >
            ← Back to Dashboard
          </button>
        </div>
      </header>

      {/* ─── Main Content ─── */}
      <main className="flex-1 flex overflow-hidden">
        {/* ─── Left Sidebar: Data Entry ─── */}
        <aside className="w-100 shrink-0 bg-white border-r border-slate-200 overflow-y-auto">
          <div className="p-6 space-y-8">
            {/* Section 1: Identity Details */}
            <div className="space-y-4">
              <h2 className="text-sm uppercase tracking-wider text-slate-500 font-semibold mb-4">
                Identity Details
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
                    Add members one by one below. When ready, click
                    &quot;Generate All IDs&quot; to create and upload all cards
                    to secure storage. Cards expire after 15 days.
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
                  <IDCard data={previewData} showBack={showBack} />
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
                  Fill in the form on the left and click &quot;Preview&quot; or
                  &quot;Add to Queue&quot;
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
                />
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
