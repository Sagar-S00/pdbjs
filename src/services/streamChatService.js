import { StreamChat } from 'stream-chat';
import { logger } from '../utils/logger.js';

/**
 * Stream Chat Service
 * 
 * Replaces the custom pdbWebSocket.js and streamApi.js with the official Stream Chat SDK.
 * Provides simplified interface for connecting, sending, and receiving messages.
 */
class StreamChatService {
    constructor() {
        this.client = null;
        this.user = null;
        this.isConnected = false;
        this.messageCallbacks = [];
        this.channels = new Map(); // Cache channels by cid
    }

    /**
     * Connect to Stream Chat using user credentials
     * @param {Object} userInfo - User info from pdbApi.getCurrentUserInfo()
     * @returns {Promise<Object>} Connected user object
     */
    async connect(userInfo) {
        if (this.isConnected) {
            logger.warn('Already connected to Stream Chat');
            return this.user;
        }

        try {
            logger.debug(`Connecting to Stream Chat as user ${userInfo.id}...`);

            // Initialize Stream Chat client
            // allowServerSideConnect: true is set because this is a server-side bot
            this.client = StreamChat.getInstance(userInfo.apiKey, {
                allowServerSideConnect: true
            });

            // Connect user with token
            this.user = await this.client.connectUser(
                {
                    id: String(userInfo.id),     // required
                    name: userInfo.name,         // optional
                    image: userInfo.imageUrl     // optional (avatar URL)
                },
                userInfo.token
            );

            this.isConnected = true;
            logger.success(`Connected to Stream Chat as ${userInfo.id}`);

            // Set up global message listener
            this.setupMessageListener();

            return this.user;
        } catch (error) {
            logger.error('Failed to connect to Stream Chat:', error.message);
            throw error;
        }
    }

    /**
     * Set up global message listener
     * @private
     */
    setupMessageListener() {
        if (!this.client) return;


        this.client.on('message.new', (event) => {
            this.messageCallbacks.forEach(callback => {
                try {
                    callback(event);
                } catch (error) {
                    logger.error('Error in message callback:', error);
                }
            });
        });

        logger.debug('Message listener set up');
    }

    /**
     * Register a callback for new messages
     * @param {Function} callback - Callback function(event)
     */
    onMessage(callback) {
        if (typeof callback === 'function') {
            this.messageCallbacks.push(callback);
        }
    }

    /**
     * Register a callback for any Stream Chat event
     * @param {string} eventType - Event type (e.g., 'member.added', 'member.removed', 'typing.start')
     * @param {Function} callback - Callback function(event)
     */
    onEvent(eventType, callback) {
        if (!this.client) {
            logger.warn('Cannot register event listener: Not connected to Stream Chat');
            return;
        }

        if (typeof callback !== 'function') {
            logger.error('Event callback must be a function');
            return;
        }

        this.client.on(eventType, (event) => {
            try {
                callback(event);
            } catch (error) {
                logger.error(`Error in ${eventType} event callback:`, error);
            }
        });

        logger.debug(`Registered event listener for: ${eventType}`);
    }

    /**
     * Get or create a channel
     * @param {string} channelType - Channel type (e.g., 'messaging', 'livestream')
     * @param {string} channelId - Channel ID
     * @param {Object} options - Additional channel options
     * @returns {Promise<Channel>} Channel object
     */
    async getChannel(channelType, channelId, options = {}) {
        if (!this.client) {
            throw new Error('Not connected to Stream Chat. Call connect() first.');
        }

        const cid = `${channelType}:${channelId}`;

        // Return cached channel if available
        if (this.channels.has(cid)) {
            return this.channels.get(cid);
        }

        // Get or create channel
        const channel = this.client.channel(channelType, channelId, options);

        // Watch the channel (subscribes to events)
        await channel.watch();

        // Cache the channel
        this.channels.set(cid, channel);

        logger.debug(`Channel ${cid} ready`);
        return channel;
    }

