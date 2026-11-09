import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import '@/lib/items/index.js';
import '@/lib/data/itemAliases.js';

import { makeCrackerWhoWonImage } from '@/lib/canvas/crackerImage.js';
import { Bank } from 'oldschooljs';

const winnerItem = process.argv[2] ?? 'Blue partyhat';
const loserItem = process.argv[3] ?? 'Holy symbol';
const outRel = process.argv[4] ?? 'docs/qc/cracker-who-won-preview.png';

const file = await makeCrackerWhoWonImage({
	ownerName: 'DJ',
	otherName: 'Zootr',
	winnerName: 'DJ',
	loserName: 'Zootr',
	winnerLoot: new Bank().add(winnerItem, 1),
	loserLoot: new Bank().add(loserItem, 1)
});
const out = resolve(outRel);
const buf = Buffer.isBuffer(file.buffer) ? file.buffer : Buffer.from(await file.buffer);
writeFileSync(out, buf);
console.log('wrote', out, 'bytes', buf.length, 'winner', winnerItem);

process.exit(0);

