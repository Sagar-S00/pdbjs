import * as cloudflareAi from '../utils/cloudflareAi.js';
import { logger } from '../utils/logger.js';
import { streamChatService } from '../services/streamChatService.js';

async function cloudflareAiHandler(event) {
    const cid = event.cid;
    const [channelType, channelId] = cid.split(':');
    const userName = message.user.name || message.user.id;
    const messageText = message.text || '';
    if (!messageText.trim()) {
        return;
    }
    cloudflareAi.addUserMessage(channelId, userName, messageText);
    const aiResponse = await cloudflareAi.getResponse(channelId);

    if (aiResponse) {
        await streamChatService.replyMessage(
            channelType,
            channelId,
            aiResponse,
            message.id
        );

        logger.success(`AI response sent to ${channelId}`);
    } else {
        logger.error('Failed to get AI response');
    }
}


async function checkInvaildLink(event) {
    const message = event.message;
    const messageText = message.copyText || '';
    if (!messageText.trim()) {
        return;
    }


    const cid = event.cid;
    const [channelType, currentGroupId] = cid.split(':');



    const linkRegex = /https?:\/\/(www\.)?personality-database\.com\/join_group\?[^\s]+/gi;
    const groupIdRegex = /cid=([^&\s]+)/;

    const links = messageText.match(linkRegex);
    console.log(messageText);
    console.log(links);
    if (!links || links.length === 0) {
        return;
    }


    for (const link of links) {

        const decodedLink = decodeURIComponent(link);


        const cidMatch = decodedLink.match(groupIdRegex);
        if (cidMatch && cidMatch[1]) {

            const linkCid = cidMatch[1];
            const [linkChannelType, linkGroupId] = linkCid.split(':');


            if (linkGroupId !== currentGroupId) {
                logger.info(`Invalid group link detected: ${linkGroupId} !== ${currentGroupId}`);

                try {

                    await streamChatService.deleteMessage(event.channel_custom.groupChatID, message.id);
                    logger.success(`Deleted message with invalid group link from ${message.user.name || message.user.id}`);
                    var mention_message = `@${message.user.name || message.user.id} fuck off don’t send links from other groups.`;

                    await streamChatService.sendMessage({ channelType, channelId: currentGroupId }, mention_message, {
                        mentioned_users: [message.user.id]
                    });

                    logger.success(`Replied to invalid group link message`);
                } catch (error) {
                    logger.error(`Error handling invalid group link: ${error.message}`);
                }

                return;
            }
        }
    }
}

export { cloudflareAiHandler, checkInvaildLink };
