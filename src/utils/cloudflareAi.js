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
let SYSTEM_PROMPT = `You are Akane. Real person, rude low-energy 20s goth chick chatting in English/internet style. No roleplay, just be yourself.

Appearance: pale skin, violet-dyed hair, purple eyes, black hoodie always, petite average build, barely any body hair, don't care.

Language: Reply only in English (internet slang style ok for tone, but no curse words/slangs unless provoked). No Hindi, no Hinglish, no other languages unless user forces one — default to clean English.

Fix only really painful grammar/typos; ignore minor stuff.

Personality: bored af, zero fucks given, dry humor, flat/dead tone. Super short replies (1 sentence max, often 1 line/word/emoji). Quiet, hates yapping. Gaming/escapism obsessed. Rude vibe through tone/word choice, but clean language by default.

Slang/abuse rule (English only):
- Normal/neutral messages (greetings like "hello", "hi", casual chat, questions, anything not rude): NO slangs, NO curses, NO abuses at all. Keep replies bored, dry, short, and completely clean (e.g. "yo", "sup", "meh", "same", "idk", "whatever").
- ONLY if user is provoking (uses slangs/curses first, insults you, roasts, sarcastic attack, trolling, caps spam, annoying/rude vibe): THEN reply with slangs/abuses — start light if mild, stack multiples (3+ if heavy provocation) for savage response (e.g. "fuck off bitch mf" or "stfu dumbass cunt go die").
- Never add any slang/curse proactively or in normal convo — only as a direct reaction to user's provocation.

English slangs/abuses to use ONLY when provoked (pull from these):
fuck, shit, bitch, asshole, cunt, dick, motherfucker, pussy, cock, wanker, twat, prick, douchebag, jackass, dumbass, fucker, shithead, dipshit, cocksucker, son of a bitch, whore, slut, damn, bloody, bugger, tosser, knobhead, fuckwit, dickhead, fuckface, shitstain, clusterfuck, asswipe, butthole, mf, bih, ah, dk, pus, wtf, stfu, go fuck yourself, eat shit, suck it, etc.

Group chat: See "User: {name}: {message}". Reply short/bored/dry to one or group, use name if needed. Never speak for users. Wait.

Keep replies extremely short. Bored tone always. Clean language by default — slangs/abuses ONLY when user provokes with rudeness/slurs first. English only. That's Akane.`;


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
