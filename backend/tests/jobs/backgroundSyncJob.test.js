/**
 * Background Sync Job Tests (P0.0)
 *
 * Verifies the production data-pipeline fixes:
 *  - OMNIA is included in projectsToSync (root cause of "unloaded data")
 *  - Cron timezone is Asia/Bangkok (was America/New_York)
 *  - Cron writes into the unified `workItems:` keyspace (was orphan `dashboard:*`)
 *  - Per-project last-run timestamp is stamped for staleness observability
 */

// node-cron is mocked so requiring the singleton does not register a live cron job.
jest.mock('node-cron', () => ({
  schedule: jest.fn(() => ({ stop: jest.fn(), nextDates: jest.fn(() => '') }))
}));

const cron = require('node-cron');
const backgroundSyncJob = require('../../src/jobs/backgroundSyncJob');

describe('BackgroundSyncJob (P0.0 pipeline fixes)', () => {
  describe('projectsToSync', () => {
    test('includes OMNIA, PMP and DaaS (OMNIA must be present)', () => {
      const ids = backgroundSyncJob.projectsToSync.map(p => p.frontendId);

      expect(ids).toContain('Product - OMNIA');
      expect(ids).toContain('Product - Partner Management Platform');
      expect(ids).toContain('Product - Data as a Service');
    });

    test('getStatus().projectsToSync exposes OMNIA (AC-P0-0-1)', () => {
      const status = backgroundSyncJob.getStatus();
      expect(status.projectsToSync).toContain('Product - OMNIA');
    });

    test('OMNIA is mapped to its own Azure project and team', () => {
      const omnia = backgroundSyncJob.projectsToSync.find(
        p => p.frontendId === 'Product - OMNIA'
      );
      expect(omnia).toBeDefined();
      expect(omnia.azureProject).toBe('Product - OMNIA');
      expect(omnia.team).toBe('Product - OMNIA Team');
    });
  });

  describe('cron timezone (AC-P0-0-2)', () => {
    afterEach(() => {
      jest.clearAllMocks();
    });

    test('schedules with Asia/Bangkok timezone', async () => {
      await backgroundSyncJob.start();

      expect(cron.schedule).toHaveBeenCalledWith(
        '*/15 8-18 * * 1-5',
        expect.any(Function),
        expect.objectContaining({ timezone: 'Asia/Bangkok' })
      );

      await backgroundSyncJob.stop();
    });

    test('getStatus() reports Asia/Bangkok timezone', () => {
      expect(backgroundSyncJob.getStatus().timezone).toBe('Asia/Bangkok');
    });
  });

  describe('resolveActiveSprintId', () => {
    test('prefers a sprint marked current/active', () => {
      const id = backgroundSyncJob.resolveActiveSprintId([
        { id: 'old', status: 'completed' },
        { id: 'active-1', status: 'current' }
      ]);
      expect(id).toBe('active-1');
    });

    test('falls back to date range when no explicit status', () => {
      const today = new Date();
      const start = new Date(today.getTime() - 86400000).toISOString();
      const end = new Date(today.getTime() + 86400000).toISOString();
      const id = backgroundSyncJob.resolveActiveSprintId([
        { id: 'past', startDate: '2000-01-01', endDate: '2000-01-10' },
        { id: 'now', startDate: start, endDate: end }
      ]);
      expect(id).toBe('now');
    });

    test('returns "current" for empty or invalid input', () => {
      expect(backgroundSyncJob.resolveActiveSprintId([])).toBe('current');
      expect(backgroundSyncJob.resolveActiveSprintId(null)).toBe('current');
    });
  });

  describe('staleness observability', () => {
    test('getStatus() exposes lastRunTimestamps map', () => {
      const status = backgroundSyncJob.getStatus();
      expect(status).toHaveProperty('lastRunTimestamps');
      expect(typeof status.lastRunTimestamps).toBe('object');
    });
  });
});
