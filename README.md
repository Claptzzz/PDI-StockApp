# PDI — Plataforma de Préstamo de Kits de Arduino

Plataforma web para gestionar el préstamo de kits de Arduino en la universidad:
grupos de estudiantes, kits con componentes, y préstamos adicionales con
devolución.

## Stack

- **Backend:** NestJS + Prisma + PostgreSQL
- **Frontend:** React + Vite + TypeScript
- **Auth (previsto):** Google OAuth 2.0 + JWT

## Estructura del repositorio

```
.
├── backend/     # API NestJS
└── frontend/    # SPA React + Vite
```

## Requisitos

- Node.js >= 20
- npm >= 10
- PostgreSQL >= 14

## Puesta en marcha

### Backend

```bash
cd backend
cp .env.example .env    # completa las variables
npm install
npx prisma generate
npm run start:dev
```

La API queda disponible en `http://localhost:3000`. Health check: `GET /health`.

### Frontend

```bash
cd frontend
cp .env.example .env    # completa VITE_API_URL
npm install
npm run dev
```

## Estado

Fase 0 — scaffolding. Aún no hay lógica de negocio ni modelos de datos.

## Variables de entorno

Consulta `backend/.env.example` y `frontend/.env.example`.
