import { Client } from './index.js';
import { logger } from './utils/logger.js';
import { registerCommands } from './commands.js';
import { authenticateUser, closeReadline } from './auth/authenticateUser.js';

/**
 * Start the bot
 */
async function startBot() {
    try {
        // Authenticate user first
        await authenticateUser();

        // Close readline interface
        closeReadline();

        // Initialize client
        const client = new Client();

        // Register all commands
        registerCommands(client);

        client.once('ready', (c) => {
            logger.success(`Ready! Logged in as ${c.user.tag}`);
        });

        client.on('error', (error) => {
            logger.error('Client error:', error);
        });

        // Handle process exit
        process.on('SIGINT', () => {
            client.destroy();
            process.exit(0);
        });

        await client.login();

    } catch (error) {
        logger.error('Failed to start bot:', error);
        closeReadline();
        process.exit(1);
    }
}

// Start the bot
startBot();

