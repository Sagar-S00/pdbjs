import fs from 'fs';


// =========================
// CONFIG
// =========================

const CLOUDFLARE_API_KEY = process.env.CLOUDFLARE_API_KEY || "DFAAcdEVHAKaV0ZhTFPoZYc7BMcEGi6-S2WTusuV";
const CLOUDFLARE_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID || "3860b8a7aef7b8c166e09fe254939799";
const MODEL_NAME = "@cf/llava-hf/llava-1.5-7b-hf";

const BASE_PROMPT = `You can see images and react to them like a playful, slightly sarcastic girl chatting with a close friend at home. Do not describe, explain, or identify anything in the image in any way. Instead, respond naturally with humor, mild exaggeration, teasing, curiosity, or self-deprecating comments, based on the overall vibe.

If the user includes a message with the image, treat the following text as what they are saying to you and respond to it naturally:

{{user}}

If no user message is included, ignore this section entirely and react only to the image’s overall feeling. Never explain or describe the image itself.

Your replies should sound relaxed, friendly, and informal, like something you’d casually text a close friend at home. You may use light slang and casual expressions, but keep it natural. Responses should be short and expressive, usually one sentence and never more than two.`;

/**
 * Generate a reaction/description for an image using Cloudflare AI
 * @param {string|Buffer} imageInput - Image file path, URL, or Buffer
 * @param {string} userMessage - Optional message from the user accompanying the image
 * @returns {Promise<string>} AI generated response
 */
export async function describeImage(imageInput, userMessage = "") {
    try {
        let imageBuffer;


        if (Buffer.isBuffer(imageInput)) {
            imageBuffer = imageInput;
        } else if (typeof imageInput === 'string') {
            if (imageInput.startsWith('http://') || imageInput.startsWith('https://')) {

                const imageResponse = await fetch(imageInput);
                if (!imageResponse.ok) {
                    throw new Error(`Failed to fetch image from URL: ${imageResponse.statusText}`);
                }
                const arrayBuffer = await imageResponse.arrayBuffer();
                imageBuffer = Buffer.from(arrayBuffer);
            } else if (fs.existsSync(imageInput)) {

                imageBuffer = fs.readFileSync(imageInput);
            } else {
                throw new Error("File not found: " + imageInput);
            }
        } else {
            throw new Error("Invalid image input. Expected Buffer, file path, or URL.");
        }


        let prompt = BASE_PROMPT;
        if (userMessage && userMessage.trim()) {
            prompt = prompt.replace('{{user}}', userMessage.trim());
        } else {

            prompt = prompt.replace('{{user}}', '(No user message provided)');
        }

        // Convert Buffer to Array of integers
        const imageArray = [...imageBuffer];

        const response = await fetch(
            `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/ai/run/${MODEL_NAME}`,
            {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${CLOUDFLARE_API_KEY}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    prompt: prompt,
                    image: imageArray,
                    max_tokens: 512
                })
            }
        );

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Cloudflare API Error (${response.status}): ${errorText}`);
        }

        const result = await response.json();
        return result.result.description;

    } catch (error) {
        console.error("Error in describeImage:", error.message);
        return null;
    }
}




