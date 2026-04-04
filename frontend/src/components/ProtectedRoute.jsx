import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import AccessStatusScreen from "./AccessStatusScreen";
import { getMemberApprovalRecord } from "../lib/memberApproval";
import { supabase } from "../lib/supabaseClient";

export default function ProtectedRoute({ children }) {
  const [accessState, setAccessState] = useState({
    status: "checking",
    session: null,
  });

  useEffect(() => {
    let active = true;
    let timeoutId = null;

    const clearVerificationTimer = () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
    };

    const verifyAccess = async (session) => {
      clearVerificationTimer();

      if (!active) return;

      if (!session?.user) {
        setAccessState({ status: "unauthenticated", session: null });
        return;
      }

      timeoutId = setTimeout(() => {
        if (active) {
          setAccessState({ status: "unauthenticated", session: null });
        }
      }, 5000);

      try {
        const { member, error } = await getMemberApprovalRecord(session.user.id);

        if (!active) return;
        clearVerificationTimer();

        if (error) {
          console.error("ProtectedRoute approval lookup failed:", error);
          setAccessState({ status: "error", session });
          return;
        }

        if (!member) {
          setAccessState({ status: "missing", session });
          return;
        }

        if (!member.approved) {
          setAccessState({ status: "pending", session });
          return;
        }

        setAccessState({ status: "approved", session });
      } catch (error) {
        if (!active) return;
        clearVerificationTimer();
        console.error("ProtectedRoute approval check crashed:", error);
        setAccessState({ status: "error", session });
      }
    };

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!active) return;
      setAccessState({ status: "checking", session: null });
      verifyAccess(session);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      setAccessState({ status: "checking", session: null });
      verifyAccess(session);
    });

    return () => {
      active = false;
      clearVerificationTimer();
      subscription.unsubscribe();
    };
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setAccessState({ status: "unauthenticated", session: null });
  };

  if (accessState.status === "checking") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f6f6f8]">
        <div className="flex flex-col items-center gap-3">
          <svg
            className="animate-spin h-8 w-8 text-[#2563EB]"
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
          <span className="text-sm text-slate-500">Verifying access...</span>
        </div>
      </div>
    );
  }

  if (accessState.status === "unauthenticated") {
    return <Navigate to="/login" replace />;
  }

  if (accessState.status === "pending") {
    return (
      <AccessStatusScreen
        title="Membership Pending Approval"
        message="Your account is signed in, but an organization admin still needs to approve your membership before you can access the dashboard."
        details="You'll receive an email once approved and your ID card will be available from the verification link in that email."
        tone="pending"
        primaryLabel="Sign Out"
        primaryAction={handleSignOut}
        secondaryLabel="Go to Login"
        secondaryTo="/login"
      />
    );
  }

  if (accessState.status === "missing") {
    return (
      <AccessStatusScreen
        title="Membership Record Required"
        message="We couldn't find a matching member record for this account, so dashboard access has been blocked."
        details="Please contact your administrator if this account should have access."
        tone="blocked"
        primaryLabel="Sign Out"
        primaryAction={handleSignOut}
        secondaryLabel="Back to Login"
        secondaryTo="/login"
      />
    );
  }

  if (accessState.status === "error") {
    return (
      <AccessStatusScreen
        title="Unable to Verify Access"
        message="We couldn't confirm your approval status right now, so access is temporarily blocked."
        details="Please try again in a moment. If this keeps happening, contact your administrator."
        tone="error"
        primaryLabel="Sign Out"
        primaryAction={handleSignOut}
        secondaryLabel="Back to Login"
        secondaryTo="/login"
      />
    );
  }

  return children;
}
