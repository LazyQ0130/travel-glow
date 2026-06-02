# Production Configuration

Use `.env.example` as the template for production configuration.

## Required Environment

```env
NODE_ENV=production
PORT=3000
APP_URL=https://your-domain.example

DATABASE_URL="file:/data/travel-glow.db"
JWT_SECRET="replace-with-a-long-random-secret"
JWT_EXPIRES_IN="30d"
CORS_ORIGINS="https://your-domain.example"
TRUST_PROXY=true

EMAIL_PROVIDER=smtp
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-account@example.com
SMTP_PASSWORD=your-smtp-password-or-app-password
SMTP_FROM=your-account@example.com
SMTP_TIMEOUT_MS=10000
EXPOSE_DEV_EMAIL_CODE=false

LOG_LEVEL=info
LOG_DIR=./logs
LOG_FILE=app.log
LOG_MAX_SIZE=10m
LOG_MAX_FILES=30
RUN_MIGRATIONS_ON_START=true
```

## Email Verification

Travel Glow supports two email verification providers:

- `EMAIL_PROVIDER=mock`: local development mode only. It does not send real email.
- `EMAIL_PROVIDER=smtp`: production mode. A plain-text verification email is sent through SMTP.

`devCode` is only returned when `EXPOSE_DEV_EMAIL_CODE=true` and `NODE_ENV` is not `production`. Keep it disabled for real users.

SMTP notes:

- Use `SMTP_SECURE=true` for implicit TLS, usually port `465`.
- Use `SMTP_SECURE=false` for plain SMTP with STARTTLS upgrade, usually port `587`.
- Gmail normally requires 2FA and an App Password.
- QQ Mail and 163 Mail normally require an SMTP authorization code.

## PostgreSQL Notes

The current Prisma datasource provider is `sqlite`, and the Docker Compose
sample persists the SQLite database in the `travel_glow_data` named volume. For
a PostgreSQL production rollout:

1. Change `prisma/schema.prisma` datasource provider from `sqlite` to `postgresql`.
2. Set production `DATABASE_URL` to the PostgreSQL connection string.
3. Regenerate and review migrations against PostgreSQL.
4. Back up data and prepare rollback before applying migrations in production.

## Docker Start

```sh
docker compose up --build
```

The image starts with `scripts/start.sh`. By default it ensures the SQLite file
exists and then runs:

```sh
node scripts/ensure-sqlite-db.js
npx prisma migrate deploy
```

To run migrations separately in CI/CD:

```env
RUN_MIGRATIONS_ON_START=false
```

## Manual Operations

1. Configure SMTP variables in `.env`.
2. If using Gmail, enable 2FA and create an App Password.
3. If using QQ Mail or 163 Mail, enable SMTP and create an authorization code.
4. Send a real verification email before release and confirm delivery.
5. Configure PostgreSQL database, credentials, backup, and network access rules.
6. Configure Nginx reverse proxy.
7. Configure HTTPS certificate and renewal.
8. Configure PM2 or container orchestration restart policy and log collection.
9. Configure firewall rules and expose only required ports.

## Logging

Application logs are written to `LOG_DIR` and ignored by Git. By default the app
uses `./logs/app.log` in development and date-split files such as
`./logs/app-20260601.log` in production. `LOG_MAX_SIZE` controls size rotation;
for example, when `10m` is exceeded the app continues in files such as
`app-20260601.1.log`.

Development logs are also printed to the console in a colored readable format.
Production logs are JSON files only, with no console output.

Use the cleanup script to review old logs before deleting anything:

```sh
npm run logs:cleanup
node scripts/cleanup-logs.js --apply
```

The cleanup script keeps 30 days by default. Set `LOG_RETENTION_DAYS` or pass
`--days=30` to override it.
