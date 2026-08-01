# syntax=docker/dockerfile:1

# ---------- Stage 1: build ----------
FROM node:20-alpine AS build
WORKDIR /app

# Prisma necesita openssl para el engine en Alpine (musl).
RUN apk add --no-cache openssl

# Instala TODAS las dependencias (incluye dev) para poder compilar.
COPY package*.json ./
RUN npm ci

# Genera el Prisma Client (necesita el schema).
COPY prisma ./prisma
RUN npx prisma generate

# Compila TypeScript -> dist/
COPY tsconfig*.json nest-cli.json ./
COPY src ./src
RUN npm run build

# ---------- Stage 2: runtime ----------
FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

RUN apk add --no-cache openssl

# Solo dependencias de producción. Al instalar @prisma/client se dispara el
# postinstall que genera el client; copiamos el schema antes para que funcione.
COPY package*.json ./
COPY prisma ./prisma
RUN npm ci --omit=dev && npm cache clean --force

# Artefactos compilados y entrypoint.
COPY --from=build /app/dist ./dist
COPY docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x docker-entrypoint.sh

# Usuario no-root.
RUN addgroup -S nodejs && adduser -S nestjs -G nodejs \
  && chown -R nestjs:nodejs /app
USER nestjs

# Azure App Service inyecta PORT; el default es 3000.
EXPOSE 3000

ENTRYPOINT ["./docker-entrypoint.sh"]
