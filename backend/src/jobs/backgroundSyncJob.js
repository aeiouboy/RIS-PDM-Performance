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
// Project mapping functions available if needed: require('../config/projectMapping')

class BackgroundSyncJob {
  constructor() {
    this.isRunning = false;
    this.lastRunTime = null;
    this.syncStats = {
      totalRuns: 0,
      successfulRuns: 0,
      failedRuns: 0,
      lastError: null,
      averageDuration: 0,
      projectsSynced: 0
    };

    // Projects to sync - following PRP project mapping patterns
    this.projectsToSync = [
      {
        frontendId: 'Product - Partner Management Platform',
        azureProject: 'Product',
        team: 'PMP Developer Team'
      },
      {
        frontendId: 'Product - Data as a Service',
        azureProject: 'Product',
        team: 'Data Team'
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
        timezone: "America/New_York", // Adjust timezone as needed
        runOnInit: false // Don't run immediately on start
      });

      logger.info(`Background sync job scheduled: ${this.cronExpression} (every 15 min, 8AM-6PM weekdays)`);

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

      // Step 1: Sync work items data using Task 3 method
      const workItemsData = await azureService.getCurrentSprintWorkItems(azureProject, team);

      // Cache the work items data for dashboard
      const workItemsCacheKey = `dashboard:workItems:${frontendId}`;
      await cacheService.set(workItemsCacheKey, workItemsData, {
        ttl: 5 * 60 * 1000 // 5 minutes TTL for work items
      });

      // Step 2: Sync sprint dates using Task 3 method
      const sprintData = await azureService.getAccurateSprintDates(azureProject, team);

      // Cache the sprint data for dashboard
      const sprintsCacheKey = `dashboard:sprints:${frontendId}`;
      await cacheService.set(sprintsCacheKey, sprintData.sprints, {
        ttl: 30 * 60 * 1000 // 30 minutes TTL for sprints
      });

      // Step 3: Run data validation using Task 4 service
      const sprintValidation = await dataValidationService.validateSprintDates(
        azureProject, team, azureService);
      const workItemValidation = await dataValidationService.validateWorkItemCounts(
        azureProject, team, azureService);

      // Update sync success status
      dataValidationService.updateSyncStats(true);

      const result = {
        project: frontendId,
        success: true,
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
      stats: { ...this.syncStats },
      projectsToSync: this.projectsToSync.map(p => p.frontendId),
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