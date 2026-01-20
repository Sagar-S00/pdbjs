import { pdbApi } from '../services/pdbApi.js';
import { logger } from '../utils/logger.js';

/**
 * Register system management commands
 * @param {Client} client - The client instance
 */
export function registerSystemCommands(client) {
  /**
   * Refresh command - Refresh access token
   */
  client.command("refresh", async (ctx) => {
    try {
      logger.debug('Refreshing token...');
      const response = await pdbApi.refreshToken();

      // Print the response (we'll set it later)
      const responseText = `**Token Refresh Response:**\n\`\`\`json\n${JSON.stringify(response, null, 2)}\n\`\`\``;
      await ctx.reply(responseText);

      logger.debug('Token refresh response received');
    } catch (error) {
      logger.error('Failed to refresh token:', error.message);
      await ctx.reply(`❌ Failed to refresh token: ${error.message}`);
    }
  });
}
