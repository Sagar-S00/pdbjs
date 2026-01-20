import { logger } from '../utils/logger.js';
import { streamChatService } from '../services/streamChatService.js';
import * as cloudflareAi from '../utils/cloudflareAi.js';

/**
 * Stream Chat Event Handlers
 * 
 * Handles various Stream Chat SDK events such as member.added, member.removed, etc.
 */

/**
 * Handle member.added event
 * Sends a welcome message mentioning the new member
 * 
 * @param {Object} event - The member.added event object
 */
async function handleMemberAdded(event) {
    try {
        logger.info(`Member added event: ${event.user.id} joined ${event.cid}`);

        // Extract channel information
        const cid = event.cid; // e.g., "messaging:fun"
        const [channelType, channelId] = cid.split(':');

        // Extract user information
        const newMember = event.member || event.user;
        const userId = newMember.user_id || newMember.id;
        const userName = newMember.user?.name || newMember.name || userId;

        // Create welcome message with proper mention
        const welcomeMessage = `@${userName} welcome to the chat 👋`;

        // Send welcome message to the channel with mentioned_users
        await streamChatService.sendMessage(
            { channelType, channelId },
            welcomeMessage,
            {
                skip_push: false,
                mentioned_users: [userId]
            }
        );

        logger.success(`Welcome message sent to ${userName} in ${cid}`);
    } catch (error) {
        logger.error('Error handling member.added event:', error.message);
    }
}

async function handleMessageNew(event) {
    var isreply = false;
    var message = event.message;
    const botUserId = streamChatService.client.userID;

    try {
        // Check if this is a reply to the bot
        if (message.quoted_message) {
            if (message.quoted_message.user && message.quoted_message.user.id == botUserId) {
                isreply = true;
            }
        }

        // Check if bot is mentioned
        const isMentioned = message.mentioned_users && message.mentioned_users.some(user => user.id === botUserId);

        // If bot is mentioned or replied to, respond with AI
        if (isreply || isMentioned) {
            const logType = isreply ? 'Reply' : 'Mention';
            logger.info(`${logType} detected: ${message.id} from ${message.user.name || message.user.id}`);

            // Extract channel information
            const cid = event.cid; // e.g., "messaging:fun"
            const [channelType, channelId] = cid.split(':');

            // Get user info
            const userName = message.user.name || message.user.id;
            const messageText = message.text || '';

            // Skip if message is empty
            if (!messageText.trim()) {
                return;
            }

            // Add user message to AI thread
            cloudflareAi.addUserMessage(channelId, userName, messageText);

            // Get AI response
            const aiResponse = await cloudflareAi.getResponse(channelId);

            if (aiResponse) {
                // Send AI response to channel
                await streamChatService.replyMessage(
                    channelType,
                    channelId,
                    aiResponse,
                    message.id
                );

                logger.success(`AI response sent to ${channelId}`);
            } else {
                logger.error('Failed to get AI response');
            }
        }
    } catch (error) {
        logger.error('Error handling message.new event:', error.message);
    }
}

/**
 * Register all Stream Chat event handlers
 * 
 * @param {StreamChatService} chatService - The Stream Chat service instance
 */
export function registerStreamChatEvents(chatService) {
    logger.info('Registering Stream Chat event handlers...');

    // Register member.added event handler
    chatService.onEvent('member.added', handleMemberAdded);
    chatService.onEvent('message.new', handleMessageNew);

    logger.success('Stream Chat event handlers registered');
}

/**
 * Export individual handlers for testing or manual use
 */
export const eventHandlers = {
    handleMemberAdded,
    handleMessageNew,
};
