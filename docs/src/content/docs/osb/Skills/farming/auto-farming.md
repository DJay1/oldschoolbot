---
title: "Auto Farming"
---

Auto farming collects ready patches into a single Farming activity so you can harvest and replant everything without running multiple commands.

## Overview

- [[/farming auto_farm]] checks every patch you have unlocked, harvests ready planted patches, and plants or replants according to your filter and preferences.
- The trip is planned as one continuous Farming activity whose duration equals the sum of each patch step (travel, harvest, replant). Your minion stays out for the full Farming trip length instead of returning after every patch.
- You can also start auto farming from the button on [[/farming check_patches]] when something is ready, or when an empty patch can be planted by **AllFarm**.
- The Auto Farm button can be disabled with the Disable Auto Farm Button user toggle.

## Filters

- **AllFarm** (default) - Plants the best seed you can use in each ready patch, prioritising higher-level crops.
- **Replant** - Only replants patches that already contained that crop and that you still have seeds for. Empty patches stay empty.
- Configure the behaviour with [[/farming auto_farm_filter auto_farm_filter_data:AllFarm]] or [[/farming auto_farm_filter auto_farm_filter_data:Replant]].
- Use [[/farming set_preferred]] for per-patch overrides:
  - Set `quantity` to limit how many patches auto farm plants or replants for that patch type.
  - `seed` to force a specific seed for that patch type
  - `highest_available` to always choose the best available seed for that patch
  - `empty` to skip that patch type entirely
  - `reset_patch` with `patch` to clear one saved patch preference
  - `reset_all` to clear all saved per-patch preferences
- `prefer_contract` prioritises your active farming contract crop when possible.
- When `prefer_contract` is enabled and a valid contract crop is available, that contract patch is scheduled first in the auto-farm trip.
- If the contract crop is already planted and ready, auto farm harvests it and then falls back to your saved patch preference for replanting.

## Trip Planning

- Auto farming respects your maximum Farming trip length. Steps that would exceed the limit are skipped and named in the chat response.
- Each step is timestamped, so the harvesting order in the summary matches the real execution order.
- If your minion is already busy the command will refuse to start.

## Messages

- The start response shows how many patch groups were scheduled, the return time, a **Patches:** list, and an **Items used:** section.
- **Items used:** is grouped into compost, seeds/spores, coins, and other items.
- The completion response combines completed steps into one summary with **XP gained**, crop deaths, boosts, and a loot image.
- Farming, Woodcutting, and Herblore XP gains include XP/hr when those skills gained XP during the trip.

## Resource Handling

- Seeds, compost, farmer payments, and tree removal fees are checked up-front.
- Your [[/farming default_compost]] choice and [[/farming always_pay]] toggle are applied automatically.
- Coins for chopping trees without the required Woodcutting level are reserved (200 gp for most trees, 2,000 gp for redwoods).
- Seed, compost, and protection costs are removed immediately before the trip starts.
- Tree-removal coin costs are deducted up-front, then partially refunded during execution if the estimate was higher than needed.
- If no step can be planned, auto farm returns the first failure reason (for example missing seeds or an unmet requirement).

## Boosts

- Full graceful and a Ring of endurance (equipped or in the bank) stack 10% + 10% trip speed.
- Ardougne hard and elite diaries each grant an additional 4% time reduction.
- The farmer outfit, magic secateurs, and the Farming cape apply the same XP and yield bonuses as manual planting.
- Moondash charm, Scroll of life, Farming master cape, Plopper, and Arcane harvester keep their existing effects.

## Tips

- Keep seed, compost, and protection stocks topped up so auto farming can plan as many patches as the trip length allows.
- Use `Replant` when you want to maintain a static herb run and `AllFarm` when you prefer the best available crop.
- If more patches are ready than the trip length allows, repeat the trip after it finishes to do the remaining patches.
- If there are no farming actions available, auto farm can fall back to repeating your previous non-Farming trip when one is available.
