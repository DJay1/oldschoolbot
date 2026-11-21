export async function findGroupOfUser(userID: string) {
	const link = await prisma.bscAccountLink.findFirst({
		where: {
			OR: [{ main_id: userID }, { iron_id: userID }]
		}
	});
	if (link) return [link.main_id, link.iron_id];

	const user = await roboChimpClient.user.findUnique({
		where: {
			id: BigInt(userID)
		}
	});
	if (!user || !user.user_group_id) return [userID];
	const group = await roboChimpClient.user.findMany({
		where: {
			user_group_id: user.user_group_id
		}
	});
	if (!group) return [userID];
	return group.map(u => u.id.toString());
}
