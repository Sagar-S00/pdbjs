import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger.js';

export const streamApi = {
  async sendMessage(chatInfo, currentUserInfo, messageText, options = {}) {
    const { skip_push = false, skip_enrich_url = false, quoted_message_id = null } = options;

    // Support both old format (with chatChannelInfo) and new format (with cid, channelType, channelId)
    let channelId, channelType, cid, apiKey;

    if (chatInfo.chatChannelInfo) {
      // Old format - for backward compatibility
      channelId = chatInfo.chatChannelInfo.channelID;
      channelType = 'messaging';
      cid = `messaging:${channelId}`;
      apiKey = chatInfo.apiKey || currentUserInfo.apiKey;
    } else {
      // New format - using cid, channelType, channelId directly
      channelId = chatInfo.channelId;
      channelType = chatInfo.channelType || 'messaging';
      cid = chatInfo.cid || `${channelType}:${channelId}`;
      apiKey = chatInfo.apiKey || currentUserInfo.apiKey;
    }

    if (!channelId) {
      throw new Error('Channel ID is required');
    }

    if (!currentUserInfo || !currentUserInfo.token) {
      throw new Error('CurrentUserInfo must contain a valid token');
    }

    if (!apiKey) {
      throw new Error('API key is required');
    }

    const token = currentUserInfo.token;
    const messageId = uuidv4();

    // Use channelType instead of hardcoding "messaging"
    const url = `https://chat.stream-io-api.com/channels/${channelType}/${channelId}/message?api_key=${apiKey}`;

    const headers = {
      'Authorization': `Bearer ${token}`,
      'Stream-Auth-Type': 'jwt',
      'Content-Type': 'application/json',
    };

    const payload = {
      message: {
        attachments: [],
        cid: cid,
        html: '',
        id: messageId,
        mentioned_users: [],
        pinned: false,
        shadowed: false,
        show_in_channel: false,
        silent: false,
        text: messageText,
        thread_participants: [],

        fullAllEmojiCount: 0,
      },
      skip_push: skip_push,
      skip_enrich_url: skip_enrich_url,
    };

    // Add quoted_message_id if provided (for replies)
    if (quoted_message_id) {
      payload.message.quoted_message_id = quoted_message_id;
    }

    logger.debug(`Sending message to channel ${channelId} (${channelType}):`, messageText.substring(0, 50));

    return axios.post(url, payload, { headers })
      .then(response => {
        logger.debug('Message sent successfully');
        return response.data;
      })
      .catch(error => {
        logger.error('Failed to send message:', error.response?.data || error.message);
        throw error;
      });
  },
};
