/**
 * Data Validation Service
 *
 * Provides monitoring and validation of data sync accuracy between
 * RIS-PDM dashboard and Azure DevOps API. Implements PRP Task 4
 * requirements for admin monitoring per NFR-005.
 */

const logger = require('../../utils/logger');
const cacheService = require('./cacheService');

class DataValidationService {
  constructor() {
    // Validation metrics tracking
    this.stats = {
      sprintDateValidations: 0,
      workItemValidations: 0,
      validationPassed: 0,
      validationFailed: 0,
      lastSyncAttempt: null,
      lastSyncSuccess: null,
      errors: 0
    };

    // Validation thresholds
    this.thresholds = {
      maxDateDiscrepancyDays: 1,      // Max allowed difference in sprint dates
      maxWorkItemCountDelta: 5,       // Max allowed difference in work item counts
      syncFrequencyMinutes: 15,       // Expected sync frequency
      alertThresholdHours: 2          // Alert if sync hasn't occurred in X hours
    };

    // Performance monitoring
    this.performanceLog = [];
    this.maxPerformanceLogSize = 100;
  }

  /**
   * Validate sprint dates between dashboard and Azure DevOps
   * Following pattern: backend/src/services/cacheService.js service class structure
   */
  async validateSprintDates(projectId, teamId, azureDevOpsService) {
    const startTime = Date.now();

    try {
      logger.info(`Validating sprint dates for project: ${projectId}, team: ${teamId}`);

      // Get sprint dates from Azure DevOps using new sync method (Task 3)
      const azureSprintData = await azureDevOpsService.getAccurateSprintDates(projectId, teamId);

      // Get cached dashboard sprint data for comparison
      const dashboardCacheKey = `dashboard:sprints:${projectId}`;
      const dashboardSprintData = await cacheService.get(dashboardCacheKey);

      if (!dashboardSprintData || !azureSprintData.sprints) {
        throw new Error('Missing sprint data for validation');
      }

      const validation = {
        timestamp: new Date().toISOString(),
        projectId,
        teamId,
        discrepancies: [],
        totalSprints: azureSprintData.sprints.length,
        validatedSprints: 0,
        passedValidation: true
      };

      // Compare each sprint's dates
      for (const azureSprint of azureSprintData.sprints) {
        const dashboardSprint = dashboardSprintData.find(ds =>
          ds.name === azureSprint.name || ds.id === azureSprint.id);

        if (!dashboardSprint) {
          validation.discrepancies.push({
            sprintName: azureSprint.name,
            issue: 'Sprint missing from dashboard data',
            azure: { startDate: azureSprint.startDate, endDate: azureSprint.endDate },
            dashboard: null
          });
          validation.passedValidation = false;
          continue;
        }

        // Validate start and end dates
        const startDateDiff = this.calculateDateDifference(
          azureSprint.startDate, dashboardSprint.startDate);
        const endDateDiff = this.calculateDateDifference(
          azureSprint.endDate, dashboardSprint.endDate);

        if (Math.abs(startDateDiff) > this.thresholds.maxDateDiscrepancyDays ||
            Math.abs(endDateDiff) > this.thresholds.maxDateDiscrepancyDays) {
          validation.discrepancies.push({
            sprintName: azureSprint.name,
            issue: 'Date discrepancy exceeds threshold',
            startDateDifference: startDateDiff,
            endDateDifference: endDateDiff,
            azure: { startDate: azureSprint.startDate, endDate: azureSprint.endDate },
            dashboard: { startDate: dashboardSprint.startDate, endDate: dashboardSprint.endDate }
          });
          validation.passedValidation = false;
        }

        validation.validatedSprints++;
      }

      // Store validation results using existing cacheService
      const validationCacheKey = `validation:sprintDates:${projectId}:${teamId}`;
      await cacheService.set(validationCacheKey, validation, {
        ttl: 30 * 60 * 1000 // 30 minutes TTL
      });

      // Update stats
      this.stats.sprintDateValidations++;
      if (validation.passedValidation) {
        this.stats.validationPassed++;
      } else {
        this.stats.validationFailed++;
      }

      const duration = Date.now() - startTime;
      this.recordPerformance('validateSprintDates', duration, validation.passedValidation);

      logger.info(`Sprint date validation completed: ${validation.passedValidation ? 'PASSED' : 'FAILED'}
                   (${validation.discrepancies.length} discrepancies)`);

      return validation;

    } catch (error) {
      logger.error(`Sprint date validation failed: ${error.message}`);
      this.stats.errors++;
      throw new Error(`Sprint date validation failed: ${error.message}`);
    }
  }

