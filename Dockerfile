# HisaabPro web frontend (app.hisaabpro.in) — build context is repo root.
#   docker build -f Dockerfile -t hisaabpro-web .
FROM node:20-alpine AS build

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Vite bakes VITE_-prefixed vars into the bundle at build time — pass as
# build args in Coolify's build settings, pointed at api.hisaabpro.in.
ARG VITE_API_URL
ARG VITE_APP_ENV
ARG VITE_AUTH_MODE
ARG VITE_TURNSTILE_SITE_KEY
ARG VITE_SENTRY_DSN
ENV VITE_API_URL=$VITE_API_URL \
    VITE_APP_ENV=$VITE_APP_ENV \
    VITE_AUTH_MODE=$VITE_AUTH_MODE \
    VITE_TURNSTILE_SITE_KEY=$VITE_TURNSTILE_SITE_KEY \
    VITE_SENTRY_DSN=$VITE_SENTRY_DSN

RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
RUN printf 'server { listen 80; root /usr/share/nginx/html; location / { try_files $uri /index.html; } }' \
    > /etc/nginx/conf.d/default.conf
EXPOSE 80