    /**
     * Send a message to a channel
     * Replaces streamApi.sendMessage()
     * 
     * @param {Object} chatInfo - Chat info object
     * @param {string} chatInfo.channelType - Channel type (e.g., 'messaging', 'livestream')
     * @param {string} chatInfo.channelId - Channel ID
     * @param {string} chatInfo.cid - Optional: full cid (e.g., 'messaging:12345')
     * @param {string} messageText - Message text to send
     * @param {Object} options - Additional options
     * @param {boolean} options.skip_push - Skip push notification
     * @param {boolean} options.skip_enrich_url - Skip URL enrichment
     * @param {string} options.quoted_message_id - ID of message being replied to
     * @param {Array<string>} options.mentioned_users - Array of user IDs to mention
     * @returns {Promise<Object>} Sent message object
     */

    async replyMessage(channelType, channelId, messageText, replyToMessageId) {
        if (!this.client) {
            throw new Error('Not connected to Stream Chat. Call connect() first.');
        }
        await this.sendMessage(
            {
                channelType: channelType,
                channelId: channelId,
            },
            messageText,
            {
                skip_push: false,
                skip_enrich_url: false,
                quoted_message_id: replyToMessageId,
            }
        );
    }

    async sendMessage(chatInfo, messageText, options = {}) {
        if (!this.client) {
            throw new Error('Not connected to Stream Chat. Call connect() first.');
        }

        try {
            // Parse chat info (support both old and new formats)
            let channelType, channelId;

            if (chatInfo.chatChannelInfo) {
                // Old format - for backward compatibility
                channelId = chatInfo.chatChannelInfo.channelID;
                channelType = 'messaging';
            } else {
                // New format
                channelType = chatInfo.channelType || 'messaging';
                channelId = chatInfo.channelId;
            }

            if (!channelId) {
                throw new Error('Channel ID is required');
            }

            // Get the channel
            const channel = await this.getChannel(channelType, channelId);

            // Prepare message object
            const messagePayload = {
                text: messageText,
            };

            // Add quoted message if replying
            if (options.quoted_message_id) {
                messagePayload.quoted_message_id = options.quoted_message_id;
            }

            // Add mentioned users if specified
            if (options.mentioned_users && Array.isArray(options.mentioned_users)) {
                messagePayload.mentioned_users = options.mentioned_users;
            }

            // Send the message
            logger.debug(`Sending message to ${channelType}:${channelId}: ${messageText.substring(0, 50)}`);

            const response = await channel.sendMessage(messagePayload, {
                skip_push: options.skip_push || false,
                skip_enrich_url: options.skip_enrich_url || false,
            });

            logger.success(`Message sent successfully to ${channelType}:${channelId}`);
            return response.message;

        } catch (error) {
            logger.error('Failed to send message:', error.message);
            throw error;
        }
    }

    /**
     * Query channels the user is a member of
     * @param {Object} filter - Query filter
     * @param {Object} sort - Sort options
     * @param {Object} options - Additional options
     * @returns {Promise<Array>} Array of channels
     */
    async queryChannels(filter = {}, sort = [{ last_message_at: -1 }], options = {}) {
        if (!this.client) {
            throw new Error('Not connected to Stream Chat. Call connect() first.');
        }

        try {
            const channels = await this.client.queryChannels(filter, sort, {
                watch: true,
                state: true,
                ...options,
            });

            logger.debug(`Found ${channels.length} channels`);
            return channels;
        } catch (error) {
            logger.error('Failed to query channels:', error.message);
            throw error;
        }
    }

    /**
     * Disconnect from Stream Chat
     */
    async disconnect() {
        if (!this.isConnected || !this.client) {
            return;
        }

        try {
            logger.debug('Disconnecting from Stream Chat...');
            await this.client.disconnectUser();
            this.isConnected = false;
            this.client = null;
            this.user = null;
            this.channels.clear();
            this.messageCallbacks = [];
            logger.success('Disconnected from Stream Chat');
        } catch (error) {
            logger.error('Error disconnecting from Stream Chat:', error.message);
            throw error;
        }
    }

    /**
     * Check if connected
     * @returns {boolean}
     */
    get connected() {
        return this.isConnected && this.client !== null;
    }
}

// Export singleton instance
export const streamChatService = new StreamChatService();
