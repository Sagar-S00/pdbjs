import { pdbApi } from './services/pdbApi.js';
import { streamChatService } from './services/streamChatService.js';
import { logger } from './utils/logger.js';
import * as truthDare from './utils/truthDare.js';

// Cache for user info and chat info
let currentUserInfoCache = null;
const chatInfoCache = new Map();

async function getOrFetchCurrentUserInfo() {
  if (currentUserInfoCache) {
    return currentUserInfoCache;
  }

  return pdbApi.getCurrentUserInfo()
    .then(info => {
      currentUserInfoCache = info;
      return info;
    });
}

async function getOrCreateChatInfo(targetUserId) {
  if (chatInfoCache.has(targetUserId)) {
    return chatInfoCache.get(targetUserId);
  }

  return pdbApi.createChat(targetUserId)
    .then(chatInfo => {
      chatInfoCache.set(targetUserId, chatInfo);
      return chatInfo;
    })
    .catch(error => {
      if (error.statusCode === 404 || error.response?.status === 404) {
        return pdbApi.getChatInfo(targetUserId)
          .then(chatInfo => {
            chatInfoCache.set(targetUserId, chatInfo);
            return chatInfo;
          });
      }
      throw error;
    });
}

/**
 * Register all bot commands with the client
 * 
 * @param {Client} client - The client instance to register commands on
 */
export function registerCommands(client) {
  /**
   * Hello command - Replies with a greeting
   */
  client.command("hello", async (ctx) => {
    // console.log(ctx);
    logger.info(`Executing hello command for ${ctx.senderName}`);
    await ctx.reply(`Hello ${ctx.senderName}! 👋`);
  });

  /**
   * Send command - Send a message to a user via Personality Database chat
   * Usage: !send <user_id> <message>
   */
  client.command("send", async (ctx) => {
    if (ctx.args.length < 2) {
      await ctx.reply('❌ Invalid command. Usage: `!send <user_id> <message>`');
      return;
    }

    const targetUserId = parseInt(ctx.args[0], 10);
    const messageText = ctx.args.slice(1).join(' ');

    if (isNaN(targetUserId)) {
      await ctx.reply('❌ Invalid user ID. Please provide a valid number.');
      return;
    }

    if (!messageText || messageText.trim().length === 0) {
      await ctx.reply('❌ Message cannot be empty.');
      return;
    }

    logger.info(`Sending message to user ${targetUserId}: ${messageText.substring(0, 50)}...`);

    try {
      const chatInfo = await getOrCreateChatInfo(targetUserId);

      // Send message using Stream Chat SDK
      await streamChatService.sendMessage(chatInfo, messageText, {
        skip_push: false,
        skip_enrich_url: false,
      });

      logger.success(`Message sent to ${targetUserId}`);
      await ctx.reply(`✅ Message sent successfully to user ${targetUserId}!`);
    } catch (error) {
      logger.error(`Failed to send message to user ${targetUserId}: `, error.message);

      let errorMessage = `❌ Failed to send message: ${error.message}`;

      if (error.code === 'E403153') {
        errorMessage = `⚠️ User ${targetUserId} is inactive and cannot receive messages.`;
      } else if (error.code === 'E403151') {
        errorMessage = `⚠️ Chat creation limit reached.Cannot create more chat channels.`;
      } else if (error.statusCode === 404 || error.response?.status === 404) {
        errorMessage = `⚠️ Chat not found for user ${targetUserId}.`;
      } else if (error.response?.status === 401) {
        errorMessage = `❌ Authentication failed.Please check your access token.`;
      } else if (error.response?.status === 403) {
        errorMessage = `❌ Forbidden: ${error.message} `;
      }

      await ctx.reply(errorMessage);
    }
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

  /**
   * Refresh command - Refresh access token
   */
  client.command("refresh", async (ctx) => {
    try {
      logger.info('Refreshing token...');
      const response = await pdbApi.refreshToken();

      // Print the response (we'll set it later)
      const responseText = `**Token Refresh Response:**\n\`\`\`json\n${JSON.stringify(response, null, 2)}\n\`\`\``;
      await ctx.reply(responseText);

      logger.info('Token refresh response received');
    } catch (error) {
      logger.error('Failed to refresh token:', error.message);
      await ctx.reply(`❌ Failed to refresh token: ${error.message}`);
    }
  });

  /**
   * Truth command - Get a truth question
   * Usage: !truth [rating]
   * Ratings: PG (default), PG13, R
   */
  client.command("truth", async (ctx) => {
    try {
      // Get rating from arguments, default to PG
      const rating = ctx.args[0]?.toUpperCase() || "PG";

      // Validate rating
      const validRatings = ["PG", "PG13", "R"];
      if (!validRatings.includes(rating)) {
        await ctx.reply(`❌ Invalid rating. Use: PG, PG13, or R`);
        return;
      }

      logger.info(`Fetching truth question with rating: ${rating}`);

      // Fetch truth question
      const truthQuestion = await truthDare.getTruth(rating);

      await ctx.reply(`🤔 **Truth (${rating}):** ${truthQuestion}`);
      logger.success(`Truth question sent with rating: ${rating}`);
    } catch (error) {
      logger.error('Failed to get truth question:', error.message);
      await ctx.reply(`❌ Failed to get truth question: ${error.message}`);
    }
  });

  /**
   * Dare command - Get a dare challenge
   * Usage: !dare [rating]
   * Ratings: PG (default), PG13, R
   */
  client.command("dare", async (ctx) => {
    try {
      // Get rating from arguments, default to PG
      const rating = ctx.args[0]?.toUpperCase() || "PG";

      // Validate rating
      const validRatings = ["PG", "PG13", "R"];
      if (!validRatings.includes(rating)) {
        await ctx.reply(`❌ Invalid rating. Use: PG, PG13, or R`);
        return;
      }

      logger.info(`Fetching dare with rating: ${rating}`);

      // Fetch dare challenge
      const dareChallenge = await truthDare.getDare(rating);

      await ctx.reply(`😈 **Dare (${rating}):** ${dareChallenge}`);
      logger.success(`Dare sent with rating: ${rating}`);
    } catch (error) {
      logger.error('Failed to get dare:', error.message);
      await ctx.reply(`❌ Failed to get dare: ${error.message}`);
    }
  });
}
