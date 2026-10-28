import { isBountyStatus, type QualityCheckBountyStatus, qualityCheckCampaign } from '@/lib/qualityChecks/config.js';
import { cleanQualityCheckNote } from '@/lib/qualityChecks/parse.js';

export interface QualityCheckLeaderboardRow {
	userId: string;
	credits: number;
}

export interface StoredBounty {
	itemId: string;
	threadId: string | null;
	starterMessageId: string | null;
	status: QualityCheckBountyStatus;
	claimerId: string | null;
	claimedAt: Date | null;
	reviewerId: string | null;
	reviewNote: string | null;
	evidenceMessageId: string | null;
	updatedAt: Date;
}

function bountyKey(itemId: string) {
	return { campaign_id_item_id: { campaign_id: qualityCheckCampaign.id, item_id: itemId } };
}

function readStatus(status: string): QualityCheckBountyStatus {
	return isBountyStatus(status) ? status : 'open';
}

export async function getQualityCheckCampaign() {
	return prisma.qualityCheckCampaign.findUnique({ where: { id: qualityCheckCampaign.id } });
}

export async function openQualityCheckCampaign(channelId: string) {
	const existing = await getQualityCheckCampaign();
	if (!existing) {
		return prisma.qualityCheckCampaign.create({
			data: {
				id: qualityCheckCampaign.id,
				channel_id: channelId,
				opened_at: new Date(),
				closed_at: null
			}
		});
	}
	return prisma.qualityCheckCampaign.update({
		where: { id: qualityCheckCampaign.id },
		data: {
			channel_id: channelId,
			closed_at: null,
			opened_at: existing.closed_at ? new Date() : existing.opened_at
		}
	});
}

export async function closeQualityCheckCampaignRecord() {
	return prisma.qualityCheckCampaign.update({
		where: { id: qualityCheckCampaign.id },
		data: { closed_at: new Date() }
	});
}

export async function markQualityCheckReminded() {
	await prisma.qualityCheckCampaign.update({
		where: { id: qualityCheckCampaign.id },
		data: { last_reminded_at: new Date() }
	});
}

function toStored(row: {
	item_id: string;
	thread_id: string | null;
	starter_message_id: string | null;
	status: string;
	claimer_id: string | null;
	claimed_at: Date | null;
	reviewer_id: string | null;
	review_note: string | null;
	evidence_message_id: string | null;
	updated_at: Date;
}): StoredBounty {
	return {
		itemId: row.item_id,
		threadId: row.thread_id,
		starterMessageId: row.starter_message_id,
		status: readStatus(row.status),
		claimerId: row.claimer_id,
		claimedAt: row.claimed_at,
		reviewerId: row.reviewer_id,
		reviewNote: row.review_note,
		evidenceMessageId: row.evidence_message_id,
		updatedAt: row.updated_at
	};
}

export async function listQualityCheckBounties(): Promise<StoredBounty[]> {
	const rows = await prisma.qualityCheckBounty.findMany({
		where: { campaign_id: qualityCheckCampaign.id },
		orderBy: { item_id: 'asc' }
	});
	return rows.map(toStored);
}

export async function getQualityCheckBounty(itemId: string): Promise<StoredBounty | null> {
	const row = await prisma.qualityCheckBounty.findUnique({ where: bountyKey(itemId) });
	return row ? toStored(row) : null;
}

export async function saveQualityCheckBounty(input: {
	itemId: string;
	threadId: string | null;
	starterMessageId: string | null;
	status: QualityCheckBountyStatus;
	claimerId: string | null;
	claimedAt: Date | null;
	reviewerId: string | null;
	reviewNote: string | null;
	evidenceMessageId: string | null;
}): Promise<void> {
	const data = {
		thread_id: input.threadId,
		starter_message_id: input.starterMessageId,
		status: input.status,
		claimer_id: input.claimerId,
		claimed_at: input.claimedAt,
		reviewer_id: input.reviewerId,
		review_note: cleanQualityCheckNote(input.reviewNote),
		evidence_message_id: input.evidenceMessageId,
		updated_at: new Date()
	};
	await prisma.qualityCheckBounty.upsert({
		where: bountyKey(input.itemId),
		create: {
			campaign_id: qualityCheckCampaign.id,
			item_id: input.itemId,
			...data
		},
		update: data
	});
}

/**
 * Confirmed credits for one user. Only bounties DJ confirmed (status passed) count.
 * This is the hook a future reward should read.
 */
export async function getQualityCheckPassCount(userId: string, campaignId = qualityCheckCampaign.id): Promise<number> {
	return prisma.qualityCheckBounty.count({
		where: { campaign_id: campaignId, claimer_id: userId, status: 'passed' }
	});
}

export async function getQualityCheckLeaderboard(
	campaignId = qualityCheckCampaign.id,
	limit = 10
): Promise<QualityCheckLeaderboardRow[]> {
	const take = Math.min(25, Math.max(1, Math.floor(limit)));
	const rows = await prisma.$queryRaw<Array<{ user_id: string; credits: number | bigint }>>`
		SELECT claimer_id AS user_id, COUNT(*)::int AS credits
		FROM quality_check_bounty
		WHERE campaign_id = ${campaignId}
			AND status = 'passed'
			AND claimer_id IS NOT NULL
		GROUP BY claimer_id
		ORDER BY credits DESC, claimer_id ASC
		LIMIT ${take}
	`;
	return rows.map(row => ({ userId: row.user_id, credits: Number(row.credits) }));
}
