/**
 * Truth/Dare API Utility
 * Fetches truth questions and dare challenges from truthordarebot.xyz API
 */

import axios from 'axios';

const API_BASE_URL = "https://api.truthordarebot.xyz/v1";

/**
 * Get a truth question
 * 
 * @param {string} rating - Rating level: PG, PG13, or R (default: PG)
 * @returns {Promise<string>} Truth question text
 */
export async function getTruth(rating = "PG") {
    try {
        const url = `${API_BASE_URL}/truth?rating=${rating}`;
        const response = await axios.get(url, { timeout: 5000 });

        if (response.status !== 200) {
            throw new Error(`API returned status ${response.status}`);
        }

        return response.data.question || "No question available";
    } catch (error) {
        throw new Error(`Failed to fetch truth question: ${error.message}`);
    }
}

/**
 * Get a dare challenge
 * 
 * @param {string} rating - Rating level: PG, PG13, or R (default: PG)
 * @returns {Promise<string>} Dare challenge text
 */
export async function getDare(rating = "PG") {
    try {
        const url = `${API_BASE_URL}/dare?rating=${rating}`;
        const response = await axios.get(url, { timeout: 5000 });

        if (response.status !== 200) {
            throw new Error(`API returned status ${response.status}`);
        }

        return response.data.question || "No dare available";
    } catch (error) {
        throw new Error(`Failed to fetch dare: ${error.message}`);
    }
}
