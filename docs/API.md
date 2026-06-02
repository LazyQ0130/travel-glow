# Travel Glow API

Base URL: `/api`

All protected endpoints require:

```text
Authorization: Bearer <jwt>
```

## Response Format

Successful responses return JSON. Errors use:

```json
{
  "message": "Human readable message.",
  "code": "ERROR_CODE",
  "details": {}
}
```

Every response also includes an `X-Request-Id` header.

## Health

- `GET /health` returns process health.
- `GET /ready` checks database connectivity.

## Auth

- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/email/send`
- `POST /auth/login/email`
- `POST /auth/logout`
- `GET /auth/me`
- `GET /auth/sessions`
- `DELETE /auth/sessions/:id`
- `DELETE /auth/sessions/others`

Password registration and password changes require 8 to 72 characters, at least 3 of lowercase letters, uppercase letters, numbers, and symbols, and must not use a known common password. Five failed password login attempts lock the account for 15 minutes.

## User

- `GET /user/profile`
- `PUT /user/profile`
- `POST /user/avatar`
- `POST /user/security/verify-password`
- `POST /user/email/code`
- `PUT /user/email`
- `PUT /user/password`
- `GET /user/settings`
- `PUT /user/settings`
- `GET /user/storage`
- `POST /user/export`
- `DELETE /user/cache`
- `DELETE /user/account`

Account deletion is a soft delete for the user and content records, while active sessions are revoked.

Sensitive account changes require the current password. Email changes use `POST /user/email/code`
to create a verification code in development or send a real SMTP email in production, then
`PUT /user/email` to verify and bind the new email. Password changes accept `revokeOtherSessions`,
which defaults to `true`.

## Regions

- `GET /regions/china/provinces`
- `GET /regions/provinces/:id/cities`
- `GET /regions/continents`
- `GET /regions/continents/:id/countries`
- `GET /regions/search?keyword=`
- `GET /regions/:id/checkins`

## Checkins

- `POST /checkins`
- `GET /checkins`
- `GET /checkins?limit=20`
- `GET /checkins?limit=20&cursor=<nextCursor>`
- `GET /checkins/:id`
- `PUT /checkins/:id`
- `DELETE /checkins/:id`

Without pagination parameters, `GET /checkins` returns the legacy array response. With pagination parameters, it uses cursor-based pagination and returns:

```json
{
  "data": [],
  "pagination": {
    "page": 1,
    "pageSize": 20,
    "nextCursor": null,
    "hasNextPage": false,
    "hasPreviousPage": false,
    "cursor": null,
    "total": null,
    "totalPages": null
  }
}
```

Deletes are soft deletes.

## Photos

- `POST /photos/upload`
- `GET /photos`
- `GET /photos?page=1&pageSize=20`
- `GET /photos/:id`
- `DELETE /photos/:id`

Uploads accept only JPG, PNG, and WEBP files. The server validates extension, MIME type, size, and file signature.

## Stats And Map

- `GET /stats/overview`
- `GET /stats/china`
- `GET /stats/world`
- `GET /map/china/lit-regions`
- `GET /map/world/lit-regions`
