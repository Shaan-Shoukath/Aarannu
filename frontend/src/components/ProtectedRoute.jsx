import { Navigate } from "react-router-dom";
import AccessStatusScreen from "./AccessStatusScreen";
import { useAuth } from "../contexts/useAuth";

export default function ProtectedRoute({ children }) {
  const { loading, user, member, error, signOut } = useAuth();

  if (loading) {
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
          <span className="text-sm text-slate-500">Opening workspace...</span>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (error) {
    return (
      <AccessStatusScreen
        title="Unable to Verify Access"
        message="We couldn't confirm your approval status right now, so access is temporarily blocked."
        details="Please try again in a moment. If this keeps happening, contact your administrator."
        tone="error"
        primaryLabel="Sign Out"
        primaryAction={signOut}
        secondaryLabel="Back to Login"
        secondaryTo="/login"
      />
    );
  }

  if (!member) {
    return (
      <AccessStatusScreen
        title="Membership Record Required"
        message="We couldn't find a matching member record for this account, so dashboard access has been blocked."
        details="Please contact your administrator if this account should have access."
        tone="blocked"
        primaryLabel="Sign Out"
        primaryAction={signOut}
        secondaryLabel="Back to Login"
        secondaryTo="/login"
      />
    );
  }

  if (!member.approved) {
    return (
      <AccessStatusScreen
        title="Membership Pending Approval"
        message="Your account is signed in, but an organization admin still needs to approve your membership before you can access the dashboard."
        details="You'll receive an email once approved and your ID card will be available from the verification link in that email."
        tone="pending"
        primaryLabel="Sign Out"
        primaryAction={signOut}
        secondaryLabel="Go to Login"
        secondaryTo="/login"
      />
    );
  }

  return children;
}
