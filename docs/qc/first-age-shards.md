# First Age shard QC

`/testpotato` is the bot's test spawn command (`src/mahoji/commands/testpotato.ts`). It is registered only when the bot is not running in production. There is no separate admin bank-add command.

Spawn strings use the same bank parser as `/testpotato spawn items:` (`1 Item name` per entry, comma-separated). Sacrifice uses `/sacrifice items:` and then the confirmation prompt. A name with no quantity sacrifices the whole stack, so these sacrifice strings use `1` of each item and leave a spare lumberjack set in the bank.

`/testpotato max` before equipping. The (max) pieces copy gear requirements from their base items.

## Spawn

Paste these three, in order. Together they give 5 uncharged shards, 20 Elder caskets, the 7 base First Age pieces, the 7 (max) pieces, one of every required sacrifice (the first item of each slot), and a second lumberjack set to keep for the double-boost test.

```
/testpotato spawn items:5 Uncharged first age shard, 20 Reward casket (elder), 1 First age tiara, 1 First age amulet, 1 First age cape, 1 First age bracelet, 1 First age ring, 1 First age robe top, 1 First age robe bottom, 1 First age tiara (max), 1 First age amulet (max), 1 First age cape (max), 1 First age bracelet (max), 1 First age ring (max), 1 First age robe top (max), 1 First age robe bottom (max)
```

```
/testpotato spawn items:2 Lumberjack hat, 2 Lumberjack top, 2 Lumberjack legs, 2 Lumberjack boots, 1 Prospector helmet, 1 Prospector jacket, 1 Prospector legs, 1 Prospector boots, 1 Angler hat, 1 Angler top, 1 Angler waders, 1 Angler boots, 1 Pyromancer hood, 1 Pyromancer garb, 1 Pyromancer robe, 1 Pyromancer boots, 1 Farmer's strawhat, 1 Farmer's jacket, 1 Farmer's boro trousers, 1 Farmer's boots, 1 Master farmer hat, 1 Master farmer jacket, 1 Master farmer pants, 1 Master farmer gloves, 1 Master farmer boots
```

```
/testpotato spawn items:1 Blacksmith helmet, 1 Blacksmith top, 1 Blacksmith apron, 1 Blacksmith gloves, 1 Blacksmith boots, 1 Fletcher's hat, 1 Fletcher's top, 1 Fletcher's legs, 1 Fletcher's boots, 1 Fletcher's gloves, 1 Inventors' helmet, 1 Inventors' torso, 1 Inventors' legs, 1 Inventors' gloves, 1 Inventors' boots, 1 Inventors' backpack, 1 Diviner's headwear, 1 Diviner's robe, 1 Diviner's legwear, 1 Diviner's handwear, 1 Diviner's footwear, 1 Rogue mask, 1 Rogue top, 1 Rogue trousers, 1 Rogue gloves, 1 Rogue boots, 1 Carpenter's helmet, 1 Carpenter's shirt, 1 Carpenter's trousers, 1 Carpenter's boots, 1 Hat of the eye, 1 Robe top of the eye, 1 Robe bottoms of the eye, 1 Boots of the eye, 1 Zealot's helm, 1 Zealot's robe top, 1 Zealot's robe bottom, 1 Zealot's boots
```

Elder casket requirements, if you are going to open the caskets rather than only simulate them:

```
/testpotato elder
```

Drop-rate sim (no caskets consumed). Quantity is capped by perk tier; use the highest the command allows:

```
/casket name:Elder quantity:3000
```

## Sacrifice

Full required set. Confirm the prompt. This sacrifices 1 of each required item and leaves 1 lumberjack piece of each kind in the bank.

