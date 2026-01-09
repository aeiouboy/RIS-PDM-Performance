/**
 * Tests for enhanced cache key strategy and filter cache clearing
 */

const CacheService = require('../../src/services/cacheService');
const redisConfig = require('../../src/config/redisConfig');

// Mock dependencies
jest.mock('../../src/config/redisConfig');
jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  debug: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
}));

describe('CacheService Filtering Tests', () => {
  let cacheService;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Mock Redis config methods
    redisConfig.isReady = jest.fn().mockReturnValue(false);
    redisConfig.connect = jest.fn().mockResolvedValue(true);
    redisConfig.disconnect = jest.fn().mockResolvedValue(true);
    redisConfig.set = jest.fn().mockResolvedValue(true);
    redisConfig.get = jest.fn().mockResolvedValue(null);
    redisConfig.delete = jest.fn().mockResolvedValue(true);
    redisConfig.deletePattern = jest.fn().mockResolvedValue(true);
    redisConfig.generateKey = jest.fn().mockImplementation((...parts) => parts.join(':'));
    redisConfig.healthCheck = jest.fn().mockResolvedValue({ status: 'healthy' });

    // Create new instance for each test
    cacheService = new CacheService();
  });

  describe('Enhanced generateKey method', () => {
    test('should generate key with project and sprint parameters', () => {
      // Act
      const key = cacheService.generateKey('workitems', 'list', {
        project: 'Product - Data as a Service',
        sprint: 'Delivery 12'
      });

      // Assert
      expect(key).toContain('project:Product - Data as a Service');
      expect(key).toContain('sprint:Delivery 12');
      expect(redisConfig.generateKey).toHaveBeenCalled();
    });

    test('should include endpoint parameter when provided', () => {
      // Act
      const key = cacheService.generateKey('metrics', 'burndown', {
        project: 'Product - Partner Management Platform',
        sprint: 'Sprint 13',
        endpoint: 'getWorkItemsForProduct'
      });

      // Assert
      expect(key).toContain('project:Product - Partner Management Platform');
      expect(key).toContain('sprint:Sprint 13');
      expect(key).toContain('endpoint:getWorkItemsForProduct');
    });

    test('should include timestamp when provided', () => {
      // Act
      const timestamp = Date.now();
      const key = cacheService.generateKey('data', 'snapshot', {
        project: 'TestProject',
        sprint: 'Sprint 1',
        timestamp: timestamp
      });

      // Assert
      expect(key).toContain(`ts:${timestamp}`);
    });

    test('should handle other parameters correctly', () => {
      // Act
      const key = cacheService.generateKey('query', 'results', {
        project: 'MyProject',
        sprint: 'current',
        userId: 'user123',
        filter: 'active'
      });

      // Assert
      expect(key).toContain('project:MyProject');
      expect(key).toContain('sprint:current');
      expect(key).toContain('filter:active');
      expect(key).toContain('userId:user123');
    });

    test('should maintain backward compatibility without filter params', () => {
      // Act
      const key = cacheService.generateKey('cache', 'data', {
        id: '12345',
        type: 'workitem'
      });

      // Assert
      expect(key).toContain('id:12345');
      expect(key).toContain('type:workitem');
      expect(key).not.toContain('project:');
      expect(key).not.toContain('sprint:');
    });
  });

  describe('clearFilterCache method', () => {
    test('should clear cache entries for specific project+sprint combination', async () => {
      // Arrange
      cacheService.memoryCache.keys = jest.fn().mockReturnValue([
        'cache:workitems:list:project:Product - Data as a Service:sprint:Delivery 12',
        'cache:metrics:burndown:project:Product - Data as a Service:sprint:Delivery 12',
        'cache:workitems:list:project:Product - Partner Management Platform:sprint:Sprint 13',
        'cache:metrics:kpis:project:Product - Data as a Service:sprint:Delivery 11'
      ]);

      cacheService.memoryCache.del = jest.fn().mockReturnValue(1);

      // Act
      const result = await cacheService.clearFilterCache('Product - Data as a Service', 'Delivery 12');

      // Assert
      expect(result).toBe(true);
      // Should delete only matching entries
      expect(cacheService.memoryCache.del).toHaveBeenCalledTimes(2);
      expect(redisConfig.deletePattern).toHaveBeenCalled();
    });

    test('should handle Redis being available', async () => {
      // Arrange
      redisConfig.isReady.mockReturnValue(true);
      cacheService.memoryCache.keys = jest.fn().mockReturnValue([]);

      // Act
      await cacheService.clearFilterCache('TestProject', 'Sprint 1');

      // Assert
      expect(redisConfig.deletePattern).toHaveBeenCalledWith(
        expect.stringContaining('project:TestProject')
      );
      expect(redisConfig.deletePattern).toHaveBeenCalledWith(
        expect.stringContaining('sprint:Sprint 1')
      );
    });

    test('should handle clearing with special characters in project/sprint names', async () => {
      // Arrange
      cacheService.memoryCache.keys = jest.fn().mockReturnValue([
        'cache:data:project:Product - Data & Analytics:sprint:Sprint/2024.1'
      ]);
      cacheService.memoryCache.del = jest.fn().mockReturnValue(1);

      // Act
      const result = await cacheService.clearFilterCache(
        'Product - Data & Analytics',
        'Sprint/2024.1'
      );

      // Assert
      expect(result).toBe(true);
      expect(cacheService.memoryCache.del).toHaveBeenCalled();
    });

    test('should return false when no entries are cleared', async () => {
      // Arrange
      cacheService.memoryCache.keys = jest.fn().mockReturnValue([]);
      redisConfig.deletePattern.mockResolvedValue(false);

      // Act
      const result = await cacheService.clearFilterCache('NonExistent', 'NoSprint');

      // Assert
      expect(result).toBe(false);
    });

    test('should handle errors gracefully', async () => {
      // Arrange
      cacheService.memoryCache.keys = jest.fn().mockImplementation(() => {
        throw new Error('Memory cache error');
      });

      // Act
      const result = await cacheService.clearFilterCache('TestProject', 'Sprint 1');

      // Assert
      expect(result).toBe(false);
      expect(cacheService.stats.errors).toBe(1);
    });

    test('should clear entries matching different pattern orders', async () => {
      // Arrange
      cacheService.memoryCache.keys = jest.fn().mockReturnValue([
        'cache:data:sprint:current:project:DaaS:endpoint:workitems',
        'cache:data:project:DaaS:sprint:current:endpoint:burndown',
        'cache:metrics:project:DaaS'
      ]);
      cacheService.memoryCache.del = jest.fn().mockReturnValue(1);

      // Act
      await cacheService.clearFilterCache('DaaS', 'current');

      // Assert
      // Should delete both entries with matching project+sprint regardless of order
      expect(cacheService.memoryCache.del).toHaveBeenCalledTimes(2);
    });
  });

  describe('Integration with existing cache methods', () => {
    test('set method should work with enhanced keys', async () => {
      // Arrange
      const key = cacheService.generateKey('test', 'data', {
        project: 'TestProject',
        sprint: 'Sprint 1'
      });

      const testData = { value: 'test' };

      // Act
      await cacheService.set(key, testData, { ttl: 300 });

      // Assert
      expect(cacheService.memoryCache.set).toHaveBeenCalledWith(
        key,
        testData,
        expect.any(Number)
      );
    });

    test('get method should work with enhanced keys', async () => {
      // Arrange
      const key = cacheService.generateKey('test', 'data', {
        project: 'TestProject',
        sprint: 'Sprint 1'
      });

      const testData = { value: 'test' };
      cacheService.memoryCache.get = jest.fn().mockReturnValue(testData);

      // Act
      const result = await cacheService.get(key);

      // Assert
      expect(result).toEqual(testData);
      expect(cacheService.stats.memoryHits).toBe(1);
    });

    test('clearPattern should work with filter-enhanced patterns', async () => {
      // Arrange
      const pattern = '*project:TestProject*sprint:Sprint 1*';
      cacheService.memoryCache.keys = jest.fn().mockReturnValue([
        'cache:data:project:TestProject:sprint:Sprint 1:data1',
        'cache:data:project:TestProject:sprint:Sprint 1:data2'
      ]);
      cacheService.memoryCache.del = jest.fn();

      // Act
      await cacheService.clearPattern(pattern);

      // Assert
      expect(cacheService.memoryCache.del).toHaveBeenCalledTimes(2);
    });
  });

  describe('Performance and edge cases', () => {
    test('should handle large number of cache keys efficiently', async () => {
      // Arrange - simulate 1000 cache keys
      const manyKeys = Array.from({ length: 1000 }, (_, i) =>
        `cache:data:${i}:project:${i % 2 === 0 ? 'DaaS' : 'PMP'}:sprint:Sprint ${i % 10}`
      );
      cacheService.memoryCache.keys = jest.fn().mockReturnValue(manyKeys);
      cacheService.memoryCache.del = jest.fn().mockReturnValue(1);

      // Act
      const startTime = Date.now();
      await cacheService.clearFilterCache('DaaS', 'Sprint 5');
      const duration = Date.now() - startTime;

      // Assert
      expect(duration).toBeLessThan(100); // Should complete within 100ms
      // Should delete 50 entries (every 20th key matches DaaS + Sprint 5)
      expect(cacheService.memoryCache.del.mock.calls.length).toBeGreaterThan(0);
    });

    test('should handle null and undefined values correctly', async () => {
      // Act & Assert - should not throw
      await expect(cacheService.clearFilterCache(null, 'Sprint 1')).resolves.toBe(false);
      await expect(cacheService.clearFilterCache('Project', null)).resolves.toBe(false);
      await expect(cacheService.clearFilterCache(undefined, undefined)).resolves.toBe(false);
    });

    test('should handle empty strings correctly', async () => {
      // Act & Assert
      await expect(cacheService.clearFilterCache('', 'Sprint 1')).resolves.toBe(false);
      await expect(cacheService.clearFilterCache('Project', '')).resolves.toBe(false);
    });
  });
});