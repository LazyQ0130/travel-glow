-- AlterTable
ALTER TABLE "Checkin" ADD COLUMN "deletedAt" DATETIME;

-- AlterTable
ALTER TABLE "Photo" ADD COLUMN "deletedAt" DATETIME;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "username" TEXT,
    "nickname" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "emailVerifiedAt" DATETIME,
    "phoneVerifiedAt" DATETIME,
    "passwordHash" TEXT NOT NULL,
    "avatar" TEXT,
    "bio" TEXT,
    "level" INTEGER NOT NULL DEFAULT 1,
    "exp" INTEGER NOT NULL DEFAULT 0,
    "failedLoginCount" INTEGER NOT NULL DEFAULT 0,
    "lastFailedLoginAt" DATETIME,
    "lockedUntil" DATETIME,
    "deletedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_User" ("avatar", "bio", "createdAt", "email", "emailVerifiedAt", "exp", "id", "level", "nickname", "passwordHash", "phone", "phoneVerifiedAt", "updatedAt", "username") SELECT "avatar", "bio", "createdAt", "email", "emailVerifiedAt", "exp", "id", "level", "nickname", "passwordHash", "phone", "phoneVerifiedAt", "updatedAt", "username" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");
CREATE INDEX "User_deletedAt_idx" ON "User"("deletedAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "Checkin_userId_deletedAt_checkinDate_idx" ON "Checkin"("userId", "deletedAt", "checkinDate");

-- CreateIndex
CREATE INDEX "Checkin_regionId_deletedAt_idx" ON "Checkin"("regionId", "deletedAt");

-- CreateIndex
CREATE INDEX "LoginSession_userId_revokedAt_idx" ON "LoginSession"("userId", "revokedAt");

-- CreateIndex
CREATE INDEX "Photo_userId_deletedAt_createdAt_idx" ON "Photo"("userId", "deletedAt", "createdAt");

-- CreateIndex
CREATE INDEX "Photo_checkinId_deletedAt_idx" ON "Photo"("checkinId", "deletedAt");

-- CreateIndex
CREATE INDEX "VerificationCode_phone_purpose_consumedAt_idx" ON "VerificationCode"("phone", "purpose", "consumedAt");
