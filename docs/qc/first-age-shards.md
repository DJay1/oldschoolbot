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

Missing-list variant. Same list with `1 Pyromancer hood` removed. `/firstage activate` must list Pyromancer hood and must not consume a shard.

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
- [ ] `/firstage` or `/firstage activate` with sacrifices missing lists what is left and does not consume a shard. The missing-list sacrifice command above should name Pyromancer hood.
- [ ] With every required piece in the sacrificed bank and 1 uncharged shard, `/firstage activate` removes the uncharged shard and adds 7 Charged first age shards.
- [ ] `/firstage activate` again, while any charged shard is still in the bank, is refused.
- [ ] `/create item:First age tiara (max)` (and the other six names) consumes 1 charged shard and the matching base piece, and gives the (max) piece. Doing all seven leaves 0 charged shards.
- [ ] Charged shard: trade, gift, GE list, sacrifice, lottery, giveaway, and gamble are all refused.
- [ ] Uncharged shard and the seven (max) pieces can be traded and listed on the GE.
- [ ] Full max set: `/testpotato max`, then equip all 7 (max) pieces on melee. With no lumberjack in the bank, a woodcutting trip gets the lumberjack outfit XP bonus (2.5%) on top of the First Age piece XP.
- [ ] 6 of 7: `/gear unequip gear_setup:melee item:First age robe bottom (max)`. The same woodcutting trip loses the lumberjack outfit bonus. The First Age piece XP for the pieces still worn can remain. Equip the robe bottom again and the lumberjack bonus returns.
- [ ] No double boost: wear all 7 (max) pieces and leave 1 Lumberjack hat, 1 Lumberjack top, 1 Lumberjack legs, and 1 Lumberjack boots in the bank (do not equip them). Woodcutting XP and logs match the full max set with no lumberjack in the bank. The lumberjack 2.5% is not applied a second time.
