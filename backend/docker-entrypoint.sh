#!/bin/sh
set -e

# Si no hay un pooler, DIRECT_URL puede omitirse: cae a DATABASE_URL.
export DIRECT_URL="${DIRECT_URL:-$DATABASE_URL}"

echo "==> Aplicando migraciones (prisma migrate deploy)..."
npx prisma migrate deploy

echo "==> Iniciando aplicación..."
exec node dist/main
