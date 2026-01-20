import { EventEmitter } from 'events';
import { logger } from '../utils/logger.js';
import { streamChatService } from '../services/streamChatService.js';
import { pdbApi } from '../services/pdbApi.js';
import { MessageHandler } from './MessageHandler.js';
import { registerStreamChatEvents } from '../events/streamChatEvents.js';

export class Client extends EventEmitter {
  constructor(options = {}) {
    super();
    this.options = options;
    this.user = null;
    // Command registry: Map<commandName, handler>
    this.commands = new Map();
    this.ready = false;
    this.commandPrefix = options.commandPrefix || '!';

    // Bind services
    this.streamChat = streamChatService;
    this.api = pdbApi;

    // Initialize message handler
    this.messageHandler = new MessageHandler(this, this.commandPrefix);
  }

  /**
   * Register a command handler
   * 
   * Usage:
   *   client.command("hello", async (ctx) => {
   *     await ctx.reply("Hello!");
   *   });
   * 
   * Or as decorator (for future use):
   *   @client.command("hello")
   *   async function helloCommand(ctx) {
   *     await ctx.reply("Hello!");
   *   }
   */
  command(name, handler) {
    const cmdName = name.toLowerCase();

    if (handler) {
      // Direct registration
      this.commands.set(cmdName, handler);
      return;
    } else {
      // Decorator pattern (for future use)
      return (handler) => {
        this.commands.set(cmdName, handler);
        return handler;
      };
    }
  }

  async login(token) { // Mimic discord.js login, though here we might use token or just start
    // If token is passed, override config
    if (token) {
      // Handle token login if supported by PDB API directly or just set it
    }

    try {
      // Fetch actual user info from PDB API
      const userInfo = await pdbApi.getCurrentUserInfo();

      this.user = {
        id: userInfo.id,
        username: userInfo.name,
        tag: `${userInfo.name}#${userInfo.id}`,
        token: userInfo.token,
        apiKey: userInfo.apiKey,
        image: userInfo.image,
        ...userInfo
      };

      this.userId = userInfo.id; // Compatibility

      // Connect to Stream Chat using SDK
      await this.streamChat.connect(userInfo);

      // Query and watch all channels the user is a member of
      logger.info('Querying user channels...');
      const channels = await this.streamChat.queryChannels(
        { members: { $in: [String(userInfo.id)] } },
        [{ last_message_at: -1 }]
      );
      logger.success(`Watching ${channels.length} channels`);

      // Set up message listeners
      this.setupMessageListeners();

      // Register Stream Chat event handlers
      registerStreamChatEvents(this.streamChat);

      // Mark as ready
      this.ready = true;
      this.emit('ready', this);

    } catch (error) {
      logger.error('Failed to login:', error.message);
      throw error;
    }
  }

  // Alias for start for backward compatibility if needed, but login is more discord.js like
  async start() {
    return this.login();
  }

  setupMessageListeners() {
    // Listen to messages from Stream Chat SDK
    this.streamChat.onMessage(async (event) => {
      // Emit raw event
      this.emit('raw', event);

      // Process message for command handling or 'messageCreate' event
      if (event && event.message) {
        const message = event.message;

        // Add Discord.js-like helpers directly to the message
        message.author = message.user;
        message.content = message.text;
        message.channelId = event.channel?.id || event.cid;

        // Handle command execution directly with SDK format
        await this.messageHandler.handleMessage(event);

        // Emit messageCreate
        this.emit('messageCreate', message);
      }
    });

    logger.debug('Message listeners set up');
  }

  destroy() {
    this.streamChat.disconnect();
    this.ready = false;
    this.removeAllListeners();
  }
}

