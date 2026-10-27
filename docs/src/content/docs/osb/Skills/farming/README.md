---
title: "Farming"
---

Farming in the bot works like in-game: your minion is sent on planting or harvesting trips, and crops grow in the background. Patch access scales with your quest points, Farming level, and major quest unlocks such as *Children of the Sun*.

When harvesting trees, either:

- Meet the Woodcutting level (and receive logs), or
- Pay a farmer to remove the tree (200gp per tree, or 2000gp per redwood tree; no logs)

Other farming activities:

- [Farming Contracts](farming-contracts)
- [Tithe Farm](tithe-farm)
- [Hespori](farmables#hespori)

---

## Farming Boosts

XP, speed, and harvest quantity can be boosted by the following:

- **Farmer's outfit**
  - Strawhat: +0.4% XP
  - Jacket/Shirt: +0.8% XP
  - Boro trousers: +0.6% XP
  - Boots: +0.2% XP
  - Full set: +2.5% XP **(works from bank)**

- **[Magic secateurs](../../Buyables/buyables#quest-items)** - 10% harvest quantity boost **(works from bank)**
- **Farming cape** - 5% harvest quantity boost **(works from bank)**
- **Full graceful outfit** - 10% trip speed **(must be equipped and charged)**
- **[Ring of endurance](../agility/hallowed-sepulchre#ring-of-endurance)** - 10% trip speed **(must be charged and either equipped or in bank)**
- **Ardougne hard diary** - 4% trip speed when completed
- **Ardougne elite diary** - 4% trip speed when completed

---

## Commands

- [[/farming plant]] – Plant or harvest and replant
- [[/farming harvest]] – Harvest without replanting
- [[/farming check_patches]] – View patch status (includes an Auto Farm button when a patch is ready or can be planted)
- [[/farming auto_farm]] – Run a combined auto-farm trip
- [[/farming auto_farm_filter]] – Choose the auto-farm filter
- [[/farming set_preferred]] – View or set per-patch seed preferences, quantity, and contract priority
- [[/farming default_compost]] – Set the compost tier to auto apply
- [[/farming always_pay]] – Toggle automatic farmer payments

---

## Auto Farming

[[/farming auto_farm]] plans every eligible patch into one Farming trip. Ready patches are harvested and replanted, and empty patches are planted when the filter allows it.

- The trip length is the sum of each patch step, up to the maximum Farming trip length. Patches that would exceed that limit are skipped.
- **All Farm** – [[/farming auto_farm_filter auto_farm_filter_data\:AllFarm]]
  Plants the highest seed in every patch
- **Replant** – [[/farming auto_farm_filter auto_farm_filter_data\:Replant]]
  Replants the same seed in only the patches that had it
  _(Empty other patches using [[/farming harvest]] for better control)_
- [[/farming set_preferred]] can force a seed, choose `highest_available`, skip a patch with `empty`, limit quantity, or prioritise the active farming contract.
- Default compost and the always-pay setting are applied automatically.

See [Auto Farming](auto-farming.md) for the full behaviour.

---

## Compost

- **Compost** – Buy for 400gp: [[/buy name\:Compost]]
- **Supercompost** – Made via [[/farming compost_bin]] or dropped/bought
- **Ultracompost** – Use 2× Volcanic ash + 1× Supercompost:
  [[/create item\:Ultracompost]]

---

## Farming Payment Creatables

Use [[/create]] to make crop protection bundles:

| **Item name**   | **Input items** |
| --------------- | --------------- |
| Tomatoes(5)     | 5 Tomato        |
| Tomato          | Tomatoes(5)     |
| Apples(5)       | 5 Cooking Apple |
| Cooking Apple   | Apples(5)       |
| Bananas(5)      | 5 Banana        |
| Banana          | Bananas(5)      |
| Strawberries(5) | 5 Strawberry    |
| Strawberry      | Strawberries(5) |
| Oranges(5)      | 5 Orange        |
| Orange          | Oranges(5)      |
| Potatoes(10)    | 10 Potato       |
| Potato          | Potatoes(10)    |
| Onions(10)      | 10 Onion        |
| Onion           | Onions(10)      |
| Cabbages(10)    | 10 Cabbage      |
| Cabbage         | Cabbages(10)    |

---

## Patch Unlocks

Patch counts depend on your quest points, Farming level, and quest progression. Unlocks are cumulative unless noted.

| Patch Type | Base patches | Unlocks |
| ---------- | ------------ | ------- |
| Herb | 4 | +1 @ 1 QP (Canifis), +1 @ 10 QP (Troll Stronghold), +1 @ 15 QP (Harmony), +1 @ 31 QP (Weiss), +1 @ 65 Farming (Farming Guild medium), +1 after *Children of the Sun* |
| Tree | 5 | +1 @ 65 Farming (Farming Guild medium), +1 after *Children of the Sun* |
| Allotment | 6 | +2 @ 1 QP (Canifis), +1 @ 15 QP (Harmony), +2 @ 33 QP (Prifddinas), +2 @ 45 Farming (Farming Guild low), +2 after *Children of the Sun* |
| Fruit tree | 4 | +1 @ 22 QP (Lletya), +1 @ 85 Farming (Farming Guild high), +1 after *Children of the Sun* |
| Seaweed | 0 | +2 @ 3 QP (Fossil Island submarine) |
| Flower | 4 | +1 once you unlock Canifis or Prifddinas flower patches, +1 @ 45 Farming (Farming Guild), +1 after *Children of the Sun* |
| Hardwood | 0 | +3 @ 3 QP (Fossil Island), +1 after *Children of the Sun* |
| Vine | 12 | Always available in the Hosidius vinery |
| Bush | 3 | +1 @ 3 QP (Etceteria), +1 @ 45 Farming (Farming Guild low) |
| Hops | 4 | No additional unlocks |
| Mushroom | 0 | +1 @ 1 QP (Canifis) |
| Belladonna | 1 | +1 after *Children of the Sun* |
| Cactus | 1 | +1 @ 45 Farming (Farming Guild low) |
| Hespori | 0 | +1 @ 65 Farming (Farming Guild medium) |
| Calquat | 1 | +1 after *Children of the Sun* |
| Crystal | 0 | +1 @ 33 QP (Prifddinas) |
| Spirit | 1 | +1 @ 91 Farming (Farming Guild high), +3 @ 99 Farming |
| Celastrus | 0 | +1 @ 85 Farming (Farming Guild high) |
| Redwood | 0 | +1 @ 85 Farming (Farming Guild high) |
