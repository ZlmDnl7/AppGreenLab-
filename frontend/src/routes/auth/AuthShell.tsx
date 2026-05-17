import React from "react";
import { Link } from "react-router-dom";
import { Card, CardBody, CardHeader } from "../../components/ui";
import { BrandLogoBlock } from "../../components/BrandLogo";

export function AuthShell({
  title,
  subtitle,
  children,
  showRegisterLink = true
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  showRegisterLink?: boolean;
}) {
  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_120%_80%_at_50%_-20%,theme(colors.brand.100),transparent)] bg-slate-50">
      <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-8 px-5 py-10 lg:grid-cols-2 lg:py-16">
        <div className="hidden lg:block">
          <div className="rounded-3xl border border-slate-200/80 bg-white/90 p-8 shadow-sm backdrop-blur-sm">
            <div className="flex items-center gap-3">
              <BrandLogoBlock />
              <div>
                <div className="text-lg font-semibold tracking-tight text-slate-900">GreenLab Data</div>
                <div className="text-sm text-slate-600">Registro de germinación para aula e investigación</div>
              </div>
            </div>
            <div className="mt-8 space-y-3 text-sm text-slate-600">
              <div className="rounded-2xl border border-slate-100 bg-gradient-to-br from-brand-50/80 to-slate-50 p-4">
                Define el diseño experimental: <span className="font-semibold text-slate-800">Factores → Réplicas → Semillas</span>.
              </div>
              <div className="rounded-2xl border border-slate-100 bg-slate-50/80 p-4">
                Captura datos por semilla: germinación, longitud de raíz e hipocótilo y observaciones.
              </div>
              <div className="rounded-2xl border border-slate-100 bg-slate-50/80 p-4">
                Exporta tablas listas para Excel; el análisis estadístico lo haces fuera de la app.
              </div>
            </div>
          </div>
        </div>

        <Card className="overflow-hidden">
          <CardHeader
            title={title}
            subtitle={subtitle}
            right={
              showRegisterLink ? (
                <Link className="text-sm text-brand-700 hover:underline" to="/register">
                  Crear cuenta
                </Link>
              ) : undefined
            }
          />
          <CardBody>{children}</CardBody>
        </Card>
      </div>
    </div>
  );
}

