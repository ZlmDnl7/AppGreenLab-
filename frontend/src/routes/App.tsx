import React from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "../state/auth";
import { IdleSessionWatcher } from "../components/IdleSessionWatcher";
import { LoginPage } from "./auth/LoginPage";
import { RegisterPage } from "./auth/RegisterPage";
import { ForgotPasswordPage } from "./auth/ForgotPasswordPage";
import { ResetPasswordPage } from "./auth/ResetPasswordPage";
import { AcceptInvitationPage } from "./auth/AcceptInvitationPage";
import { AppLayout } from "./app/AppLayout";
import { DashboardPage } from "./app/DashboardPage";
import { ExperimentsListPage } from "./app/ExperimentsListPage";
import { ExperimentNewPage } from "./app/ExperimentNewPage";
import { ExperimentDetailPage } from "./app/ExperimentDetailPage";
import { ProfilePage } from "./app/ProfilePage";
import { ProjectsListPage } from "./app/ProjectsListPage";
import { ProjectNewPage } from "./app/ProjectNewPage";
import { ProjectDetailPage } from "./app/ProjectDetailPage";
import { ProjectEditPage } from "./app/ProjectEditPage";
import { SupervisionPage } from "./app/SupervisionPage";
import { AdminUsersPage } from "./app/AdminUsersPage";
import { ExperimentEditPage } from "./app/ExperimentEditPage";
import type { UserRole } from "../state/auth";

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { token } = useAuth();
  if (!token) return <Navigate to="/login" replace state={{ authRequired: true }} />;
  return <>{children}</>;
}

function RequireRole({ roles, children }: { roles: UserRole[]; children: React.ReactNode }) {
  const { user } = useAuth();
  if (!user?.role || !roles.includes(user.role)) {
    return <Navigate to="/app/dashboard" replace />;
  }
  return <>{children}</>;
}

export function App() {
  return (
    <>
      <IdleSessionWatcher />
      <Routes>
      <Route path="/" element={<Navigate to="/app/dashboard" replace />} />

      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/forgot" element={<ForgotPasswordPage />} />
      <Route path="/reset" element={<ResetPasswordPage />} />
      <Route path="/invitations/accept" element={<AcceptInvitationPage />} />

      <Route
        path="/app"
        element={
          <RequireAuth>
            <AppLayout />
          </RequireAuth>
        }
      >
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="projects" element={<ProjectsListPage />} />
        <Route path="projects/new" element={<ProjectNewPage />} />
        <Route path="projects/:id/edit" element={<ProjectEditPage />} />
        <Route path="projects/:id" element={<ProjectDetailPage />} />
        <Route path="experiments" element={<ExperimentsListPage />} />
        <Route path="experiments/new" element={<ExperimentNewPage />} />
        <Route
          path="supervision"
          element={
            <RequireRole roles={["TEACHER", "ADMIN"]}>
              <SupervisionPage />
            </RequireRole>
          }
        />
        <Route path="teacher/experiments" element={<Navigate to="/app/supervision" replace />} />
        <Route
          path="admin/users"
          element={
            <RequireRole roles={["ADMIN"]}>
              <AdminUsersPage />
            </RequireRole>
          }
        />
        <Route path="experiments/:id/edit" element={<ExperimentEditPage />} />
        <Route path="experiments/:id" element={<ExperimentDetailPage />} />
        <Route path="profile" element={<ProfilePage />} />
        <Route path="*" element={<Navigate to="/app/dashboard" replace />} />
      </Route>

      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
    </>
  );
}

