export interface ItemCopies {
	total: number;
	inBanks: number;
	equipped: number;
	onGrandExchange: number;
}

export async function countItemCopies(itemID: number): Promise<ItemCopies> {
	if (!Number.isInteger(itemID)) throw new Error(`Invalid itemID passed to countItemCopies: ${itemID}`);
	const itemKey = String(itemID);

	const [users] = await prisma.$queryRaw<{ bank_qty: bigint; gear_qty: bigint; pet_qty: bigint }[]>`
SELECT
  COALESCE(SUM(b), 0)::bigint AS bank_qty,
  COALESCE(SUM(g), 0)::bigint AS gear_qty,
  COALESCE(SUM(p), 0)::bigint AS pet_qty
FROM (
  SELECT
    COALESCE((u.bank->>${itemKey})::bigint, 0) AS b,
    (SELECT COALESCE(SUM((s.value->>'quantity')::bigint), 0)
       FROM unnest(ARRAY[u."gear.melee", u."gear.mage", u."gear.range", u."gear.misc", u."gear.skilling", u."gear.wildy", u."gear.fashion", u."gear.other"]) AS setup(gear),
            json_each(COALESCE(setup.gear, '{}'::json)) AS s
      WHERE json_typeof(s.value) = 'object' AND (s.value->>'item')::int = ${itemID}) AS g,
    CASE WHEN u."minion.equippedPet" = ${itemID} THEN 1 ELSE 0 END AS p
  FROM users u
) t;`;

	const [ge] = await prisma.$queryRaw<{ qty: bigint }[]>`
SELECT COALESCE(SUM(quantity), 0)::bigint AS qty FROM ge_bank WHERE item_id = ${itemID};`;

	const inBanks = Number(users.bank_qty);
	const equipped = Number(users.gear_qty) + Number(users.pet_qty);
	const onGrandExchange = Number(ge.qty);
	return { total: inBanks + equipped + onGrandExchange, inBanks, equipped, onGrandExchange };
}
