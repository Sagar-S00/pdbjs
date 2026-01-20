import { logger } from '../utils/logger.js';

/**
 * Register basic utility commands
 * @param {Client} client - The client instance
 */
export function registerBasicCommands(client) {
  /**
   * Hello command - Replies with a greeting
   */
  client.command("hello", async (ctx) => {
    logger.debug(`Executing hello command for ${ctx.senderName}`);
    await ctx.reply(`Hello ${ctx.senderName}! 👋`);
  });

  /**
   * Ping command - Check if bot is alive
   */
  client.command("ping", async (ctx) => {
    await ctx.reply("Pong! 🏓");
  });

  /**
   * Help command - Show available commands
   */
  client.command("help", async (ctx) => {
    const commands = Array.from(ctx.client.commands.keys());
    const helpText = `**📋 Available Commands **\n\n` +
      commands.map(cmd => `\`!${cmd}\``).join(', ') +
      `\n\nUse \`!help <command>\` for more info about a specific command.`;
    await ctx.reply(helpText);
  });
}
