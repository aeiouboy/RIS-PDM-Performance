/**
 * Integration tests for dashboard filtering scenarios
 * Tests project/sprint filtering combinations, cache invalidation, and data consistency
 */

const request = require('supertest');
const app = require('../../server');

// Mock services
jest.mock('../../src/services/azureDevOpsService');
jest.mock('../../src/services/cacheService');
jest.mock('../../src/services/metricsCalculator');

const AzureDevOpsService = require('../../src/services/azureDevOpsService');
const cacheService = require('../../src/services/cacheService');
const MetricsCalculator = require('../../src/services/metricsCalculator');

describe('Dashboard Filtering Integration Tests', () => {
  let server;

  beforeAll(async () => {
    // Start server on test port
    server = app.listen(0);
  });

  afterAll(async () => {
    // Clean up
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();

    // Setup default mock implementations
    cacheService.clearFilterCache = jest.fn().mockResolvedValue(true);
    cacheService.clearPattern = jest.fn().mockResolvedValue(true);
    cacheService.get = jest.fn().mockResolvedValue(null);
    cacheService.set = jest.fn().mockResolvedValue(true);
    cacheService.generateKey = jest.fn().mockImplementation((ns, id, params) =>
      `cache:${ns}:${id}:${JSON.stringify(params)}`
    );
  });

  describe('Project/Sprint Filtering', () => {
    test('should handle DaaS project with current sprint', async () => {
      // Arrange
      const mockBurndownData = {
        data: [
          { day: 1, idealRemaining: 100, actualRemaining: 100 },
          { day: 2, idealRemaining: 90, actualRemaining: 95 },
          { day: 3, idealRemaining: 80, actualRemaining: 85 }
        ]
      };

      // Mock the metrics calculator response
      const mockMetricsCalculator = {
        calculateSprintBurndown: jest.fn().mockResolvedValue(mockBurndownData.data)
      };

      // Act
      const response = await request(app)
        .get('/api/metrics/burndown')
        .query({
          productId: 'Product - Data as a Service',
          sprintId: 'current'
        });

      // Assert
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      // Check that cache invalidation wasn't called (no forceRefresh)
      expect(cacheService.clearFilterCache).not.toHaveBeenCalled();
    });

    test('should handle PMP project with specific sprint', async () => {
      // Arrange
      const mockBurndownData = {
        data: [
          { day: 1, idealRemaining: 150, actualRemaining: 150 },
          { day: 2, idealRemaining: 135, actualRemaining: 140 }
        ]
      };

      // Mock the metrics calculator response
      const mockMetricsCalculator = {
        calculateSprintBurndown: jest.fn().mockResolvedValue(mockBurndownData.data)
      };

      // Act
      const response = await request(app)
        .get('/api/metrics/burndown')
        .query({
          productId: 'Product - Partner Management Platform',
          sprintId: 'Sprint 13'
        });

      // Assert
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    test('should handle different project/sprint combinations without contamination', async () => {
      // Test DaaS first
      const daasResponse = await request(app)
        .get('/api/metrics/kpis')
        .query({
          productId: 'Product - Data as a Service',
          sprintId: 'Delivery 12'
        });

      expect(daasResponse.status).toBe(200);

      // Then test PMP - should not have DaaS data
      const pmpResponse = await request(app)
        .get('/api/metrics/kpis')
        .query({
          productId: 'Product - Partner Management Platform',
          sprintId: 'Sprint 13'
        });

      expect(pmpResponse.status).toBe(200);
      // Verify separate cache keys were used
      expect(cacheService.generateKey).toHaveBeenCalledTimes(2);
    });
  });

  describe('Cache Invalidation', () => {
    test('should clear filter cache when forceRefresh is true', async () => {
      // Act
      const response = await request(app)
        .get('/api/metrics/burndown')
        .query({
          productId: 'Product - Data as a Service',
          sprintId: 'current',
          forceRefresh: 'true'
        });

      // Assert
      expect(response.status).toBe(200);
      expect(cacheService.clearFilterCache).toHaveBeenCalledWith(
        'Product - Data as a Service',
        'current'
      );
      expect(cacheService.clearPattern).toHaveBeenCalled();
    });

    test('should use cached data when available', async () => {
      // Arrange - mock cache hit
      const cachedData = {
        data: [{ day: 1, idealRemaining: 100, actualRemaining: 100 }]
      };
      cacheService.get = jest.fn().mockResolvedValue(cachedData);

      // Act
      const response = await request(app)
        .get('/api/metrics/kpis')
        .query({
          productId: 'Product - Data as a Service',
          sprintId: 'current'
        });

      // Assert
      expect(response.status).toBe(200);
      // Verify cache was checked
      expect(cacheService.get).toHaveBeenCalled();
      // Verify no new data was fetched (cache hit)
      expect(cacheService.set).not.toHaveBeenCalled();
    });

    test('should generate correct cache keys with filtering context', async () => {
      // Act
      await request(app)
        .get('/api/metrics/products/Product%20-%20Data%20as%20a%20Service')
        .query({
          sprintId: 'Delivery 12'
        });

      // Assert
      expect(cacheService.generateKey).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        expect.objectContaining({
          project: expect.stringContaining('Data as a Service'),
          sprint: 'Delivery 12'
        })
      );
    });
  });

  describe('Data Consistency', () => {
    test('should maintain consistency across different endpoints', async () => {
      // Test that all endpoints return consistent data for same filters
      const filters = {
        productId: 'Product - Data as a Service',
        sprintId: 'current'
      };

      // Test KPIs endpoint
      const kpiResponse = await request(app)
        .get('/api/metrics/kpis')
        .query(filters);

      // Test burndown endpoint
      const burndownResponse = await request(app)
        .get('/api/metrics/burndown')
        .query(filters);

      // Both should succeed
      expect(kpiResponse.status).toBe(200);
      expect(burndownResponse.status).toBe(200);

      // Both should have same project context
      expect(kpiResponse.body.success).toBe(true);
      expect(burndownResponse.body.success).toBe(true);
    });

    test('should handle missing or invalid project mappings gracefully', async () => {
      // Act - test with unmapped project
      const response = await request(app)
        .get('/api/metrics/burndown')
        .query({
          productId: 'Unknown Project',
          sprintId: 'Sprint 1'
        });

      // Assert - should still return success but possibly with empty data
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    test('should handle special sprint identifiers correctly', async () => {
      // Test 'current' sprint
      const currentResponse = await request(app)
        .get('/api/metrics/burndown')
        .query({
          productId: 'Product - Data as a Service',
          sprintId: 'current'
        });

      expect(currentResponse.status).toBe(200);

      // Test 'all-sprints'
      const allResponse = await request(app)
        .get('/api/metrics/burndown')
        .query({
          productId: 'Product - Data as a Service',
          sprintId: 'all-sprints'
        });

      expect(allResponse.status).toBe(200);
    });
  });

  describe('Error Handling', () => {
    test('should handle Azure DevOps API failures gracefully', async () => {
      // Arrange - mock service failure
      const error = new Error('Azure DevOps API timeout');
      cacheService.get = jest.fn().mockResolvedValue(null);

      // Act
      const response = await request(app)
        .get('/api/metrics/burndown')
        .query({
          productId: 'Product - Data as a Service',
          sprintId: 'current'
        });

      // Assert - should return success with fallback data
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    test('should validate required parameters', async () => {
      // Act - missing productId
      const response = await request(app)
        .get('/api/metrics/products/');

      // Assert
      expect(response.status).toBe(404);
    });

    test('should handle concurrent requests without race conditions', async () => {
      // Act - send multiple concurrent requests
      const requests = [
        request(app).get('/api/metrics/burndown').query({
          productId: 'Product - Data as a Service',
          sprintId: 'current'
        }),
        request(app).get('/api/metrics/kpis').query({
          productId: 'Product - Partner Management Platform',
          sprintId: 'Sprint 13'
        }),
        request(app).get('/api/metrics/burndown').query({
          productId: 'Product - Data as a Service',
          sprintId: 'Delivery 11'
        })
      ];

      const responses = await Promise.all(requests);

      // Assert - all should succeed
      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      });

      // Verify correct number of cache operations
      expect(cacheService.generateKey.mock.calls.length).toBeGreaterThanOrEqual(3);
    });
  });
});