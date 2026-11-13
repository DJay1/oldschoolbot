import { type BaseSendableMessage, sendableMsgToApiCreate } from '@oldschoolgg/discord';
import { describe, expect, test } from 'vitest';

import { MessageBuilderClass } from '@/discord/MessageBuilder.js';

describe('MessageBuilder.build()', () => {
	test('attaches a generated bank image only once when build() is called twice', async () => {
		const image = { name: 'Loot from 54x Tradeable Mystery Box.png', buffer: Buffer.from('loot') };
		const builder = new MessageBuilderClass();
		builder.setContent('You have now opened a total of 54x Tradeable Mystery Box');
		Object.defineProperty(builder, 'bankImagePromise', {
			value: Promise.resolve(image),
			writable: true
		});

		const first = (await builder.build()) as BaseSendableMessage;
		const second = (await builder.build()) as BaseSendableMessage;

		expect(first.files?.filter(Boolean)).toHaveLength(1);
		expect(second.files?.filter(Boolean)).toHaveLength(1);
		expect(second.files?.[0]).toEqual(image);
	});

	test('sendableMsgToApiCreate on the same builder does not send duplicate files', async () => {
		const image = { name: 'Opening (V: 117.9k).png', buffer: Buffer.from('open') };
		const builder = new MessageBuilderClass();
		builder.setContent('Opening boxes');
		Object.defineProperty(builder, 'bankImagePromise', {
			value: Promise.resolve(image),
			writable: true
		});

		const first = await sendableMsgToApiCreate({ msg: builder });
		const second = await sendableMsgToApiCreate({ msg: builder });

		expect(first.files).toHaveLength(1);
		expect(second.files).toHaveLength(1);
		expect(second.files?.[0]?.name).toBe(image.name);
	});
});
