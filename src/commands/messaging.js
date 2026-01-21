import { pdbApi } from '../services/pdbApi.js';
import { streamChatService } from '../services/streamChatService.js';
import { logger } from '../utils/logger.js';

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
 * Register messaging commands
 * @param {Client} client - The client instance
 */
export function registerMessagingCommands(client) {
  /**
   * Send command - Send a message to a user via Personality Database chat
   * Usage: !send <user_id> <message>
   */

  // client.command("delete", async (ctx) => {
  //   if (!ctx.quotedMessage) {
  //     await ctx.reply('❌ Please reply to a message to delete it.');
  //     return;
  //   }
  //   try {

  //     await streamChatService.deleteMessage(ctx.groupChatID, ctx.quotedMessage.id);
  //     await ctx.reply('✅ Message deleted successfully.');
  //   } catch (error) {
  //     logger.error('Failed to delete message:', error);
  //     await ctx.reply('❌ Failed to delete message.');
  //   }
  // });


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

    logger.debug(`Sending message to user ${targetUserId}: ${messageText.substring(0, 50)}...`);

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
}
