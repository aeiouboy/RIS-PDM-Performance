/**
 * WebSocket Service for Real-time Updates
 * Manages Socket.IO connection and handles real-time metric updates
 */

import { io } from 'socket.io-client';

class WebSocketService {
  constructor() {
    this.socket = null;
    this.isConnected = false;
    this.isConnecting = false; // Prevent multiple connection attempts
    this.connectionPromise = null; // Store active connection promise
    this.connectionRetries = 0;
    this.maxRetries = 5;
    this.retryDelay = 1000; // Start with 1 second
    this.maxRetryDelay = 30000; // Max 30 seconds
    this.subscriptions = new Map(); // trackingId -> callback
    this.connectionListeners = new Set();
    this.statusListeners = new Set();

    // Configuration
    this.config = {
      // Use current origin for Vite dev server, which proxies /socket.io to backend (3002)
      serverUrl: (typeof window !== 'undefined' && window.location?.origin) || 'http://localhost:5173',
      autoConnect: true,
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 10000,
      forceNew: false,
      path: '/socket.io'
    };

    // Singleton pattern to prevent multiple instances
    if (WebSocketService.instance) {
      return WebSocketService.instance;
    }
    WebSocketService.instance = this;
  }

  /**
   * Establish WebSocket connection to server
   * @returns {Promise<boolean>} Connection success status
   */
  async connect() {
    console.log('🔍 WebSocket connect() called - current state:', {
      isConnected: this.isConnected,
      isConnecting: this.isConnecting,
      hasPromise: !!this.connectionPromise,
      socketConnected: this.socket?.connected
    });

    // Return existing connection promise if already connecting
    if (this.connectionPromise) {
      console.log('🔌 Reusing existing connection attempt');
      return this.connectionPromise;
    }

    // Return true if already connected
    if (this.isConnected && this.socket?.connected) {
      console.log('🔌 Already connected to WebSocket server');
      return Promise.resolve(true);
    }

    // Create new connection promise
    this.connectionPromise = this._performConnection();

    try {
      const result = await this.connectionPromise;
      console.log('🔌 Connection attempt finished with result:', result);
      return result;
    } finally {
      // Clear the promise when done (success or failure)
      this.connectionPromise = null;
    }
  }

  async _performConnection() {
    this.isConnecting = true;

    try {
      console.log('🔌 Connecting to WebSocket server at', this.config.serverUrl);

      // Clean up existing connection if any
      if (this.socket) {
        this.socket.removeAllListeners();
        this.socket.disconnect();
        this.socket = null;
      }

      // Create socket connection with disabled auto-reconnection to prevent loops
      this.socket = io(this.config.serverUrl, {
        transports: ['websocket', 'polling'],
        reconnection: false, // Disable automatic reconnection to handle manually
        timeout: this.config.timeout,
        forceNew: true, // Force new connection each time
        path: this.config.path
      });

      // Set up event handlers
      this.setupEventHandlers();

      // Wait for connection to establish
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          console.error('🔌 Connection timeout');
          this.isConnecting = false;
          reject(new Error('Connection timeout'));
        }, this.config.timeout);

        this.socket.on('connect', () => {
          clearTimeout(timeout);
          this.isConnecting = false;
          resolve(true);
        });

