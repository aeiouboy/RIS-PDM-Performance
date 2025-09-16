/**
 * Dashboard SSE Client
 *
 * Server-Sent Events client for real-time dashboard updates.
 * Implements PRP Task 6 requirements following PRPs/ai_docs/real-time-dashboard-sync-patterns.md
 * SSE implementation pattern with automatic reconnection logic.
 *
 * Key advantages over WebSocket for dashboard updates:
 * - Simpler protocol (unidirectional server-to-client)
 * - Automatic reconnection built into EventSource
 * - Better browser compatibility
 * - Lower overhead for dashboard update use case
 */

class DashboardSSEClient {
  constructor() {
    this.eventSource = null;
    this.isConnected = false;
    this.connectionRetries = 0;
    this.maxRetries = 5;
    this.retryDelay = 1000; // Start with 1 second
    this.maxRetryDelay = 30000; // Max 30 seconds
    this.subscriptions = new Map(); // event type -> Set of callbacks
    this.connectionListeners = new Set();
    this.statusListeners = new Set();
    this.lastHeartbeat = null;
    this.heartbeatInterval = null;

    // Configuration - following websocketService.js pattern
    this.config = {
      // Use Vite proxy for API calls - /api routes are proxied to backend
      serverUrl: (typeof window !== 'undefined' && window.location?.origin) || 'http://localhost:5173',
      endpoint: '/api/sse/dashboard',
      autoConnect: true,
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 10000,
      withCredentials: false
    };

    // Statistics tracking
    this.stats = {
      connectionAttempts: 0,
      successfulConnections: 0,
      reconnections: 0,
      messagesReceived: 0,
      lastConnectionTime: null,
      totalDowntime: 0,
      errors: 0
    };

    // Auto-connect if enabled
    if (this.config.autoConnect) {
      // Delay auto-connect to allow component setup
      setTimeout(() => this.connect(), 100);
    }
  }

  /**
   * Connect to SSE endpoint
   * Following pattern: websocketService.js connect method with SSE adaptations
   */
  async connect() {
    if (this.isConnected && this.eventSource?.readyState === EventSource.OPEN) {
      console.log('🔗 Already connected to SSE server');
      return true;
    }

    try {
      console.log('🔗 Connecting to SSE server at', `${this.config.serverUrl}${this.config.endpoint}`);
      this.stats.connectionAttempts++;

      // Close existing connection if any
      this.disconnect();

      // Create EventSource connection
      const sseUrl = `${this.config.serverUrl}${this.config.endpoint}`;
      this.eventSource = new EventSource(sseUrl, {
        withCredentials: this.config.withCredentials
      });

      // Set up event handlers
      this.setupEventHandlers();

      // Wait for connection to establish
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          console.error('🔗 SSE connection timeout');
          this.handleConnectionError(new Error('Connection timeout'));
          reject(new Error('Connection timeout'));
        }, this.config.timeout);

        // Handle successful connection
        const handleOpen = () => {
          clearTimeout(timeout);
          this.handleConnection();
          resolve(true);
        };

        // Handle connection error
        const handleError = (event) => {
          clearTimeout(timeout);
          console.error('🔗 SSE connection failed:', event);
          const error = new Error('SSE connection failed');
          this.handleConnectionError(error);
          reject(error);
        };

