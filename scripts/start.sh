#!/bin/sh
set -eu

export NODE_ENV="${NODE_ENV:-production}"

if [ "${RUN_MIGRATIONS_ON_START:-true}" = "true" ]; then
  npx prisma migrate deploy
fi

exec node server/start.js
