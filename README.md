# PDI — Plataforma de Préstamo de Kits de Arduino

Plataforma web para gestionar el préstamo de kits de Arduino en la universidad:
grupos de estudiantes, kits con componentes, préstamos adicionales con devolución
y evidencia fotográfica. Autenticación con Google (correo institucional) y roles
STUDENT / PROFESSOR / ADMIN.

## Stack

- **Backend:** NestJS 11 + Prisma 6 + PostgreSQL
- **Frontend:** React 19 + Vite + TypeScript + Tailwind v4 + React Query
- **Auth:** Google Identity Services (idToken) + JWT propio
- **Storage:** Supabase Storage (evidencia de préstamos)

## Arquitectura

```
┌────────────┐        HTTPS (JWT)        ┌────────────┐      ┌──────────────┐
│  Frontend  │ ───────────────────────▶ │  Backend    │ ───▶ │ PostgreSQL   │
│ React/Vite │                          │ NestJS API  │      └──────────────┘
│  (SPA)     │ ◀─── CORS FRONTEND_ORIGIN│             │ ───▶ ┌──────────────┐
└────────────┘                          └────────────┘      │ Supabase     │
      │  Google Identity Services (popup)       │           │ Storage      │
      └────────────────────┬────────────────────┘           └──────────────┘
                           ▼
                    Google OAuth (idToken)
```

- El frontend obtiene un **idToken** de Google y lo envía a `POST /auth/google`.
- El backend valida el idToken, resuelve el rol por allowlist de correos y emite
  un **JWT** propio que la SPA usa en las siguientes llamadas.
- Las migraciones de Prisma se aplican con `prisma migrate deploy` (nunca
  `migrate dev` en producción).

## Estructura del repositorio

```
.
├── backend/               # API NestJS + Prisma
│   ├── Dockerfile         # build multi-stage (imagen de producción)
│   ├── docker-entrypoint.sh
│   └── prisma/
├── frontend/              # SPA React + Vite
│   ├── staticwebapp.config.json   # Azure Static Web Apps
│   ├── vercel.json                # Vercel
│   └── public/_headers,_redirects # Netlify
├── docker-compose.yml     # Postgres + backend (imagen de prod) para pruebas
└── .env.example           # variables para docker-compose (raíz)
```

## Requisitos

- Node.js >= 20
- npm >= 10
- PostgreSQL >= 14 (o Docker, para el flujo de docker-compose)

## Puesta en marcha (desarrollo)

### Backend

```bash
cd backend
cp .env.example .env    # completa las variables
npm install
npx prisma generate
npx prisma migrate deploy   # aplica las migraciones
npm run start:dev
```

La API queda en `http://localhost:3000`. Health check público: `GET /health` → `{ "status": "ok" }`.

### Frontend

```bash
cd frontend
cp .env.example .env    # completa VITE_API_URL y VITE_GOOGLE_CLIENT_ID
npm install
npm run dev
```

> **Importante:** las variables `VITE_*` se **inyectan en tiempo de build**. Si
> cambias `VITE_API_URL` o `VITE_GOOGLE_CLIENT_ID`, hay que reconstruir el
> frontend (`npm run build`); no se leen en runtime.

## Puesta en marcha con docker-compose (imagen de producción)

Levanta Postgres + el backend construido desde su `Dockerfile`. Sirve para probar
la imagen de producción y las migraciones de forma integrada. **No reemplaza** el
flujo de desarrollo (`npm run start:dev`).

```bash
cp .env.example .env    # en la RAÍZ; completa los valores
docker compose up --build
```

- El backend queda en `http://localhost:3000`, Postgres en `localhost:5432`.
- Dentro de la red de compose el host de la DB es `db` (nombre del servicio),
  por eso `DATABASE_URL` usa `@db:5432` y **no** `localhost`.
- El entrypoint corre `prisma migrate deploy` antes de arrancar la app.

Para bajar todo y borrar el volumen de datos:

```bash
docker compose down -v
```

## Variables de entorno

### Backend (`backend/.env`)

| Variable                    | Requerida | Descripción                                                                 |
| --------------------------- | :-------: | --------------------------------------------------------------------------- |
| `NODE_ENV`                  |    No     | `development` \| `production` \| `test`. Default `development`.              |
| `PORT`                      |    No     | Puerto de escucha. Default `3000`. Azure App Service lo inyecta.            |
| `DATABASE_URL`              |    Sí     | Cadena de conexión a PostgreSQL (usada por la app en runtime).             |
| `DIRECT_URL`                |    No     | Conexión directa (sin pooler) para migraciones. Si falta, usa `DATABASE_URL`. |
| `JWT_SECRET`                |    Sí     | Secreto para firmar los JWT. Mínimo 16 caracteres.                          |
| `GOOGLE_CLIENT_ID`          |    Sí     | Client ID de Google OAuth 2.0.                                              |
| `GOOGLE_CLIENT_SECRET`      |    Sí     | Client Secret de Google OAuth 2.0.                                         |
| `ADMIN_EMAILS`              |    Sí     | Correos de administradores, separados por comas.                            |
| `PROFESSOR_EMAILS`          |    No     | Correos con rol PROFESSOR, separados por comas.                             |
| `FRONTEND_ORIGIN`           |    Sí     | Origen(es) permitido(s) para CORS. Lista separada por comas (prod + local). |
| `SUPABASE_URL`              |    Sí     | URL del proyecto Supabase (Storage).                                        |
| `SUPABASE_SERVICE_ROLE_KEY` |    Sí     | Service role key de Supabase.                                              |
| `SUPABASE_BUCKET`           |    Sí     | Nombre del bucket de evidencia.                                            |

