# syntax=docker/dockerfile:1

# ---------- Stage 1: build ----------
FROM node:22-alpine AS build
WORKDIR /app

# Prefijo bajo el que se servirá la app. Se hornea en el bundle (Vite lo usa para
# las URLs de los assets y para el basename del router), así que debe coincidir con
# el que sirva nginx en el stage de runtime.
ARG VITE_BASE_PATH=/inventario/
ENV VITE_BASE_PATH=${VITE_BASE_PATH}

# El Client ID NO se hornea: se inyecta en runtime vía config.js (ver el entrypoint).
# Se deja el ARG por si alguien prefiere el build-time (Vercel lo usa así).
ARG VITE_GOOGLE_CLIENT_ID=""
ENV VITE_GOOGLE_CLIENT_ID=${VITE_GOOGLE_CLIENT_ID}

# VITE_API_URL se deja SIN definir a propósito: el SPA llamará al backend por ruta
# relativa bajo el mismo origen, que nginx redirige. Así no hace falta CORS.

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# ---------- Stage 2: runtime ----------
FROM nginx:alpine AS runtime

ARG VITE_BASE_PATH=/inventario/
ENV APP_BASE_PATH=${VITE_BASE_PATH}
ENV APP_BACKEND_URL=http://backend:3000
ENV APP_MAX_BODY_SIZE=10M

# Limita envsubst a las variables APP_* para que no destroce las de nginx ($uri, $host…).
ENV NGINX_ENVSUBST_FILTER=^APP_

# El dist se coloca bajo el prefijo, de modo que `root` lo resuelve sin alias.
COPY --from=build /app/dist /usr/share/nginx/html${VITE_BASE_PATH}

# La plantilla se procesa con envsubst al arrancar (mecanismo de la imagen oficial).
COPY nginx.conf.template /etc/nginx/templates/default.conf.template
COPY proxy-headers.inc spa-headers.inc /etc/nginx/conf.d/
COPY docker-entrypoint.d/10-app-config.envsh /docker-entrypoint.d/10-app-config.envsh
RUN chmod +x /docker-entrypoint.d/10-app-config.envsh

EXPOSE 80

# Se hereda el ENTRYPOINT de nginx:alpine, que ejecuta /docker-entrypoint.d/* y arranca.
