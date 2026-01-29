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
    const isUserAdmin = await ctx.client.isAdmin(ctx.sender);
    const commands = ctx.client.commands;
    const publicCommands = [];
    const adminCommands = [];

    // Define command details (usage and description)
    const commandDetails = {
      'setadmin': { usage: '!setadmin <userId>', desc: 'Add a new admin' },
      'removeadmin': { usage: '!removeadmin <userId>', desc: 'Remove an admin' },
      'adminset': { usage: '!adminset <command>', desc: 'Restrict command to admins' },
      'adminremove': { usage: '!adminremove <command>', desc: 'Remove admin restriction' },
      'setprofile': { usage: '!setprofile', desc: 'Set bot profile (reply to image)' },
      'send': { usage: '!send <userId> <msg>', desc: 'Send a message as bot' },
      'refresh': { usage: '!refresh', desc: 'Refresh API token' },
      'hello': { usage: '!hello', desc: 'Bot says hello' },
      'ping': { usage: '!ping', desc: 'Check bot latency' },
      'help': { usage: '!help', desc: 'Show this help message' },
      'truth': { usage: '!truth', desc: 'Get a truth question' },
      'dare': { usage: '!dare', desc: 'Get a dare challenge' },
      'wyr': { usage: '!wyr', desc: 'Get a "Would You Rather" question' },
      'sendmessage': { usage: '!sendmessage <type> <id> <msg>', desc: 'Send message to channel' },
      'deletemessage': { usage: '!deletemessage <chId> <msgId>', desc: 'Delete a message' },
      'senderrormessage': { usage: '!senderrormessage <chId> <err>', desc: 'Send error log to channel' }
    };

    for (const [name, handler] of commands) {
      // Check if command is admin only
      const isDbAdminOnly = await ctx.client.isCommandAdminOnly(name);
      const isHardcodedAdminOnly = handler.adminOnly === true;

      // Filter out commands that shouldn't be shown or group them
      if (isDbAdminOnly || isHardcodedAdminOnly) {
        if (!commandDetails[name]) continue; // Skip undocumented admin commands if any
        adminCommands.push(name);
      } else {
        publicCommands.push(name);
      }
    }

    let helpText = `🤖 BOT COMMANDS\n\n`;

    // Public Commands
    if (publicCommands.length > 0) {
      helpText += `👤 GENERAL\n`;
      helpText += `──────────────\n`;
      publicCommands.sort().forEach(cmd => {
        const details = commandDetails[cmd] || { usage: `!${cmd}`, desc: 'No description' };
        helpText += `• ${details.usage}\n  ${details.desc}\n\n`;
      });
    }

    // Admin Commands (only show if user is admin)
    if (isUserAdmin && adminCommands.length > 0) {
      helpText += `🛡️ ADMIN\n`;
      helpText += `────────────\n`;
      adminCommands.sort().forEach(cmd => {
        const details = commandDetails[cmd] || { usage: `!${cmd}`, desc: 'No description' };
        helpText += `• ${details.usage}\n  ${details.desc}\n\n`;
      });
    }

    helpText += `⏳ Cooldown: 6 seconds (for non-admins)`;

    await ctx.reply(helpText);
  });
}
