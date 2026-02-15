import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";

/**
 * ProtectedRoute
 * --------------------------------------------------
 * Wraps any route that requires authentication.
 *
 * Behaviour:
 *  1. On mount, checks the current Supabase session.
 *  2. While checking → shows a loading spinner.
 *  3. No session → redirects to /login.
 *  4. Valid session → renders children.
 *
 * It also subscribes to auth state changes so that if
 * the user signs out in another tab, they are redirected immediately.
 */
export default function ProtectedRoute({ children }) {
  const [session, setSession] = useState(undefined); // undefined = loading

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    // Subscribe to auth changes (login, logout, token refresh)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Still loading
  if (session === undefined) {
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
          <span className="text-sm text-slate-500">Verifying session…</span>
        </div>
      </div>
    );
  }

  // No session → redirect to login
  if (!session) {
    return <Navigate to="/login" replace />;
  }

  return children;
}
