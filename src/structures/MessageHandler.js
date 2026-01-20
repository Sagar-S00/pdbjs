import { CommandContext } from './CommandContext.js';
import { logger } from '../utils/logger.js';

/**
 * Message handler for parsing and executing commands
 */
export class MessageHandler {
  constructor(client, prefix = '!') {
    this.client = client;
    this.prefix = prefix;
  }

  /**
   * Parse command from message text
   * @param {string} text - Message text
   * @returns {[string, string[]]|null} - [commandName, args] or null if not a command
   */
  _parseCommand(text) {
    if (!text || typeof text !== 'string') {
      return null;
    }

    // Check if message starts with prefix
    if (!text.startsWith(this.prefix)) {
      return null;
    }

    // Remove prefix and trim
    const content = text.substring(this.prefix.length).trim();
    if (!content) {
      return null;
    }

    // Split command and args
    const parts = content.split(/\s+/);
    const command = parts[0].toLowerCase();
    const args = parts.slice(1);

    return [command, args];
  }

  /**
   * Handle incoming message and execute command if applicable
   * @param {Object} event - Stream Chat SDK event object
   */
  async handleMessage(event) {
    try {
      // Extract message from Stream Chat SDK event
      const message = event.message;

      if (!message || !message.text) {
        return;
      }

      // Check if message is from bot itself
      const senderId = message.user?.id;
      if (senderId === String(this.client.user?.id) || senderId === String(this.client.userId)) {
        return;
      }

      // Parse command
      const parsed = this._parseCommand(message.text);
      if (!parsed) {
        // Not a command - could emit 'message' event here if needed
        return;
      }

      const [commandName, args] = parsed;

      // Check if command exists
      const commandHandler = this.client.commands.get(commandName);
      if (!commandHandler) {
        return;
      }

      // Create context with Stream Chat SDK event
      const ctx = new CommandContext(this.client, event, commandName, args);

      // Execute command
      try {
        await commandHandler(ctx);
      } catch (error) {
        logger.error(`Error executing command ${commandName}:`, error);
        try {
          await ctx.reply(`❌ Error executing command: ${error.message}`);
        } catch (replyError) {
          logger.error('Failed to send error message:', replyError);
        }
      }
    } catch (error) {
      logger.error('Error in message handler:', error);
    }
  }
}