### Frontend (`frontend/.env`)

| Variable                | Requerida | Descripción                                                        |
| ----------------------- | :-------: | ------------------------------------------------------------------ |
| `VITE_API_URL`          |    Sí     | URL base del backend. **Se inyecta en build.**                     |
| `VITE_GOOGLE_CLIENT_ID` |    Sí     | Client ID de Google (mismo que el backend). **Se inyecta en build.** |

> No pongas valores reales en `.env.example`; son solo plantillas.

## CI/CD

Los pipelines viven en [.github/workflows/](.github/workflows/). Metodología: **Trunk
Based Development** — ramas de vida corta que se integran a `main` vía PR.

### Workflows

| Workflow                 | Se dispara                                            | Qué hace                                                                                                        |
| ------------------------ | ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| **ci.yml**               | `pull_request` → `main` y `push` a `main`             | Quality gate. Jobs `backend` y `frontend` en paralelo: `npm ci`, lint y build (backend además `prisma generate`). Si falla, no se mergea. |
| **deploy-backend.yml**   | `push` a `main` + `workflow_dispatch` (manual)        | Construye la imagen del backend, la publica en GHCR (`latest` + `sha`) y la despliega en Azure App Service. Termina con un smoke test a `/health`. |
| **keep-alive.yml**       | `cron` cada 3 días + `workflow_dispatch`              | Hace un ping ligero a Supabase Storage para que el proyecto free no se pause por inactividad. No falla si la respuesta no es 200. |

> **Frontend:** Vercel despliega automáticamente en cada push a `main` (integración
> propia de Vercel). El pipeline **no** hace deploy del frontend; solo lo verifica en CI.

### Flujo TBD

```
rama corta  →  PR a main  →  ci.yml en verde  →  merge a main  →  deploy-backend.yml (auto)
```

### Secrets a crear en GitHub

En **Settings → Secrets and variables → Actions → New repository secret**:

| Secret                         | Usado por            | Descripción                                                                       |
| ------------------------------ | -------------------- | --------------------------------------------------------------------------------- |
| `AZURE_WEBAPP_PUBLISH_PROFILE` | deploy-backend.yml   | Publish profile del App Service **PDI-Stock** (XML descargado desde Azure).       |
| `VITE_API_URL`                 | ci.yml (frontend)    | URL base del backend para el build de CI (con dummy fallback si falta).           |
| `VITE_GOOGLE_CLIENT_ID`        | ci.yml (frontend)    | Google Client ID para el build de CI (con dummy fallback si falta).               |
| `SUPABASE_URL`                 | keep-alive.yml       | URL del proyecto Supabase (`https://xxxx.supabase.co`).                            |
| `SUPABASE_SERVICE_ROLE_KEY`    | keep-alive.yml       | Service role key de Supabase.                                                      |

> `GITHUB_TOKEN` lo provee Actions automáticamente (login a GHCR); no hay que crearlo.
> Los secrets de **runtime** del backend (DATABASE_URL, JWT_SECRET, etc.) se configuran
> en el **App Service**, no en GitHub.

## Deploy

### Backend (contenedor)

1. **Construir la imagen** desde `backend/`:

   ```bash
   docker build -t pdi-backend ./backend
   ```

2. **Migraciones**: el `ENTRYPOINT` ejecuta `prisma migrate deploy` en el arranque
   (nunca `migrate dev`). Provee `DATABASE_URL` y, si usas un pooler, `DIRECT_URL`
   con la conexión directa.

3. **Variables de hosting**: define todas las del backend (tabla superior) en el
   proveedor (Azure App Service, Render, Fly, etc.). El contenedor escucha en
   `process.env.PORT` (`0.0.0.0`), que Azure inyecta automáticamente.

### Frontend (SPA estática)

Construye con las `VITE_*` definidas **en el momento del build**:

```bash
cd frontend
npm run build   # genera dist/
```

Sirve `dist/` en cualquier host estático. Se incluyen configs de routing SPA +
cabeceras para los proveedores habituales:

- **Azure Static Web Apps** → `staticwebapp.config.json`
- **Vercel** → `vercel.json`
- **Netlify** → `public/_headers` + `public/_redirects`

> **Login de Google:** el popup de Google Identity Services requiere la cabecera
> `Cross-Origin-Opener-Policy: same-origin-allow-popups` (y `COEP: unsafe-none`).
> Los tres configs anteriores ya la incluyen. Sin ella, el popup de login falla.
> Recuerda además registrar el dominio del frontend en la consola de Google OAuth.
