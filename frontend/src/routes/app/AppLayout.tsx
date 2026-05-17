import React, { useEffect } from "react";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth, type UserRole } from "../../state/auth";
import { Button, cx } from "../../components/ui";
import { BrandLogoBlock } from "../../components/BrandLogo";

const ROLE_LABEL: Record<string, string> = {
  STUDENT: "Estudiante",
  TEACHER: "Docente",
  ADMIN: "Administrador",
  RESEARCHER: "Investigador"
};

export function AppLayout() {
  const { user, logout, refreshUser } = useAuth();
  const nav = useNavigate();

  useEffect(() => {
    void refreshUser();
  }, [refreshUser]);

  useEffect(() => {
    const sync = () => {
      if (document.visibilityState === "visible") void refreshUser();
    };
    document.addEventListener("visibilitychange", sync);
    window.addEventListener("focus", sync);
    return () => {
      document.removeEventListener("visibilitychange", sync);
      window.removeEventListener("focus", sync);
    };
  }, [refreshUser]);

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_120%_80%_at_50%_-20%,theme(colors.brand.100),transparent)] bg-slate-50">
      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-0 lg:grid-cols-[280px_1fr]">
        <aside className="border-b border-slate-200/80 bg-white/90 backdrop-blur-sm lg:min-h-screen lg:border-b-0 lg:border-r lg:bg-gradient-to-b lg:from-white lg:to-brand-50/40">
          <div className="flex items-center justify-between gap-3 p-5">
            <Link to="/app/dashboard" className="flex items-center gap-3">
              <BrandLogoBlock size="sm" />
              <div>
                <div className="text-sm font-semibold leading-tight tracking-tight text-slate-900">GreenLab Data</div>
                <div className="text-xs font-medium leading-tight text-brand-800/80">Germinación y diseño experimental</div>
              </div>
            </Link>
            <Button
              variant="ghost"
              onClick={() => {
                logout();
                nav("/login");
              }}
            >
              Salir
            </Button>
          </div>

          <div className="px-3 pb-5">
            <div className="mb-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
              <div className="text-xs text-slate-500">Sesión</div>
              <div className="text-sm font-medium">{user?.name ?? "Usuario"}</div>
              <div className="text-xs text-slate-500">{user?.email ?? ""}</div>
              {user?.role ? (
                <div className="mt-2 inline-block rounded-full border border-brand-100 bg-brand-50 px-2 py-0.5 text-[11px] font-medium text-brand-900">
                  {ROLE_LABEL[user.role] ?? user.role}
                </div>
              ) : null}
            </div>

            <nav className="space-y-1">
              <SideLink to="/app/dashboard" label="Dashboard" />
              <SideLink to="/app/projects" label="Proyectos" />
              <SideLink to="/app/experiments" label="Experimentos" />
              <RoleLinks role={user?.role} />
              <SideLink to="/app/profile" label="Perfil" />
            </nav>
          </div>
        </aside>

        <main className="p-5 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function RoleLinks({ role }: { role?: UserRole }) {
  if (!role) return null;
  return (
    <>
      {(role === "TEACHER" || role === "ADMIN") && <SideLink to="/app/supervision" label="Supervisión" />}
      {role === "ADMIN" && <SideLink to="/app/admin/users" label="Administración" />}
    </>
  );
}

function SideLink({ to, label }: { to: string; label: string }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        cx(
          "block rounded-xl px-4 py-3 text-sm font-medium transition",
          isActive ? "bg-brand-50 text-brand-800 border border-brand-100" : "text-slate-700 hover:bg-slate-100"
        )
      }
    >
      {label}
    </NavLink>
  );
}

