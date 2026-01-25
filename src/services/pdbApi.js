import { gotScraping } from 'got-scraping';
import { config } from '../config/config.js';
import { logger } from '../utils/logger.js';

// Token storage
let tokenData = {
  accessToken: config.pdb.accessToken || null,
  refreshToken: null,
  expireAt: null,
};

// Callback to trigger on token refresh (for websocket reconnection)
let onTokenRefreshCallbacks = [];

const createApiClient = (options = {}) => {
  const headers = {
    'Host': 'api.personality-database.com',
    'X-Device': config.pdb.deviceToken || 'eyJPUyI6ImFuZHJvaWQiLCJBcHAtVmVyc2lvbiI6IjEuNS40IiwiQXBwLUJ1aWxkTm8iOiI3NzQiLCJNYXJrZXQiOiJHb29nbGVQbGF5IiwiQnJhbmQiOiJhc3VzIiwiTW9kZWwiOiJBU1VTX1gwMFREIiwiQnVuZGxlSUQiOiJtYnRpLnRlc3QubWVudGFsLmhlYWx0aC5wZXJzb25hbGl0eSIsIk1hbnVmYWN0dXJlciI6ImFzdXMiLCJPUy1WZXJzaW9uIjoiOSIsIlNESy1WZXJzaW9uIjoiMjgiLCJYLVBEQi1EZXZpY2UtSUQiOiI2YWU4YmM4MS1hNzdlLTRiZjEtYTEzMC1hYTc4NTQ1NGQwMzEifQ==',
    'X-Region': config.pdb.region || 'IN',
    'X-Locale': config.pdb.locale || 'en',
    'X-Locale-Settings': config.pdb.locale || 'en',
    'X-TZ-Database-Name': config.pdb.timezone || 'Asia/Kolkata',
    'Accept': '*/*',
    'Accept-Language': `${config.pdb.locale || 'en'}-${config.pdb.region || 'IN'},${config.pdb.locale || 'en'};q=0.9`,
    'Accept-Encoding': 'gzip, deflate, br',
    'User-Agent': 'PDB/2625 CFNetwork/3860.200.71 Darwin/25.1.0',
    'Connection': 'keep-alive',
    'Content-Type': 'application/json',
  };

  // Add Authorization header if not explicitly disabled
  if (!options.noAuth && tokenData.accessToken) {
    headers['Authorization'] = `Bearer ${tokenData.accessToken}`;
  }

  // Allow custom authorization (for refresh token)
  if (options.customAuth) {
    headers['Authorization'] = options.customAuth;
  }

  return gotScraping.extend({
    prefixUrl: config.pdb.baseUrl,
    headers,
    responseType: 'json',
    http2: true,
    timeout: {
      request: 30000,
    },
    retry: {
      limit: 2,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'HEAD', 'OPTIONS'],
      statusCodes: [408, 413, 429, 500, 502, 503, 504, 521, 522, 524],
      errorCodes: [
        'ETIMEDOUT',
        'ECONNRESET',
        'EADDRINUSE',
        'ECONNREFUSED',
        'EPIPE',
        'ENOTFOUND',
        'ENETUNREACH',
        'EAI_AGAIN'
      ],
      maxRetryAfter: undefined,
      calculateDelay: ({ attemptCount }) => {
        // Exponential backoff: 1000ms, 2000ms
        return Math.min(1000 * (2 ** (attemptCount - 1)), 5000);
      }
    },
  });
};

// Check if token is expired or about to expire (within 1 hour)
const isTokenExpired = () => {
  if (!tokenData.expireAt) {
    return false; // If no expireAt, assume it's not expired
  }
  const now = Date.now();
  const expiryBuffer = 3600000; // 1 hour buffer (in milliseconds)
  return now >= (tokenData.expireAt - expiryBuffer);
};

