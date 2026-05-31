-- Drop phone-based verification codes.
DROP TABLE IF EXISTS "VerificationCode";

-- Remove phone fields from users.
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "username" TEXT,
    "nickname" TEXT NOT NULL,
    "email" TEXT,
    "emailVerifiedAt" DATETIME,
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
INSERT INTO "new_User" ("avatar", "bio", "createdAt", "deletedAt", "email", "emailVerifiedAt", "exp", "failedLoginCount", "id", "lastFailedLoginAt", "level", "lockedUntil", "nickname", "passwordHash", "updatedAt", "username")
SELECT "avatar", "bio", "createdAt", "deletedAt", "email", "emailVerifiedAt", "exp", "failedLoginCount", "id", "lastFailedLoginAt", "level", "lockedUntil", "nickname", "passwordHash", "updatedAt", "username" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE INDEX "User_deletedAt_idx" ON "User"("deletedAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
