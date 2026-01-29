import * as cloudflareAi from '../utils/cloudflareAi.js';
import { logger } from '../utils/logger.js';
import { streamChatService } from '../services/streamChatService.js';
import { describeImage } from '../utils/cloudflareImageToText.js';

async function cloudflareAiHandler(event) {
    const cid = event.cid;
    const message = event.message;
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


async function imageToTextHandler(event) {
    const cid = event.cid;
    const message = event.message;
    const [channelType, channelId] = cid.split(':');

    var mes = await describeImage(message.attachments[0].image_url);
    if (mes) {
        await streamChatService.replyMessage(
            channelType,
            channelId,
            mes,
            message.id
        );

        logger.success(`AI response sent to ${channelId}`);
    } else {
        logger.error('Failed to get AI response');
    }
}


async function checkInvaildLink(event) {
    const message = event.message;
    const botUserId = streamChatService.client.userID;

    if (message.user.id == botUserId) {
        return;
    }
    const messageText = message?.copyText || message?.content;

    if (!messageText.trim()) {
        return;
    }


    const cid = event.cid;
    const [channelType, currentGroupId] = cid.split(':');



    const linkRegex = /https?:\/\/(www\.)?personality-database\.com\/join_group\?[^\s]+/gi;
    const groupIdRegex = /cid=([^&\s]+)/;
    const linkIdRegex = /[?&]id=([^&\s]+)/;

    const links = messageText.match(linkRegex);

    if (!links || links.length === 0) {
        return;
    }


    for (const link of links) {

        const decodedLink = decodeURIComponent(link);


        const linkIdMatch = decodedLink.match(linkIdRegex);
        const linkGroupChatId = linkIdMatch && linkIdMatch[1];
        // console.log(linkGroupChatId);


        const cidMatch = decodedLink.match(groupIdRegex);
        if (cidMatch && cidMatch[1]) {

            const linkCid = cidMatch[1];
            const [linkChannelType, linkGroupId] = linkCid.split(':');


            if (linkGroupId !== currentGroupId) {
                logger.info(`Invalid group link detected: ${linkGroupId} !== ${currentGroupId}`);

                try {

                    await streamChatService.deleteMessage(event.channel_custom.groupChatID, message.id);
                    logger.success(`Deleted message with invalid group link from ${message.user.name || message.user.id}`);


                    var mention_message = `@${message.user.name || message.user.id} fuck off don't send links from other groups.`;


                    await streamChatService.sendMessage({ channelType, channelId: currentGroupId }, mention_message, {
                        mentioned_users: [message.user.id]
                    });
                    logger.success(`Replied to invalid group link message`);


                    const currentUserId = streamChatService.client.userID;
                    const groupChatId = event.channel_custom.groupChatID;
                    const encodedCid = encodeURIComponent(cid);

                    const inviteLink = `https://www.personality-database.com/join_group?cid=${encodedCid}&id=${groupChatId}&inviteFrom=${currentUserId}`;

                    logger.info(`Created invite link: ${inviteLink}`);
                    await streamChatService.sendMessage({ channelType: linkChannelType, channelId: linkGroupId }, inviteLink);
                    await streamChatService.stopWatching(linkChannelType, linkGroupId);


                } catch (error) {
                    logger.error(`Error handling invalid group link: ${error.message}`);
                }

                return;
            }
        }
    }
}

export { cloudflareAiHandler, checkInvaildLink, imageToTextHandler };
