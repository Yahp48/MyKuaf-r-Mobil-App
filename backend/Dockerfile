# Production imajı: docker build -t bibakim-api backend/
FROM node:22-alpine AS build
WORKDIR /app
# prisma generate yalnızca adresin biçimine bakar; derlemede gerçek veritabanı gerekmez.
ENV DATABASE_URL=postgresql://build:build@localhost:5432/build
COPY package.json package-lock.json ./
COPY prisma ./prisma
COPY prisma.config.ts tsconfig.json ./
RUN npm ci
COPY src ./src
RUN npm run build && npm prune --omit=dev

FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /app
RUN addgroup -S app && adduser -S app -G app
COPY --from=build --chown=app:app /app/node_modules ./node_modules
COPY --from=build --chown=app:app /app/dist ./dist
COPY --from=build --chown=app:app /app/prisma ./prisma
COPY --from=build --chown=app:app /app/package.json /app/prisma.config.ts ./
USER app
EXPOSE 5000
HEALTHCHECK --interval=30s --timeout=5s CMD wget -qO- http://127.0.0.1:5000/api/health || exit 1
# Migration'lar dağıtım adımında çalıştırılır: npx prisma migrate deploy
CMD ["node", "dist/server.js"]
