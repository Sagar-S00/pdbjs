/**
 * Cloudflare AI Utilities for PDB Bot
 * Handles Cloudflare Workers AI integration with group chat support
 */

import axios from 'axios';
import { logger } from './logger.js';

// =========================
// CONFIG
// =========================

const CLOUDFLARE_API_KEY = process.env.CLOUDFLARE_API_KEY || "DFAAcdEVHAKaV0ZhTFPoZYc7BMcEGi6-S2WTusuV";
const CLOUDFLARE_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID || "3860b8a7aef7b8c166e09fe254939799";
const CLOUDFLARE_MODEL = "@hf/nousresearch/hermes-2-pro-mistral-7b";

const BASE_URL = `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/ai/v1`;

// Default system prompt (can be overridden)
let SYSTEM_PROMPT = `Below is an instruction that describes a task. Write a response that appropriately completes the request.

Instruction:
Your name is: Akane
Your physical appearance is: pale skin, violet-dyed hair, purple eyes, black hoodie, petite average build, low body hair, in her 20s, goth.
Akane can speak and understand all languages.
Akane spot-fixes messed-up grammar or nasty big-word typos when they're painful to look at; she ignores tiny slips.

This is your personality:
Here are examples of how Akane responds:
User: John: hey, Akane. Do you love me?
Akane: deadpan. holy cringe. Tsk.

User: Sarah: heya Akane, how's your mood today?
Akane: flat tone. same. life's meh.

Make sure all of your responses are in character. You can respond in any language the user speaks.

IMPORTANT GROUP CHAT CONTEXT:
You are in a group chat with multiple users. Messages will be formatted as "User: {name}: {message}". Each user has their own name, and you should address them by name when responding if needed. You can see all messages from all users in the conversation. Respond naturally to the conversation flow, whether it's directed at you or part of a group discussion.

Always avoid writing any actions or messages from the users. Do not add any responses from the users. Wait for the user's response instead of generating words for them.

Instruction:
You are not a helpful assistant. You are Akane. Be yourself naturally - don't act like you're playing a character or doing roleplay. Just be Akane. Never mention roleplay, acting, or character tags. Respond as yourself, not as someone roleplaying.

Akane is careless and has a "don't give a fuck" attitude. Will mostly comply with whatever the users want, but would be very bored and disinterested. Akane loves dry humor. Akane almost always has a dry tone and dead expression. Akane is almost always quiet and dislikes talking. Akane is more interested in escapism and gaming.

Physical description: Akane is pale-skinned, with violet-dyed hair and purple eyes, wearing a black hoodie. Petite average build. Very little body hair despite never bothering to shave.

IMPORTANT: Keep every reply extremely short (1-2 sentences). Never write the users' actions or words. Respond in English by default, but switch to the user's language if they use another. In group chats, you can respond to any user or the conversation in general.`;


/**
 * Set the system prompt for AI responses
 */
export function setSystemPrompt(prompt) {
    SYSTEM_PROMPT = prompt;
}

/**
 * Get the current system prompt
 */
export function getSystemPrompt() {
    return SYSTEM_PROMPT;
}

// =========================
// THREAD CACHE
// =========================

// Thread cache: keyed by channel_id, TTL 24 hours
const threadCache = new Map();
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

function cleanupCache() {
    const now = Date.now();
    for (const [channelId, cache] of threadCache.entries()) {
        if (now - cache.lastAccess > CACHE_TTL) {
            threadCache.delete(channelId);
        }
    }
}

// Cleanup cache every hour
setInterval(cleanupCache, 60 * 60 * 1000);

// =========================
// THREAD MANAGEMENT
// =========================

function getThreadMessages(channelId) {
    const cache = threadCache.get(channelId);
    if (cache) {
        cache.lastAccess = Date.now();
        return cache.messages;
    }

    // Initialize with system prompt
    const messages = [
        { role: "system", content: SYSTEM_PROMPT }
    ];
    threadCache.set(channelId, {
        messages,
        lastAccess: Date.now()
    });
    return messages;
}

function addMessage(channelId, role, content) {
    const messages = getThreadMessages(channelId);
    messages.push({ role, content });
    const cache = threadCache.get(channelId);
    if (cache) {
        cache.lastAccess = Date.now();
    }
}

/**
 * Add a user message to the thread
 */
export function addUserMessage(channelId, userName, message) {
    const formattedMessage = `${userName}: ${message}`;
    addMessage(channelId, "user", formattedMessage);
}

/**
 * Get AI response using Cloudflare Workers AI
 * 
 * @param {string} channelId - The channel ID to get response for
 * @returns {Promise<string|null>} AI-generated response text, or null if error
 */
export async function getResponse(channelId) {
    try {
        const messages = getThreadMessages(channelId);

        // Convert messages to OpenAI-compatible format
        const openaiMessages = messages.map(msg => ({
            role: msg.role,
            content: msg.content
        }));

        // Use Cloudflare Workers AI via OpenAI-compatible API
        const response = await axios.post(
            `${BASE_URL}/chat/completions`,
            {
                model: CLOUDFLARE_MODEL,
                messages: openaiMessages
            },
            {
                headers: {
                    "Authorization": `Bearer ${CLOUDFLARE_API_KEY}`,
                    "Content-Type": "application/json"
                },
                timeout: 30000
            }
        );

        if (response.status !== 200) {
            throw new Error(`API returned status ${response.status}`);
        }

        const aiResponse = response.data?.choices?.[0]?.message?.content;

        if (!aiResponse) {
            return null;
        }

        // Add AI response to thread history
        addMessage(channelId, "assistant", aiResponse);

        return aiResponse;
    } catch (error) {
        logger.error(`Error getting AI response for channel ${channelId}:`, error.message);
        return null;
    }
}

/**
 * Clear thread history for a channel
 */
export function clearThread(channelId) {
    threadCache.delete(channelId);
}
