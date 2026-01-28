import { Client } from './index.js';
import { logger } from './utils/logger.js';
import { registerCommands } from './commands/index.js';
import { authenticateUser, closeReadline } from './auth/authenticateUser.js';
import { connectDatabase } from './database/connect.js';
import { loadAdminCache } from './utils/adminUtils.js';

/**
 * Start the bot
 */
async function startBot() {
    try {
        // Connect to database
        await connectDatabase();
        await loadAdminCache();

        // Authenticate user first
        await authenticateUser();

        // Close readline interface
        closeReadline();

        // Initialize client
        const client = new Client({ commandPrefix: '!' });

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

