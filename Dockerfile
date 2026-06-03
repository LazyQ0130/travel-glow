FROM node:22-alpine AS dependencies

WORKDIR /app
ENV CI=true
COPY package*.json ./
RUN npm ci && npm cache clean --force

FROM node:22-alpine AS runtime

WORKDIR /app
ENV NODE_ENV=production
ENV RUN_MIGRATIONS_ON_START=true

RUN addgroup -S travelglow && adduser -S travelglow -G travelglow \
  && mkdir -p /data /app/backups /app/logs

COPY --from=dependencies /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate \
  && chmod +x scripts/start.sh \
  && chown -R travelglow:travelglow /app /data

USER travelglow

EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/ready').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["sh", "scripts/start.sh"]
