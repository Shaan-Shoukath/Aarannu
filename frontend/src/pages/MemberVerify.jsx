import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import BrandLogoLink from "../components/BrandLogoLink";
import { useAuth } from "../contexts/useAuth";

const BACKEND =
  import.meta.env.VITE_API_URL ||
  import.meta.env.VITE_BACKEND_URL ||
  "http://localhost:5000";

export default function MemberVerify() {
  const { id } = useParams();
  const { user } = useAuth();
  const [state, setState] = useState({
    loading: true,
    error: "",
    data: null,
  });

  useEffect(() => {
    let cancelled = false;

    async function loadMember() {
      setState({ loading: true, error: "", data: null });
      try {
        const res = await fetch(`${BACKEND}/api/verify/${encodeURIComponent(id)}`);
        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
          throw new Error(data?.error || "Member could not be verified.");
        }

        if (!cancelled) {
          setState({ loading: false, error: "", data });
        }
      } catch (err) {
        if (!cancelled) {
          setState({
            loading: false,
            error: err.message || "Member could not be verified.",
            data: null,
          });
        }
      }
    }

    loadMember();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const member = state.data?.member || {};
  const organization = state.data?.organization || {};
  const isActive = Boolean(state.data?.valid);
  const statusLabel = isActive ? "ACTIVE" : "INVALID";
  const isAuthenticated = Boolean(user);

  return (
    <div className="min-h-screen bg-white px-4 py-8 font-['Public_Sans',sans-serif] text-slate-950 sm:px-6">
      <div className="mx-auto max-w-2xl">
        <header className="mb-8 flex items-center justify-between gap-4">
          <BrandLogoLink
            imageClassName="h-9 w-auto"
            textClassName="font-black tracking-[0.18em] text-slate-950"
            className="rounded-lg focus:outline-none focus:ring-4 focus:ring-blue-300/40"
            label="AARANNU"
          />
          <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-slate-600">
            Member Verification
          </span>
        </header>

        {state.loading ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
            <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
            <p className="mt-4 text-sm font-semibold text-slate-600">
              Checking member status...
            </p>
          </div>
        ) : state.error ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-8 text-center">
            <p className="text-sm font-black uppercase tracking-[0.2em] text-rose-700">
              Invalid
            </p>
            <h1 className="mt-2 text-2xl font-black text-slate-950">
              Verification failed
            </h1>
            <p className="mt-2 text-sm text-slate-600">{state.error}</p>
          </div>
        ) : (
          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl shadow-slate-900/8">
            <div className="h-2 bg-linear-to-r from-blue-600 via-blue-500 to-red-500" />
            <div className="grid gap-6 p-6 sm:grid-cols-[132px_minmax(0,1fr)] sm:p-8">
              <div className="h-40 w-32 overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
                {member.photo_url ? (
                  <img
                    src={member.photo_url}
                    alt={`${member.name || "Member"} profile`}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-xs font-semibold text-slate-500">
                    No Photo
                  </div>
                )}
              </div>

              <div className="min-w-0">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">
                      Name
                    </p>
                    <h1 className="mt-1 break-words text-3xl font-black text-slate-950">
                      {member.name || "Unknown Member"}
                    </h1>
                  </div>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-black tracking-[0.14em] ${
                      isActive
                        ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
                        : "bg-rose-50 text-rose-700 ring-1 ring-rose-200"
                    }`}
                  >
                    {statusLabel}
                  </span>
                </div>

                <div className="mt-6 grid gap-4 sm:grid-cols-2">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">
                      Organization
                    </p>
                    <p className="mt-1 text-base font-bold text-slate-900">
                      {organization.name || "Unknown organization"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">
                      Valid Until
                    </p>
                    <p className="mt-1 text-base font-bold text-slate-900">
                      {state.data?.expires_at
                        ? new Date(state.data.expires_at).toLocaleDateString()
                        : "N/A"}
                    </p>
                  </div>
                </div>

                {isAuthenticated && (
                  <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">
                      Full Profile
                    </p>
                    <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
                      <div>
                        <dt className="font-bold text-slate-500">Email</dt>
                        <dd className="font-semibold text-slate-900">
                          {member.email || "N/A"}
                        </dd>
                      </div>
                      <div>
                        <dt className="font-bold text-slate-500">Project</dt>
                        <dd className="font-semibold text-slate-900">
                          {state.data?.project?.name || "N/A"}
                        </dd>
                      </div>
                    </dl>
                  </div>
                )}
              </div>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
