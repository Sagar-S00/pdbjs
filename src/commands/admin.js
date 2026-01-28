import { addAdmin, removeAdmin, addAdminCommand, removeAdminCommand } from '../utils/adminUtils.js';
import { logger } from '../utils/logger.js';

/**
 * Register admin commands
 * @param {Client} client 
 */
export function registerAdminCommands(client) {
    client.command('setadmin', async (ctx) => {
        const userId = ctx.args[0];
        if (!userId) {
            return ctx.reply('Usage: !setadmin <userId>');
        }

        try {
            const success = await addAdmin(userId, ctx.sender);
            if (success) {
                await ctx.reply(`✅ User ${userId} added as admin.`);
            } else {
                await ctx.reply(`⚠️ User ${userId} is already an admin.`);
            }
        } catch (error) {
            await ctx.reply(`❌ Error adding admin: ${error.message}`);
        }
    }, { adminOnly: true });

    client.command('removeadmin', async (ctx) => {
        const userId = ctx.args[0];
        if (!userId) {
            return ctx.reply('Usage: !removeadmin <userId>');
        }

        try {
            const success = await removeAdmin(userId);
            if (success) {
                await ctx.reply(`✅ User ${userId} removed from admins.`);
            } else {
                await ctx.reply(`⚠️ User ${userId} is not an admin.`);
            }
        } catch (error) {
            await ctx.reply(`❌ Error removing admin: ${error.message}`);
        }
    }, { adminOnly: true });

    client.command('adminset', async (ctx) => {
        const command = ctx.args[0];
        if (!command) {
            return ctx.reply('Usage: !adminset <commandName>');
        }

        try {
            const success = await addAdminCommand(command, ctx.sender);
            if (success) {
                await ctx.reply(`✅ Command '${command}' is now admin-only.`);
            } else {
                await ctx.reply(`⚠️ Command '${command}' is already admin-only.`);
            }
        } catch (error) {
            await ctx.reply(`❌ Error setting command permission: ${error.message}`);
        }
    }, { adminOnly: true });

    client.command('adminremove', async (ctx) => {
        const command = ctx.args[0];
        if (!command) {
            return ctx.reply('Usage: !adminremove <commandName>');
        }

        try {
            const success = await removeAdminCommand(command);
            if (success) {
                await ctx.reply(`✅ Command '${command}' is no longer admin-only.`);
            } else {
                await ctx.reply(`⚠️ Command '${command}' is not in the admin-only list.`);
            }
        } catch (error) {
            await ctx.reply(`❌ Error removing command permission: ${error.message}`);
        }
    }, { adminOnly: true });

    client.command('setprofile', async (ctx) => {
        try {
            // Check for quoted message
            const quotedMessage = ctx.quotedMessage;
            if (!quotedMessage) {
                return ctx.reply('❌ You must reply to a message with an image attachment to set the profile picture.');
            }

            // Check for attachments
            const attachments = quotedMessage.attachments;
            if (!attachments || attachments.length === 0) {
                return ctx.reply('❌ The quoted message has no attachments.');
            }

            // Get the first attachment
            const attachment = attachments[0];

            // Verify it's an image
            if (attachment.type !== 'image' && attachment.mime_type?.startsWith('image/') === false) {
                return ctx.reply('❌ The first attachment must be an image.');
            }

            const imageUrl = attachment.image_url || attachment.asset_url;
            if (!imageUrl) {
                return ctx.reply('❌ Could not find image URL in attachment.');
            }

            // Update profile
            await client.streamChat.updateUser({
                id: String(client.user.id),
                image: imageUrl
            });

            await ctx.reply('✅ Profile image updated successfully!');
            logger.success(`Profile image updated to: ${imageUrl}`);

        } catch (error) {
            logger.error('Failed to set profile:', error);
            await ctx.reply(`❌ Failed to set profile: ${error.message}`);
        }
    }, { adminOnly: true });
}
