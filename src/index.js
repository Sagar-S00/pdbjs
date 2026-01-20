export * from './structures/Client.js';
export * from './structures/Collection.js';
export * from './structures/CommandContext.js';
export * from './structures/MessageHandler.js';
export { registerCommands } from './commands.js';
export { logger } from './utils/logger.js'; 

export const GatewayIntentBits = {
    Guilds: 1,
    GuildMessages: 512,
    MessageContent: 32768,
};
