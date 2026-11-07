import { ButtonBuilder, ButtonStyle } from '@oldschoolgg/discord';
import { buttonEmoji } from '@oldschoolgg/toolkit';

import type { ClueTier } from '@/lib/clues/clueTiers.js';
import { InteractionID } from '@/lib/InteractionID.js';

export function makeOpenCasketButton(tier: ClueTier) {
	const name: Uppercase<ClueTier['name']> = tier.name.toUpperCase() as Uppercase<ClueTier['name']>;
	const id = `OPEN_${name}_CASKET`;
	return new ButtonBuilder()
		.setCustomId(id)
		.setLabel(`Open ${tier.name} Casket`)
		.setStyle(ButtonStyle.Secondary)
		.setEmoji(buttonEmoji('Casket'));
}

export function makeOpenSeedPackButton() {
	return new ButtonBuilder()
		.setCustomId(InteractionID.Open.SeedPack)
		.setLabel('Open Seed Pack')
		.setStyle(ButtonStyle.Secondary)
		.setEmoji(buttonEmoji('Seedpack'));
}

export function makeAutoContractButton() {
	return new ButtonBuilder()
		.setCustomId(InteractionID.Commands.AutoFarmingContract)
		.setLabel('Auto Farming Contract')
		.setStyle(ButtonStyle.Secondary)
		.setEmoji(buttonEmoji('Seedpack'));
}

export function makeAutoFarmButton() {
	return new ButtonBuilder()
		.setCustomId(InteractionID.Commands.AutoFarm)
		.setLabel('Auto Farm')
		.setStyle(ButtonStyle.Secondary)
		.setEmoji(buttonEmoji('farming'));
}

export function makeRepeatTripButton() {
	return new ButtonBuilder()
		.setCustomId(InteractionID.Commands.RepeatTrip)
		.setLabel('Repeat Trip')
		.setStyle(ButtonStyle.Secondary)
		.setEmoji({ name: '🔁' });
}

export function makeAutoRummageToggleButton() {
	return new ButtonBuilder()
		.setCustomId(InteractionID.Commands.ToggleAutoRummage)
		.setLabel('Toggle Auto Rummage')
		.setStyle(ButtonStyle.Secondary)
		.setEmoji({ name: '♻️' });
}

export function makeTearsOfGuthixButton() {
	return new ButtonBuilder()
		.setCustomId(InteractionID.Commands.StartTearsOfGuthix)
		.setLabel('Start Tears of Guthix')
		.setStyle(ButtonStyle.Secondary)
		.setEmoji({ name: '🐍' });
}

export function makeBirdHouseTripButton() {
	return new ButtonBuilder()
		.setCustomId(InteractionID.Commands.DoBirdHouseRun)
		.setLabel('Birdhouse Run')
		.setStyle(ButtonStyle.Secondary)
		.setEmoji(buttonEmoji('BirdsNest'));
}

export function makeAutoSlayButton() {
	return new ButtonBuilder()
		.setCustomId(InteractionID.Slayer.AutoSlay)
		.setLabel('Auto Slay')
		.setEmoji(buttonEmoji('slayer'))
		.setStyle(ButtonStyle.Secondary);
}

export function makeClaimDailyButton() {
	return new ButtonBuilder()
		.setCustomId(InteractionID.Commands.ClaimDaily)
		.setLabel('Minion Daily')
		.setStyle(ButtonStyle.Secondary)
		.setEmoji(buttonEmoji('MoneyBag'));
}

export function makeNewSlayerTaskButton() {
	return new ButtonBuilder()
		.setCustomId(InteractionID.Commands.NewSlayerTask)
		.setLabel('New Slayer Task')
		.setStyle(ButtonStyle.Secondary)
		.setEmoji(buttonEmoji('slayer'));
}

export function makeShootingStarButton(size: number) {
	return new ButtonBuilder()
		.setCustomId(InteractionID.Commands.DoShootingStar)
		.setLabel(`Mine Size ${size} Crashed Star`)
		.setEmoji({ name: '⭐' })
		.setStyle(ButtonStyle.Secondary);
}

export function makeTameRepeatTripButton() {
	return new ButtonBuilder()
		.setCustomId(InteractionID.Commands.RepeatTameTrip)
		.setLabel('Repeat Tame Trip')
		.setStyle(ButtonStyle.Secondary);
}

export function makeDonateIcButton(userId: string) {
	return new ButtonBuilder()
		.setStyle(ButtonStyle.Primary)
		.setLabel('Donate IC')
		.setEmoji(buttonEmoji('Item_contract'))
		.setCustomId(`DONATE_IC_${userId}`);
}

export function makeSendICButton(itemName: string) {
	return new ButtonBuilder()
		.setCustomId(InteractionID.Commands.SendItemContract)
		.setLabel(`IC: ${itemName.slice(0, 20)}`)
		.setEmoji(buttonEmoji('Item_contract'))
		.setStyle(ButtonStyle.Secondary);
}

export function makeSpawnLampButton() {
	return new ButtonBuilder()
		.setCustomId(InteractionID.Commands.SpawnLamp)
		.setLabel('Spawn Lamp')
		.setEmoji(buttonEmoji('Huge_lamp'))
		.setStyle(ButtonStyle.Secondary);
}

export function makeFishingContestButton() {
	return new ButtonBuilder()
		.setCustomId(InteractionID.Commands.DoFishingContest)
		.setLabel('Fishing Contest')
		.setEmoji(buttonEmoji('fishing'))
		.setStyle(ButtonStyle.Secondary);
}
