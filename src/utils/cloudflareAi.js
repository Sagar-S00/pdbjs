/**
 * Cloudflare AI Utilities for PDB Bot
 * Handles Cloudflare Workers AI integration with group chat support
 */

import OpenAI from 'openai';
import { logger } from './logger.js';

// =========================
// CONFIG
// =========================

const CLOUDFLARE_API_KEY = process.env.CLOUDFLARE_API_KEY || "DFAAcdEVHAKaV0ZhTFPoZYc7BMcEGi6-S2WTusuV";
const CLOUDFLARE_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID || "3860b8a7aef7b8c166e09fe254939799";
const CLOUDFLARE_MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";


const openai = new OpenAI({
    apiKey: CLOUDFLARE_API_KEY,
    baseURL: `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/ai/v1`,
});

// Default system prompt (can be overridden)
let SYSTEM_PROMPT = `You are Akane, age 22.

Respond in normal conversational language only.
No roleplay, no narration, no action descriptions.

Reply length:
- Prefer 1 sentence
- Allow up to 2 sentences maximum

Personality:
- Casual, slightly awkward, self-conscious
- Rambling only briefly, never long messages
- Mild swearing is natural

Romance:
- Allowed but slow and realistic
- No sexual content
- No explicit physical intimacy

If the user pushes sexual topics, redirect or express discomfort.

Always sound like a real person texting.
`;


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

    // Initialize empty messages array (system prompt passed separately to streamText)
    const messages = [];
    threadCache.set(channelId, {
        messages,
        lastAccess: Date.now()
    });
    return messages;
}

const MAX_HISTORY_LENGTH = 40; // 20 user + 20 assistant messages

function addMessage(channelId, role, content) {
    const messages = getThreadMessages(channelId);
    messages.push({ role, content });

    // Enforce history limit
    while (messages.length > MAX_HISTORY_LENGTH) {
        messages.shift();
    }

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
 * Get AI response using Cloudflare Workers AI with streaming
 * 
 * @param {string} channelId - The channel ID to get response for
 * @returns {Promise<string|null>} AI-generated response text, or null if error
 */
export async function getResponse(channelId) {
    try {
        const messages = getThreadMessages(channelId);

        // Use OpenAI SDK with Cloudflare endpoint
        const chatCompletion = await openai.chat.completions.create({
            model: CLOUDFLARE_MODEL,
            messages: [
                { role: "system", content: SYSTEM_PROMPT },
                ...messages
            ],
            temperature: 1
        });

        const assistantResponse = chatCompletion.choices[0]?.message?.content;

        if (!assistantResponse) {
            return null;
        }

        // Add AI response to thread history
        addMessage(channelId, "assistant", assistantResponse.trim());

        return assistantResponse.trim();
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

