import { streamChatService } from '../services/streamChatService.js';
import { logger } from '../utils/logger.js';

/**
 * Command context for PDB Bot
 * Provides access to message data, command arguments, and reply functionality
 * Works directly with Stream Chat SDK event format
 */
export class CommandContext {
  constructor(client, event, command, args) {
    this.client = client;
    this.event = event;  // Stream Chat SDK event
    this.message = event.message;  // The message object
    this.command = command;
    this.args = args;

    // Extract sender information from SDK format
    this.sender = this.message.user?.id;
    this.senderName = this.message.user?.name || 'Unknown';

    // Extract channel information from SDK event
    this.cid = event.cid;
    this.channelType = event.channel?.type || event.channel_type || 'messaging';
    this.channelId = event.channel?.id || event.channel_id;
    this.messageId = this.message.id;
  }

  /**
   * Reply to the command (sends a message in the same channel)
   * Uses Stream Chat SDK to send the reply
   */
  async reply(text, quotedMessageId = null) {
    try {
      // Validate required channel information
      if (!this.channelId) {
        throw new Error('Channel ID is not available in event');
      }
      if (!this.channelType) {
        throw new Error('Channel type is not available in event');
      }

      // Use message_id as quoted_message_id if not provided
      const replyToMessageId = quotedMessageId || this.messageId;

      // Send message using Stream Chat SDK
      await streamChatService.sendMessage(
        {
          channelType: this.channelType,
          channelId: this.channelId,
        },
        text,
        {
          skip_push: false,
          skip_enrich_url: false,
          quoted_message_id: replyToMessageId,
        }
      );
    } catch (error) {
      logger.error('Failed to send reply:', error);
      throw error;
    }
  }

  /**
   * Send a message (alias for reply)
   */
  async send(text) {
    return this.reply(text);
  }
}
