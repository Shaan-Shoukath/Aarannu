import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";

/**
 * Dashboard Page
 * --------------------------------------------------
 * The main hub after login. Shows:
 *  1. User's approval status.
 *  2. Quick stats (total generated IDs, active IDs, expired).
 *  3. List of generated IDs (non-expired) with download links.
 *  4. Navigation to the Generate page (if approved).
 *
 * Expiry logic:
 *  We fetch from `generated_ids` WHERE expires_at > now().
 *  Expired records still exist in the DB but are hidden from the UI.
 */
export default function Dashboard() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [member, setMember] = useState(null);
  const [generatedIds, setGeneratedIds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [signedUrls, setSignedUrls] = useState({});

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      // 1. Get current user
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setUser(user);

      if (!user) return;

      // 2. Fetch member profile
      const { data: memberData } = await supabase
        .from("members")
        .select("*")
        .eq("user_id", user.id)
        .single();

      setMember(memberData);

      // 3. Fetch non-expired generated IDs
      const { data: idsData } = await supabase
        .from("generated_ids")
        .select("*")
        .eq("user_id", user.id)
        .gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false });

      setGeneratedIds(idsData || []);
    } catch (err) {
      console.error("Dashboard load error:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/login", { replace: true });
  };

  /**
   * Generate a signed URL for a given file path.
   * Signed URLs grant temporary access to private storage files.
   * We cache them in state to avoid re-generating on every render.
   */
  const getSignedUrl = async (filePath) => {
    if (signedUrls[filePath]) return signedUrls[filePath];

    const { data, error } = await supabase.storage
      .from("id-cards")
      .createSignedUrl(filePath, 60 * 60); // 1 hour validity

    if (error) {
      console.error("Signed URL error:", error);
      return null;
    }

    setSignedUrls((prev) => ({ ...prev, [filePath]: data.signedUrl }));
    return data.signedUrl;
  };

  const handleDownload = async (filePath, fileName) => {
    const url = await getSignedUrl(filePath);
    if (!url) return;

    const a = document.createElement("a");
    a.href = url;
    a.download = fileName || "id-card.png";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handlePreview = async (filePath) => {
    const url = await getSignedUrl(filePath);
    if (url) window.open(url, "_blank");
  };

  // days remaining helper
  const daysRemaining = (expiresAt) => {
    const diff = new Date(expiresAt) - new Date();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f6f6f8]">
        <div className="flex flex-col items-center gap-3">
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
          <span className="text-sm text-slate-500">Loading dashboard…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f6f6f8] font-['Public_Sans',sans-serif]">
      {/* ─── Header ─── */}
      <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-[#1152d4] rounded-lg flex items-center justify-center text-white font-bold text-lg">
            A
          </div>
          <h1 className="font-bold text-lg text-slate-900">
            Aarannu{" "}
            <span className="text-slate-400 font-normal ml-2 text-sm">
              | Dashboard
            </span>
          </h1>
        </div>
        <div className="flex items-center gap-3">
          {member?.approved && (
            <button
              onClick={() => navigate("/templates")}
              className="px-4 py-2 bg-[#1152d4] hover:bg-[#1152d4]/90 text-white text-sm font-medium rounded-lg flex items-center gap-2 shadow-lg shadow-[#1152d4]/20 transition-all"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 4v16m8-8H4"
                />
              </svg>
              Generate IDs
            </button>
          )}
          <button
            onClick={handleSignOut}
            className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-red-600 transition-colors border border-slate-300 rounded-lg"
          >
            Sign Out
          </button>
        </div>
      </header>

      {/* ─── Main Content ─── */}
      <main className="max-w-6xl mx-auto px-6 py-8 space-y-8">
        {/* Approval Status Banner */}
        {!member?.approved && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 flex items-start gap-4">
            <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center shrink-0">
              <svg
                className="w-5 h-5 text-amber-600"
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-bold text-amber-800">
                Account Pending Approval
              </h3>
              <p className="text-sm text-amber-700 mt-1">
                Your account is awaiting admin approval. Once approved,
                you&apos;ll be able to generate ID cards. Please check back
                later or contact your administrator.
              </p>
            </div>
          </div>
        )}

        {member?.approved && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-3">
            <svg
              className="w-5 h-5 text-green-600"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
            </svg>
            <span className="text-sm font-medium text-green-700">
              Account approved — you can generate ID cards.
            </span>
          </div>
        )}

        {/* Profile Card */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <h2 className="text-sm uppercase tracking-wider text-slate-500 font-semibold mb-4">
            Your Profile
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <p className="text-xs text-slate-400 uppercase font-semibold">
                Name
              </p>
              <p className="text-sm font-semibold text-slate-800 mt-1">
                {member?.name || "N/A"}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-400 uppercase font-semibold">
                Role
              </p>
              <p className="text-sm font-semibold text-slate-800 mt-1">
                {member?.role || "Member"}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-400 uppercase font-semibold">
                Email
              </p>
              <p className="text-sm font-semibold text-slate-800 mt-1">
                {user?.email || "N/A"}
              </p>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <svg
                  className="w-5 h-5 text-[#1152d4]"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 14H4V6h16v12z" />
                </svg>
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-800">
                  {generatedIds.length}
                </p>
                <p className="text-xs text-slate-500">Active IDs</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                <svg
                  className="w-5 h-5 text-green-600"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm-2 16l-4-4 1.41-1.41L10 14.17l6.59-6.59L18 9l-8 8z" />
                </svg>
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-800">
                  {member?.approved ? "Yes" : "No"}
                </p>
                <p className="text-xs text-slate-500">Approved</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                <svg
                  className="w-5 h-5 text-purple-600"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z" />
                </svg>
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-800">15</p>
                <p className="text-xs text-slate-500">Days validity</p>
              </div>
            </div>
          </div>
        </div>

        {/* Generated IDs Table */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-800">
              Your Generated IDs
            </h2>
            <button
              onClick={loadDashboardData}
              className="text-sm text-[#1152d4] hover:underline flex items-center gap-1"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
              Refresh
            </button>
          </div>

          {generatedIds.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <svg
                className="w-12 h-12 text-slate-300 mx-auto mb-3"
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                <path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 14H4V6h16v12z" />
              </svg>
              <p className="text-slate-500 text-sm">
                No active ID cards found.
              </p>
              {member?.approved && (
                <button
                  onClick={() => navigate("/templates")}
                  className="mt-4 px-4 py-2 bg-[#1152d4] text-white text-sm font-medium rounded-lg hover:bg-[#1152d4]/90 transition-colors"
                >
                  Generate your first ID
                </button>
              )}
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {/* Table header */}
              <div className="grid grid-cols-12 bg-slate-50 px-6 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
                <div className="col-span-1">#</div>
                <div className="col-span-4">File</div>
                <div className="col-span-3">Created</div>
                <div className="col-span-2">Expires In</div>
                <div className="col-span-2 text-right">Actions</div>
              </div>

              {generatedIds.map((id, idx) => (
                <div
                  key={id.id}
                  className="grid grid-cols-12 items-center px-6 py-3 hover:bg-slate-50 transition-colors"
                >
                  <div className="col-span-1 text-sm text-slate-500">
                    {idx + 1}
                  </div>
                  <div className="col-span-4 text-sm text-slate-800 font-medium truncate">
                    {id.file_url.split("/").pop()}
                  </div>
                  <div className="col-span-3 text-sm text-slate-500">
                    {new Date(id.created_at).toLocaleDateString()}
                  </div>
                  <div className="col-span-2">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        daysRemaining(id.expires_at) <= 3
                          ? "bg-red-100 text-red-700"
                          : "bg-green-100 text-green-700"
                      }`}
                    >
                      {daysRemaining(id.expires_at)} days left
                    </span>
                  </div>
                  <div className="col-span-2 flex gap-2 justify-end">
                    <button
                      onClick={() => handlePreview(id.file_url)}
                      className="p-1.5 text-slate-400 hover:text-[#1152d4] transition-colors"
                      title="Preview"
                    >
                      <svg
                        className="w-4 h-4"
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
                    </button>
                    <button
                      onClick={() =>
                        handleDownload(
                          id.file_url,
                          id.file_url.split("/").pop(),
                        )
                      }
                      className="p-1.5 text-slate-400 hover:text-green-600 transition-colors"
                      title="Download"
                    >
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                        />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
