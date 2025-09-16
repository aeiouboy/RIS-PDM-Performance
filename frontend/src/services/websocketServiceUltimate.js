/**
 * Ultimate WebSocket Service - Zero Connections Until Explicitly Needed
 * This completely defers Socket.IO loading until connection is required
 */

console.log('🔧 Loading Ultimate WebSocket Service...');

// Ultra-global locks - even more aggressive than minimal
window.__ULTIMATE_WEBSOCKET_LOCK__ = window.__ULTIMATE_WEBSOCKET_LOCK__ || false;
window.__ULTIMATE_WEBSOCKET_INSTANCE__ = window.__ULTIMATE_WEBSOCKET_INSTANCE__ || null;

class UltimateWebSocketService {
  constructor() {
    console.log('🔧 UltimateWebSocketService constructor called');

    // Check if another instance is already locked globally
    if (window.__ULTIMATE_WEBSOCKET_LOCK__) {
      console.warn('🔧 ULTIMATE_WEBSOCKET_LOCK is active globally - BLOCKED');
      return window.__ULTIMATE_WEBSOCKET_INSTANCE__ || this;
    }

    // Return existing instance if it exists
    if (UltimateWebSocketService.instance) {
      console.log('🔧 Returning existing UltimateWebSocketService instance');
      return UltimateWebSocketService.instance;
    }

    // Set the ultimate lock immediately in constructor
    window.__ULTIMATE_WEBSOCKET_LOCK__ = true;

    this.socket = null;
    this.isConnected = false;
    this.connectionAttempted = false;
    this.socketIOImported = false;

    // Set both singleton and global
    UltimateWebSocketService.instance = this;
    window.__ULTIMATE_WEBSOCKET_INSTANCE__ = this;

    console.log('🔧 UltimateWebSocketService instance created with ULTIMATE lock');
  }

  async connect() {
    console.log('🔧 ULTIMATE connect() called - Global Lock:', window.__ULTIMATE_WEBSOCKET_LOCK__, 'Connection Attempted:', this.connectionAttempted);

    // Triple protection - check all locks
    if (this.connectionAttempted || window.__ULTIMATE_WEBSOCKET_LOCK__ !== true || this.socket !== null) {
      console.log('🔧 ULTIMATE connection blocked by safety locks');
      return this.isConnected;
    }

    this.connectionAttempted = true;
    console.log('🔧 ULTIMATE: Beginning single connection attempt...');

    try {
      // Only import Socket.IO when actually needed
      if (!this.socketIOImported) {
        console.log('🔧 ULTIMATE: Importing Socket.IO dynamically...');
        const { io } = await import('socket.io-client');
        this.io = io;
        this.socketIOImported = true;
      }

      console.log('🔧 ULTIMATE: Creating Socket.IO connection');
      this.socket = this.io('http://localhost:3002', {
        transports: ['websocket', 'polling'],
        reconnection: false, // NEVER reconnect automatically
        timeout: 10000,
        forceNew: true,
        path: '/socket.io'
      });

      // Set up event handlers
      this.socket.once('connect', () => {
        console.log('✅ ULTIMATE WebSocket connected successfully');
        this.isConnected = true;
      });

      this.socket.once('connect_error', (error) => {
        console.error('❌ ULTIMATE WebSocket connection failed:', error.message);
        this.cleanup();
      });

      this.socket.on('disconnect', () => {
        console.log('🔌 ULTIMATE WebSocket disconnected');
        this.isConnected = false;
      });

      return true;

    } catch (error) {
      console.error('❌ ULTIMATE failed to create WebSocket:', error);
      this.cleanup();
      return false;
    }
  }

  subscribeToMetrics(type, callback, options = {}) {
    console.log('📊 ULTIMATE subscribe to metrics:', type);
    // Minimal implementation - just return a simple ID
    return `ultimate-${type}-${Date.now()}`;
  }

  unsubscribeFromMetrics(subscriptionId) {
    console.log('📊 ULTIMATE unsubscribe from metrics:', subscriptionId);
    // Minimal implementation - no-op
  }

  addConnectionListener(listener) {
    console.log('🔌 ULTIMATE add connection listener');
    // Call immediately with current status
    if (listener) {
      listener(this.isConnected);
    }
  }

  removeConnectionListener(listener) {
    console.log('🔌 ULTIMATE remove connection listener');
    // Minimal implementation - no-op
  }

  getConnectionStatus() {
    return this.isConnected && this.socket?.connected;
  }

  getStats() {
    return {
      connected: this.isConnected,
      subscriptions: 0,
      serverUrl: 'http://localhost:3002',
      socketId: this.socket?.id || null,
      globalLock: window.__ULTIMATE_WEBSOCKET_LOCK__,
      connectionAttempted: this.connectionAttempted,
      socketIOImported: this.socketIOImported
    };
  }

  disconnect() {
    console.log('🔌 ULTIMATE disconnect called');
    this.cleanup();
  }

  cleanup() {
    console.log('🔧 ULTIMATE cleanup called');
    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
    }
    this.isConnected = false;
    // NEVER reset the ultimate lock
  }

  forceReconnect() {
    console.log('🔌 ULTIMATE force reconnect - PERMANENTLY BLOCKED');
    // Never allow force reconnect
  }
}

// Create and export singleton
const ultimateWebsocketService = new UltimateWebSocketService();

console.log('🔧 Ultimate WebSocket service exported');

export default ultimateWebsocketService;