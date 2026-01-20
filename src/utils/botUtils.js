/**
 * Bot Utilities
 * Helper functions to access bot information across the application
 */

// Client reference (set by bot.js when it initializes)
let clientRef = null;

/**
 * Set the bot client reference
 * This is called by bot.js during initialization
 * @param {Object} client - The bot client instance
 */
export function setBotClient(client) {
    clientRef = client;
}

/**
 * Get the current bot user information
 * @returns {Object|null} Bot user object with id, name, tag, token, apiKey, and image
 */
export function getBotUser() {
    return clientRef?.user || null;
}

/**
 * Get the bot user ID
 * @returns {string|null} Bot user ID
 */
export function getBotUserId() {
    return clientRef?.userId || null;
}

/**
 * Get the bot username
 * @returns {string|null} Bot username
 */
export function getBotUsername() {
    return clientRef?.username || null;
}

/**
 * Get the bot user tag (name#id)
 * @returns {string|null} Bot user tag
 */
export function getBotUserTag() {
    return clientRef?.tag || null;
}

/**
 * Get the bot user token
 * @returns {string|null} Bot user authentication token
 */
export function getBotToken() {
    return clientRef?.token || null;
}

/**
 * Get the bot user API key
 * @returns {string|null} Bot user API key
 */
export function getBotApiKey() {
    return clientRef?.apiKey || null;
}

/**
 * Get the bot user profile image URL
 * @returns {string|null} Bot user profile image URL
 */
export function getBotImage() {
    return clientRef?.image || null;
}

/**
 * Check if the bot is ready
 * @returns {boolean} True if bot is ready, false otherwise
 */
export function isBotReady() {
    return clientRef?.ready || false;
}

/**
 * Get the bot client instance
 * Use this for advanced operations like registering commands or emitting events
 * @returns {Object|null} Bot client instance
 */
export function getBotClient() {
    return clientRef;
}