        // Set up temporary listeners for connection establishment
        this.eventSource.addEventListener('open', handleOpen, { once: true });
        this.eventSource.addEventListener('error', handleError, { once: true });
      });

    } catch (error) {
      console.error('🔗 Failed to create SSE connection:', error);
      this.stats.errors++;
      this.isConnected = false;
      return false;
    }
  }

  /**
   * Set up event handlers for SSE connection
   * Following pattern: websocketService.js setupEventHandlers with SSE events
   */
  setupEventHandlers() {
    if (!this.eventSource) return;

    // Handle connection open
    this.eventSource.onopen = () => {
      console.log('🔗 SSE connection established');
      this.handleConnection();
    };

    // Handle connection errors
    this.eventSource.onerror = (event) => {
      console.error('🔗 SSE connection error:', event);
      this.handleConnectionError(new Error('SSE connection error'));
    };

    // Handle general messages
    this.eventSource.onmessage = (event) => {
      this.handleMessage(event);
    };

    // Handle specific event types for dashboard updates
    this.eventSource.addEventListener('sprint_data_updated', (event) => {
      this.handleSprintUpdate(event);
    });

    this.eventSource.addEventListener('work_item_updated', (event) => {
      this.handleWorkItemUpdate(event);
    });

    this.eventSource.addEventListener('sync_completed', (event) => {
      this.handleSyncCompleted(event);
    });

    this.eventSource.addEventListener('heartbeat', (event) => {
      this.handleHeartbeat(event);
    });
  }

  /**
   * Handle successful connection
   * Following pattern: websocketService.js handleConnection
   */
  handleConnection() {
    this.isConnected = true;
    this.connectionRetries = 0;
    this.retryDelay = this.config.reconnectionDelay;
    this.stats.successfulConnections++;
    this.stats.lastConnectionTime = new Date().toISOString();

    console.log('✅ Connected to dashboard SSE server');

    // Start heartbeat monitoring
    this.startHeartbeatMonitoring();

    // Notify connection listeners
    this.notifyConnectionListeners(true);
    this.notifyStatusListeners({
      connected: true,
      timestamp: new Date().toISOString(),
      connectionAttempts: this.stats.connectionAttempts
    });
  }

  /**
   * Handle connection errors and implement reconnection logic
   * Following pattern: websocketService.js handleConnectionError with exponential backoff
   */
  handleConnectionError(error) {
    this.isConnected = false;
    this.stats.errors++;

    console.error('❌ SSE connection error:', error.message);

    // Stop heartbeat monitoring
    this.stopHeartbeatMonitoring();

    // Notify listeners of disconnection
    this.notifyConnectionListeners(false);
    this.notifyStatusListeners({
      connected: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });

    // Implement reconnection logic
    if (this.config.reconnection && this.connectionRetries < this.maxRetries) {
      this.scheduleReconnection();
    } else {
      console.error('🔗 Max reconnection attempts reached, giving up');
      this.notifyStatusListeners({
        connected: false,
        error: 'Max reconnection attempts reached',
        timestamp: new Date().toISOString(),
        finalFailure: true
      });
    }
  }

  /**
   * Schedule reconnection with exponential backoff
   * Following pattern: websocketService.js scheduleReconnection
   */
  scheduleReconnection() {
    this.connectionRetries++;
    const delay = Math.min(this.retryDelay * Math.pow(2, this.connectionRetries - 1), this.maxRetryDelay);

    console.log(`🔄 Scheduling reconnection attempt ${this.connectionRetries}/${this.maxRetries} in ${delay}ms`);

    setTimeout(() => {
      if (!this.isConnected) {
        console.log(`🔄 Attempting to reconnect (${this.connectionRetries}/${this.maxRetries})`);
        this.stats.reconnections++;
        this.connect().catch(error => {
          console.error('🔄 Reconnection failed:', error.message);
        });
      }
    }, delay);
  }

  /**
   * Handle general messages
   * Message routing and statistics
   */
  handleMessage(event) {
    this.stats.messagesReceived++;

    try {
      const data = JSON.parse(event.data);
      console.log('📨 SSE message received:', data.type || 'general');

      // Route to appropriate handler based on data type
      if (data.type) {
        this.notifySubscribers(data.type, data);
      }
    } catch (error) {
      console.warn('📨 Failed to parse SSE message:', error.message);
    }
  }

  /**
   * Handle sprint data updates
   * Specific handler for sprint-related real-time updates
   */
  handleSprintUpdate(event) {
    try {
      const data = JSON.parse(event.data);
      console.log('📊 Sprint data updated:', data);

      this.notifySubscribers('sprint_data_updated', {
        type: 'sprint_data_updated',
        payload: data,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('📊 Failed to handle sprint update:', error.message);
    }
  }

  /**
   * Handle work item updates
   * Specific handler for work item count changes
   */
  handleWorkItemUpdate(event) {
    try {
      const data = JSON.parse(event.data);
      console.log('📋 Work item data updated:', data);

      this.notifySubscribers('work_item_updated', {
        type: 'work_item_updated',
        payload: data,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('📋 Failed to handle work item update:', error.message);
    }
  }

  /**
   * Handle sync completion notifications
   * Notifies when background sync job completes
   */
  handleSyncCompleted(event) {
    try {
      const data = JSON.parse(event.data);
      console.log('🔄 Background sync completed:', data);

      this.notifySubscribers('sync_completed', {
        type: 'sync_completed',
        payload: data,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('🔄 Failed to handle sync completion:', error.message);
    }
  }

  /**
   * Handle heartbeat messages
   * Monitors connection health
   */
  handleHeartbeat() {
    this.lastHeartbeat = new Date().toISOString();
    // Heartbeats are silent unless debugging
    // console.debug('💓 Heartbeat received');
  }

  /**
   * Subscribe to specific event types
   * Following pattern: websocketService.js subscription management
   */
  subscribe(eventType, callback) {
    if (typeof callback !== 'function') {
      throw new Error('Callback must be a function');
    }

    if (!this.subscriptions.has(eventType)) {
      this.subscriptions.set(eventType, new Set());
    }

    this.subscriptions.get(eventType).add(callback);
    console.log(`📡 Subscribed to ${eventType} events`);

    // Return unsubscribe function
    return () => this.unsubscribe(eventType, callback);
  }

  /**
   * Unsubscribe from event types
   */
  unsubscribe(eventType, callback) {
    const eventSubscriptions = this.subscriptions.get(eventType);
    if (eventSubscriptions) {
      eventSubscriptions.delete(callback);
      if (eventSubscriptions.size === 0) {
        this.subscriptions.delete(eventType);
      }
      console.log(`📡 Unsubscribed from ${eventType} events`);
    }
  }

  /**
   * Notify all subscribers of an event
   */
  notifySubscribers(eventType, data) {
    const eventSubscriptions = this.subscriptions.get(eventType);
    if (eventSubscriptions) {
      eventSubscriptions.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in ${eventType} subscription callback:`, error);
        }
      });
    }
  }

  /**
   * Connection listener management
   * Following pattern: websocketService.js connection listener patterns
   */
  addConnectionListener(callback) {
    this.connectionListeners.add(callback);
    return () => this.removeConnectionListener(callback);
  }

  removeConnectionListener(callback) {
    this.connectionListeners.delete(callback);
  }

  notifyConnectionListeners(isConnected) {
    this.connectionListeners.forEach(callback => {
      try {
        callback(isConnected);
      } catch (error) {
        console.error('Error in connection listener:', error);
      }
    });
  }

  /**
   * Status listener management
   */
  addStatusListener(callback) {
    this.statusListeners.add(callback);
    return () => this.removeStatusListener(callback);
  }

  removeStatusListener(callback) {
    this.statusListeners.delete(callback);
  }

  notifyStatusListeners(status) {
    this.statusListeners.forEach(callback => {
      try {
        callback(status);
      } catch (error) {
        console.error('Error in status listener:', error);
      }
    });
  }

  /**
   * Start heartbeat monitoring
   * Detects connection health issues
   */
  startHeartbeatMonitoring() {
    this.stopHeartbeatMonitoring();

    this.heartbeatInterval = setInterval(() => {
      if (this.lastHeartbeat) {
        const timeSinceHeartbeat = Date.now() - new Date(this.lastHeartbeat).getTime();
        const heartbeatTimeout = 60000; // 60 seconds

        if (timeSinceHeartbeat > heartbeatTimeout) {
          console.warn('💓 Heartbeat timeout, connection may be stale');
          this.handleConnectionError(new Error('Heartbeat timeout'));
        }
      }
    }, 30000); // Check every 30 seconds
  }

  /**
   * Stop heartbeat monitoring
   */
  stopHeartbeatMonitoring() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  /**
   * Disconnect from SSE server
   * Following pattern: websocketService.js disconnect
   */
  disconnect() {
    console.log('🔗 Disconnecting from SSE server');

    this.isConnected = false;
    this.stopHeartbeatMonitoring();

    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }

    this.notifyConnectionListeners(false);
    this.notifyStatusListeners({
      connected: false,
      timestamp: new Date().toISOString(),
      reason: 'manual_disconnect'
    });
  }

  /**
   * Force reconnection
   * Following pattern: websocketService.js forceReconnect
   */
  async forceReconnect() {
    console.log('🔄 Forcing SSE reconnection');
    this.connectionRetries = 0;
    this.disconnect();
    return await this.connect();
  }

  /**
   * Get connection status
   * Following pattern: websocketService.js getConnectionStatus
   */
  getConnectionStatus() {
    return {
      isConnected: this.isConnected,
      readyState: this.eventSource?.readyState,
      url: this.eventSource?.url,
      lastHeartbeat: this.lastHeartbeat,
      connectionRetries: this.connectionRetries
    };
  }

  /**
   * Get service statistics
   * Following pattern: websocketService.js getStats
   */
  getStats() {
    return {
      ...this.stats,
      subscriptions: Array.from(this.subscriptions.keys()),
      connectionListeners: this.connectionListeners.size,
      statusListeners: this.statusListeners.size,
      currentStatus: this.getConnectionStatus(),
      uptime: this.stats.lastConnectionTime ?
        Date.now() - new Date(this.stats.lastConnectionTime).getTime() : 0
    };
  }
}

// Create and export singleton instance
const dashboardSSEClient = new DashboardSSEClient();

export default dashboardSSEClient;