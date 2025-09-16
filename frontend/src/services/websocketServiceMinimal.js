/**
 * Minimal WebSocket Service - Ultimate Connection Prevention
 * This is the most basic possible implementation to prevent connection loops
 */

console.log('🔧 Loading Minimal WebSocket Service...');

// Global flag to prevent ANY multiple connections
let GLOBAL_CONNECTION_LOCK = false;
let globalSocketInstance = null;

class MinimalWebSocketService {
  constructor() {
    console.log('🔧 MinimalWebSocketService constructor called');

    // Return existing instance if exists
    if (MinimalWebSocketService.instance) {
      console.log('🔧 Returning existing MinimalWebSocketService instance');
      return MinimalWebSocketService.instance;
    }

    // Check global lock
    if (GLOBAL_CONNECTION_LOCK) {
      console.warn('🔧 GLOBAL_CONNECTION_LOCK is active, blocking new instance');
      return MinimalWebSocketService.instance || this;
    }

    this.socket = null;
    this.isConnected = false;
    this.connectionAttempted = false;

    // Set singleton
    MinimalWebSocketService.instance = this;
    console.log('🔧 MinimalWebSocketService instance created');
  }

  async connect() {
    console.log('🔧 connect() called - Global Lock:', GLOBAL_CONNECTION_LOCK, 'Connection Attempted:', this.connectionAttempted);

    // Ultimate protection - never allow more than one connection attempt
    if (GLOBAL_CONNECTION_LOCK || this.connectionAttempted) {
      console.log('🔧 Connection blocked by global lock or previous attempt');
      return false;
    }

    // Set the global lock immediately
    GLOBAL_CONNECTION_LOCK = true;
    this.connectionAttempted = true;

    console.log('🔧 Attempting single WebSocket connection...');

    try {
      // Import Socket.IO dynamically to ensure we control when it loads
      const { io } = await import('socket.io-client');

      // Only create socket if none exists globally
      if (!globalSocketInstance) {
        console.log('🔧 Creating new Socket.IO connection');
        globalSocketInstance = io('http://localhost:5173', {
          transports: ['websocket', 'polling'],
          reconnection: false, // NEVER reconnect automatically
          timeout: 10000,
          forceNew: true,
          path: '/socket.io'
        });

        this.socket = globalSocketInstance;

        this.socket.once('connect', () => {
          console.log('✅ Minimal WebSocket connected successfully');
          this.isConnected = true;
        });

        this.socket.once('connect_error', (error) => {
          console.error('❌ Minimal WebSocket connection failed:', error.message);
          this.cleanup();
        });

        this.socket.on('disconnect', () => {
          console.log('🔌 Minimal WebSocket disconnected');
          this.isConnected = false;
        });

        return true;
      } else {
        console.log('🔧 Using existing global socket instance');
        this.socket = globalSocketInstance;
        this.isConnected = globalSocketInstance.connected;
        return this.isConnected;
      }

    } catch (error) {
      console.error('❌ Failed to create minimal WebSocket:', error);
      this.cleanup();
      return false;
    }
  }

  subscribeToMetrics(type, callback, options = {}) {
    console.log('📊 Minimal subscribe to metrics:', type);
    // Minimal implementation - just return a simple ID
    return `minimal-${type}-${Date.now()}`;
  }

  unsubscribeFromMetrics(subscriptionId) {
    console.log('📊 Minimal unsubscribe from metrics:', subscriptionId);
    // Minimal implementation - no-op
  }

  addConnectionListener(listener) {
    console.log('🔌 Minimal add connection listener');
    // Call immediately with current status
    if (listener) {
      listener(this.isConnected);
    }
  }

  removeConnectionListener(listener) {
    console.log('🔌 Minimal remove connection listener');
    // Minimal implementation - no-op
  }

  getConnectionStatus() {
    return this.isConnected && this.socket?.connected;
  }

  getStats() {
    return {
      connected: this.isConnected,
      subscriptions: 0,
      serverUrl: 'http://localhost:5173',
      socketId: this.socket?.id || null,
      globalLock: GLOBAL_CONNECTION_LOCK
    };
  }

  disconnect() {
    console.log('🔌 Minimal disconnect called');
    this.cleanup();
  }

  cleanup() {
    console.log('🔧 Minimal cleanup called');
    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
    }

    if (globalSocketInstance === this.socket) {
      globalSocketInstance = null;
    }

    this.isConnected = false;
    // DO NOT reset global lock - once locked, stay locked
  }

  forceReconnect() {
    console.log('🔌 Minimal force reconnect - BLOCKED to prevent loops');
    // Never allow force reconnect to prevent loops
  }
}

// Create and export singleton
const minimalWebsocketService = new MinimalWebSocketService();

console.log('🔧 Minimal WebSocket service exported');

export default minimalWebsocketService;