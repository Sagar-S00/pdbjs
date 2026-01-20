import { logger } from '../utils/logger.js';
import { config, saveConfig } from '../config/config.js';
import { pdbApi } from '../services/pdbApi.js';
import readline from 'readline';

// Create readline interface for user input
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

/**
 * Promisified question function for readline
 */
function question(query) {
    return new Promise(resolve => rl.question(query, resolve));
}

/**
 * Close the readline interface
 */
export function closeReadline() {
    rl.close();
}

/**
 * Authenticate user with email and OTP
 */
export async function authenticateUser() {
    try {
        // Check if email exists in config
        if (!config.pdb.email) {
            logger.info('No email found in config. Starting authentication process...');

            // Clear old tokens
            config.pdb.accessToken = '';
            config.pdb.refreshToken = '';
            config.pdb.expireAt = null;

            // Get email from user
            const email = await question('Please enter your email: ');

            if (!email || !email.trim()) {
                throw new Error('Email is required');
            }

            logger.info(`Sending OTP to ${email}...`);

            // Send OTP
            const otpResponse = await pdbApi.sendDigits(email.trim());
            logger.success(`OTP sent successfully! ${otpResponse.isNewUser ? '(New User)' : '(Existing User)'}`);

            // Get OTP code from user
            const code = await question('Please enter the OTP code: ');

            if (!code || !code.trim()) {
                throw new Error('OTP code is required');
            }

            logger.info('Logging in...');

            // Login with OTP
            const loginResponse = await pdbApi.login(email.trim(), code.trim(), 'android');
            logger.success(`Login successful! Welcome ${loginResponse.user.username}`);

            // Immediately refresh token after login
            logger.info('Refreshing token after login...');
            const refreshResponse = await pdbApi.refreshToken();
            logger.success('Token refreshed successfully');

            // Save credentials from refresh response to config
            saveConfig({
                pdb: {
                    email: email.trim(),
                    accessToken: refreshResponse.data.accessToken,
                    refreshToken: refreshResponse.data.refreshToken,
                    expireAt: refreshResponse.data.expireAt,
                },
            });

            logger.success('Credentials saved to config.json');

            // Set tokens in pdbApi
            pdbApi.setTokenData(
                refreshResponse.data.accessToken,
                refreshResponse.data.refreshToken,
                refreshResponse.data.expireAt
            );

        } else {
            logger.info(`Using saved email: ${config.pdb.email}`);

            // Check if we have valid tokens
            if (config.pdb.accessToken && config.pdb.refreshToken && config.pdb.expireAt) {
                logger.info('Loading saved credentials...');

                // Set tokens in pdbApi
                pdbApi.setTokenData(
                    config.pdb.accessToken,
                    config.pdb.refreshToken,
                    config.pdb.expireAt
                );

                // Check token status
                const tokenData = pdbApi.getTokenData();
                if (tokenData.isExpired) {
                    logger.info('Token expired, refreshing...');
                    const refreshed = await pdbApi.refreshToken();

                    // Save refreshed tokens
                    saveConfig({
                        pdb: {
                            accessToken: refreshed.data.accessToken,
                            refreshToken: refreshed.data.refreshToken,
                            expireAt: refreshed.data.expireAt,
                        },
                    });

                    logger.success('Token refreshed successfully');
                } else {
                    logger.success('Credentials loaded successfully');
                }
            } else {
                logger.warn('Email found but tokens missing. Re-authenticating...');

                // Clear email and re-authenticate
                config.pdb.email = '';
                await authenticateUser();
            }
        }
    } catch (error) {
        logger.error('Authentication failed:', error.message);

        // Clear config and retry
        logger.info('Clearing config and retrying authentication...');
        config.pdb.email = '';
        config.pdb.accessToken = '';
        config.pdb.refreshToken = '';
        config.pdb.expireAt = null;

        saveConfig({
            pdb: {
                email: '',
                accessToken: '',
                refreshToken: '',
                expireAt: null,
            },
        });

        throw error;
    }
}
