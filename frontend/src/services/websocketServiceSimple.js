/**
 * Simplified WebSocket Service
 * Fixed version to prevent connection loops
 */

import { io } from 'socket.io-client';

class SimpleWebSocketService {
  constructor() {
    this.socket = null;
    this.isConnected = false;
    this.isConnecting = false;
    this.subscriptions = new Map();
    this.connectionListeners = new Set();
    this.statusListeners = new Set();
    this.connectionPromise = null;
    this.initialized = false;

    console.log('🔌 SimpleWebSocketService created');

    // Singleton
    if (SimpleWebSocketService.instance) {
      console.log('🔌 Returning existing SimpleWebSocketService instance');
      return SimpleWebSocketService.instance;
    }
    SimpleWebSocketService.instance = this;
  }

  async connect() {
    if (this.initialized) {
      console.log('🔌 Service already initialized, skipping connect');
      return this.isConnected;
    }

    if (this.connectionPromise) {
      console.log('🔌 Connection already in progress, waiting...');
      return this.connectionPromise;
    }

    console.log('🔌 Starting connection...');
    this.initialized = true;
    this.isConnecting = true;

    this.connectionPromise = this.createConnection();

    try {
      const result = await this.connectionPromise;
      return result;
    } finally {
      this.connectionPromise = null;
      this.isConnecting = false;
    }
  }

  async createConnection() {
    try {
      const serverUrl = 'http://localhost:5173'; // Use Vite dev server with proxy

      console.log(`🔌 Connecting to ${serverUrl}...`);

      this.socket = io(serverUrl, {
        transports: ['websocket', 'polling'],
        reconnection: false, // Disable auto-reconnection
        timeout: 5000,
        forceNew: true,
        path: '/socket.io'
      });

      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          console.error('🔌 Connection timeout');
          this.cleanup();
          reject(new Error('Connection timeout'));
        }, 5000);

        this.socket.once('connect', () => {
          clearTimeout(timeout);
          this.isConnected = true;
          console.log('✅ WebSocket connected');
          this.setupEventHandlers();
          this.notifyConnectionListeners(true);
          resolve(true);
        });

        this.socket.once('connect_error', (error) => {
          clearTimeout(timeout);
          console.error('❌ WebSocket connection error:', error.message);
          this.cleanup();
          reject(error);
        });
      });

    } catch (error) {
      console.error('❌ Failed to create WebSocket connection:', error);
      this.cleanup();
      throw error;
    }
  }

  setupEventHandlers() {
    if (!this.socket) return;

    this.socket.on('disconnect', (reason) => {
      console.log(`🔌 Disconnected: ${reason}`);
      this.isConnected = false;
      this.notifyConnectionListeners(false);
    });

    this.socket.on('realtime-status', (status) => {
      this.notifyStatusListeners(status);
    });

    this.socket.on('metrics-update', (update) => {
      this.handleMetricsUpdate(update);
    });
  }

  handleMetricsUpdate(update) {
    const subscriptionKey = this.generateSubscriptionKey(update.type, update.userId, update.teamId);
    const callback = this.subscriptions.get(subscriptionKey);

    if (callback) {
      try {
        callback(update);
      } catch (error) {
        console.error('📊 Error in metrics update callback:', error);
      }
    }
  }

  subscribeToMetrics(type, callback, options = {}) {
    const subscriptionKey = this.generateSubscriptionKey(type, options.userId, options.teamId);
    this.subscriptions.set(subscriptionKey, callback);

    if (this.socket && this.isConnected) {
      this.socket.emit('subscribe-metrics', {
        type,
        userId: options.userId || null,
        teamId: options.teamId || null,
        filters: options.filters || {}
      });
    }

    return subscriptionKey;
  }

  unsubscribeFromMetrics(subscriptionId) {
    this.subscriptions.delete(subscriptionId);

    if (this.socket && this.isConnected) {
      const [type, userId, teamId] = subscriptionId.split('-');
      this.socket.emit('unsubscribe-metrics', {
        type: type === 'all' ? 'all' : type,
        userId: userId === 'all' ? null : userId,
        teamId: teamId === 'all' ? null : teamId
      });
    }
  }

  generateSubscriptionKey(type, userId, teamId) {
    return `${type || 'all'}-${userId || 'all'}-${teamId || 'all'}`;
  }

  addConnectionListener(listener) {
    this.connectionListeners.add(listener);
    listener(this.isConnected);
  }

  removeConnectionListener(listener) {
    this.connectionListeners.delete(listener);
  }

  notifyConnectionListeners(connected) {
    for (const listener of this.connectionListeners) {
      try {
        listener(connected);
      } catch (error) {
        console.error('🔌 Error in connection listener:', error);
      }
    }
  }

  addStatusListener(listener) {
    this.statusListeners.add(listener);
  }

  removeStatusListener(listener) {
    this.statusListeners.delete(listener);
  }

  notifyStatusListeners(status) {
    for (const listener of this.statusListeners) {
      try {
        listener(status);
      } catch (error) {
        console.error('📊 Error in status listener:', error);
      }
    }
  }

  getConnectionStatus() {
    return this.isConnected && this.socket?.connected;
  }

  getStats() {
    return {
      connected: this.isConnected,
      subscriptions: this.subscriptions.size,
      serverUrl: 'http://localhost:5173',
      socketId: this.socket?.id || null
    };
  }

  disconnect() {
    this.cleanup();
  }

  cleanup() {
    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
    }
    this.isConnected = false;
    this.subscriptions.clear();
    this.notifyConnectionListeners(false);
  }

  forceReconnect() {
    console.log('🔌 Force reconnect requested - cleaning up and reconnecting');
    this.cleanup();
    this.initialized = false;
    this.connect();
  }
}

// Create singleton instance
const simpleWebsocketService = new SimpleWebSocketService();

export default simpleWebsocketService;