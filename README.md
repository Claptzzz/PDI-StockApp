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
│   ├── Dockerfile         # build + nginx que sirve el SPA bajo el subpath
│   ├── nginx.conf.template        # plantilla (envsubst) del server nginx
│   ├── proxy-headers.inc          # cabeceras del proxy a la API
│   ├── spa-headers.inc            # COOP/COEP (obligatorias para el login de Google)
│   ├── docker-entrypoint.d/       # genera config.js al arrancar el contenedor
│   ├── public/config.js           # config de RUNTIME (no-op en dev)
│   ├── staticwebapp.config.json   # Azure Static Web Apps
│   ├── vercel.json                # Vercel
│   └── public/_headers,_redirects # Netlify
├── docker-compose.yml         # DEV: Postgres + backend publicados en el host
├── docker-compose.prod.yml    # DESPLIEGUE: db + backend + web, solo `web` expuesto
└── .env.example               # variables para ambos compose (raíz)
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

## docker-compose de desarrollo (`docker-compose.yml`)

Levanta Postgres + el backend construido desde su `Dockerfile`, **publicando ambos
en el host** para poder depurarlos. Sirve para probar la imagen y las migraciones
de forma integrada. **No reemplaza** el flujo de desarrollo (`npm run start:dev`)
ni es el que se usa en el servidor: para eso está
[`docker-compose.prod.yml`](#despliegue-en-servidor-propio-docker-compose).

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
| `FRONTEND_ORIGIN`           |    No     | Origen(es) permitido(s) para CORS, separados por comas. **Obligatorio si el front vive en otro dominio** (Vercel → Azure). Vacío en el despliegue con Docker: mismo origen, sin CORS. |
| `API_PREFIX`                |    No     | Prefijo global de las rutas de la API. Default `api`. `GET /health` queda siempre fuera del prefijo. |
| `SUPABASE_URL`              |    Sí     | URL del proyecto Supabase (Storage).                                        |
| `SUPABASE_SERVICE_ROLE_KEY` |    Sí     | Service role key de Supabase.                                              |
| `SUPABASE_BUCKET`           |    Sí     | Nombre del bucket de evidencia.                                            |

### Frontend (`frontend/.env`)

| Variable                | Requerida | Descripción                                                        |
| ----------------------- | :-------: | ------------------------------------------------------------------ |
| `VITE_API_URL`          |    No     | URL **raíz** del backend, sin `/api` (el cliente añade el prefijo). Si se omite, el SPA llama por ruta relativa al mismo origen (despliegue con nginx). **Se inyecta en build.** |
| `VITE_API_PREFIX`       |    No     | Prefijo de la API en el cliente. Default `api`; **debe coincidir con `API_PREFIX` del backend**. Vacío = backend en la raíz. **Se inyecta en build.** |
| `VITE_GOOGLE_CLIENT_ID` |    No     | Client ID de Google. **Se inyecta en build.** En el despliegue con Docker se prefiere la config de runtime (`config.js`), que no exige reconstruir. |
| `VITE_BASE_PATH`        |    No     | Subpath bajo el que se sirve la app, con barras inicial y final. Default `/` (raíz). El contenedor usa `/inventario/`. **Se inyecta en build.** |

## Despliegue en servidor propio (Docker Compose)

Levanta **toda** la plataforma con un solo comando y la sirve bajo el subpath
`/inventario/`. Pensado para un servidor de la universidad con HTTPS por delante.

### Qué levanta

| Servicio  | Imagen                | Expuesto al host        |
| --------- | --------------------- | ----------------------- |
| `db`      | `postgres:16`         | **No** (red interna)    |
| `backend` | build de `./backend`  | **No** (red interna)    |
| `web`     | build de `./frontend` | Sí, `${APP_PORT}` → 80  |

`web` es un nginx que sirve el SPA **y** hace de proxy a la API, todo bajo el mismo
origen. Por eso no hace falta configurar CORS.

### Requisitos

- Docker 24+ y Docker Compose v2 (`docker compose`, sin guion).
- Un reverse proxy con **HTTPS** por delante (lo gestiona la universidad).
  Sin HTTPS **el login de Google y la cámara no funcionan**: son APIs restringidas
  a contextos seguros.

### Pasos

```bash
cp .env.example .env          # completa los valores (ver tabla más abajo)
docker compose -f docker-compose.prod.yml up -d --build
```

Para ver el estado y los logs:

```bash
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs -f backend
```

Para bajarlo (con `-v` se borra también el volumen de la base):

```bash
docker compose -f docker-compose.prod.yml down
```

### Verificación

Con `APP_PORT=8080`:

```bash
curl -i http://localhost:8080/inventario/api/health     # {"status":"ok"}
curl -I http://localhost:8080/inventario/               # 200, Cache-Control: no-store
curl -I http://localhost:8080/inventario/admin/bodega   # 200 (fallback del SPA, no 404)
curl -I http://localhost:8080/                          # 301 -> /inventario/
```

En el navegador: `http://localhost:8080/inventario/` debe mostrar la pantalla de
login, y recargar una ruta profunda como `/inventario/admin/bodega` no debe dar 404.

### ⚠️ Nota para quien configure el reverse proxy

**La app YA se sirve bajo `/inventario/`.** El proxy debe hacer *pass-through* del
path completo, **sin recortar el prefijo**. Si lo recorta, nginx devolverá 404
porque buscará los archivos fuera del subpath.

nginx (en el servidor de la universidad):

```nginx
location /inventario/ {
    # OJO: proxy_pass SIN path final. Así nginx conserva el URI completo
    # (/inventario/...) en lugar de reescribirlo.
    proxy_pass http://127.0.0.1:8080;

    proxy_http_version 1.1;
    proxy_set_header Host              $host;
    proxy_set_header X-Real-IP         $remote_addr;
    proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;

    client_max_body_size 10M;   # fotos de evidencia
}
```

Apache (`mod_proxy`):

```apache
<Location /inventario/>
    ProxyPass        http://127.0.0.1:8080/inventario/
    ProxyPassReverse http://127.0.0.1:8080/inventario/
    RequestHeader set X-Forwarded-Proto "https"
</Location>
LimitRequestBody 10485760
```

Para servir la app en **otro** subpath, cambia `APP_BASE_PATH` en el `.env` y
reconstruye (`--build`): el prefijo se hornea en el bundle del frontend.

### ⚠️ Google Cloud Console

Hay que registrar el **origen** del dominio final en
*APIs & Services → Credentials → OAuth 2.0 Client ID → Authorized JavaScript origins*:

```
https://midominio.ucn.cl
```

Solo el **origen**: el path (`/inventario/`) no se incluye ni importa. Y debe ser
`https://` — con `http://` el login de Google no cargará.

### Variables de entorno del compose

| Variable                    | Requerida | Default          | Descripción                                                                 |
| --------------------------- | :-------: | ---------------- | --------------------------------------------------------------------------- |
| `APP_PORT`                  |    No     | `8080`           | Puerto publicado en el host. Es el **único** expuesto.                       |
| `APP_BASE_PATH`             |    No     | `/inventario/`   | Subpath de la app, con barras inicial y final. Se hornea en el build.        |
| `APP_MAX_BODY_SIZE`         |    No     | `10M`            | Tamaño máximo de subida (fotos de evidencia).                                |
| `API_PREFIX`                |    No     | `api`            | Prefijo de las rutas de la API en NestJS.                                    |
| `POSTGRES_USER`             |    No     | `pdi`            | Usuario de la base del compose.                                              |
| `POSTGRES_PASSWORD`         |  **Sí**   | —                | Clave de la base. El compose falla si no está.                               |
| `POSTGRES_DB`               |    No     | `pdi`            | Nombre de la base.                                                           |
| `DATABASE_URL`              |    No     | (se arma sola)   | Solo para apuntar a un Postgres **externo** al compose.                      |
| `DIRECT_URL`                |    No     | `DATABASE_URL`   | Conexión directa (sin pooler) para las migraciones.                          |
| `JWT_SECRET`                |  **Sí**   | —                | Secreto para firmar los JWT (`openssl rand -base64 48`).                     |
| `GOOGLE_CLIENT_ID`          |  **Sí**   | —                | Client ID de Google. Lo usan backend y `web` (vía `config.js` en runtime).    |
| `GOOGLE_CLIENT_SECRET`      |    Sí     | —                | Client Secret de Google.                                                      |
| `ADMIN_EMAILS`              |  **Sí**   | —                | Correos con rol ADMIN, separados por comas.                                  |
| `PROFESSOR_EMAILS`          |    No     | vacío            | Correos con rol PROFESSOR fuera del dominio institucional.                   |
| `FRONTEND_ORIGIN`           |    No     | vacío            | Dejar **vacío**: mismo origen, sin CORS.                                      |
| `SUPABASE_URL`              |    Sí     | —                | Proyecto de Supabase (Storage de fotos).                                      |
| `SUPABASE_SERVICE_ROLE_KEY` |    Sí     | —                | Service role key de Supabase.                                                 |
| `SUPABASE_BUCKET`           |    No     | `loan-evidence`  | Bucket de evidencia.                                                          |

### Cambiar el Client ID sin reconstruir

El Client ID de Google se inyecta en **runtime**: el entrypoint del contenedor `web`
genera `config.js` a partir de la variable `GOOGLE_CLIENT_ID`. Basta con editar el
`.env` y reiniciar:

```bash
docker compose -f docker-compose.prod.yml up -d web
```

`config.js` se sirve con `no-store`, así que el cambio se ve en la siguiente recarga.

### Usar un Postgres institucional

Si la universidad provee su propia base, define `DATABASE_URL` y `DIRECT_URL` en el
`.env` apuntando a ella y elimina el servicio `db` (y su `depends_on`) del compose.
El entrypoint del backend seguirá aplicando `prisma migrate deploy` al arrancar.

## ⚠️ Cambio de rutas de la API (Fase 12)

Desde la Fase 12 el backend sirve la API bajo un **prefijo global** (`API_PREFIX`,
por defecto `api`): lo que antes era `GET /courses` ahora es `GET /api/courses`.

- **`GET /health` NO cambió**: sigue respondiendo sin prefijo. Los health checks de
  Azure App Service y el smoke test de `deploy-backend.yml` funcionan igual.
- El frontend añade el mismo prefijo automáticamente (`VITE_API_PREFIX`, default
  `api`), así que **no hay que tocar `VITE_API_URL`**: sigue siendo la URL raíz del
  backend.

**Despliega backend y frontend juntos.** Si actualizas solo uno, el front antiguo
llamaría a las rutas viejas (404) o el nuevo a un backend sin prefijo. Si necesitas
desplegarlos por separado, desactiva el prefijo en ambos lados mientras tanto:
`API_PREFIX=""` en el backend y `VITE_API_PREFIX=""` en el build del frontend.

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