  /**
   * Validate work item counts between dashboard and Azure DevOps
   * Supporting getCurrentSprintWorkItems method from Task 3
   */
  async validateWorkItemCounts(projectId, teamId, azureDevOpsService) {
    const startTime = Date.now();

    try {
      logger.info(`Validating work item counts for project: ${projectId}, team: ${teamId}`);

      // Get work items from Azure DevOps using new sync method (Task 3)
      const azureWorkItems = await azureDevOpsService.getCurrentSprintWorkItems(projectId, teamId);

      // Get cached dashboard work item data for comparison
      const dashboardCacheKey = `dashboard:workItems:${projectId}`;
      const dashboardWorkItems = await cacheService.get(dashboardCacheKey);

      if (!dashboardWorkItems || !azureWorkItems) {
        throw new Error('Missing work item data for validation');
      }

      const validation = {
        timestamp: new Date().toISOString(),
        projectId,
        teamId,
        azure: {
          total: azureWorkItems.total,
          bugs: azureWorkItems.bugs,
          stories: azureWorkItems.stories,
          tasks: azureWorkItems.tasks
        },
        dashboard: {
          total: dashboardWorkItems.total || 0,
          bugs: dashboardWorkItems.bugs || 0,
          stories: dashboardWorkItems.stories || 0,
          tasks: dashboardWorkItems.tasks || 0
        },
        discrepancies: [],
        passedValidation: true
      };

      // Compare work item counts by type
      const types = ['total', 'bugs', 'stories', 'tasks'];
      for (const type of types) {
        const azureCount = validation.azure[type];
        const dashboardCount = validation.dashboard[type];
        const difference = Math.abs(azureCount - dashboardCount);

        if (difference > this.thresholds.maxWorkItemCountDelta) {
          validation.discrepancies.push({
            type,
            difference,
            azureCount,
            dashboardCount,
            threshold: this.thresholds.maxWorkItemCountDelta
          });
          validation.passedValidation = false;
        }
      }

      // Store validation results using existing cacheService
      const validationCacheKey = `validation:workItemCounts:${projectId}:${teamId}`;
      await cacheService.set(validationCacheKey, validation, {
        ttl: 5 * 60 * 1000 // 5 minutes TTL
      });

      // Update stats
      this.stats.workItemValidations++;
      if (validation.passedValidation) {
        this.stats.validationPassed++;
      } else {
        this.stats.validationFailed++;
      }

      const duration = Date.now() - startTime;
      this.recordPerformance('validateWorkItemCounts', duration, validation.passedValidation);

      logger.info(`Work item count validation completed: ${validation.passedValidation ? 'PASSED' : 'FAILED'}
                   (${validation.discrepancies.length} discrepancies)`);

      return validation;

    } catch (error) {
      logger.error(`Work item count validation failed: ${error.message}`);
      this.stats.errors++;
      throw new Error(`Work item count validation failed: ${error.message}`);
    }
  }

  /**
   * Get last sync status and validation results
   * Provides admin monitoring of data sync accuracy per NFR-005
   */
  async getLastSyncStatus(projectId = null, teamId = null) {
    try {
      const status = {
        timestamp: new Date().toISOString(),
        overall: 'unknown',
        stats: { ...this.stats },
        validations: {}
      };

      if (projectId && teamId) {
        // Get specific project/team validation results
        const sprintValidationKey = `validation:sprintDates:${projectId}:${teamId}`;
        const workItemValidationKey = `validation:workItemCounts:${projectId}:${teamId}`;

        const sprintValidation = await cacheService.get(sprintValidationKey);
        const workItemValidation = await cacheService.get(workItemValidationKey);

        status.validations.sprintDates = sprintValidation;
        status.validations.workItemCounts = workItemValidation;

        // Determine overall status
        if (sprintValidation?.passedValidation && workItemValidation?.passedValidation) {
          status.overall = 'healthy';
        } else if (!sprintValidation || !workItemValidation) {
          status.overall = 'pending';
        } else {
          status.overall = 'issues_detected';
        }
      } else {
        // Return general system status
        const now = new Date();
        const hoursSinceLastSync = this.stats.lastSyncSuccess ?
          (now - new Date(this.stats.lastSyncSuccess)) / (1000 * 60 * 60) : null;

        if (hoursSinceLastSync && hoursSinceLastSync > this.thresholds.alertThresholdHours) {
          status.overall = 'stale_data';
        } else if (this.stats.validationFailed > this.stats.validationPassed) {
          status.overall = 'issues_detected';
        } else {
          status.overall = 'healthy';
        }
      }

      // Add performance insights
      status.performance = this.getPerformanceInsights();

      return status;

    } catch (error) {
      logger.error(`Failed to get sync status: ${error.message}`);
      return {
        timestamp: new Date().toISOString(),
        overall: 'error',
        error: error.message,
        stats: { ...this.stats }
      };
    }
  }

  /**
   * Calculate difference between two dates in days
   * Helper method for sprint date validation
   */
  calculateDateDifference(date1, date2) {
    if (!date1 || !date2) return null;
    const d1 = new Date(date1);
    const d2 = new Date(date2);
    return Math.round((d1 - d2) / (1000 * 60 * 60 * 24));
  }

  /**
   * Record performance metrics
   * Following cacheService.js pattern
   */
  recordPerformance(operation, duration, success, additionalData = {}) {
    const entry = {
      operation,
      duration,
      success,
      timestamp: new Date().toISOString(),
      ...additionalData
    };

    this.performanceLog.push(entry);

    // Keep log size manageable
    if (this.performanceLog.length > this.maxPerformanceLogSize) {
      this.performanceLog.shift();
    }
  }

  /**
   * Get performance insights
   * Supporting getLastSyncStatus method
   */
  getPerformanceInsights() {
    if (this.performanceLog.length === 0) {
      return { averageDuration: 0, operations: 0, successRate: 0 };
    }

    const totalDuration = this.performanceLog.reduce((sum, entry) => sum + entry.duration, 0);
    const successfulOperations = this.performanceLog.filter(entry => entry.success).length;

    return {
      averageDuration: Math.round(totalDuration / this.performanceLog.length),
      operations: this.performanceLog.length,
      successRate: Math.round((successfulOperations / this.performanceLog.length) * 100),
      recentOperations: this.performanceLog.slice(-10) // Last 10 operations
    };
  }

  /**
   * Update sync statistics
   * Called by background sync job to track sync attempts
   */
  updateSyncStats(success = false) {
    const now = new Date().toISOString();
    this.stats.lastSyncAttempt = now;

    if (success) {
      this.stats.lastSyncSuccess = now;
    }
  }

  /**
   * Get validation statistics for admin dashboard
   * Supporting admin monitoring requirements
   */
  getValidationStats() {
    return {
      ...this.stats,
      thresholds: { ...this.thresholds },
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage()
    };
  }
}

// Export singleton instance
module.exports = new DataValidationService();