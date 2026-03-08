import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Dashboard from "./pages/Dashboard";
import Generate from "./pages/Generate";
import Templates from "./pages/Templates";
import RenderCard from "./pages/RenderCard";
import TokenDashboard from "./pages/TokenDashboard";
import TokenPurchase from "./pages/TokenPurchase";
import ProtectedRoute from "./components/ProtectedRoute";

// ── SaaS Platform Pages ──────────────────────────────────────
import OrgOnboarding from "./pages/OrgOnboarding";
import OrgDashboard from "./pages/OrgDashboard";
import ProjectCreate from "./pages/ProjectCreate";
import ProjectDashboard from "./pages/ProjectDashboard";
import RegistrationForm from "./pages/RegistrationForm";
import VerifyCard from "./pages/VerifyCard";
import BulkDashboard from "./pages/BulkDashboard";

/**
 * App – Root Component
 * --------------------------------------------------
 * Sets up client-side routing:
 *
 *  LEGACY (single-user):
 *    /login, /signup, /dashboard, /templates, /generate
 *
 *  SAAS PLATFORM:
 *    /org/new            → Create or select organization
 *    /org/:slug/dashboard → Organization dashboard
 *    /org/:slug/project/new → Create project
 *    /org/:slug/project/:projectId → Project dashboard
 *    /org/:slug/bulk/:projectId → Bulk dashboard
 *
 *  PUBLIC:
 *    /register/:projectId → Member registration form
 *    /verify/:cardId      → QR verification page
 */
export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* ── Public routes ────────────────────── */}
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/register/:projectId" element={<RegistrationForm />} />
        <Route path="/verify/:cardId" element={<VerifyCard />} />
        <Route path="/render-card" element={<RenderCard />} />

        {/* ── Legacy protected routes ──────────── */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/templates"
          element={
            <ProtectedRoute>
              <Templates />
            </ProtectedRoute>
          }
        />
        <Route
          path="/generate"
          element={
            <ProtectedRoute>
              <Generate />
            </ProtectedRoute>
          }
        />

        <Route
          path="/tokens"
          element={
            <ProtectedRoute>
              <TokenDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/tokens/purchase"
          element={
            <ProtectedRoute>
              <TokenPurchase />
            </ProtectedRoute>
          }
        />

        {/* ── SaaS Platform routes (protected) ─── */}
        <Route
          path="/org/new"
          element={
            <ProtectedRoute>
              <OrgOnboarding />
            </ProtectedRoute>
          }
        />
        <Route
          path="/org/:slug/dashboard"
          element={
            <ProtectedRoute>
              <OrgDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/org/:slug/project/new"
          element={
            <ProtectedRoute>
              <ProjectCreate />
            </ProtectedRoute>
          }
        />
        <Route
          path="/org/:slug/project/:projectId"
          element={
            <ProtectedRoute>
              <ProjectDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/org/:slug/bulk/:projectId"
          element={
            <ProtectedRoute>
              <BulkDashboard />
            </ProtectedRoute>
          }
        />

        {/* ── Catch-all redirect ──────────────── */}
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