// Refresh access token if expired
const ensureValidToken = async () => {
  if (isTokenExpired() && tokenData.refreshToken) {
    logger.info('Access token expired, refreshing...');
    try {
      const refreshedData = await pdbApi.refreshToken();
      if (refreshedData?.data) {
        tokenData.accessToken = refreshedData.data.accessToken;
        tokenData.refreshToken = refreshedData.data.refreshToken;
        tokenData.expireAt = refreshedData.data.expireAt;
        logger.info('Token refreshed successfully');

        // Save refreshed tokens to config
        const { saveConfig } = await import('../config/config.js');
        saveConfig({
          pdb: {
            accessToken: refreshedData.data.accessToken,
            refreshToken: refreshedData.data.refreshToken,
            expireAt: refreshedData.data.expireAt,
          },
        });
        logger.info('Refreshed tokens saved to config');

        // Trigger websocket reconnection callbacks
        for (const callback of onTokenRefreshCallbacks) {
          try {
            await callback(refreshedData.data);
          } catch (callbackError) {
            logger.error('Token refresh callback error:', callbackError);
          }
        }
      }
    } catch (error) {
      logger.error('Failed to refresh token:', error);
      throw new Error('Token refresh failed');
    }
  }
};

export const pdbApi = {
  /**
   * Send verification code to email for login/signup
   * @param {string} email - User's email address
   * @returns {Promise<{email: string, isNewUser: boolean}>}
   */
  async sendDigits(email) {
    const client = createApiClient({ noAuth: true });
    const response = await client.post('oauth/email/send_digits', {
      json: { email },
    });

    const data = response.body?.data;
    if (!data) {
      throw new Error('Invalid response: missing data field');
    }

    return {
      email: data.email,
      isNewUser: data.isNewUser,
    };
  },

  /**
   * Login with email and verification code
   * @param {string} email - User's email address
   * @param {string} code - Verification code received via email
   * @param {string} device - Device type (default: 'android')
   * @returns {Promise<Object>} - Complete login response with user info and tokens
   */
  async login(email, code, device = 'android') {
    const client = createApiClient({ noAuth: true });
    const response = await client.post('oauth/email/login', {
      json: {
        email,
        code,
        device,
      },
    });

    const data = response.body?.data;
    if (!data) {
      throw new Error('Invalid response: missing data field');
    }

    // Store tokens
    if (data.accessToken) {
      tokenData.accessToken = data.accessToken;
      tokenData.refreshToken = data.refreshToken;
      tokenData.expireAt = data.expireAt;

      logger.info('Login successful, tokens stored');


    }

    return {
      user: data.user,
      auth: data.auth,
      needReactivate: data.needReactivate,
      deleteDate: data.deleteDate,
      expireDate: data.expireDate,
      isNewUser: data.isNewUser,
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
      expireAt: data.expireAt,
      onBoarding: data.onBoarding,
    };
  },

  /**
   * Refresh access token using refresh token
   * @returns {Promise<Object>} - New access and refresh tokens
   */
  async refreshToken() {
    if (!tokenData.refreshToken) {
      throw new Error('No refresh token available');
    }

    const client = createApiClient({
      customAuth: `Bearer ${tokenData.refreshToken}`
    });

    const response = await client.post('token/refresh');
    const data = response.body?.data;

    if (!data) {
      throw new Error('Invalid response: missing data field');
    }

    // Update stored tokens
    tokenData.accessToken = data.accessToken;
    tokenData.refreshToken = data.refreshToken;
    tokenData.expireAt = data.expireAt;

    return response.body;
  },

  /**
   * Get current user info
   */
  async getCurrentUserInfo() {
    await ensureValidToken();
    const client = createApiClient();
    const response = await client.get('chats/currentUserInfo');
    const data = response.body?.data;

    if (!data) {
      throw new Error('Invalid response: missing data field');
    }

    return {
      id: data.id,
      name: data.name,
      token: data.token,
      apiKey: data.apiKey,
      image: data.image?.picURL || data.image,
    };
  },

  /**
   * Get WebSocket token
   */
  async getWebSocketToken() {
    await ensureValidToken();
    const client = createApiClient();
    const response = await client.get('ws/token');
    const data = response.body?.data;

    if (!data) {
      throw new Error('Invalid response: missing data field');
    }

    return {
      server: data.server,
      token: data.token,
    };
  },

  /**
   * Create a new chat
   */
  async createChat(targetUserId) {
    await ensureValidToken();
    const client = createApiClient();
    const response = await client.post('chats/create', {
      json: {
        targetUserID: String(targetUserId),
      },
    });

    const data = response.body?.data;
    if (!data) {
      throw new Error('Invalid response: missing data field');
    }

    return {
      id: data.id,
      apiKey: data.apiKey,
      token: data.token,
      chatChannelInfo: data.chatChannelInfo,
      currentUser: data.currentUser,
      targetUser: data.targetUser,
    };
  },

  /**
   * Get chat info
   */
  async getChatInfo(targetUserId) {
    await ensureValidToken();
    const client = createApiClient();
    const response = await client.get('chats/info', {
      searchParams: {
        targetUserID: targetUserId,
      },
    });

    const data = response.body?.data;
    if (!data) {
      throw new Error('Invalid response: missing data field');
    }

    return {
      id: data.id,
      apiKey: data.apiKey,
      token: data.token,
      chatChannelInfo: data.chatChannelInfo,
      currentUser: data.currentUser,
      targetUser: data.targetUser,
    };
  },

  /**
   * Delete a message from a group chat
   * @param {string} channelId - Channel ID (group chat ID)
   * @param {string} messageId - Message ID to delete
   * @returns {Promise<Object>} - Deletion response
   */
  async deleteMessage(channelId, messageId) {
    await ensureValidToken();
    const client = createApiClient();

    const response = await client.delete(`group_chats/${channelId}/message`, {
      searchParams: {
        messageID: messageId,
      },
    });

    const data = response.body?.data;
    if (!data) {
      throw new Error('Invalid response: missing data field');
    }

    return data;
  },

  /**
   * Send server message to a group chat
   * @param {string} groupChatId - Group chat ID
   * @param {string} message - Message to send
   * @returns {Promise<Object>} - Response data
   */
  async sendServerMessage(groupChatId, message) {
    await ensureValidToken();
    const client = createApiClient();

    const response = await client.post(`group_chats/${groupChatId}/server_message`, {
      json: {
        message,
      },
    });

    const data = response.body?.data;
    if (!data) {
      throw new Error('Invalid response: missing data field');
    }

    return data;
  },

  /**
   * Leave a group chat
   * @param {string} groupChatId - Group chat ID
   * @returns {Promise<Object>} - Response data
   */
  async leaveGroupChat(groupChatId) {
    await ensureValidToken();
    const client = createApiClient();

    const response = await client.post(`group_chats/${groupChatId}/leave`, {
      json: {},
    });

    const data = response.body?.data;
    if (!data) {
      throw new Error('Invalid response: missing data field');
    }

    return data;
  },

  /**
   * Get current token data (for debugging/monitoring)
   */
  getTokenData() {
    return {
      hasAccessToken: !!tokenData.accessToken,
      hasRefreshToken: !!tokenData.refreshToken,
      expireAt: tokenData.expireAt,
      isExpired: isTokenExpired(),
    };
  },

  /**
   * Manually set token data (useful for restoring session)
   */
  setTokenData(accessToken, refreshToken, expireAt) {
    tokenData.accessToken = accessToken;
    tokenData.refreshToken = refreshToken;
    tokenData.expireAt = expireAt;
    logger.info('Token data manually set');
  },

  /**
   * Register a callback to be called when tokens are refreshed
   * Useful for reconnecting websocket with new tokens
   */
  onTokenRefresh(callback) {
    onTokenRefreshCallbacks.push(callback);
  },

  /**
   * Clear all token refresh callbacks
   */
  clearTokenRefreshCallbacks() {
    onTokenRefreshCallbacks = [];
  },
};
