# Imagen de producción de la API de Reverde.
FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY server/package.json ./server/
RUN npm ci --workspaces --include-workspace-root --omit=dev=false
COPY server ./server
RUN npm run build -w @reverde/server

FROM node:24-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
COPY server/package.json ./server/
RUN npm ci --workspaces --include-workspace-root --omit=dev
COPY --from=build /app/server/dist ./server/dist
COPY --from=build /app/server/prisma ./server/prisma
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/node_modules/@prisma ./node_modules/@prisma
EXPOSE 4000
# Las migraciones se aplican al arrancar: el contenedor nunca escribe un
# esquema a mano y `migrate deploy` es idempotente.
CMD ["sh", "-c", "npm run migrate:deploy -w @reverde/server && node server/dist/index.js"]