        this.socket.on('connect_error', (error) => {
          clearTimeout(timeout);
          this.isConnecting = false;
          console.error('🔌 Connection failed:', error);
          reject(error);
        });
      });

    } catch (error) {
      console.error('🔌 Failed to create WebSocket connection:', error);
      this.isConnected = false;
      this.isConnecting = false;
      return false;
    }
  }

  /**
   * Setup WebSocket event handlers
   */
  setupEventHandlers() {
    if (!this.socket) return;

    // Connection events
    this.socket.on('connect', () => {
      this.handleConnection();
    });

    this.socket.on('disconnect', (reason) => {
      this.handleDisconnection(reason);
    });

    this.socket.on('connect_error', (error) => {
      this.handleConnectionError(error);
    });

    // Real-time data events
    this.socket.on('connected', (data) => {
      console.log('🔌 Server acknowledgment:', data);
    });

    this.socket.on('realtime-status', (status) => {
      console.log('📊 Real-time status update:', status);
      this.notifyStatusListeners(status);
    });

    this.socket.on('metrics-update', (update) => {
      this.handleMetricsUpdate(update);
    });

    // Error events
    this.socket.on('error', (error) => {
      console.error('🔌 WebSocket error:', error);
    });
  }

  /**
   * Handle successful connection
   */
  handleConnection() {
    this.isConnected = true;
    this.connectionRetries = 0;
    this.retryDelay = 1000;
    
    console.log('🔌 Connected to WebSocket server');
    this.notifyConnectionListeners(true);
  }

  /**
   * Handle disconnection
   * @param {string} reason - Disconnect reason
   */
  handleDisconnection(reason) {
    this.isConnected = false;
    console.log(`🔌 Disconnected from WebSocket server: ${reason}`);
    this.notifyConnectionListeners(false);

    // Attempt reconnection for unexpected disconnections
    if (reason !== 'io client disconnect' && this.config.reconnection) {
      this.scheduleReconnection();
    }
  }

  /**
   * Handle connection error
   * @param {Error} error - Connection error
   */
  handleConnectionError(error) {
    console.error('🔌 WebSocket connection error:', error);
    this.isConnected = false;
    this.notifyConnectionListeners(false);
    
    if (this.config.reconnection) {
      this.scheduleReconnection();
    }
  }

  /**
   * Schedule reconnection with exponential backoff
   */
  scheduleReconnection() {
    if (this.connectionRetries >= this.maxRetries) {
      console.error('🔌 Max reconnection attempts reached');
      return;
    }

    // Don't schedule if already connecting
    if (this.connectionPromise) {
      console.log('🔌 Connection attempt already in progress, skipping scheduled reconnection');
      return;
    }

    this.connectionRetries++;
    const delay = Math.min(this.retryDelay * Math.pow(2, this.connectionRetries - 1), this.maxRetryDelay);

    console.log(`🔌 Scheduling reconnection attempt ${this.connectionRetries}/${this.maxRetries} in ${delay}ms`);

    setTimeout(() => {
      if (!this.isConnected && !this.connectionPromise) {
        console.log('🔌 Attempting to reconnect...');
        this.connect();
      }
    }, delay);
  }

  /**
   * Handle incoming metrics updates
   * @param {object} update - Metrics update data
   */
  handleMetricsUpdate(update) {
    console.log('📊 Received metrics update:', update.type, update.timestamp);
    
    // Notify relevant subscribers
    const subscriptionKey = this.generateSubscriptionKey(update.type, update.userId, update.teamId);
    const callback = this.subscriptions.get(subscriptionKey);
    
    if (callback) {
      try {
        callback(update);
      } catch (error) {
        console.error('📊 Error in metrics update callback:', error);
      }
    }

    // Also notify wildcard subscribers
    const wildcardCallback = this.subscriptions.get('all');
    if (wildcardCallback && wildcardCallback !== callback) {
      try {
        wildcardCallback(update);
      } catch (error) {
        console.error('📊 Error in wildcard metrics update callback:', error);
      }
    }
  }

  /**
   * Subscribe to metrics updates
   * @param {string} type - Metrics type ('all', 'user', 'team', etc.)
   * @param {function} callback - Callback function to handle updates
   * @param {object} options - Subscription options (userId, teamId, etc.)
   * @returns {string} Subscription ID for unsubscribing
   */
  subscribeToMetrics(type = 'all', callback, options = {}) {
    if (!callback || typeof callback !== 'function') {
      console.error('📊 Invalid callback provided for metrics subscription');
      return null;
    }

    // Generate unique subscription key
    const subscriptionKey = this.generateSubscriptionKey(type, options.userId, options.teamId);
    
    // Store callback
    this.subscriptions.set(subscriptionKey, callback);
    
    // Send subscription request to server if connected
    if (this.socket && this.isConnected) {
      this.socket.emit('subscribe-metrics', {
        type: type,
        userId: options.userId || null,
        teamId: options.teamId || null,
        filters: options.filters || {}
      });
    }
    
    console.log(`📊 Subscribed to metrics: ${subscriptionKey}`);
    return subscriptionKey;
  }

  /**
   * Unsubscribe from metrics updates
   * @param {string} subscriptionId - Subscription ID returned from subscribe
   */
  unsubscribeFromMetrics(subscriptionId) {
    if (!subscriptionId || !this.subscriptions.has(subscriptionId)) {
      return;
    }

    // Remove callback
    this.subscriptions.delete(subscriptionId);
    
    // Parse subscription key to get original parameters
    const [type, userId, teamId] = subscriptionId.split('-');
    
    // Send unsubscription request to server
    if (this.socket) {
      this.socket.emit('unsubscribe-metrics', {
        type: type === 'all' ? 'all' : type,
        userId: userId === 'all' ? null : userId,
        teamId: teamId === 'all' ? null : teamId
      });
    }
    
    console.log(`📊 Unsubscribed from metrics: ${subscriptionId}`);
  }

  /**
   * Subscribe to individual performance metrics
   * @param {string} userId - User ID for individual performance
   * @param {object} options - Additional options
   * @param {string} options.productId - Optional product/project filter
   * @param {function} callback - Callback function for updates
   * @returns {string|null} Subscription ID
   */
  subscribeToIndividualPerformance(userId, callback, options = {}) {
    if (!callback || typeof callback !== 'function') {
      console.error('👤 Invalid callback provided for individual performance subscription');
      return null;
    }

    if (!userId) {
      console.error('👤 User ID is required for individual performance subscription');
      return null;
    }

    const { productId = null } = options;
    const subscriptionKey = `individual-${userId}-${productId || 'all'}`;
    
    // Store callback
    this.subscriptions.set(subscriptionKey, callback);
    
    // Send subscription request to server if connected
    if (this.socket && this.isConnected) {
      this.socket.emit('subscribe-individual', {
        userId,
        productId
      });
      
      // Also listen for individual-specific events
      this.socket.on('individual-metrics-updated', callback);
      this.socket.on('individual-workitem-changed', callback);
    }
    
    console.log(`👤 Subscribed to individual performance: ${userId} (project: ${productId || 'all'})`);
    return subscriptionKey;
  }

  /**
   * Unsubscribe from individual performance metrics
   * @param {string} userId - User ID
   * @param {object} options - Additional options
   * @param {string} options.productId - Optional product/project filter
   */
  unsubscribeFromIndividualPerformance(userId, options = {}) {
    if (!userId) return;

    const { productId = null } = options;
    const subscriptionKey = `individual-${userId}-${productId || 'all'}`;
    
    // Remove callback
    this.subscriptions.delete(subscriptionKey);
    
    // Send unsubscription request to server if connected
    if (this.socket && this.isConnected) {
      this.socket.emit('unsubscribe-individual', {
        userId,
        productId
      });
      
      // Remove individual-specific event listeners
      this.socket.off('individual-metrics-updated');
      this.socket.off('individual-workitem-changed');
    }
    
    console.log(`👤 Unsubscribed from individual performance: ${userId}`);
  }

  /**
   * Generate subscription key
   * @param {string} type - Metrics type
   * @param {string} userId - User ID (optional)
   * @param {string} teamId - Team ID (optional)
   * @returns {string} Subscription key
   */
  generateSubscriptionKey(type, userId, teamId) {
    return `${type || 'all'}-${userId || 'all'}-${teamId || 'all'}`;
  }

  /**
   * Add connection status listener
   * @param {function} listener - Listener function
   */
  addConnectionListener(listener) {
    this.connectionListeners.add(listener);
    
    // Immediately call with current status
    listener(this.isConnected);
  }

  /**
   * Remove connection status listener
   * @param {function} listener - Listener function
   */
  removeConnectionListener(listener) {
    this.connectionListeners.delete(listener);
  }

  /**
   * Notify connection listeners
   * @param {boolean} connected - Connection status
   */
  notifyConnectionListeners(connected) {
    for (const listener of this.connectionListeners) {
      try {
        listener(connected);
      } catch (error) {
        console.error('🔌 Error in connection listener:', error);
      }
    }
  }

  /**
   * Add status listener for real-time service status
   * @param {function} listener - Listener function
   */
  addStatusListener(listener) {
    this.statusListeners.add(listener);
  }

  /**
   * Remove status listener
   * @param {function} listener - Listener function
   */
  removeStatusListener(listener) {
    this.statusListeners.delete(listener);
  }

  /**
   * Notify status listeners
   * @param {object} status - Service status
   */
  notifyStatusListeners(status) {
    for (const listener of this.statusListeners) {
      try {
        listener(status);
      } catch (error) {
        console.error('📊 Error in status listener:', error);
      }
    }
  }

  /**
   * Disconnect from WebSocket server
   */
  disconnect() {
    if (this.socket) {
      console.log('🔌 Disconnecting from WebSocket server');
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
    }

    this.isConnected = false;
    this.isConnecting = false;
    this.connectionPromise = null; // Clear any pending connection promise
    this.subscriptions.clear();
    this.notifyConnectionListeners(false);
  }

  /**
   * Get connection status
   * @returns {boolean} Connection status
   */
  getConnectionStatus() {
    return this.isConnected && this.socket?.connected;
  }

  /**
   * Get service statistics
   * @returns {object} Service statistics
   */
  getStats() {
    return {
      connected: this.isConnected,
      subscriptions: this.subscriptions.size,
      retries: this.connectionRetries,
      serverUrl: this.config.serverUrl,
      socketId: this.socket?.id || null
    };
  }

  /**
   * Force reconnection
   */
  forceReconnect() {
    console.log('🔌 Forcing reconnection...');
    if (this.socket) {
      this.socket.disconnect();
    }
    this.connectionRetries = 0;
    this.connect();
  }
}

// Create singleton instance
const websocketService = new WebSocketService();

export default websocketService;