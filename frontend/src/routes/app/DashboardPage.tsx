import React, { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Alert, Button, Card, CardBody, CardHeader } from "../../components/ui";

export function DashboardPage() {
  const location = useLocation();
  const nav = useNavigate();
  const [showWelcome, setShowWelcome] = useState(false);

  useEffect(() => {
    const st = location.state as { justRegistered?: boolean } | undefined;
    if (st?.justRegistered) {
      setShowWelcome(true);
      nav(location.pathname, { replace: true, state: {} });
    }
  }, [location.pathname, location.state, nav]);

  return (
    <div className="space-y-5">
      {showWelcome ? <Alert kind="success">Cuenta creada correctamente. Ya puedes usar GreenLab Data.</Alert> : null}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="text-2xl font-semibold">Dashboard</div>
          <div className="text-slate-500">Acceso rápido a tus módulos y experimentos.</div>
        </div>
        <Link to="/app/experiments/new">
          <Button>Nuevo experimento</Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader title="Experimentos" subtitle="Crea y registra datos por semilla." />
          <CardBody>
            <div className="text-sm text-slate-600">
              Define factores (mínimo 3), réplicas por factor y semillas por réplica.
            </div>
            <div className="mt-4">
              <Link to="/app/experiments">
                <Button variant="ghost">Ir a Experimentos</Button>
              </Link>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Exportación" subtitle="Estructura lista para Excel." />
          <CardBody>
            <div className="text-sm text-slate-600">
              Descarga CSV/JSON para análisis estadístico externo (la app no calcula estadísticas).
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Imágenes" subtitle="Carga básica con aceptación/rechazo." />
          <CardBody>
            <div className="text-sm text-slate-600">
              Sube una imagen del experimento, revisa vista previa y marca como aceptada o rechazada.
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

