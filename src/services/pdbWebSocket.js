import WebSocket from 'ws';
import jsonParseSafe from 'json-parse-safe';
import { logger } from '../utils/logger.js';
import { pdbApi } from './pdbApi.js';

class PDBWebSocketClient {
  constructor() {
    this.ws = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 10;
    this.reconnectDelay = 1000;
    this.isConnecting = false;
    this.messageQueue = [];
    this.onMessageCallback = null;
    this.onOpenCallback = null;
    this.onErrorCallback = null;
    this.onCloseCallback = null;
    this.connectionData = null;
    this.healthCheckInterval = null;
  }

  async connect(userInfo = null) {
    if (this.isConnecting || (this.ws && this.ws.readyState === WebSocket.OPEN)) {
      return;
    }

    this.isConnecting = true;

    const user = userInfo || await pdbApi.getCurrentUserInfo();

    const connectionJson = {
      user_details: {
        id: String(user.id),
      },
      user_id: String(user.id),
      server_determines_connection_id: true,
      "X-Stream-Client": "stream-chat-android-5.17.28|os=Android 9|api_version=28|device_vendor=asus|device_model=ASUS_X00TD|offline_enabled=true"
    };

    const wsUrl = new URL('wss://chat.stream-io-api.com/connect');
    wsUrl.searchParams.set('json', JSON.stringify(connectionJson));
    wsUrl.searchParams.set('api_key', user.apiKey);
    wsUrl.searchParams.set('authorization', user.token);
    wsUrl.searchParams.set('stream-auth-type', 'jwt');

    console.log(wsUrl.toString());

    this.ws = new WebSocket(wsUrl.toString());

    this.ws.on('open', () => {
      logger.success('WebSocket connected successfully');
      this.isConnecting = false;
      this.reconnectAttempts = 0;
      this.reconnectDelay = 1000;
      this.connectionData = null;
      this.stopHealthCheck();

      if (this.onOpenCallback) {
        this.onOpenCallback();
      }

      this.flushMessageQueue();
    });

    this.ws.on('message', (data) => {
      const message = data.toString();
      let parsedMessage;

      try {
        parsedMessage = JSON.parse(message);
      } catch {
        return;
      }

      if (!this.connectionData && parsedMessage.connection_id && parsedMessage.me) {
        this.connectionData = {
          connection_id: parsedMessage.connection_id,
          me: parsedMessage.me,
        };
        this.startHealthCheck();
      }

      if (this.onMessageCallback && parsedMessage && parsedMessage.type === 'notification.message_new') {
        this.onMessageCallback(parsedMessage);
      }
    });

    this.ws.on('error', (error) => {
      logger.error('WebSocket error:', error.message);
      this.isConnecting = false;

      if (this.onErrorCallback) {
        this.onErrorCallback(error);
      }
    });

    this.ws.on('close', (code, reason) => {
      this.isConnecting = false;
      this.ws = null;
      this.stopHealthCheck();

      if (this.onCloseCallback) {
        this.onCloseCallback(code, reason);
      }

      if (code !== 1000) {
        this.scheduleReconnect();
      }
    });
  }

  scheduleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1), 30000);

    setTimeout(() => {
      this.connect();
    }, delay);
  }

  flushMessageQueue() {
    while (this.messageQueue.length > 0 && this.ws && this.ws.readyState === WebSocket.OPEN) {
      const message = this.messageQueue.shift();
      this.send(message);
    }
  }

  send(message) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      this.messageQueue.push(message);
      return false;
    }

    const messageStr = typeof message === 'string' ? message : JSON.stringify(message);
    this.ws.send(messageStr);
    return true;
  }

  onMessage(callback) {
    this.onMessageCallback = callback;
  }

  onOpen(callback) {
    this.onOpenCallback = callback;
  }

  onError(callback) {
    this.onErrorCallback = callback;
  }

  onClose(callback) {
    this.onCloseCallback = callback;
  }

  disconnect() {
    this.stopHealthCheck();
    if (this.ws) {
      this.ws.close(1000, 'Client disconnect');
      this.ws = null;
    }
    this.messageQueue = [];
    this.reconnectAttempts = this.maxReconnectAttempts;
    this.connectionData = null;
  }

  isConnected() {
    return this.ws && this.ws.readyState === WebSocket.OPEN;
  }

  startHealthCheck() {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    if (!this.connectionData) {
      return;
    }

    this.healthCheckInterval = setInterval(() => {
      if (!this.isConnected() || !this.connectionData) {
        return;
      }

      const healthCheckMessage = {
        type: 'health.check',
        created_at: new Date().toISOString(),
        me: {
          banned: this.connectionData.me.banned || false,
          id: this.connectionData.me.id,
          name: this.connectionData.me.name,
          image: this.connectionData.me.image,
          invisible: this.connectionData.me.invisible || false,
          language: this.connectionData.me.language || 'en',
          role: this.connectionData.me.role || 'user',
          devices: (this.connectionData.me.devices || []).map(device => ({
            id: device.id,
            push_provider: device.push_provider,
          })),
          teams: this.connectionData.me.teams || [],
          unread_threads: this.connectionData.me.unread_threads || 0,
          gender: this.connectionData.me.gender,
          region: this.connectionData.me.region,
          regionEmoji: this.connectionData.me.regionEmoji,
          mbti: this.connectionData.me.mbti,
        },
        connection_id: this.connectionData.connection_id,
      };

      this.send(healthCheckMessage);
    }, 10000);
  }

  stopHealthCheck() {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
  }
}

export const pdbWebSocket = new PDBWebSocketClient();
