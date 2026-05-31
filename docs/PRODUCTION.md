# Production Configuration

Use `.env.example` as the template for production configuration.

## Required Environment

```env
NODE_ENV=production
PORT=3000
APP_URL=https://your-domain.example

DATABASE_URL="postgresql://travel_glow:strong-password@db-host:5432/travel_glow?schema=public"
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

LOG_LEVEL=info
RUN_MIGRATIONS_ON_START=true
```

## Email Verification

Travel Glow supports two email verification providers:

- `EMAIL_PROVIDER=mock`: development mode. The API response includes `devCode`.
- `EMAIL_PROVIDER=smtp`: production mode. A plain-text verification email is sent through SMTP.

SMTP notes:

- Use `SMTP_SECURE=true` for implicit TLS, usually port `465`.
- Use `SMTP_SECURE=false` for plain SMTP with STARTTLS upgrade, usually port `587`.
- Gmail normally requires 2FA and an App Password.
- QQ Mail and 163 Mail normally require an SMTP authorization code.

## PostgreSQL Notes

The current Prisma datasource provider is still `sqlite`. For a PostgreSQL production rollout:

1. Change `prisma/schema.prisma` datasource provider from `sqlite` to `postgresql`.
2. Set production `DATABASE_URL` to the PostgreSQL connection string.
3. Regenerate and review migrations against PostgreSQL.
4. Back up data and prepare rollback before applying migrations in production.

## Docker Start

```sh
docker build -t travel-glow .
docker run --env-file .env -p 3000:3000 travel-glow
```

The image starts with `scripts/start.sh`. By default it runs:

```sh
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
