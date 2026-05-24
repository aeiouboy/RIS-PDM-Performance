/**
 * Background Sync Job
 *
 * Scheduled job for 15-minute Azure DevOps data synchronization during business hours.
 * Implements PRP Task 5 requirements with real-time patterns and data validation.
 *
 * Schedule: Every 15 minutes, 8 AM to 6 PM, weekdays only
 */

const cron = require('node-cron');
const logger = require('../../utils/logger');
const AzureDevOpsService = require('../services/azureDevOpsService');
const dataValidationService = require('../services/dataValidationService');
const cacheService = require('../services/cacheService');
const { mapFrontendProjectToAzure } = require('../config/projectMapping');

class BackgroundSyncJob {
  constructor() {
    this.isRunning = false;
    this.lastRunTime = null;
    // Per-project last successful sync timestamps (ms epoch).
    // Backs the `risp_background_sync_last_run_timestamp{project}` style gauge so a
    // stale sync (e.g. cron silently broken) is observable instead of failing silently.
    this.lastRunTimestamps = {};
    this.syncStats = {
      totalRuns: 0,
      successfulRuns: 0,
      failedRuns: 0,
      lastError: null,
      averageDuration: 0,
      projectsSynced: 0
    };

    // Projects to sync - frontendId/azureProject/team must match config/projectMapping.js
    // OMNIA is the PRIMARY project and MUST be synced first (it was previously omitted,
    // which is why the dashboard's main project never refreshed — the "unloaded data" bug).
    this.projectsToSync = [
      {
        frontendId: 'Product - OMNIA',
        azureProject: 'Product - OMNIA',
        team: 'Product - OMNIA Team'
      },
      {
        frontendId: 'Product - Partner Management Platform',
        azureProject: 'Product - Partner Management Platform',
        team: 'PMP Developer Team'
      },
      {
        frontendId: 'Product - Data as a Service',
        azureProject: 'Product - Data as a Service',
        team: 'Product - Data as a Service Team'
      }
    ];

    // Sync job schedule: every 15 minutes during business hours (8 AM - 6 PM weekdays)
    this.cronExpression = '*/15 8-18 * * 1-5';
    this.cronJob = null;
  }

  /**
   * Initialize and start the background sync job
   * Following pattern: Real-time patterns from PRPs/ai_docs/real-time-dashboard-sync-patterns.md
   */
  async start() {
    try {
      logger.info('Starting background sync job...');

      // Validate that required services are available
      if (!AzureDevOpsService || !dataValidationService) {
        throw new Error('Required services not available for background sync');
      }

      // Create cron job with business hours schedule
      this.cronJob = cron.schedule(this.cronExpression, async () => {
        await this.executeSyncCycle();
      }, {
        scheduled: true,
        timezone: "Asia/Bangkok", // Team is in Bangkok — keeps the 8AM-6PM business-hours window aligned with the actual workday
        runOnInit: false // Don't run immediately on start
      });

      logger.info(`Background sync job scheduled: ${this.cronExpression} (every 15 min, 8AM-6PM weekdays, Asia/Bangkok)`);

      // Optional: Run initial sync if needed
      const runInitialSync = process.env.RUN_INITIAL_SYNC === 'true';
      if (runInitialSync) {
        logger.info('Running initial sync...');
        setTimeout(() => this.executeSyncCycle(), 5000); // Wait 5 seconds after startup
      }

    } catch (error) {
      logger.error(`Failed to start background sync job: ${error.message}`);
      throw error;
    }
  }

