# Real-Time Dashboard Synchronization Patterns

**Purpose**: Implementation patterns for real-time data synchronization in dashboard applications with Azure DevOps integration.

## Architecture Selection

### Server-Sent Events (SSE) vs WebSocket

**Recommended: Server-Sent Events (SSE)**
- **Simpler implementation**: HTTP-based protocol
- **Automatic reconnection**: Built-in browser support
- **Better for dashboard**: Unidirectional server-to-client data flow
- **Performance**: Sub-second data delivery (vs 10+ second polling)

**When to Use WebSocket**:
- Bidirectional communication needed
- Real-time collaboration features
- Complex client-server interactions

## SSE Implementation Pattern

### Backend SSE Endpoint
```javascript
// Express.js SSE endpoint
app.get('/api/sse/dashboard', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*'
  });

  // Send initial data
  res.write(`data: ${JSON.stringify({ type: 'connected', timestamp: Date.now() })}\n\n`);

  // Store connection for broadcasting
  connections.add(res);

  req.on('close', () => {
    connections.delete(res);
  });
});
```

### Frontend SSE Consumer
```javascript
class DashboardSSEClient {
  constructor(endpoint = '/api/sse/dashboard') {
    this.endpoint = endpoint;
    this.eventSource = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
  }

  connect() {
    this.eventSource = new EventSource(this.endpoint);

    this.eventSource.onopen = () => {
      console.log('SSE connected');
      this.reconnectAttempts = 0;
    };

    this.eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);
      this.handleDashboardUpdate(data);
    };

    this.eventSource.onerror = () => {
      this.handleReconnection();
    };
  }

  handleReconnection() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      const delay = Math.pow(2, this.reconnectAttempts) * 1000; // Exponential backoff
      setTimeout(() => {
        this.reconnectAttempts++;
        this.connect();
      }, delay);
    }
  }
}
```

## Intelligent Caching Strategy

### Multi-Layer Cache Architecture
```javascript
class IntelligentCache {
  constructor() {
    this.memoryCache = new Map();
    this.redisCache = redisClient;
    this.cacheTTL = {
      workItems: 5 * 60 * 1000,      // 5 minutes
      sprints: 30 * 60 * 1000,       // 30 minutes
      velocity: 60 * 60 * 1000,      // 1 hour
    };
  }

  async get(key, type) {
    // 1. Check memory cache first (fastest)
    const memoryData = this.memoryCache.get(key);
    if (memoryData && !this.isExpired(memoryData, type)) {
      return memoryData.data;
    }

    // 2. Check Redis cache (fast)
    const redisData = await this.redisCache.get(key);
    if (redisData) {
      const parsed = JSON.parse(redisData);
      if (!this.isExpired(parsed, type)) {
        // Populate memory cache
        this.memoryCache.set(key, parsed);
        return parsed.data;
      }
    }

    return null;
  }

  async set(key, data, type) {
    const cacheEntry = {
      data,
      timestamp: Date.now(),
      type
    };

    // Store in both layers
    this.memoryCache.set(key, cacheEntry);
    await this.redisCache.setex(key, this.cacheTTL[type] / 1000, JSON.stringify(cacheEntry));
  }
}
```

### Cache Invalidation on Data Changes
```javascript
class CacheInvalidationService {
  constructor(cache, sseService) {
    this.cache = cache;
    this.sseService = sseService;
  }

  async invalidateWorkItems(projectId, sprintId) {
    const keysToInvalidate = [
      `workitems-${projectId}-${sprintId}`,
      `sprint-${sprintId}`,
      `kpis-${projectId}-${sprintId}`
    ];

    // Remove from cache
    for (const key of keysToInvalidate) {
      await this.cache.delete(key);
    }

    // Trigger SSE update
    this.sseService.broadcast({
      type: 'cache_invalidated',
      keys: keysToInvalidate,
      timestamp: Date.now()
    });
  }
}
```

## Background Data Sync

### Scheduled Background Jobs
```javascript
// Cron-based data sync every 15 minutes during business hours
const cron = require('node-cron');

class BackgroundSyncService {
  constructor(azureService, cacheService, sseService) {
    this.azureService = azureService;
    this.cacheService = cacheService;
    this.sseService = sseService;
  }

  startScheduledSync() {
    // Every 15 minutes, 8 AM to 6 PM, weekdays only
    cron.schedule('*/15 8-18 * * 1-5', async () => {
      await this.performDataSync();
    }, {
      timezone: 'America/New_York'
    });
  }

  async performDataSync() {
    try {
      const projects = await this.getActiveProjects();

      for (const project of projects) {
        const currentSprint = await this.azureService.getCurrentSprint(project.id, project.team);
        if (currentSprint) {
          const workItems = await this.azureService.getSprintWorkItems(currentSprint.id);

          // Update cache
          await this.cacheService.set(`workitems-${project.id}-${currentSprint.id}`, workItems, 'workItems');

          // Broadcast update via SSE
          this.sseService.broadcast({
            type: 'workitems_updated',
            projectId: project.id,
            sprintId: currentSprint.id,
            data: this.transformWorkItemsForDashboard(workItems),
            timestamp: Date.now()
          });
        }
      }
    } catch (error) {
      console.error('Background sync failed:', error);
    }
  }
}
```

