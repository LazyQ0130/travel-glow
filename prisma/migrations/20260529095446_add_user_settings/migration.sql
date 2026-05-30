-- CreateTable
CREATE TABLE "UserSettings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "privacyVisibility" TEXT NOT NULL DEFAULT 'private',
    "mapTheme" TEXT NOT NULL DEFAULT 'cyber',
    "glowColor" TEXT NOT NULL DEFAULT 'cyan',
    "defaultHomeTab" TEXT NOT NULL DEFAULT 'home',
    "photoViewMode" TEXT NOT NULL DEFAULT 'timeline',
    "language" TEXT NOT NULL DEFAULT 'zh-CN',
    "distanceUnit" TEXT NOT NULL DEFAULT 'metric',
    "notificationEnabled" BOOLEAN NOT NULL DEFAULT true,
    "checkinReminder" BOOLEAN NOT NULL DEFAULT false,
    "yearlyReport" BOOLEAN NOT NULL DEFAULT true,
    "localCacheLabel" TEXT NOT NULL DEFAULT '本地缓存',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "UserSettings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LoginSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "deviceName" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "lastActiveAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LoginSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "UserSettings_userId_key" ON "UserSettings"("userId");

-- CreateIndex
CREATE INDEX "LoginSession_userId_idx" ON "LoginSession"("userId");
