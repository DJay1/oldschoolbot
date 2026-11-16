-- BSC: The Fractured Archive raid. Idempotent. Apply with prisma db execute (never prisma db push).
-- Adds the activity/xp enum values, the minigame KC column, and stats/bank tracking columns.

ALTER TYPE "activity_type_enum" ADD VALUE IF NOT EXISTS 'FracturedArchive';
ALTER TYPE "XpGainSource" ADD VALUE IF NOT EXISTS 'FracturedArchive';

ALTER TABLE "minigames" ADD COLUMN IF NOT EXISTS "fractured_archive" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "clientStorage" ADD COLUMN IF NOT EXISTS "tfa_cost" JSON NOT NULL DEFAULT '{}';
ALTER TABLE "clientStorage" ADD COLUMN IF NOT EXISTS "tfa_loot" JSON NOT NULL DEFAULT '{}';

ALTER TABLE "user_stats" ADD COLUMN IF NOT EXISTS "tfa_attempts" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "user_stats" ADD COLUMN IF NOT EXISTS "tfa_total_minutes" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "user_stats" ADD COLUMN IF NOT EXISTS "tfa_cost" JSON NOT NULL DEFAULT '{}';
ALTER TABLE "user_stats" ADD COLUMN IF NOT EXISTS "tfa_loot" JSON NOT NULL DEFAULT '{}';