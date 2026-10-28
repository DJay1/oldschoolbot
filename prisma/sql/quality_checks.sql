-- Quality-check bounty board.
-- Idempotent so `pnpm exec-sql` can add these tables to an existing Postgres database.
-- Fresh local PGLite databases are created from prisma/schema.prisma (same tables).
-- Tags, env vars, and bounty keys: src/lib/qualityChecks/config.ts
-- status is one of: open, claimed, needs-DJ, passed, failed

CREATE TABLE IF NOT EXISTS "quality_check_campaign" (
    "id" VARCHAR(64) NOT NULL,
    "channel_id" VARCHAR(19) NOT NULL,
    "opened_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closed_at" TIMESTAMP(6),
    "last_reminded_at" TIMESTAMP(6),
    CONSTRAINT "quality_check_campaign_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "quality_check_bounty" (
    "id" SERIAL NOT NULL,
    "campaign_id" VARCHAR(64) NOT NULL,
    "item_id" VARCHAR(64) NOT NULL,
    "thread_id" VARCHAR(19),
    "starter_message_id" VARCHAR(19),
    "status" VARCHAR(16) NOT NULL,
    "claimer_id" VARCHAR(19),
    "claimed_at" TIMESTAMP(6),
    "reviewer_id" VARCHAR(19),
    "review_note" VARCHAR(400),
    "evidence_message_id" VARCHAR(19),
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "quality_check_bounty_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "quality_check_bounty_campaign_id_item_id_key"
ON "quality_check_bounty"("campaign_id", "item_id");

CREATE INDEX IF NOT EXISTS "quality_check_bounty_campaign_id_status_claimer_id_idx"
ON "quality_check_bounty"("campaign_id", "status", "claimer_id");

DO $$
BEGIN
    ALTER TABLE "quality_check_bounty"
        ADD CONSTRAINT "quality_check_bounty_status_check"
        CHECK ("status" IN ('open', 'claimed', 'needs-DJ', 'passed', 'failed'));
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;
