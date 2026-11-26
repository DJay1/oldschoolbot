-- BSC tickets: add Player report and Appeal types (TEST DB first; apply on prod at ship with
-- prisma db execute, never db push). Only widens the allowed type list; no rows change.
DO $$
BEGIN
	ALTER TABLE bsc_tickets DROP CONSTRAINT IF EXISTS bsc_tickets_type_check;
	ALTER TABLE bsc_tickets ADD CONSTRAINT bsc_tickets_type_check
		CHECK (type IN ('bug', 'suggestion', 'report', 'appeal'));
END $$;
