# Imagen migrate de Task-MK (plan-infrastructure, fase 4, tarea 2; §7.7).
# Ejecuta migrate-mongo contra MongoDB y termina. Por defecto: migrate-mongo up.

# node:26-alpine (Node 26.13.1), fijada por digest. La actualiza Dependabot.
FROM node:26-alpine@sha256:6bd9ab43c0ec0190ca7b2d193906cb8b7edf6e7f4afa43ddeccd6452710bffb5 AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts --omit=dev && npm cache clean --force

FROM node:26-alpine@sha256:6bd9ab43c0ec0190ca7b2d193906cb8b7edf6e7f4afa43ddeccd6452710bffb5
ENV NODE_ENV=production
WORKDIR /app
# Ficheros de root y solo lectura para el usuario node: la imagen no modifica su código.
COPY --from=deps /app/node_modules ./node_modules
COPY migrate-mongo-config.js ./
COPY migrations/ ./migrations/
USER node
ENTRYPOINT ["/app/node_modules/.bin/migrate-mongo"]
CMD ["up"]