```
/sacrifice items:1 Lumberjack hat, 1 Lumberjack top, 1 Lumberjack legs, 1 Lumberjack boots, 1 Prospector helmet, 1 Prospector jacket, 1 Prospector legs, 1 Prospector boots, 1 Angler hat, 1 Angler top, 1 Angler waders, 1 Angler boots, 1 Pyromancer hood, 1 Pyromancer garb, 1 Pyromancer robe, 1 Pyromancer boots, 1 Farmer's strawhat, 1 Farmer's jacket, 1 Farmer's boro trousers, 1 Farmer's boots, 1 Master farmer hat, 1 Master farmer jacket, 1 Master farmer pants, 1 Master farmer gloves, 1 Master farmer boots, 1 Blacksmith helmet, 1 Blacksmith top, 1 Blacksmith apron, 1 Blacksmith gloves, 1 Blacksmith boots, 1 Fletcher's hat, 1 Fletcher's top, 1 Fletcher's legs, 1 Fletcher's boots, 1 Fletcher's gloves, 1 Inventors' helmet, 1 Inventors' torso, 1 Inventors' legs, 1 Inventors' gloves, 1 Inventors' boots, 1 Inventors' backpack, 1 Diviner's headwear, 1 Diviner's robe, 1 Diviner's legwear, 1 Diviner's handwear, 1 Diviner's footwear, 1 Rogue mask, 1 Rogue top, 1 Rogue trousers, 1 Rogue gloves, 1 Rogue boots, 1 Carpenter's helmet, 1 Carpenter's shirt, 1 Carpenter's trousers, 1 Carpenter's boots, 1 Hat of the eye, 1 Robe top of the eye, 1 Robe bottoms of the eye, 1 Boots of the eye, 1 Zealot's helm, 1 Zealot's robe top, 1 Zealot's robe bottom, 1 Zealot's boots
```

Missing-list variant. Same list with `1 Pyromancer hood` removed. `/create item:Charged first age shard` must list Pyromancer hood and must not consume a shard or coins.

Coins for one charge (100b). The bank parser accepts `100b`.

```
/testpotato spawn items:100b Coins
```

```
/sacrifice items:1 Lumberjack hat, 1 Lumberjack top, 1 Lumberjack legs, 1 Lumberjack boots, 1 Prospector helmet, 1 Prospector jacket, 1 Prospector legs, 1 Prospector boots, 1 Angler hat, 1 Angler top, 1 Angler waders, 1 Angler boots, 1 Pyromancer garb, 1 Pyromancer robe, 1 Pyromancer boots, 1 Farmer's strawhat, 1 Farmer's jacket, 1 Farmer's boro trousers, 1 Farmer's boots, 1 Master farmer hat, 1 Master farmer jacket, 1 Master farmer pants, 1 Master farmer gloves, 1 Master farmer boots, 1 Blacksmith helmet, 1 Blacksmith top, 1 Blacksmith apron, 1 Blacksmith gloves, 1 Blacksmith boots, 1 Fletcher's hat, 1 Fletcher's top, 1 Fletcher's legs, 1 Fletcher's boots, 1 Fletcher's gloves, 1 Inventors' helmet, 1 Inventors' torso, 1 Inventors' legs, 1 Inventors' gloves, 1 Inventors' boots, 1 Inventors' backpack, 1 Diviner's headwear, 1 Diviner's robe, 1 Diviner's legwear, 1 Diviner's handwear, 1 Diviner's footwear, 1 Rogue mask, 1 Rogue top, 1 Rogue trousers, 1 Rogue gloves, 1 Rogue boots, 1 Carpenter's helmet, 1 Carpenter's shirt, 1 Carpenter's trousers, 1 Carpenter's boots, 1 Hat of the eye, 1 Robe top of the eye, 1 Robe bottoms of the eye, 1 Boots of the eye, 1 Zealot's helm, 1 Zealot's robe top, 1 Zealot's robe bottom, 1 Zealot's boots
```

Use a fresh account, or only one of these two sacrifice commands. Running the full sacrifice and then the missing-list variant will not un-sacrifice the hood.

## Equip

```
/testpotato max
```

```
/gear equip gear_setup:melee items:First age tiara (max), First age amulet (max), First age cape (max), First age bracelet (max), First age ring (max), First age robe top (max), First age robe bottom (max)
```

Remove one piece:

```
/gear unequip gear_setup:melee item:First age robe bottom (max)
```

Put it back:

```
/gear equip gear_setup:melee item:First age robe bottom (max)
```

## QC checklist