## Threshold-Based Updates

### Smart Update Detection
```javascript
class SmartUpdateDetector {
  constructor(threshold = 0.05) { // 5% change threshold
    this.threshold = threshold;
    this.lastKnownValues = new Map();
  }

  shouldUpdate(key, newValue, oldValue) {
    if (!oldValue) return true; // First time data

    // For bug counts, any change is significant
    if (key.includes('bugs')) {
      return newValue !== oldValue;
    }

    // For other metrics, use percentage threshold
    const percentChange = Math.abs(newValue - oldValue) / oldValue;
    return percentChange >= this.threshold;
  }

  checkAndUpdate(key, newData) {
    const oldData = this.lastKnownValues.get(key);

    if (this.shouldUpdate(key, newData.value, oldData?.value)) {
      this.lastKnownValues.set(key, newData);
      return { shouldUpdate: true, changePercent: this.calculateChangePercent(oldData, newData) };
    }

    return { shouldUpdate: false };
  }
}
```

## Azure DevOps Webhook Integration

### Webhook Handler for Real-Time Updates
```javascript
class AzureDevOpsWebhookHandler {
  constructor(cacheService, sseService) {
    this.cacheService = cacheService;
    this.sseService = sseService;
  }

  async handleWorkItemUpdate(webhookPayload) {
    const workItem = webhookPayload.resource;
    const projectId = webhookPayload.resourceContainers.project.id;

    // Extract sprint information
    const iterationPath = workItem.fields['System.IterationPath'];
    const sprintId = await this.extractSprintId(iterationPath);

    // Invalidate relevant caches
    await this.cacheService.invalidateWorkItems(projectId, sprintId);

    // Broadcast real-time update
    this.sseService.broadcast({
      type: 'workitem_changed',
      workItemId: workItem.id,
      projectId,
      sprintId,
      changeType: this.determineChangeType(webhookPayload),
      timestamp: Date.now()
    });
  }

  setupWebhookEndpoints(app) {
    app.post('/webhooks/azure-devops/workitem-updated', (req, res) => {
      this.handleWorkItemUpdate(req.body);
      res.status(200).send('OK');
    });
  }
}
```

## Performance Monitoring

### Real-Time Metrics Collection
```javascript
class PerformanceMonitor {
  constructor() {
    this.metrics = {
      sseConnections: 0,
      cacheHitRate: 0,
      apiResponseTime: [],
      lastUpdateTimes: new Map()
    };
  }

  recordCacheHit(hit) {
    this.metrics.cacheHitRate = this.calculateRunningAverage(this.metrics.cacheHitRate, hit ? 1 : 0);
  }

  recordApiResponse(responseTime) {
    this.metrics.apiResponseTime.push(responseTime);
    if (this.metrics.apiResponseTime.length > 100) {
      this.metrics.apiResponseTime.shift(); // Keep last 100 samples
    }
  }

  getHealthMetrics() {
    return {
      sseConnections: this.metrics.sseConnections,
      cacheHitRate: this.metrics.cacheHitRate,
      avgApiResponseTime: this.calculateAverage(this.metrics.apiResponseTime),
      lastDataUpdate: Math.max(...Array.from(this.metrics.lastUpdateTimes.values()))
    };
  }
}
```

## Graceful Degradation

### Fallback Strategies
```javascript
class FallbackManager {
  constructor(cacheService) {
    this.cacheService = cacheService;
    this.degradationLevels = {
      FULL: 'full', // Real-time with Azure DevOps API
      CACHED: 'cached', // Cached data only
      MOCK: 'mock' // Mock/fallback data
    };
    this.currentLevel = this.degradationLevels.FULL;
  }

  async getData(key, fetchFunction, mockData) {
    switch (this.currentLevel) {
      case this.degradationLevels.FULL:
        try {
          const data = await fetchFunction();
          await this.cacheService.set(key, data, 'workItems');
          return data;
        } catch (error) {
          // Degrade to cached
          this.currentLevel = this.degradationLevels.CACHED;
          return this.getData(key, fetchFunction, mockData);
        }

      case this.degradationLevels.CACHED:
        const cachedData = await this.cacheService.get(key, 'workItems');
        if (cachedData) {
          return cachedData;
        }
        // Degrade to mock
        this.currentLevel = this.degradationLevels.MOCK;
        return mockData;

      case this.degradationLevels.MOCK:
      default:
        return mockData;
    }
  }
}
```

## Implementation Recommendations

### For RIS-PDM Dashboard Fix:

1. **Start with SSE**: Simpler than WebSocket for dashboard use case
2. **Implement intelligent caching**: Use 5-minute TTL for work items
3. **Background sync**: 15-minute intervals during business hours
4. **Threshold-based updates**: Only push significant changes (>5% or bug count changes)
5. **Graceful degradation**: Fall back to cached → mock data on failures

### Performance Targets:
- **Data freshness**: <5 minutes for work items, <30 minutes for sprints
- **Response time**: <2 seconds for dashboard loads
- **Cache hit rate**: >80% for work items
- **Real-time delivery**: <1 second for SSE updates

**References**:
- Shopify Real-Time Architecture: Performance improvements from polling to SSE
- Growth-onomics Caching Strategies: Multi-layer caching for dashboard applications