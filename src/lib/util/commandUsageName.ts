import { command_name_enum } from '@/prisma/main/enums.js';

const knownCommandNames: ReadonlySet<string> = new Set(Object.values(command_name_enum));

/**
 * The command usage table stores the name as a database enum. New commands that are not in
 * that enum yet (for example a test-only event command) would make the insert fail, so they
 * are simply not logged there.
 */
export function isLoggableCommandName(name: string): name is command_name_enum {
	return knownCommandNames.has(name);
}
