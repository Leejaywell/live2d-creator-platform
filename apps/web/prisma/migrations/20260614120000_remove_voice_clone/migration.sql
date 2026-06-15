DROP TABLE IF EXISTS "VoiceCloneRequest";
DROP TYPE IF EXISTS "VoiceCloneStatus";

DELETE FROM "PlatformSetting"
WHERE "category" = 'voice_cloning' OR "key" LIKE 'voiceCloning.%';

ALTER TYPE "PlatformSettingCategory" RENAME TO "PlatformSettingCategory_old";

CREATE TYPE "PlatformSettingCategory" AS ENUM (
  'ai',
  'tts',
  'storage',
  'security',
  'integrations',
  'payments'
);

ALTER TABLE "PlatformSetting"
ALTER COLUMN "category" TYPE "PlatformSettingCategory"
USING ("category"::text::"PlatformSettingCategory");

DROP TYPE "PlatformSettingCategory_old";
