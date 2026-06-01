# GitHub Actions Workflows

## CI

`ci.yml` runs on pushes to `main` and `develop`, pull requests to `main`, and manual dispatch.

The CI job:

- Uses Node.js 22 with npm cache.
- Retries `npm ci` up to three times to reduce transient registry failures.
- Uses `EMAIL_PROVIDER=mock` so tests never send real verification emails.
- Creates a disposable SQLite database with `prisma migrate deploy` and `prisma:seed`.
- Runs Prisma validation, syntax checks, the test suite, smoke checks, and a Docker build.
- Prints npm, Prisma, and Docker diagnostics when a step fails.

## Deploy

`deploy.yml` runs on pushes to `main` and manual dispatch.

The current deploy job is a production candidate validation and handoff. It checks required
secrets, repeats the same application validation with a disposable SQLite database, and builds
a Docker image. Add registry push, server connection, migration, and service restart steps once
the production infrastructure is ready.

Required repository secrets:

- `APP_URL`
- `CORS_ORIGINS`
- `DATABASE_URL`
- `JWT_SECRET` with at least 32 characters
- `SMTP_HOST`
- `SMTP_USER`
- `SMTP_PASSWORD`
- `SMTP_FROM`

Optional repository secrets:

- `SMTP_PORT`
- `SMTP_SECURE`
- `REGISTRY_URL`
- `DEPLOY_HOST`
- `DEPLOY_USER`
- `DEPLOY_KEY`

## Verification

Run the same checks locally before pushing:

```sh
npm ci
npx prisma generate
npx prisma migrate deploy
npm run prisma:seed
npm run check
docker build --progress=plain -t travel-glow:local .
```
