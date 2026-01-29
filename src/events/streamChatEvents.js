import { logger } from '../utils/logger.js';
import { streamChatService } from '../services/streamChatService.js';

import { cloudflareAiHandler, checkInvaildLink, imageToTextHandler } from './eventsUtil.js';
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
    var messageText = message.text;
    if (messageText.startsWith("!")) {
        return;
    }

    // Ignore symbol-only or symbol-heavy messages
    const alphaNumericCount = (messageText.match(/[a-zA-Z0-9]/g) || []).length;
    const totalCount = messageText.length;

    // 1. Only symbols (no alphanumeric characters)
    if (alphaNumericCount === 0) {
        return;
    }

    // 2. Too many symbols (if message is long enough to matter)
    // Require at least 40% alphanumeric characters for messages > 5 chars
    if (totalCount > 5 && (alphaNumericCount / totalCount) < 0.4) {
        return;
    }


    if (cloudflareAi.isGhosted(message.user.id)) {
        logger.info(`Ignoring message from ghosted user ${message.user.id}`);
        return;
    }
    const botUserId = streamChatService.client.userID;

    try {

        await checkInvaildLink(event);

        if (message.quoted_message) {

            if (message.quoted_message.user && message.quoted_message.user.id == botUserId) {
                isreply = true;
            }
        }
        const isMentioned = message.mentioned_users && message.mentioned_users.some(user => user.id === botUserId);
        if (isreply || isMentioned) {
            if (message.attachments && message.attachments.length > 0) {
                // console.log(message.attachments);
                await imageToTextHandler(event);
            }
            await cloudflareAiHandler(event);
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
