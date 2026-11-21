import { userMention } from '@oldschoolgg/discord';

import {
	BSC_ACCOUNT_LINK_CONFIRM_MS,
	bscAccountRelinkCooldownMs,
	createAccountLink,
	deleteAccountLink,
	evaluateLinkStart,
	formatLinkStatus,
	getAccountLink,
	getRelinkCooldownRemaining,
	linkRequestMessage,
	linkStartFailureMessage,
	linkSuccessMessage,
	notLinkedStatusMessage,
	unlinkConfirmMessage,
	unlinkSuccessMessage
} from '@/lib/bsc/accountLink.js';

export async function runPatronLink(
	user: MUser,
	interaction: MInteraction,
	targetOption?: MahojiUserOption
): Promise<string> {
	if (!targetOption) return formatLinkStatus(user);

	const target = await mUserFetch(targetOption.user.id);
	const targetMention = userMention(target.id);
	const [actorLink, targetLink, actorCooldownRemainingMs, targetCooldownRemainingMs] = await Promise.all([
		getAccountLink(user.id),
		getAccountLink(target.id),
		getRelinkCooldownRemaining(user.id),
		getRelinkCooldownRemaining(target.id)
	]);
	const decision = evaluateLinkStart({
		actorId: user.id,
		targetId: target.id,
		actorIsIron: user.isIronman,
		targetIsIron: target.isIronman,
		actorLink,
		targetLink,
		actorCooldownRemainingMs,
		targetCooldownRemainingMs
	});
	if (!decision.ok) {
		return linkStartFailureMessage(decision.reason, decision.remainingMs, targetMention);
	}

	await interaction.confirmation({
		content: linkRequestMessage(userMention(user.id), targetMention),
		users: [target.id],
		timeout: BSC_ACCOUNT_LINK_CONFIRM_MS
	});

	const [actorLinkAfter, targetLinkAfter, actorCdAfter, targetCdAfter] = await Promise.all([
		getAccountLink(user.id),
		getAccountLink(target.id),
		getRelinkCooldownRemaining(user.id),
		getRelinkCooldownRemaining(target.id)
	]);
	const again = evaluateLinkStart({
		actorId: user.id,
		targetId: target.id,
		actorIsIron: user.isIronman,
		targetIsIron: target.isIronman,
		actorLink: actorLinkAfter,
		targetLink: targetLinkAfter,
		actorCooldownRemainingMs: actorCdAfter,
		targetCooldownRemainingMs: targetCdAfter
	});
	if (!again.ok) {
		return linkStartFailureMessage(again.reason, again.remainingMs, targetMention);
	}

	await createAccountLink(user.id, target.id);
	return linkSuccessMessage(userMention(user.id), targetMention);
}

export async function runPatronUnlink(user: MUser, interaction: MInteraction): Promise<string> {
	const link = await getAccountLink(user.id);
	if (!link) return notLinkedStatusMessage();
	const otherId = user.id === link.mainId ? link.ironId : link.mainId;
	await interaction.confirmation(unlinkConfirmMessage(userMention(otherId)));
	const deleted = await deleteAccountLink(user.id);
	if (!deleted) return 'That link was already removed.';
	return unlinkSuccessMessage(bscAccountRelinkCooldownMs());
}
