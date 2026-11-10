-- Additive columns for Golden Corgo catch-all dyes (custom glow/recolour hex + sparkle toggle).
-- Idempotent. Apply with prisma db execute (never prisma db push).

ALTER TABLE bsc_patron_item_dyes
	ADD COLUMN IF NOT EXISTS glow_hex text,
	ADD COLUMN IF NOT EXISTS recolour_hex text,
	ADD COLUMN IF NOT EXISTS sparkle boolean;
