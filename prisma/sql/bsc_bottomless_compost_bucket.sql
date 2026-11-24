-- BSC: Bottomless compost bucket charges. Idempotent. Apply with prisma db execute to the TEST DB only (never prisma db push).
-- Each bucket of Compost, Supercompost, or Ultracompost stored in the bucket becomes 2 uses, capped at 10,000 of one type.

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "bottomless_compost_charges" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "bottomless_compost_type" "CropUpgradeType";

ALTER TABLE "users" DROP CONSTRAINT IF EXISTS chk_bottomless_compost_charges_bounds;
ALTER TABLE "users" ADD CONSTRAINT chk_bottomless_compost_charges_bounds
	CHECK (bottomless_compost_charges >= 0 AND bottomless_compost_charges <= 10000);

ALTER TABLE "users" DROP CONSTRAINT IF EXISTS chk_bottomless_compost_type_consistency;
ALTER TABLE "users" ADD CONSTRAINT chk_bottomless_compost_type_consistency
	CHECK (
		(bottomless_compost_charges = 0 AND bottomless_compost_type IS NULL)
		OR (bottomless_compost_charges > 0 AND bottomless_compost_type IS NOT NULL)
	);