  /**
   * Execute complete sync cycle for all projects
   * Integrates services from Tasks 3 and 4 for data sync and validation
   */
  async executeSyncCycle() {
    if (this.isRunning) {
      logger.warn('Sync cycle already in progress, skipping...');
      return;
    }

    const startTime = Date.now();
    this.isRunning = true;
    this.syncStats.totalRuns++;

    logger.info('🔄 Starting background sync cycle');

    try {
      let projectsSyncedCount = 0;
      const syncResults = [];

      // Sync each project independently
      for (const projectConfig of this.projectsToSync) {
        try {
          const projectResult = await this.syncProject(projectConfig);
          syncResults.push(projectResult);

          if (projectResult.success) {
            projectsSyncedCount++;
          }

        } catch (projectError) {
          logger.error(`Failed to sync project ${projectConfig.frontendId}: ${projectError.message}`);
          syncResults.push({
            project: projectConfig.frontendId,
            success: false,
            error: projectError.message
          });
        }
      }

      // Update statistics
      const duration = Date.now() - startTime;
      this.updateSyncStats(true, duration, projectsSyncedCount);

      // Broadcast sync completion to real-time clients (if available)
      await this.broadcastSyncUpdate({
        type: 'sync_completed',
        timestamp: new Date().toISOString(),
        results: syncResults,
        duration,
        projectsSynced: projectsSyncedCount
      });

      logger.info(`✅ Background sync cycle completed successfully (${duration}ms, ${projectsSyncedCount} projects)`);

    } catch (error) {
      const duration = Date.now() - startTime;
      this.updateSyncStats(false, duration, 0);
      this.syncStats.lastError = error.message;

      logger.error(`❌ Background sync cycle failed: ${error.message}`);

      // Update data validation service with sync failure
      dataValidationService.updateSyncStats(false);

    } finally {
      this.isRunning = false;
      this.lastRunTime = new Date().toISOString();
    }
  }