- [ ] Elder drop: `/casket name:Elder quantity:3000` (or as high as the sim limit allows) shows Uncharged first age shard at about 1/300. Or `/testpotato elder`, spawn `Reward casket (elder)`, then `/open` (open-until `Uncharged first age shard` works because it is on the casket's item list).
- [ ] `/firstage` shows sacrifice progress. There is no `/firstage activate`.
- [ ] `/create item:Charged first age shard` with sacrifices missing lists what is left (the missing-list sacrifice above should name Pyromancer hood) and does not consume a shard or coins.
- [ ] With every required piece sacrificed, 1 uncharged shard, and 100b coins, `/create item:Charged first age shard` removes 1 uncharged shard and 100b coins and adds 1 Charged first age shard. One charged shard upgrades one piece. The charged icon is the gold shard with purple flecks. The uncharged icon is the same shape in dull grey.
- [ ] `/create item:First age tiara (max)` consumes 1 charged shard and the base tiara, and gives the (max) piece. Repeat for the other six names.
- [ ] Charged shard: trade, gift, GE list, sacrifice, lottery, giveaway, and gamble are all refused.
- [ ] Uncharged shard and the seven (max) pieces can be traded and listed on the GE.
- [ ] Full max set: `/testpotato max`, then equip all 7 (max) pieces on melee. Every skill trip that awards XP says `You received 10% bonus XP for First age outfit items.` That line is still on the "no XP / tracked" message when the skill is already at 5b XP. Woodcutting also says `**Lumberjack bonus:** 2.5% (...) from your First Age (max) set, same as the Lumberjack outfit.` Fishing (Rocktail and the other fishing trips), mining, firemaking, farming, construction, fletching, smithing, runecraft, invention, and divination use that same `**<Outfit> bonus:**` line for their outfit (Angler, Prospector, Pyromancer, Farmer, Carpenter, Fletcher, Blacksmith, Master runecrafter, Inventor, Diviner). Wearing the real outfit as well does not add a second copy: a full Angler outfit plus the set is still 2.5%, not 5%. A clue trip of any tier (beginner, easy, medium, hard, elite, master, grandmaster, or elder) has a 1/15 chance (same roll as Zippy's loot double) to say `Your First Age (max) set **doubled** your clue casket!`. The word doubled is bold, the same markdown as `Zippy has **doubled** your loot.`, and the line has no emoji. That double runs after Zippy and applies to every reward casket already in the loot, including caskets of other tiers Zippy found, so Zippy turning 1 casket into 2 becomes 4 when the set also hits. Mystery boxes and other non-casket loot are left as Zippy left them.
- [ ] `/testpotato elder` collection log includes Saradomin cloak and Zamorak cloak (both the name-resolved ids and vestments 10446 and 10450).
- [ ] 6 of 7: `/gear unequip gear_setup:melee item:First age robe bottom (max)`. The same woodcutting trip loses the lumberjack outfit bonus. The First Age piece XP for the pieces still worn can remain. Equip the robe bottom again and the lumberjack bonus returns.
- [ ] No double boost: wear all 7 (max) pieces and leave 1 Lumberjack hat, 1 Lumberjack top, 1 Lumberjack legs, and 1 Lumberjack boots in the bank (do not equip them). Woodcutting XP and logs match the full max set with no lumberjack in the bank. The lumberjack 2.5% is not applied a second time.

## Follow-up QC (icons, per-piece XP, outfit boosts)

`/testpotato max`, then equip all 7 (max) pieces on **one** setup (melee is fine). Do the XP checks on a skill that is not already 200m, so the First Age line is visible.

- [ ] Icons: tiara, amulet, robe bottom, and bracelet sit in the middle of the head, neck, legs, and hands slots. Cape, robe top, and ring stay as they were. Uncharged shard is grey. Charged shard is the gold shard with purple flecks.
- [ ] Full set: a woodcutting trip's XP line includes the First Age **10%** and the lumberjack **2.5%**. A Wintertodt trip is as fast, and uses as little food, as wearing the 4 pyromancer pieces (the warmth bonus), and the firemaking XP includes the pyromancer 2.5% on top of the First Age 10%.
- [ ] Missing cape: `/gear unequip gear_setup:melee item:First age cape (max)`. Also unequip that cape from every other setup. The next trip says **8%** First Age XP (not 10%). The lumberjack / pyromancer / angler outfit bonus is gone. A First Age cape left only on a different setup does not put the 10% back.
- [ ] No double: with all 7 (max) pieces equipped and the real lumberjack outfit in the bank, woodcutting XP matches the full max set with no lumberjack in the bank. Same idea for Wintertodt if the pyromancer outfit is already worn: warmth is not applied a second time.
