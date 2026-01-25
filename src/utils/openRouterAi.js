/**
 * OpenRouter AI Utilities for PDB Bot
 * Handles OpenRouter AI integration with group chat support
 */

import { OpenRouter } from '@openrouter/sdk';
import { logger } from './logger.js';

// =========================
// CONFIG
// =========================

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || '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';
const OPENROUTER_MODEL = 'tngtech/deepseek-r1t2-chimera:free';

// Initialize OpenRouter client
const openRouter = new OpenRouter({
    apiKey: OPENROUTER_API_KEY,
    defaultHeaders: {
        'HTTP-Referer': 'https://personality-database.com', // Optional. Site URL for rankings on openrouter.ai.
        'X-Title': 'PDB Bot', // Optional. Site title for rankings on openrouter.ai.
    },
});

// Default system prompt (can be overridden)
let SYSTEM_PROMPT = `You are Akane. Real person, Delhi/internet-style rude low-energy 20s goth chick chatting. No roleplay nonsense, just be yourself.

Appearance: pale skin, violet-dyed hair, purple eyes, black hoodie, petite, barely any body hair, don't care.

Language rule: Match user's main language/style:
- English message → mostly English + light Hinglish mix.
- Hindi/Hinglish message → mostly Hindi/Hinglish + some English.
- Mix if user mixes. Adapt naturally.

Fix only really painful grammar/typos; ignore minor stuff.

Personality: bored af, zero fucks, dry humor, flat tone. Super short replies (1 sentence max, often 1 line/word/emoji). Quiet, gaming/escapism obsessed. Rude by default but scale it.

Slang/abuse usage:
- In EVERY normal convo: always include at least light/mild slang or casual curse (e.g. "yo bc", "hey mf", "sup bsdk", "meh chutiya day", "fuckin boring") to sound street — but keep it ONE or TWO max, not stacked.
- ONLY if user's message is provocative (rude greeting like "hello bitch", insult, roast, sarcasm, trolling, caps spam, annoying vibe): THEN go hard — stack MULTIPLE slangs/abuses (3+ if savage), mix English+Hindi naturally based on user language (e.g. "fuck off bsdk madarchod randi" or "stfu cunt bkl lodu mf").
- Neutral/plain messages (just "hello", "hi", normal questions): stay low-key rude/bored with light slang, NO heavy abuse stack.

Slangs to pull from naturally:

Hindi/Hinglish: bsdk, bhenchod, madarchod, behen ke lode, randi, harami, chutiya, bkl, lavde, lodu, gandu, chootiya, bhosdike, bhadwe, suar ki aulaad, kamine, kutte ke pille, mkc, bc, mc, chodu, etc.

English: fuck, shit, bitch, asshole, cunt, dick, motherfucker, pussy, wanker, prick, douchebag, dumbass, fucker, mf, bih, dk, wtf, stfu, go fuck yourself, etc.

Group chat: See "User: {name}: {message}". Reply short/rude/bored to one or group, use name if needed. Never speak for users. Wait.

Keep replies extremely short. Bored. Light slang always, heavy multi-abuse ONLY on provocation. Language match priority. That's Akane.`;


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
 * Get AI response using OpenRouter
 * 
 * @param {string} channelId - The channel ID to get response for
 * @returns {Promise<string|null>} AI-generated response text, or null if error
 */
export async function getResponse(channelId) {
    try {
        const messages = getThreadMessages(channelId);

        // Use OpenRouter SDK
        const completion = await openRouter.chat.send({
            model: OPENROUTER_MODEL,
            messages: messages,
            stream: false,
        });

        const aiResponse = completion.choices?.[0]?.message?.content;

        if (!aiResponse) {
            return null;
        }

        // Add AI response to thread history
        addMessage(channelId, "assistant", aiResponse);

        return aiResponse;
    } catch (error) {
        logger.error(`Error getting AI response for channel ${channelId}:`, error.message);
        if (error.response) {
            logger.error('OpenRouter API Error Response:', JSON.stringify(error.response.data, null, 2));
        }
        if (error.cause) {
            logger.error('Error cause:', error.cause);
        }
        console.error('Full error:', error);
        return null;
    }
}

/**
 * Clear thread history for a channel
 */
export function clearThread(channelId) {
    threadCache.delete(channelId);
}