  /**
   * Sync individual project data
   * Uses services from Tasks 3 and 4 for data sync and validation
   */
  async syncProject(projectConfig) {
    const { frontendId, azureProject, team } = projectConfig;
    logger.info(`Syncing project: ${frontendId}`);

    try {
      // Initialize Azure DevOps service
      const azureService = new AzureDevOpsService();
      await azureService.initialize();

      // Resolve the Azure project name exactly as metricsCalculator does, so the served
      // cache key we build here is byte-for-byte identical to what the dashboard reads.
      const azureProjectName = mapFrontendProjectToAzure(frontendId) || frontendId;

      // Step 1: Fetch sprint dates to identify the active sprint name/id used as key.
      const sprintData = await azureService.getAccurateSprintDates(azureProject, team);
      const sprintId = this.resolveActiveSprintId(sprintData.sprints);
      const syncedAt = new Date().toISOString();

      // Step 2: Fetch work items using the same query shape as getCurrentSprintWorkItems.
      // We store the classified summary under the SERVED keyspace so the next dashboard
      // request finds a cache hit instead of hitting Azure again.
      const workItemsData = await azureService.getCurrentSprintWorkItems(azureProject, team);

      // Build the exact key that metricsCalculator.getWorkItemsForProduct writes so the
      // dashboard read-path (ris:cache:workitems:*) is pre-warmed by the cron.
      const servedKey = cacheService.buildServedWorkItemsKey(frontendId, sprintId, azureProjectName);
      await cacheService.set(servedKey, { ...workItemsData, lastSync: syncedAt }, {
        ttl: 300 // 5 minutes — matches metricsCalculator TTL
      });
      logger.info(`Pre-warmed served cache key for ${frontendId}: ${servedKey}`);

      // Step 3: Run data validation passing the already-fetched data directly — no cache
      // round-trip — so validation never reads orphaned keys that nothing writes anymore.
      const sprintValidation = await dataValidationService.validateSprintDates(
        azureProject, team, azureService, sprintData);
      const workItemValidation = await dataValidationService.validateWorkItemCounts(
        azureProject, team, azureService, workItemsData);

      // Update sync success status
      dataValidationService.updateSyncStats(true);

      // Stamp per-project last successful sync time (backs the staleness gauge/alert).
      this.lastRunTimestamps[frontendId] = Date.now();

      const result = {
        project: frontendId,
        success: true,
        sprintId,
        workItems: {
          total: workItemsData.total,
          bugs: workItemsData.bugs,
          synced: true
        },
        sprints: {
          count: sprintData.sprints.length,
          synced: true
        },
        validation: {
          sprintDates: sprintValidation.passedValidation,
          workItemCounts: workItemValidation.passedValidation
        },
        timestamp: new Date().toISOString()
      };

      logger.info(`Project ${frontendId} synced successfully: ${workItemsData.total} work items, ${sprintData.sprints.length} sprints`);
      return result;

    } catch (error) {
      logger.error(`Project sync failed for ${frontendId}: ${error.message}`);
      return {
        project: frontendId,
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Resolve the active sprint id from a list of sprints so work items can be cached
   * under a stable, surgical-invalidation-friendly key.
   * Falls back to 'current' when no active sprint can be determined.
   * @param {Array} sprints - Sprint list from getAccurateSprintDates
   * @returns {string} Sprint id (or 'current' fallback)
   */
  resolveActiveSprintId(sprints) {
    if (!Array.isArray(sprints) || sprints.length === 0) {
      return 'current';
    }

    // Prefer a sprint explicitly marked current/active by the resolver.
    const active = sprints.find(s => {
      const status = (s.status || '').toLowerCase();
      return status === 'current' || status === 'active';
    });
    if (active && active.id) {
      return active.id;
    }

    // Fallback: a sprint whose date range contains today.
    const now = Date.now();
    const byDate = sprints.find(s => {
      const start = s.startDate ? Date.parse(s.startDate) : NaN;
      const end = s.endDate ? Date.parse(s.endDate) : NaN;
      return Number.isFinite(start) && Number.isFinite(end) && start <= now && end >= now;
    });
    if (byDate && byDate.id) {
      return byDate.id;
    }

    return sprints[0].id || 'current';
  }

  /**
   * Broadcast sync updates to real-time clients
   * Connect integration with realtimeService (Task 8) for update notifications
   */
  async broadcastSyncUpdate(updateData) {
    try {
      // This will be connected to realtimeService in Task 8
      // For now, just cache the update for potential real-time clients
      const updateCacheKey = 'realtime:lastSyncUpdate';
      await cacheService.set(updateCacheKey, updateData, {
        ttl: 60 * 60 * 1000 // 1 hour TTL
      });

      // Log for monitoring
      logger.debug(`Sync update broadcasted: ${updateData.type}`);

    } catch (error) {
      logger.warn(`Failed to broadcast sync update: ${error.message}`);
      // Don't fail the entire sync for broadcast issues
    }
  }

  /**
   * Update sync statistics
   * Supporting metrics collection and monitoring
   */
  updateSyncStats(success, duration, projectsSynced) {
    if (success) {
      this.syncStats.successfulRuns++;
    } else {
      this.syncStats.failedRuns++;
    }

    this.syncStats.projectsSynced += projectsSynced;

    // Update average duration (rolling average)
    const totalRuns = this.syncStats.successfulRuns + this.syncStats.failedRuns;
    const currentAverage = this.syncStats.averageDuration;
    this.syncStats.averageDuration = Math.round(
      ((currentAverage * (totalRuns - 1)) + duration) / totalRuns
    );
  }

  /**
   * Stop the background sync job
   * Cleanup method for graceful shutdown
   */
  async stop() {
    try {
      if (this.cronJob) {
        this.cronJob.stop();
        logger.info('Background sync job stopped');
      }

      // Wait for current sync to complete if running
      if (this.isRunning) {
        logger.info('Waiting for current sync cycle to complete...');
        let attempts = 0;
        while (this.isRunning && attempts < 30) { // Wait max 30 seconds
          await new Promise(resolve => setTimeout(resolve, 1000));
          attempts++;
        }
      }

      logger.info('Background sync job shutdown completed');

    } catch (error) {
      logger.error(`Error stopping background sync job: ${error.message}`);
    }
  }

  /**
   * Get current sync status and statistics
   * Supporting admin monitoring and debugging
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      lastRunTime: this.lastRunTime,
      schedule: this.cronExpression,
      timezone: 'Asia/Bangkok',
      stats: { ...this.syncStats },
      projectsToSync: this.projectsToSync.map(p => p.frontendId),
      // Per-project last successful sync timestamps (ms epoch) — observability for stale syncs.
      lastRunTimestamps: { ...this.lastRunTimestamps },
      nextRunTime: this.cronJob?.nextDates()?.toString() || null,
      uptime: process.uptime()
    };
  }

  /**
   * Manually trigger sync (for testing/admin purposes)
   * Allows manual sync outside of scheduled times
   */
  async triggerManualSync(projectFilter = null) {
    logger.info(`Manual sync triggered${projectFilter ? ` for project: ${projectFilter}` : ''}`);

    if (projectFilter) {
      // Sync specific project
      const projectConfig = this.projectsToSync.find(p => p.frontendId === projectFilter);
      if (!projectConfig) {
        throw new Error(`Project not found: ${projectFilter}`);
      }
      return await this.syncProject(projectConfig);
    } else {
      // Sync all projects
      return await this.executeSyncCycle();
    }
  }
}

// Export singleton instance
module.exports = new BackgroundSyncJob();