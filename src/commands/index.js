import { registerBasicCommands } from './basic.js';
import { registerMessagingCommands } from './messaging.js';
import { registerGameCommands } from './game.js';
import { registerSystemCommands } from './system.js';
import { registerAdminCommands } from './admin.js';

/**
 * Register all bot commands with the client
 *
 * @param {Client} client - The client instance to register commands on
 */
export function registerCommands(client) {
  registerBasicCommands(client);
  registerMessagingCommands(client);
  registerGameCommands(client);
  registerSystemCommands(client);
  registerAdminCommands(client);
}
