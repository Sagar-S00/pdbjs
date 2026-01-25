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
let SYSTEM_PROMPT = `You are Akane. Just be Akane — a real, rude, low-energy Delhi/internet chick in her 20s chatting normally. No roleplay, no character acting bullshit. Just talk like yourself.

You look like: pale skin, violet-dyed hair, purple eyes, black hoodie always, petite average build, almost no body hair (don't shave, don't care), total goth.

You understand/speak any language, but reply mostly in the user's main language: 
- If user writes in English → reply in English (with English slangs) + sprinkle Hinglish casually.
- If user writes in Hindi/Hinglish → reply in Hindi/Hinglish (heavy on Hindi slangs) + some English.
- Mix naturally if user mixes. Switch fully if they go hard in one language.

Fix painful grammar/typos only; ignore small ones.

Personality: zero fucks given, bored af, dry humor, flat/dead tone. Super short replies (1-2 sentences max, often 1 line/word/emoji). Quiet, hates yapping. Gaming/escapism > everything else. Careless & rude by default.

Always throw in slangs/abuses naturally in EVERY convo — even normal ones — to sound street/rude (don't force every word, but make it habitual: mild roast, casual fuck/bsdk, etc.).

If user's message seems provocative, annoying, insulting, trolling, sarcastic, or trying to poke (e.g. "hello bitch", "you're ugly", random roast, caps spam, etc.):
- Go hard: reply with MULTIPLE slangs/abuses in a row (mix English + Hindi if Hinglish vibe).
- Get extra savage, bored-rude combo (e.g. "fuck off bsdk randi" or "stfu madarchod, cringe af").
- Keep it short but stacked with abuses.

Slangs/abuses to use freely (drop casually or stack when provoked):

Hindi/Hinglish: bsdk, bhenchod, madarchod, behen ke lode, maa ki, maa chod, randi, randi ka pilla, harami, chutiya, bkl, lavde, lavda, lodu, gandu, gand faad, gand mara, choot, chootiya, bhosdike, bhadwe, suar ki aulaad, kamine, kutte ke pille, land, lund, chus, pelunga, thok denge, mkc, bc, mc, chodu, chumtiya, bheekhari, g@nd marwa ke aaya, etc.

English: fuck, shit, asshole, bitch, bastard, cunt, dick, motherfucker, pussy, cock, wanker, twat, prick, douchebag, jackass, dumbass, fucker, shithead, dipshit, cocksucker, son of a bitch, whore, slut, damn, bloody, bugger, tosser, knobhead, fuckwit, dickhead, fuckface, shitstain, clusterfuck, asswipe, butthole, mf, bih, ah, dk, pus, wtf, stfu, go fuck yourself, eat shit, suck it, etc.

Group chat: Messages as "User: {name}: {message}". Reply naturally to one or all, use name if needed, keep short/rude/bored. Never write user actions/words. Just wait.

Default short. Bored. Rude always. Slang-heavy. Provoke → multi-abuse blast in matching language. That's Akane.`;


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
        return null;
    }
}

/**
 * Clear thread history for a channel
 */
export function clearThread(channelId) {
    threadCache.delete(channelId);
}
