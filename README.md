# GreenLab Data

Aplicación web para **gestión de experimentos de germinación** con diseño experimental (Factores → Réplicas → Semillas), proyectos colaborativos, captura de datos, autenticación y evidencia fotográfica.

## Stack

- **Frontend**: React + TypeScript + Vite + Tailwind
- **Backend**: Node.js + Express + TypeScript
- **DB**: SQLite (archivo local) + Prisma ORM
- **Auth**: JWT (access token) + recuperación de contraseña e invitaciones por correo (SMTP)

## Estructura

- `backend/`: API REST, Prisma, validaciones, subida de imagen, invitaciones
- `frontend/`: UI tipo SaaS, sidebar, flujo guiado, tablas y formularios

## Requisitos

- Node.js 18+ (recomendado 20+)

## Variables de entorno

### Backend (`backend/.env`)

Crear archivo `backend/.env` (ver también `backend/.env.example`):

```env
PORT=4100
DATABASE_URL="file:./dev.db"
JWT_SECRET="dev_super_secret_change_me"
JWT_EXPIRES_IN="7d"
APP_ORIGIN="http://localhost:5175"
APP_PUBLIC_URL="http://localhost:5175"
UPLOAD_DIR="uploads"
```

- `APP_ORIGIN`: debe ser **exactamente** la URL donde abres el front (incluye puerto). Si cambias el puerto en `frontend/vite.config.ts`, actualízalo.
- `APP_PUBLIC_URL`: URL pública del front en los enlaces de correo (**recuperación de contraseña** e **invitaciones a proyectos**). Si no la defines, se usa `APP_ORIGIN`.

**Correo (SMTP):** sin `SMTP_HOST` y `SMTP_FROM` no funcionan la recuperación de contraseña ni el envío de invitaciones (la API responde 503). Define `SMTP_*` según tu proveedor (Gmail, hosting, correo institucional, etc.); hay ejemplos comentados en `backend/.env.example`.

### Frontend (`frontend/.env`)

```env
VITE_API_URL="http://localhost:4100"
```

Debe coincidir con `PORT` del backend.

## Levantar el proyecto (dev)

1) Backend:

```bash
cd backend
npm install
npm run prisma:migrate
npm run dev
```

2) Frontend:

```bash
cd frontend
npm install
npm run dev
```

Abrir `http://localhost:5175` (o el puerto que definas en `frontend/vite.config.ts`; `APP_ORIGIN` debe coincidir exactamente).

## Flujo principal

- Registro / Login / Logout
- Recuperar contraseña (enlace por correo)
- Dashboard, perfil, proyectos y experimentos
- Diseño experimental: factores → réplicas → semillas
- Captura por semilla: germinó, longitudes, observaciones (con autoguardado)
- Supervisión (docente / administrador): consulta de proyectos y experimentos de estudiantes (solo lectura salvo autoría propia)
- Subir imagen del experimento + vista previa + marcar **Aceptar / Rechazar** (ver sección [Imágenes](#imágenes-evidencia-no-medición-automática))
- Exportar datos: CSV por experimento; Excel por proyecto

## Invitaciones a proyectos

El dueño de un proyecto invita colaboradores **por correo electrónico**. Solo se pueden invitar **usuarios ya registrados** en la plataforma; si el correo no existe, la API responde **Usuario no encontrado** y no se envía el mensaje. No se añaden miembros al escribir el correo: la persona debe **aceptar** el enlace del mensaje.

1. En el detalle del proyecto → **Miembros** → correo del usuario registrado → **Enviar invitación**.
2. El invitado recibe un correo con enlace a `/invitations/accept?token=...` (válido **7 días**).
3. Al abrir el enlace ve el nombre del proyecto y quién invitó.
4. Inicia sesión (si hace falta) y acepta para unirse al proyecto.
5. El dueño puede ver **invitaciones pendientes** y **cancelarlas** antes de que expiren.

Requisitos: `SMTP_*` configurado y `APP_PUBLIC_URL` apuntando a la URL real del frontend (en producción, la URL pública, no `localhost`).

## Imágenes: evidencia, no medición automática

Las fotos del experimento **no analizan** raíz, hipocótilo ni germinación. No hay visión por computadora ni extracción automática de medidas desde la imagen.

| Qué hace hoy | Qué no hace |
|--------------|-------------|
| Subir PNG/JPEG/WebP | Medir longitudes desde la foto |
| Vista previa | Detectar si germinó la semilla |
| Marcar manualmente **Aceptar** o **Rechazar** | Rellenar la tabla de datos |

Los **datos numéricos** se capturan en la **tabla de semillas** (entrada manual) y se exportan a CSV/Excel. La imagen sirve como **respaldo visual** del experimento.

## Exportación

**Por experimento** — la API expone `GET /experiments/:id/export` con columnas:

`Factor | Réplica | Semilla | Germinó | Raíz | Hipocótilo | Observaciones`

En la web, **Descargar CSV** genera un archivo **separado por punto y coma (`;`)**, **UTF-8 con BOM** y saltos de línea Windows (`\r\n`), para abrirlo en **Excel en español** sin ajustes manuales.

**Por proyecto** — `GET /projects/:id/export.xlsx` (botón en el detalle del proyecto): consolidado de experimentos del proyecto.
