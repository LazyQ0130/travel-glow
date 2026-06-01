-- Replace offset-pagination indexes with keyset-pagination friendly indexes.
DROP INDEX IF EXISTS "Checkin_userId_deletedAt_checkinDate_idx";
CREATE INDEX IF NOT EXISTS "Checkin_userId_deletedAt_checkinDate_id_idx" ON "Checkin"("userId", "deletedAt", "checkinDate", "id");

DROP INDEX IF EXISTS "Photo_checkinId_deletedAt_idx";
CREATE INDEX IF NOT EXISTS "Photo_checkinId_deletedAt_createdAt_id_idx" ON "Photo"("checkinId", "deletedAt", "createdAt", "id");
CREATE INDEX IF NOT EXISTS "Photo_checkinId_userId_deletedAt_idx" ON "Photo"("checkinId", "userId", "deletedAt");
