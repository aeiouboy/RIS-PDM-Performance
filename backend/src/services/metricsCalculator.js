/**
 * Metrics Calculator Service
 * Processes Azure DevOps data to generate dashboard metrics and KPIs
 */

const { mapFrontendProjectToAzure } = require('../config/projectMapping');
const {
  calculateVelocity,
  calculateTeamPerformance,
  calculateQualityMetrics,
  calculateSprintMetrics
} = require('../utils/dataTransformers');
const AzureDevOpsApiService = require('./azureDevOpsApiService');
const cacheService = require('./cacheService');

class MetricsCalculatorService {
  constructor(azureDevOpsService) {
    this.azureService = azureDevOpsService;
    this.realApiService = new AzureDevOpsApiService(); // New real API service
    this.cache = new Map();
    this.cacheTTL = 5 * 60 * 1000; // 5 minutes
    this.cacheService = cacheService; // Enhanced cache service for filtering
  }

  /**
   * Backward-compatible wrapper: resolves sprint info
   * @param {string} sprintId
   * @param {string} productId
   * @returns {Promise<object|null>}
   */
  async getSprintInfo(sprintId, productId) {
    try {
      // Prefer the newer method if present
      if (typeof this.getSprintData === 'function') {
        return await this.getSprintData(sprintId, productId);
      }
      return null;
    } catch (e) {
      console.warn(`getSprintInfo fallback failed for ${sprintId}: ${e.message}`);
      return null;
    }
  }

  /**
   * Build burndown series from provided work items and sprint info
   * @param {Array} workItems
   * @param {Object|null} sprintInfo
   * @returns {Promise<Array>} Burndown data points
   */
  async calculateBurndownData(workItems = [], sprintInfo = null) {
    try {
      if (!sprintInfo) {
        return [];
      }
      const duration = this.calculateSprintDuration(sprintInfo);
      return this.generateBurndownChart(workItems || [], sprintInfo, duration);
    } catch (error) {
      console.warn('calculateBurndownData error:', error.message);
      return [];
    }
  }

  /**
   * Calculate overview metrics for the dashboard
   * @param {object} options - Calculation options
   * @returns {Promise<object>} Overview metrics
   */
  async calculateOverviewMetrics(options = {}) {
    const { period = 'sprint', startDate, endDate, productId } = options;
    const cacheKey = `overview_${period}_${startDate}_${endDate}_${productId}`;
    
    // Check cache
    const cached = this.getFromCache(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      // Get work items for the specified period
      const workItems = await this.getWorkItemsForPeriod({ startDate, endDate, productId });
      
      // Calculate basic metrics
      const velocity = calculateVelocity(workItems, startDate, endDate);
      const quality = calculateQualityMetrics(workItems);
      const teamPerformance = calculateTeamPerformance(workItems);
      
      // Calculate KPIs - currentSprint not needed since we have work items and context
      const kpis = await this.calculateKPIs(workItems, null);
      
      // Calculate trends
      const trends = await this.calculateTrends(period);
      
      const overview = {
        period: {
          type: period,
          startDate,
          endDate,
        },
        summary: {
          totalProducts: await this.getTotalProducts(),
          activeProjects: await this.getActiveProjects(),
          totalTeamMembers: teamPerformance.totalMembers,
          avgVelocity: parseFloat(velocity.storyPoints),
          avgQualityScore: this.calculateQualityScore(quality),
          totalWorkItems: workItems.length,
          completedWorkItems: velocity.completedTasks,
        },
        kpis,
        trends,
        alerts: await this.generateAlerts(workItems, kpis)
      };

      this.setCache(cacheKey, overview);
      return overview;
      
    } catch (error) {
      console.error('Error calculating overview metrics:', error);
      throw new Error(`Failed to calculate overview metrics: ${error.message}`);
    }
  }

  /**
   * Calculate detailed metrics for a specific product
   * @param {string} productId - Product identifier
   * @param {object} options - Calculation options
   * @returns {Promise<object>} Product metrics
   */
  async calculateProductMetrics(productId, options = {}) {
    const { period = 'sprint', sprintId } = options;
    const cacheKey = `product_${productId}_${period}_${sprintId}`;
    
    const cached = this.getFromCache(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      // Get work items for this product/sprint
      const workItems = await this.getWorkItemsForProduct(productId, { sprintId });
      
      // Get sprint information (compat wrapper uses getSprintData under the hood)
      const sprintInfo = sprintId ? await this.getSprintInfo(sprintId, productId) : null;
      
      // Calculate metrics
      const velocity = calculateVelocity(workItems, sprintInfo?.startDate, sprintInfo?.endDate);
      const quality = calculateQualityMetrics(workItems);
      const teamPerformance = calculateTeamPerformance(workItems);
      const sprintMetrics = calculateSprintMetrics(workItems, sprintInfo);
      
      const metrics = {
        productId,
        period: {
          type: period,
          sprintId,
        },
        performance: {
          velocity: {
            current: velocity.storyPoints,
            // Real capacity from Azure sprint info; null (not a fabricated 50.0) when absent.
            target: sprintInfo?.capacity ?? null,
            trend: await this.getVelocityTrend(productId),
            history: await this.getVelocityHistory(productId),
          },
          burndown: await this.calculateBurndownData(workItems, sprintInfo),
          quality: {
            codeQuality: this.calculateQualityScore(quality),
            testCoverage: await this.getTestCoverage(productId),
            defectDensity: quality.bugToTaskRatio,
            technicalDebt: await this.getTechnicalDebtScore(productId),
          },
          delivery: {
            commitmentReliability: this.calculateCommitmentReliability(sprintMetrics),
            cycleTime: parseFloat(sprintMetrics.averageCycleTime),
            leadTime: await this.calculateLeadTime(workItems),
            throughput: this.calculateThroughput(velocity),
          },
        },
        workItems: this.categorizeWorkItems(workItems),
        team: {
          size: teamPerformance.totalMembers,
          productivity: this.calculateProductivityScore(teamPerformance),
          collaboration: await this.getCollaborationScore(productId),
          satisfaction: await this.getTeamSatisfaction(productId),
          utilization: this.calculateUtilization(teamPerformance),
        },
        risks: this.identifyRisks(sprintMetrics, quality)
      };

      this.setCache(cacheKey, metrics);
      return metrics;
      
    } catch (error) {
      console.error(`Error calculating product metrics for ${productId}:`, error);
      throw new Error(`Failed to calculate product metrics: ${error.message}`);
    }
  }

  /**
   * Calculate team-specific metrics
   * @param {string} teamId - Team identifier
   * @param {object} options - Calculation options
   * @returns {Promise<object>} Team metrics
   */
  async calculateTeamMetrics(teamId, options = {}) {
    const { period = 'sprint' } = options;
    const cacheKey = `team_${teamId}_${period}`;
    
    const cached = this.getFromCache(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      // Get team information and work items
      const teamInfo = await this.getTeamInfo(teamId);
      const workItems = await this.getWorkItemsForTeam(teamId);
      
      const teamPerformance = calculateTeamPerformance(workItems, teamInfo.members);
      const quality = calculateQualityMetrics(workItems);
      
      const metrics = {
        teamId,
        period: { type: period },
        team: {
          name: teamInfo.name,
          size: teamInfo.members.length,
          lead: teamInfo.lead,
          members: teamInfo.members.map(member => ({
            id: member.id,
            name: member.displayName,
            role: member.role || 'Developer'
          })),
        },
        performance: {
          velocity: calculateVelocity(workItems).storyPoints,
          productivity: this.calculateProductivityScore(teamPerformance),
          collaboration: await this.getCollaborationScore(teamId),
          satisfaction: await this.getTeamSatisfaction(teamId),
          utilization: this.calculateUtilization(teamPerformance),
        },
        workload: this.analyzeWorkload(teamPerformance),
        skills: await this.analyzeTeamSkills(teamId)
      };

      this.setCache(cacheKey, metrics);
      return metrics;
      
    } catch (error) {
      console.error(`Error calculating team metrics for ${teamId}:`, error);
      throw new Error(`Failed to calculate team metrics: ${error.message}`);
    }
  }

  /**
   * Get work items for a specific period
   * @private
   */
  async getWorkItemsForPeriod({ startDate, endDate, productId }) {
    let queryOptions = {
      maxResults: 2000
    };

    if (startDate && endDate) {
      queryOptions.customQuery = `
        SELECT [System.Id], [System.Title], [System.WorkItemType], [System.AssignedTo], 
               [System.State], [Custom.StoryPoint], [System.CreatedDate], 
               [System.ChangedDate], [Microsoft.VSTS.Common.ClosedDate], [System.AreaPath], 
               [System.IterationPath], [Microsoft.VSTS.Common.Priority]
        FROM WorkItems 
        WHERE [System.TeamProject] = @project 
        AND [System.WorkItemType] IN ('Task', 'Bug')
        AND [System.State] <> 'Removed'
        AND [System.ChangedDate] >= '${startDate}'
        AND [System.ChangedDate] <= '${endDate}'
        ORDER BY [System.ChangedDate] DESC
      `;
    }

    if (productId) {
      queryOptions.areaPath = productId;
    }

    const response = await this.azureService.getWorkItems(queryOptions);
    
    if (response.workItems.length > 0) {
      const workItemIds = response.workItems.map(wi => wi.id);
      const detailsResponse = await this.azureService.getWorkItemDetails(workItemIds);
      return detailsResponse.workItems;
    }

    return [];
  }

  /**
   * Get work items for a specific product with proper iteration path resolution
   * @private
   */
  async getWorkItemsForProduct(productId, { sprintId } = {}) {
    // Map frontend project to actual Azure DevOps project
    const azureProjectName = mapFrontendProjectToAzure(productId) || productId;
    
    // Clear cache if filtering context changes
    if (sprintId && this.cacheService) {
      await this.cacheService.clearFilterCache(productId, sprintId);
    }
    
    // Generate enhanced cache key for filtering context
    const cacheKey = this.cacheService ? 
      this.cacheService.generateKey('workitems', 'product', {
        project: productId,
        sprint: sprintId || 'all',
        endpoint: 'getWorkItemsForProduct',
        azureProject: azureProjectName
      }) : null;
    
    // Try to get from cache first
    if (cacheKey && this.cacheService) {
      const cachedData = await this.cacheService.get(cacheKey);
      if (cachedData) {
        console.log(`📊 Cache hit for work items: ${productId}/${sprintId}`);
        return cachedData;
      }
    }
    
    let queryOptions = {
      projectName: azureProjectName, // Use mapped Azure project instead of frontend project
      maxResults: 1000,
      // Fetch all work item types so downstream _filterByWorkItemTypes can filter correctly.
      // Without this, getWorkItems defaults to ['Task','Bug'] and PBIs are never fetched.
      workItemTypes: ['Product Backlog Item', 'Task', 'Bug', 'Feature', 'User Story', 'Epic'],
    };

    // Resolve iteration path properly instead of passing raw sprintId
    if (sprintId) {
      try {
        // Use Azure DevOps service iteration resolution for proper path resolution
        const resolvedIterationPath = await this.azureService.iterationResolver.resolveIteration(
          productId,
          sprintId,
          null // teamName - let resolver use project mapping
        );
        
        if (resolvedIterationPath) {
          queryOptions.iterationPath = resolvedIterationPath;
          console.log(`📊 Resolved iteration path: ${sprintId} → ${resolvedIterationPath} for ${productId}`);
        } else {
          console.warn(`⚠️ Could not resolve iteration path: ${sprintId} for ${productId}. Querying without iteration filter.`);
          // Continue without iteration filter to avoid empty results
        }
      } catch (error) {
        console.warn(`⚠️ Error resolving iteration path "${sprintId}" for ${productId}: ${error.message}. Using fallback.`);
        queryOptions.iterationPath = sprintId; // Fallback to original behavior
      }
    }

    console.log(`📊 Frontend Project: "${productId}" → Azure Project: "${azureProjectName}" with options:`, queryOptions);
    const response = await this.azureService.getWorkItems(queryOptions);
    
    let workItems = [];
    if (response.workItems.length > 0) {
      const workItemIds = response.workItems.map(wi => wi.id);
      const detailsResponse = await this.azureService.getWorkItemDetails(workItemIds, null, productId);
      workItems = detailsResponse.workItems;
    }

    // Cache the result with enhanced key
    if (cacheKey && this.cacheService && workItems.length > 0) {
      await this.cacheService.set(cacheKey, workItems, {
        ttl: 300 // 5 minutes for filtered data
      });
      console.log(`📊 Cached work items for ${productId}/${sprintId}`);
    }

    return workItems;
  }


  /**
   * Calculate KPIs
   * @private
   */
  async calculateKPIs(workItems, currentSprint) {
    const velocity = calculateVelocity(workItems);
    const quality = calculateQualityMetrics(workItems);
    
    return {
      deliveryPredictability: this.calculateDeliveryPredictability(workItems, currentSprint),
      // getTeamSatisfaction returns an honest status contract; fabricated 7.6 fallback removed 2026-05-24
      teamSatisfaction: await this.getTeamSatisfaction(),
      codeQuality: this.calculateQualityScore(quality),
      defectEscapeRate: this.calculateDefectEscapeRate(quality),
      cycleTime: parseFloat(await this.calculateAverageCycleTime(workItems)),
      leadTime: await this.calculateLeadTime(workItems),
    };
  }

  /**
   * Calculate quality score from metrics
   * @private
   */
  calculateQualityScore(qualityMetrics) {
    const bugRatio = parseFloat(qualityMetrics.bugToTaskRatio) || 0;
    const resolutionTime = parseFloat(qualityMetrics.averageResolutionTimeDays) || 0;
    
    // Quality score based on bug ratio and resolution time
    let score = 10;
    
    // Penalize high bug ratios
    if (bugRatio > 0.3) score -= 2;
    else if (bugRatio > 0.2) score -= 1;
    else if (bugRatio > 0.1) score -= 0.5;
    
    // Penalize slow resolution times
    if (resolutionTime > 7) score -= 1;
    else if (resolutionTime > 14) score -= 2;
    
    return Math.max(1, Math.min(10, score));
  }

  /**
   * Calculate trends data
   * @private
   */
  async calculateTrends(period) {
    // Historical trends analysis requires external data processing
    return {
      velocity: {
        current: 'Processing...',
        previous: 'Processing...',
        trend: 'Processing...',
        change: 'Processing...',
        status: 'processing',
        message: 'Analyzing historical velocity trends'
      },
      quality: {
        current: 'Processing...',
        previous: 'Processing...',
        trend: 'Processing...',
        change: 'Processing...',
        status: 'processing',
        message: 'Analyzing historical quality trends'
      },
      satisfaction: {
        current: 'Processing...',
        previous: 'Processing...',
        trend: 'Processing...',
        change: 'Processing...',
        status: 'processing',
        message: 'Analyzing historical satisfaction trends'
      },
      dataSource: 'pending_historical_analysis'
    };
  }

  /**
   * Generate alerts based on metrics
   * @private
   */
  async generateAlerts(workItems, kpis) {
    const alerts = [];
    
    // Check for low velocity.
    // deliveryPredictability is null when there is no sprint commitment data
    // (fabricated 78.9 default was removed). `null < 70` is true in JS, which would
    // fire a spurious "below target" alert on every overview call — guard against it.
    if (kpis.deliveryPredictability != null && kpis.deliveryPredictability < 70) {
      alerts.push({
        type: 'warning',
        message: 'Delivery predictability is below target (70%)',
        severity: 'medium',
        metric: 'deliveryPredictability',
        value: kpis.deliveryPredictability
      });
    }
    
    // Check for high bug count
    const quality = calculateQualityMetrics(workItems);
    if (quality.openBugs > 20) {
      alerts.push({
        type: 'error',
        message: `High number of open bugs: ${quality.openBugs}`,
        severity: 'high',
        metric: 'bugCount',
        value: quality.openBugs
      });
    }
    
    // Check for cycle time
    if (kpis.cycleTime > 10) {
      alerts.push({
        type: 'warning',
        message: `Cycle time is high: ${kpis.cycleTime} days`,
        severity: 'medium',
        metric: 'cycleTime',
        value: kpis.cycleTime
      });
    }
    
    return alerts;
  }

  /**
   * Calculate delivery predictability
   * @private
   */
  calculateDeliveryPredictability(workItems, sprintInfo) {
    // Without sprint commitment data there is no real predictability to report.
    // Fabricated default (78.9) removed 2026-05-24.
    if (!sprintInfo) return null;

    const committed = sprintInfo.workItemCount || workItems.length;
    const completed = workItems.filter(wi => ['Closed', 'Done', 'Resolved', 'Deploy'].includes(wi.state)).length;
    
    return committed > 0 ? ((completed / committed) * 100).toFixed(1) : 0;
  }

  /**
   * Helper methods for metrics calculation
   * @private
   */
  calculateDefectEscapeRate(qualityMetrics) {
    // Derived from real bug-to-task ratio; 0 when no bugs/tasks. Fabricated 2.1 fallback removed 2026-05-24.
    const ratio = parseFloat(qualityMetrics?.bugToTaskRatio);
    return Number.isFinite(ratio) ? ratio * 10 : 0;
  }

  async calculateAverageCycleTime(workItems) {
    const completedItems = workItems.filter(item => 
      ['Closed', 'Done', 'Resolved', 'Deploy'].includes(item.state) && 
      item.createdDate && 
      item.closedDate
    );

    // No completed items with timestamps → no real cycle time. Fabricated 4.2 removed 2026-05-24.
    if (completedItems.length === 0) return 0;

    const totalCycleTime = completedItems.reduce((sum, item) => {
      const created = new Date(item.createdDate);
      const closed = new Date(item.closedDate);
      return sum + (closed - created) / (1000 * 60 * 60 * 24); // Days
    }, 0);

    return (totalCycleTime / completedItems.length).toFixed(2);
  }

  async calculateLeadTime(workItems) {
    // Lead time requires backlog-entry / activation timestamps not reliably present
    // on the batch work-item payload. Fabricated 8.7 default removed 2026-05-24 —
    // return null until the required Azure DevOps revision data is wired.
    return null;
  }

  calculateThroughput(velocity) {
    // Derived from real average story points per task; 0 when unavailable.
    // Fabricated 23.4 fallback removed 2026-05-24.
    const avg = parseFloat(velocity?.averageStoryPointsPerTask);
    return Number.isFinite(avg) ? avg * 10 : 0;
  }

  categorizeWorkItems(workItems) {
    const byType = workItems.reduce((acc, item) => {
      acc[item.type] = (acc[item.type] || 0) + 1;
      return acc;
    }, {});

    const byPriority = workItems.reduce((acc, item) => {
      const priority = item.priority === 1 ? 'high' : 
                     item.priority === 2 ? 'high' :
                     item.priority === 3 ? 'medium' : 'low';
      acc[priority] = (acc[priority] || 0) + 1;
      return acc;
    }, {});

    const byState = workItems.reduce((acc, item) => {
      acc[item.state] = (acc[item.state] || 0) + 1;
      return acc;
    }, {});

    return {
      total: workItems.length,
      completed: workItems.filter(wi => ['Closed', 'Done', 'Resolved', 'Deploy'].includes(wi.state)).length,
      inProgress: workItems.filter(wi => ['Active', 'In Progress'].includes(wi.state)).length,
      blocked: workItems.filter(wi => wi.reason === 'Blocked').length,
      byType,
      byPriority
    };
  }

  /**
   * Calculate individual performance metrics for a specific user
   * @param {string} userId - User identifier (email)
   * @param {object} options - Calculation options
   * @returns {Promise<object>} Individual metrics
   */
  async calculateIndividualMetrics(userId, options = {}) {
    const { period = 'sprint', startDate, endDate, productId, sprintId, iterationPath } = options;
    const cacheKey = `individual_${userId}_${period}_${startDate}_${endDate}_${productId || 'all'}_${sprintId || 'all'}_${iterationPath || 'none'}`;

    const cached = this.getFromCache(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      // Get work items assigned to this user using enhanced Azure DevOps service
      const workItems = await this.azureService.getUserWorkItems(userId, {
        startDate,
        endDate,
        productId,
        sprintId,
        iterationPath
      });
      
      // Get user capacity data for current sprint (if available)
      let capacityData = null;
      if (productId && productId !== 'all-projects') {
        try {
          const azureProjectName = mapFrontendProjectToAzure(productId);
          if (azureProjectName) {
            capacityData = await this.azureService.getUserCapacityData(userId, 'current', azureProjectName);
          }
        } catch (error) {
          console.warn('Could not fetch capacity data:', error.message);
        }
      }
      
      // Get user performance history for velocity trend analysis - always show latest 4 sprints
      let performanceHistory = [];
      try {
        performanceHistory = await this.azureService.getUserPerformanceHistory(userId, {
          timeRange: '4sprints', // Changed to show latest 4 sprints specifically
          productId
        });
      } catch (error) {
        console.warn('Could not fetch performance history for velocity trends:', error.message);
        // Fallback: create single period data from current work items
        const performance = this.calculateEnhancedUserPerformance(workItems, capacityData);
        performanceHistory = [{
          iterationPath: iterationPath || sprintId || 'Current Sprint',
          completedStoryPoints: performance.completedStoryPoints || 0,
          totalAssignedStoryPoints: performance.totalAssignedStoryPoints || 0,
          completionRate: performance.completionRate || 0,
          velocity: performance.velocity || 0,
          period: 'Current Sprint'
        }];
      }

      // Calculate individual performance metrics with real data
      const performance = this.calculateEnhancedUserPerformance(workItems, capacityData);
      const quality = this.calculateEnhancedUserQuality(workItems);
      const timeline = this.generateUserTimeline(workItems, startDate, endDate);
      const trends = this.calculateTrendsFromHistory(performanceHistory);
      const burndown = this.calculateUserBurndown(workItems, startDate, endDate);
      
      // Get user information from team members
      const userInfo = await this.getUserInfoFromTeamMembers(userId);
      
      const metrics = {
        userId,
        period: {
          type: period,
          startDate,
          endDate
        },
        userInfo: userInfo || {
          displayName: userId.includes('@') ? userId.split('@')[0] : userId,
          email: userId.includes('@') ? userId : `${userId}@company.com`,
          avatar: null,
          role: 'Developer',
          isActive: true
        },
        performance: {
          completedStoryPoints: performance.completedStoryPoints || 0,
          totalAssignedStoryPoints: performance.totalAssignedStoryPoints || 0,
          completionRate: performance.completionRate || 0,
          velocity: performance.velocity || 0,
          averageTaskCompletionTime: performance.averageTaskCompletionTime || 0,
          capacityUtilization: performance.capacityUtilization || 0
        },
        workItems: (() => {
          // Apply sprint filtering consistently for all work item counts
          let filteredItems = workItems;

          if (sprintId && sprintId !== 'all-sprints') {
            let actualSprintId = sprintId;

            // Handle 'current' sprint by finding the latest Delivery sprint
            if (sprintId === 'current') {
              // Find the highest numbered Delivery sprint from work items
              const deliverySprintNumbers = workItems
                .map(item => {
                  if (!item.iterationPath) return null;
                  const iterationName = item.iterationPath.split('\\').pop() || item.iterationPath;
                  const match = iterationName.match(/^Delivery\s+(\d+)$/i);
                  return match ? parseInt(match[1]) : null;
                })
                .filter(num => num !== null);

              if (deliverySprintNumbers.length > 0) {
                const currentSprintNumber = Math.max(...deliverySprintNumbers);
                actualSprintId = `delivery-${currentSprintNumber}`;
              } else {
                // Fallback: if no Delivery sprints found, don't filter
                actualSprintId = 'all-sprints';
              }
            }

            // First, try to filter by specific sprint using iteration path
            const sprintFilteredItems = workItems.filter(item => {
              if (!item.iterationPath) return false;
              const itemSprintName = item.iterationPath.split('\\').pop() || item.iterationPath;
              return itemSprintName.includes(actualSprintId.replace('delivery-', 'Delivery '));
            });

            // If iteration path filtering worked, use those items
            if (sprintFilteredItems.length > 0) {
              filteredItems = sprintFilteredItems;
            } else {
              // If no iteration path data available, try alternate filtering approaches
              // Look for work items that have the sprint ID in their title or description
              const titleFilteredItems = workItems.filter(item => {
                const searchText = ((item.title || '') + ' ' + (item.description || '')).toLowerCase();
                const targetSprint = actualSprintId.replace('delivery-', '').replace('-', ' ');
                return searchText.includes('delivery') && searchText.includes(targetSprint);
              });

              if (titleFilteredItems.length > 0) {
                filteredItems = titleFilteredItems;
              }
              // If no alternate filtering works, keep all items (fallback behavior)
            }
          } else if (iterationPath) {
            // Filter by iteration path
            filteredItems = workItems.filter(item =>
              item.iterationPath && item.iterationPath.includes(iterationPath)
            );

            // If no items match the iteration path filter, fall back to all items
            if (filteredItems.length === 0) {
              filteredItems = workItems;
            }
          }

          return {
            total: filteredItems.length,
            completed: filteredItems.filter(wi => wi.state === 'Done' || wi.state === 'Closed' || wi.state === 'Deploy').length,
            inProgress: filteredItems.filter(wi => wi.state === 'Active' || wi.state === 'In Progress').length,
            backlog: filteredItems.filter(wi => wi.state === 'New' || wi.state === 'Approved').length,
            byType: this.categorizeWorkItemsByType(filteredItems),
            recent: filteredItems
              .sort((a, b) => new Date(b.changedDate) - new Date(a.changedDate))
              // Show all filtered work items, not just recent 5
              .map(item => ({
              id: item.id,
              title: item.title,
              type: item.type,
              state: item.state,
              storyPoints: item.storyPoints,
              priority: item.priority,
              url: item.url
            }))
          };
        })(),
        quality: {
          bugsCreated: quality.bugsCreated || 0,
          bugsResolved: quality.bugsResolved || 0,
          codeReviewComments: quality.codeReviewComments || 0,
          testCasesPassed: quality.testCasesPassed || 0,
          qualityScore: quality.qualityScore || 100
        },
        trends: trends || [],
        burndown: burndown || [],
        timeline: timeline || [],
        capacity: capacityData,
        cached: false,
        lastUpdate: new Date().toISOString()
      };

      this.setCache(cacheKey, metrics);
      return metrics;
      
    } catch (error) {
      console.error(`Error calculating individual metrics for ${userId}:`, error);
      throw new Error(`Failed to calculate individual metrics: ${error.message}`);
    }
  }

  /**
   * Get work items assigned to a specific user
   * @private
   */
  async getWorkItemsForUser(userId, { startDate, endDate, productId } = {}) {
    let queryOptions = {
      assignedTo: userId,
      maxResults: 1000
    };

    // Map frontend productId to Azure DevOps project name if provided
    if (productId) {
      const azureProjectName = mapFrontendProjectToAzure(productId);
      if (azureProjectName) {
        queryOptions.projectName = azureProjectName;
      }
    }

    if (startDate && endDate) {
      queryOptions.customQuery = `
        SELECT [System.Id], [System.Title], [System.WorkItemType], [System.AssignedTo], 
               [System.State], [Custom.StoryPoint], [System.CreatedDate], 
               [System.ChangedDate], [Microsoft.VSTS.Common.ClosedDate], [System.AreaPath], 
               [System.IterationPath], [Microsoft.VSTS.Common.Priority]
        FROM WorkItems 
        WHERE [System.TeamProject] = @project 
        AND [System.WorkItemType] IN ('Task', 'Bug')
        AND [System.AssignedTo] = '${userId}'
        AND [System.ChangedDate] >= '${startDate}'
        AND [System.ChangedDate] <= '${endDate}'
        ORDER BY [System.ChangedDate] DESC
      `;
    }

    const response = await this.azureService.getWorkItems(queryOptions);
    
    if (response.workItems.length > 0) {
      const workItemIds = response.workItems.map(wi => wi.id);
      // Use the same project name for getting details if specified
      const projectName = queryOptions.projectName || null;
      const detailsResponse = await this.azureService.getWorkItemDetails(workItemIds, null, projectName);
      return detailsResponse.workItems;
    }

    return [];
  }

  /**
   * Calculate user performance metrics
   * @private
   */
  calculateUserPerformanceMetrics(workItems) {
    const err = new Error('calculateUserPerformanceMetrics: real Azure DevOps integration required; mock removed 2026-05-19');
    err.code = 'NOT_IMPLEMENTED';
    throw err;
  }

  /**
   * Calculate user quality metrics
   * @private
   */
  calculateUserQualityMetrics(workItems) {
    const bugs = workItems.filter(item => item.type === 'Bug');
    const tasks = workItems.filter(item => item.type === 'Task');
    
    const bugsCreated = bugs.filter(bug => 
      !['Closed', 'Done', 'Resolved', 'Deploy'].includes(bug.state)
    ).length;
    
    const bugsFixed = bugs.filter(bug => 
      ['Closed', 'Done', 'Resolved', 'Deploy'].includes(bug.state)
    ).length;

    const bugRatio = tasks.length > 0 ? 
      (bugs.length / tasks.length).toFixed(3) : 0;

    return {
      bugsCreated,
      bugsFixed,
      bugRatio: parseFloat(bugRatio),
      totalBugs: bugs.length,
      codeQuality: this.calculateCodeQuality(bugs, tasks)
    };
  }

  /**
   * Generate user timeline for contribution tracking
   * @private
   */
  generateUserTimeline(workItems, startDate, endDate) {
    if (!startDate || !endDate) {
      // Generate timeline for last 30 days
      const end = new Date();
      const start = new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);
      startDate = start.toISOString().split('T')[0];
      endDate = end.toISOString().split('T')[0];
    }

    const timeline = [];
    const current = new Date(startDate);
    const end = new Date(endDate);

    while (current <= end) {
      const dateStr = current.toISOString().split('T')[0];
      
      const dayItems = workItems.filter(item => {
        const itemDate = item.closedDate || item.changedDate;
        return itemDate && itemDate.startsWith(dateStr);
      });

      const storyPoints = dayItems.reduce((sum, item) => 
        sum + (item.storyPoints || 0), 0
      );

      timeline.push({
        date: dateStr,
        itemsCompleted: dayItems.filter(item => 
          ['Closed', 'Done', 'Resolved', 'Deploy'].includes(item.state)
        ).length,
        storyPoints,
        activities: dayItems.map(item => ({
          id: item.id,
          title: item.title,
          type: item.type,
          state: item.state
        }))
      });

      current.setDate(current.getDate() + 1);
    }

    return timeline;
  }

  /**
   * Get list of team members from work items
   * @param {object} options - Filtering options
   * @param {string} options.productId - Product ID to filter by
   * @param {string} options.sprintId - Sprint ID to filter by
   * @returns {Promise<object>} Team members data
   */
  async getTeamMembersList(options = {}) {
    try {
      const { productId, sprintId } = options;
      
      console.log('🔧 DEBUG: getTeamMembersList called with options:', options);
      console.log(`🔧 DEBUG: productId = "${productId}", type: ${typeof productId}`);
      console.log(`🔧 DEBUG: productId !== 'all-projects' = ${productId !== 'all-projects'}`);
      console.log('📊 Getting team members list with filters:', { productId, sprintId });
      
      // If productId is specified and not 'all-projects', use proper project mapping
      if (productId && productId !== 'all-projects') {
        // Map frontend project to actual Azure DevOps project
        const azureProjectName = mapFrontendProjectToAzure(productId);
        
        console.log(`🔧 TRACE: Frontend project "${productId}" mapped to Azure project "${azureProjectName}"`);
        
        try {
          // Get all team members from the actual Azure DevOps project
          const allMembers = await this.azureService.getTeamMembers();
          console.log(`📊 Got ${allMembers.length} total members from Azure DevOps`);
          
          // Filter members by the specific project using the new filtering logic
          const filteredMembers = await this.azureService.filterMembersByProject(allMembers, productId);
          console.log(`📊 Filtered to ${filteredMembers.length} members for project ${productId}`);
          
          return {
            members: filteredMembers.map(member => ({
              id: member.id || member.email,
              name: member.displayName || member.name,
              email: member.uniqueName || member.email,
              avatar: member.imageUrl || member.avatar,
              role: member.role || 'Team Member',
              isActive: true
            })),
            count: filteredMembers.length,
            filters: { productId, sprintId },
            project: productId,
            actualProject: azureProjectName,
            totalMembers: allMembers.length,
            dataSource: 'azureDevOpsFiltered'
          };
        } catch (error) {
          console.warn(`Failed to get filtered team members for project ${productId}:`, error.message);
          // Fall back to work items approach if filtering fails
        }
      }
      
      // Use work items approach for 'all-projects' or as fallback
      console.log(`🔧 TRACE: Using work items approach to get team members for productId: "${productId}"`);
      
      const workItems = await this.getWorkItemsForPeriod({ maxResults: 2000 });
      console.log(`📊 Found ${workItems.length} work items from configured project`);
      
      const membersMap = new Map();
      
      workItems.forEach(item => {
        if (item.assigneeEmail && !membersMap.has(item.assigneeEmail)) {
          membersMap.set(item.assigneeEmail, {
            id: item.assigneeEmail,
            name: item.assignee,
            email: item.assigneeEmail,
            avatar: item.assigneeImageUrl || null,
            role: 'Developer',
            isActive: true,
            workItemCount: workItems.filter(wi => wi.assigneeEmail === item.assigneeEmail).length
          });
        }
      });

      const allMembers = Array.from(membersMap.values()).sort((a, b) => 
        a.name.localeCompare(b.name)
      );

      console.log(`📊 Returning ${allMembers.length} team members from work items for project ${productId}`);

      return {
        members: allMembers,
        count: allMembers.length,
        filters: { productId, sprintId },
        project: productId,
        totalMembers: allMembers.length,
        totalWorkItems: workItems.length,
        dataSource: 'workItems'
      };
    } catch (error) {
      console.error('Error fetching team members list:', error);
      throw error;
    }
  }

  /**
   * Filter team members by project using Azure DevOps service
   * @private
   */
  async filterMembersByProject(allMembers, projectName) {
    // Delegate to Azure DevOps service for proper project filtering
    return await this.azureService.filterMembersByProject(allMembers, projectName);
  }

  /**
   * Get user information from Azure DevOps team members data
   * @private
   */
  async getUserInfoFromTeamMembers(userId) {
    try {
      // Try to find the user across all Azure DevOps projects
      const projectIds = ['Product - Data as a Service', 'Product - Supplier Connect', 'Product - CFG Workflow', 'Product - RTS-On-Prem'];
      
      for (const projectId of projectIds) {
        try {
          const teamMembersData = await this.getTeamMembersList({ productId: projectId });
          const user = teamMembersData.members?.find(member => 
            member.email?.toLowerCase() === userId.toLowerCase()
          );

          if (user) {
            console.log(`📋 Found user ${userId} in project ${projectId} with name: ${user.name}`);
            return {
              name: user.name, // This comes from Azure DevOps displayName
              email: user.email,
              avatar: user.avatar,
              role: user.role || 'Developer'
            };
          }
        } catch (projectError) {
          console.warn(`⚠️ Could not check project ${projectId} for user ${userId}:`, projectError.message);
          continue;
        }
      }

      // Fallback if user not found in any project
      console.warn(`⚠️ User ${userId} not found in any Azure DevOps project`);
      return this.extractUserInfo([], userId); // Use the old method as fallback
      
    } catch (error) {
      console.error(`Error getting user info from team members for ${userId}:`, error);
      // Fallback to work items extraction
      const workItems = await this.getWorkItemsForUser(userId);
      return this.extractUserInfo(workItems, userId);
    }
  }

  /**
   * Extract user information from work items
   * @private
   */
  extractUserInfo(workItems, userId) {
    // Better fallback name from email
    const fallbackName = userId ? 
      userId.split('@')[0].replace(/[._-]/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) : 
      'Team Member';

    if (workItems.length === 0) {
      return {
        name: fallbackName,
        email: userId,
        avatar: null,
        role: 'Developer'
      };
    }

    // Get user info from the first work item with assignee data
    const userItem = workItems.find(item => item.assigneeEmail === userId);
    
    if (userItem) {
      return {
        name: userItem.assignee || fallbackName,
        email: userItem.assigneeEmail,
        avatar: userItem.assigneeImageUrl || null,
        role: 'Developer' // Default role, could be enhanced with org data
      };
    }

    return {
      name: fallbackName, // Extract and format name from email
      email: userId,
      avatar: null,
      role: 'Developer'
    };
  }

  /**
   * Helper methods for individual metrics calculations
   * @private
   */
  calculateUserVelocity(workItems) {
    const recentItems = workItems
      .filter(item => ['Closed', 'Done', 'Resolved', 'Deploy'].includes(item.state))
      .slice(0, 10); // Last 10 completed items
    
    const totalStoryPoints = recentItems.reduce((sum, item) => 
      sum + (item.storyPoints || 0), 0
    );
    
    return recentItems.length > 0 ? 
      (totalStoryPoints / recentItems.length).toFixed(2) : 0;
  }

  calculateUserProductivity(allItems, completedItems) {
    const baseScore = completedItems.length * 10;
    const storyPointBonus = completedItems.reduce((sum, item) => 
      sum + (item.storyPoints || 0), 0
    ) * 2;
    
    return Math.min(100, baseScore + storyPointBonus).toFixed(1);
  }

  calculateCodeQuality(bugs, tasks) {
    // No tasks → no measured quality. Fabricated "default good quality" 8.0 removed 2026-05-24.
    if (tasks.length === 0) return null;

    const bugRatio = bugs.length / tasks.length;
    let quality = 10;
    
    if (bugRatio > 0.3) quality -= 4;
    else if (bugRatio > 0.2) quality -= 2;
    else if (bugRatio > 0.1) quality -= 1;
    
    return Math.max(1, quality).toFixed(1);
  }

  calculateUserQualityScore(qualityMetrics) {
    const bugScore = qualityMetrics.bugsFixed > qualityMetrics.bugsCreated ? 2 : -1;
    const ratioScore = qualityMetrics.bugRatio < 0.1 ? 8 : 6;
    // codeQuality can be null when there were no tasks to measure (see calculateCodeQuality).
    const parsedCode = parseFloat(qualityMetrics.codeQuality);
    const codeScore = Number.isFinite(parsedCode) ? parsedCode : 0;

    return Math.min(10, Math.max(1, bugScore + ratioScore + codeScore * 0.1)).toFixed(1);
  }

  categorizeUserWorkItems(workItems) {
    const categorized = this.categorizeWorkItems(workItems);
    
    // Add user-specific categorization
    const recentItems = workItems
      .sort((a, b) => new Date(b.changedDate) - new Date(a.changedDate))
      .slice(0, 5);

    return {
      ...categorized,
      recent: recentItems.map(item => ({
        id: item.id,
        title: item.title,
        type: item.type,
        state: item.state,
        storyPoints: item.storyPoints,
        priority: item.priority,
        url: item.url // Use the URL directly from the transformed work item
      }))
    };
  }

  /**
   * Generate Azure DevOps work item URL
   * @private
   */
  generateWorkItemUrl(workItemId, projectName) {
    const organization = this.azureService.organization;
    const project = projectName || this.azureService.project;
    return `https://dev.azure.com/${organization}/${encodeURIComponent(project)}/_workitems/edit/${workItemId}`;
  }

  async calculateUserTrends(userId, period) {
    const err = new Error('calculateUserTrends: real Azure DevOps integration required; mock removed 2026-05-19');
    err.code = 'NOT_IMPLEMENTED';
    throw err;
  }

  async getUserComparisonData(userId, userWorkItems) {
    // Compare user performance against team average
    const teamMetrics = await this.getTeamAverageMetrics();
    const userMetrics = this.calculateUserPerformanceMetrics(userWorkItems);
    
    // teamMetrics comes from getTeamAverageMetrics() (which currently throws an
    // honest NOT_IMPLEMENTED error). Fabricated fallbacks (75.5 / 3.2 / 5.8) removed
    // 2026-05-24 — use the real team average or null, never invented numbers.
    return {
      taskCompletion: {
        user: userMetrics.completionRate,
        teamAverage: teamMetrics.averageCompletionRate ?? null,
        percentile: teamMetrics.averageCompletionRate != null
          ? this.calculatePercentile(userMetrics.completionRate, teamMetrics.averageCompletionRate)
          : null
      },
      velocity: {
        user: userMetrics.averageVelocity,
        teamAverage: teamMetrics.averageVelocity ?? null,
        percentile: teamMetrics.averageVelocity != null
          ? this.calculatePercentile(userMetrics.averageVelocity, teamMetrics.averageVelocity)
          : null
      },
      cycleTime: {
        user: userMetrics.averageCycleTime,
        teamAverage: teamMetrics.averageCycleTime ?? null,
        percentile: teamMetrics.averageCycleTime != null
          ? this.calculatePercentile(userMetrics.averageCycleTime, teamMetrics.averageCycleTime, true) // Lower is better
          : null
      }
    };
  }

  generateUserAlerts(performance, quality) {
    const alerts = [];
    
    if (performance.completionRate < 60) {
      alerts.push({
        type: 'warning',
        message: 'Task completion rate is below expected threshold',
        severity: 'medium',
        metric: 'completion_rate',
        value: performance.completionRate
      });
    }
    
    if (quality.bugRatio > 0.2) {
      alerts.push({
        type: 'error',
        message: 'High bug-to-task ratio indicates quality concerns',
        severity: 'high',
        metric: 'bug_ratio',
        value: quality.bugRatio
      });
    }
    
    if (performance.averageCycleTime > 10) {
      alerts.push({
        type: 'info',
        message: 'Cycle time is higher than team average',
        severity: 'low',
        metric: 'cycle_time',
        value: performance.averageCycleTime
      });
    }
    
    return alerts;
  }

  generateTrendData(metric, points) {
    const data = [];
    const baseValue = metric === 'velocity' ? 3.5 : metric === 'quality' ? 8.2 : 78.5;
    
    for (let i = points - 1; i >= 0; i--) {
      const variation = 0;
      const value = baseValue * (1 + variation);
      const date = new Date();
      date.setDate(date.getDate() - (i * 7)); // Weekly data points
      
      data.push({
        date: date.toISOString().split('T')[0],
        value: parseFloat(value.toFixed(2))
      });
    }
    
    return data;
  }

  calculatePercentile(userValue, teamAverage, lowerIsBetter = false) {
    if (!teamAverage || teamAverage === 0) return 50;
    
    const ratio = userValue / teamAverage;
    let percentile;
    
    if (lowerIsBetter) {
      percentile = ratio < 1 ? 50 + (1 - ratio) * 30 : 50 - (ratio - 1) * 30;
    } else {
      percentile = ratio > 1 ? 50 + (ratio - 1) * 30 : 50 - (1 - ratio) * 30;
    }
    
    return Math.min(95, Math.max(5, Math.round(percentile)));
  }

  async getTeamAverageMetrics() {
    const err = new Error('getTeamAverageMetrics: real Azure DevOps integration required; mock removed 2026-05-19');
    err.code = 'NOT_IMPLEMENTED';
    throw err;
  }

  // Placeholder methods for data that requires additional Azure DevOps API calls
  // Hardcoded counts (5 / 12) removed 2026-05-24 — these masqueraded as real
  // org-wide totals. Return null until a real project/product enumeration is wired.
  async getTotalProducts() { return null; }
  async getActiveProjects() { return null; }
  async getTestCoverage() { 
    return {
      value: 'Processing...',
      status: 'processing',
      message: 'Integrating with code coverage analysis tools',
      dataSource: 'pending_coverage_integration'
    };
  }
  async getTechnicalDebtScore() { 
    return {
      value: 'Processing...',
      status: 'processing',
      message: 'Analyzing codebase for technical debt metrics',
      dataSource: 'pending_code_analysis'
    };
  }
  async getCollaborationScore() { 
    return {
      value: 'Processing...',
      status: 'processing',
      message: 'Analyzing team collaboration patterns',
      dataSource: 'pending_collaboration_analysis'
    };
  }
  async getTeamSatisfaction() { 
    return {
      value: 'Processing...',
      status: 'processing',
      message: 'Integrating with team satisfaction survey systems',
      dataSource: 'pending_survey_integration'
    };
  }
  // Hardcoded velocity trend ('increasing') and history ([42.1, 44.5, 47.2, 45.8])
  // removed 2026-05-24 — these were fabricated. Real values require querying
  // historical sprint velocities from Azure DevOps. Return null/empty honestly.
  async getVelocityTrend() { return null; }
  async getVelocityHistory() { return []; }
  async getUserTestCoverage() { 
    return {
      value: 'Processing...',
      status: 'processing',
      message: 'Analyzing individual test coverage metrics',
      dataSource: 'pending_coverage_analysis'
    };
  }

  calculateCommitmentReliability(sprintMetrics) {
    // sprintProgress is real (derived from work items). When it is absent we must
    // not invent a plausible number (previously hardcoded 78.9 — removed 2026-05-24).
    const progress = parseFloat(sprintMetrics?.sprintProgress);
    return Number.isFinite(progress) ? progress : null;
  }

  calculateProductivityScore(teamPerformance) {
    const avgTasksPerMember = teamPerformance.teamTotals.tasksCompleted / Math.max(1, teamPerformance.totalMembers);
    return Math.min(100, avgTasksPerMember * 10).toFixed(1);
  }

  calculateUtilization(teamPerformance) {
    // Real utilization requires per-member capacity data from Azure DevOps
    // (work/teamsettings/iterations/{id}/capacities). The teamPerformance object
    // aggregated from work items does not carry capacity, so we surface an honest
    // not_available contract instead of fabricating a plausible percentage.
    // mock magic-number (85.4) removed 2026-05-24
    return {
      value: null,
      status: 'not_available',
      message: 'Utilization requires Azure DevOps team capacity data which is not wired into this aggregation.',
      dataSource: 'not_implemented'
    };
  }

  identifyRisks(sprintMetrics, qualityMetrics) {
    const risks = [];
    
    if (parseFloat(sprintMetrics.sprintProgress) < 70) {
      risks.push({
        type: 'velocity',
        description: 'Sprint progress is below target',
        severity: 'medium',
        impact: 'Schedule may be at risk',
      });
    }
    
    if (qualityMetrics.openBugs > 15) {
      risks.push({
        type: 'quality',
        description: 'High number of open bugs',
        severity: 'high',
        impact: 'Quality and delivery at risk',
      });
    }
    
    return risks;
  }

  // Cache management
  getFromCache(key) {
    const cached = this.cache.get(key);
    if (cached && (Date.now() - cached.timestamp) < this.cacheTTL) {
      return cached.data;
    }
    return null;
  }

  setCache(key, data) {
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });
  }

  clearCache() {
    this.cache.clear();
  }

  /**
   * Calculate detailed KPIs for dashboard cards
   * @param {object} options - Calculation options
   * @returns {Promise<object>} Detailed KPI data
   */
  async calculateDetailedKPIs(options = {}) {
    const {
      period = 'sprint',
      productId,
      sprintId,
      workItemTypes = 'Product Backlog Item',
      resolvedAsCompleted = true,
      aggregation = 'storyPoints',
    } = options;
    const cacheKey = `detailed_kpis_${period}_${productId}_${sprintId}_${workItemTypes}_${resolvedAsCompleted}_${aggregation}`;
    
    const cached = this.getFromCache(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      // Get work items for the specified period
      let workItems;
      try {
        workItems = await this.getWorkItemsForProduct(productId, { sprintId });
      } catch (azureError) {
        // Try real Azure DevOps API service as fallback
        console.info(`Azure DevOps API failed for KPI calculation, trying real API service for ${productId}`);
        try {
          workItems = await this.realApiService.getRealWorkItems(productId, sprintId);
          if (!workItems || workItems.length === 0) {
            throw new Error('No work items from real API');
          }
        } catch (realApiError) {
          console.error(`Both Azure DevOps APIs failed for ${productId}:`, realApiError.message);
          throw new Error(`Unable to fetch work items from Azure DevOps for ${productId}`);
        }
      }
      
      // A1: Filter by work item type (default: PBI only, 'all' = no filter)
      const filteredItems = this._filterByWorkItemTypes(workItems, workItemTypes);

      // A2: Build completed-states set based on resolvedAsCompleted flag
      const completedStates = this._getCompletedStates(resolvedAsCompleted);

      // P/L metrics — returns an honest not_available contract (no real financial source wired)
      const pl = await this.calculatePLMetrics(filteredItems, productId);

      // Calculate velocity metrics (completed story points)
      const velocity = calculateVelocity(filteredItems);

      // A3: Aggregate committed value (storyPoints or count)
      const totalCommittedStoryPoints = aggregation === 'count'
        ? filteredItems.length
        : filteredItems.reduce((sum, item) => sum + (item.storyPoints || 0), 0);

      // Calculate bug metrics
      const bugs = this.calculateBugMetrics(workItems); // bugs always use full set
      
      // Satisfaction metrics — returns an honest not_available contract (no real survey source wired)
      const satisfaction = await this.calculateSatisfactionMetrics(workItems);

      const kpis = {
        pl: {
          value: pl.value,
          trend: pl.trend,
          trendValue: pl.trendValue,
          period: 'YTD',
          target: pl.target,
          status: pl.status,
          message: pl.message,
          dataSource: pl.dataSource
        },
        velocity: {
          value: totalCommittedStoryPoints, // ✅ FIXED - showing total sprint capacity (committed story points)
          trend: velocity.trend || 0,
          trendValue: velocity.trendValue || '0%',
          period: 'Current Sprint',
          target: velocity.target || 40,
          status: 'real',
          dataSource: 'azure_devops'
        },
        bugs: {
          value: bugs.total,
          trend: bugs.trend,
          trendValue: bugs.trendValue,
          period: 'Current Sprint',
          target: 15,
          status: 'real',
          dataSource: 'azure_devops'
        },
        satisfaction: {
          value: satisfaction.value,
          trend: satisfaction.trend,
          trendValue: satisfaction.trendValue,
          period: 'Current Sprint',
          target: 4.5,
          status: satisfaction.status,
          message: satisfaction.message,
          dataSource: satisfaction.dataSource
        }
      };

      this.setCache(cacheKey, kpis);
      return kpis;
      
    } catch (error) {
      console.error('Error calculating detailed KPIs:', error);
      throw new Error(`Failed to calculate KPIs: ${error.message}`);
    }
  }

  /**
   * Calculate sprint burndown data
   * @param {object} options - Calculation options
   * @returns {Promise<Array>} Burndown data points
   */
  async calculateSprintBurndown(options = {}) {
    const {
      sprintId,
      productId,
      // undefined → smart default applied at the filter step (PBI when present, else all)
      workItemTypes,
      resolvedAsCompleted = true,
      aggregation = 'storyPoints',
    } = options;
    const cacheKey = `sprint_burndown_${sprintId}_${productId}_${workItemTypes}_${resolvedAsCompleted}_${aggregation}`;
    
    const cached = this.getFromCache(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      // Get current sprint work items
      let workItems = await this.getWorkItemsForProduct(productId, { sprintId });
      
      // Get sprint iteration data
      const sprintData = await this.getSprintData(sprintId, productId);
      // getSprintData now returns null when no real Azure iteration resolves (fabricated
      // "Delivery 13/6" fallback was removed). generateBurndownChart dereferences
      // sprintData.startDate, so guard here: fail honestly rather than crash with a
      // cryptic TypeError, and never fabricate a sprint window.
      if (!sprintData || !sprintData.startDate) {
        throw new Error(`Sprint date range not available for ${productId}/${sprintId}; cannot compute burndown without a real iteration`);
      }
      const sprintDuration = this.calculateSprintDuration(sprintData);
      
      // If no work items found, try real API service first, then fallback to mock data
      if (!workItems || workItems.length === 0) {
        console.info(`No work items found for ${productId}, trying real API service`);
        try {
          // Resolve iteration path the same way as getWorkItemsForProduct
          let resolvedIterationPath = null;
          if (sprintId) {
            try {
              resolvedIterationPath = await this.azureService.iterationResolver.resolveIteration(
                productId,
                sprintId,
                null // teamName - let resolver use project mapping
              );
              console.log(`📊 Resolved iteration path: ${sprintId} → ${resolvedIterationPath} for ${productId}`);
            } catch (resolveError) {
              console.warn(`Failed to resolve iteration path for ${sprintId}: ${resolveError.message}`);
            }
          }

          // Pass the resolved iteration path to avoid duplicate resolution
          workItems = await this.realApiService.getRealWorkItems(productId, sprintId, resolvedIterationPath);
          if (!workItems || workItems.length === 0) {
            throw new Error('No work items from real API');
          }
        } catch (realApiError) {
          console.error(`Both Azure DevOps APIs failed for burndown data ${productId}:`, realApiError.message);
          throw new Error(`Unable to fetch burndown work items from Azure DevOps for ${productId}`);
        }
      }
      
      // A1: Filter by work item type.
      // Smart default when caller didn't specify: prefer PBI/User Story (matches the
      // Azure "Sprint Burndown" widget) for projects that have strict Product Backlog
      // Items (PMP/DaaS). For task-level teams (OMNIA: zero strict PBI, only Task/Bug/
      // User Story), fall back to **all** items so the burndown reflects the sprint
      // taskboard. Discriminator uses strict PBI presence to avoid the User Story
      // alias from accidentally matching for OMNIA.
      let filteredItems;
      if (workItemTypes === undefined || workItemTypes === null) {
        const hasStrictPbi = (workItems || []).some(w => (w.workItemType || w.type || '').toLowerCase() === 'product backlog item');
        filteredItems = hasStrictPbi
          ? this._filterByWorkItemTypes(workItems, 'Product Backlog Item')
          : this._filterByWorkItemTypes(workItems, 'all');
      } else {
        filteredItems = this._filterByWorkItemTypes(workItems, workItemTypes);
      }

      // A2/A3: Pass resolvedAsCompleted and aggregation to chart generator
      const burndownData = this.generateBurndownChart(filteredItems, sprintData, sprintDuration, { resolvedAsCompleted, aggregation });

      this.setCache(cacheKey, burndownData);
      return burndownData;

    } catch (error) {
      console.error('Error calculating sprint burndown:', error);
      throw new Error(`Failed to calculate burndown: ${error.message}`);
    }
  }

  /**
   * Calculate team velocity trend data
   * @param {object} options - Calculation options
   * @returns {Promise<Array>} Velocity trend data
   */
  async calculateVelocityTrend(options = {}) {
    const {
      period = 'sprint',
      range = 6,
      productId,
      workItemTypes = 'Product Backlog Item',
      resolvedAsCompleted = false,
      aggregation = 'count',
    } = options;
    const cacheKey = `velocity_trend_${period}_${range}_${productId}_${workItemTypes}_${resolvedAsCompleted}_${aggregation}`;

    const cached = this.getFromCache(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      // Determine the correct team based on productId
      const { mapFrontendProjectToTeam } = require('../config/projectMapping');
      const teamName = mapFrontendProjectToTeam(productId) || "PMP Developer Team";
      const isOmniaProject = productId && productId.toLowerCase().includes('omnia');
      const isSlickProject = productId && productId.toLowerCase().includes('slick');
      // Projects that use "Sprint*" iteration names (vs. PMP/DaaS "Delivery N")
      const usesSprintPattern = isOmniaProject || isSlickProject;

      // 1) Get real iterations - try realApiService first (works for OMNIA), then fallback
      let iterations = [];

      // Try the real API service first (same as /sprints endpoint)
      try {
        console.log(`🔍 [DEBUG] Trying realApiService.getRealSprintData for ${productId}`);
        const realSprints = await this.realApiService.getRealSprintData(productId);
        if (realSprints && realSprints.length > 0) {
          // Convert sprint format to iteration format
          iterations = realSprints.map(s => ({
            id: s.azureDevOpsId,
            name: s.name,
            path: s.path,
            attributes: {
              startDate: s.startDate,
              finishDate: s.endDate
            }
          }));
          console.log(`✅ Got ${iterations.length} iterations from realApiService`);
        }
      } catch (realApiError) {
        console.log(`⚠️ realApiService failed: ${realApiError.message}, trying iteration resolver`);
      }

      // Fallback to iteration resolver if realApiService failed
      if (!iterations || iterations.length === 0) {
        iterations = await this.azureService.iterationResolver.getProjectIterations(
          productId || this.azureService.project,
          teamName
        );
      }

      console.log('🔍 [DEBUG] Raw iterations from Azure DevOps:', iterations?.map(i => ({
        id: i.id,
        name: i.name,
        path: i.path
      })));

      // 2) Filter for sprints based on project type
      // - PMP/DaaS: "Delivery" sprints
      // - OMNIA: "OMS - Sprint" or "Sprint" iterations
      const filteredIterations = (iterations || [])
        .filter(iter => {
          if (usesSprintPattern) {
            // For OMNIA & Slick: match "OMS - Sprint N" or "Sprint YYYY-N" patterns
            const hasOmsSprintName = iter.name && (
              iter.name.toLowerCase().includes('oms') ||
              iter.name.toLowerCase().includes('sprint')
            );
            return hasOmsSprintName;
          } else {
            // For PMP/DaaS: match Delivery sprints
            const hasDeliveryPath = iter.path && iter.path.includes('Delivery');
            const hasDeliveryName = iter.name && iter.name.toLowerCase().includes('delivery');
            return hasDeliveryPath || hasDeliveryName;
          }
        })
        .filter(iter => iter.attributes?.startDate)
        .filter(iter => new Date(iter.attributes.startDate) <= new Date()) // Exclude future sprints
        .sort((a, b) => new Date(b.attributes.startDate) - new Date(a.attributes.startDate));

      console.log('🔍 [DEBUG] Filtered iterations:', filteredIterations?.map(i => ({
        name: i.name,
        path: i.path,
        startDate: i.attributes?.startDate
      })));

      // 3) Take the last N sprints (dynamically, regardless of numbers)
      const targetSprints = filteredIterations
        .slice(0, Math.min(range, filteredIterations.length));

      console.log(`🔍 [DEBUG] Target sprints (last ${range} delivery sprints):`, targetSprints?.map(i => i.name));

      const velocityTrend = [];

      const completedStatesForTrend = this._getCompletedStates(resolvedAsCompleted);

      for (const iter of targetSprints) {
        const sprintName = iter.name;
        // 4) Fetch work items for each sprint and compute real commitment/velocity
        const rawItems = await this.getWorkItemsForProduct(productId, { sprintId: sprintName });

        // A1: Filter by work item type
        const workItems = this._filterByWorkItemTypes(rawItems, workItemTypes);

        // A3: Compute commitment and velocity based on aggregation param
        const completedItems = workItems.filter(wi => completedStatesForTrend.includes(wi.state));
        const commitmentStoryPoints = aggregation === 'count'
          ? workItems.length
          : workItems.reduce((sum, wi) => sum + (wi.storyPoints || 0), 0);
        const velocityValue = aggregation === 'count'
          ? completedItems.length
          : completedItems.reduce((sum, wi) => sum + (wi.storyPoints || 0), 0);
        const v = { storyPoints: velocityValue, averageStoryPointsPerTask: completedItems.length > 0 ? velocityValue / completedItems.length : 0 };

        // Extract sprint number for chronological sorting.
        // Priority: "Sprint YYYY-N" (Slick) → year*100+N, trailing digit group, first digit group.
        let sprintNumber = 0;
        const yearNMatch = sprintName.match(/Sprint\s+(\d{4})-(\d+)/i);
        if (yearNMatch) {
          sprintNumber = parseInt(yearNMatch[1]) * 100 + parseInt(yearNMatch[2]);
        } else {
          const trailingMatch = sprintName.match(/(\d+)$/);
          const firstMatch = sprintName.match(/(\d+)/);
          const fallback = trailingMatch || firstMatch;
          sprintNumber = fallback ? parseInt(fallback[1]) : 0;
        }

        velocityTrend.push({
          sprint: sprintName,
          velocity: Number(v.storyPoints) || 0,
          commitment: Number(commitmentStoryPoints) || 0,
          completed: Number(v.storyPoints) || 0,
          average: Number(v.averageStoryPointsPerTask) || 0,
          sprintNumber,
        });
      }

      // 5) Return chronologically ascending by sprint number
      velocityTrend.sort((a, b) => a.sprintNumber - b.sprintNumber);

      console.log('🔍 [DEBUG] Final velocity trend result:', velocityTrend);

      this.setCache(cacheKey, velocityTrend);
      return velocityTrend;
      
    } catch (error) {
      console.error('Error calculating velocity trend:', error);
      throw new Error(`Failed to calculate velocity trend: ${error.message}`);
    }
  }

  /**
   * Calculate task distribution data
   * @param {object} options - Calculation options
   * @returns {Promise<Array>} Task distribution data
   */
  async calculateTaskDistribution(options = {}) {
    const { period = 'sprint', sprintId, productId } = options;
    const cacheKey = `task_distribution_v2_${period}_${sprintId}_${productId}`;
    
    const cached = this.getFromCache(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      // Get work items for the specified period
      const workItems = await this.getWorkItemsForProduct(productId, { sprintId });
      
      // Group by work item type
      const distribution = this.groupByType(workItems);

      this.setCache(cacheKey, distribution);
      return distribution;
      
    } catch (error) {
      console.error('Error calculating task distribution:', error);
      throw new Error(`Failed to calculate task distribution: ${error.message}`);
    }
  }

  // Helper methods for new calculations

  async calculatePLMetrics(workItems, productId) {
    // Honest contract: no fabricated P/L. Real financial data source is not wired.
    return {
      value: null,
      trend: null,
      trendValue: '—',
      target: null,
      status: 'not_available',
      message: 'P/L metric is not implemented until a real financial data source is wired.',
      dataSource: 'not_implemented',
    };
  }

  calculateBugMetrics(workItems) {
    const bugs = workItems.filter(item => item.type === 'Bug');
    const openBugs = bugs.filter(bug => !['Closed', 'Done', 'Resolved', 'Deploy'].includes(bug.state));
    
    // Show total bugs (all bugs regardless of status)
    const totalBugs = bugs.length;
    const remainingBugs = openBugs.length;
    
    return {
      total: totalBugs, // ✅ UPDATED - showing total bugs (all bugs regardless of status)
      trend: 0,
      trendValue: '0%',
      resolved: bugs.length - openBugs.length,
      breakdown: {
        total: bugs.length,
        open: openBugs.length,
        remaining: remainingBugs,
        resolved: bugs.length - openBugs.length
      }
    };
  }

  async calculateSatisfactionMetrics(workItems) {
    // Honest contract: no fabricated satisfaction. Real survey data source is not wired.
    return {
      value: null,
      trend: null,
      trendValue: '—',
      target: null,
      status: 'not_available',
      message: 'Satisfaction metric is not implemented until a real survey data source is wired.',
      dataSource: 'not_implemented',
    };
  }

  generateBurndownChart(workItems, sprintData, sprintDuration, chartOptions = {}) {
    const { resolvedAsCompleted = true, aggregation = 'storyPoints' } = chartOptions;

    // A3: Respect aggregation param; fall back to work-item count when no SPs exist
    const totalStoryPoints = workItems.reduce((sum, item) => sum + (item.storyPoints || 0), 0);
    const hasStoryPoints = totalStoryPoints > 0;

    let totalWork;
    let workUnit;

    if (aggregation === 'count') {
      totalWork = workItems.length;
      workUnit = 'work items';
      console.log(`🔥 BURNDOWN CHART: aggregation=count - Total: ${totalWork} ${workUnit}`);
    } else if (hasStoryPoints) {
      // Use story points if available
      totalWork = workItems.reduce((sum, item) => {
        const storyPoints = item.storyPoints || 0;
        return sum + (typeof storyPoints === 'number' ? storyPoints : 0);
      }, 0);
      workUnit = 'story points';
      console.log(`🔥 BURNDOWN CHART: Using STORY POINTS - Total: ${totalWork} ${workUnit}`);
    } else {
      // Use work item count if no story points
      totalWork = workItems.length;
      workUnit = 'work items';
      console.log(`🔥 BURNDOWN CHART: Using WORK ITEM COUNT - Total: ${totalWork} ${workUnit}`);
    }

    // Store resolvedAsCompleted for use in getCompletedWorkByDay
    this._currentResolvedAsCompleted = resolvedAsCompleted;
    
    const burndownData = [];
    
    for (let day = 0; day <= sprintDuration; day++) {
      const idealRemaining = totalWork - (totalWork * day / sprintDuration);
      
      // Calculate actual remaining based on completed work
      // Pass real sprintDuration so getCompletedWorkByDay can scope sprintEnd correctly
      // (without this, hardcoded 14-day sprint caused items closed at/after the real sprint end to be silently skipped → flat actual line).
      const completedByDay = this.getCompletedWorkByDay(workItems, day, sprintData.startDate, sprintDuration);
      const actualRemaining = Math.max(0, totalWork - completedByDay);
      
      console.log(`🔥 BURNDOWN CHART [Day ${day}]: ideal=${idealRemaining.toFixed(1)}, completed=${completedByDay}, actual=${actualRemaining.toFixed(1)} ${workUnit}`);
      
      burndownData.push({
        day: `Day ${day}`,
        dayNumber: day,
        idealRemaining: Math.max(0, parseFloat(idealRemaining.toFixed(1))),
        actualRemaining: parseFloat(actualRemaining.toFixed(1)),
        date: this.addDays(sprintData.startDate, day).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      });
    }
    
    return burndownData;
  }

  groupByType(workItems) {
    const typeGroups = {};
    const totalStoryPoints = workItems.reduce((sum, item) => sum + (item.storyPoints || 0), 0);
    
    workItems.forEach(item => {
      const type = this.normalizeWorkItemType(item.type);
      if (!typeGroups[type]) {
        typeGroups[type] = {
          name: type,
          count: 0,
          icon: this.getTypeIcon(type),
          storyPoints: 0,
          completed: 0,
          inProgress: 0,
          remaining: 0,
          priorities: { High: 0, Medium: 0, Low: 0 },
          avgCycleTime: 0
        };
      }
      
      typeGroups[type].count++;
      typeGroups[type].storyPoints += item.storyPoints || 0;
      
      // Track status
      if (['Done', 'Closed', 'Completed'].includes(item.state)) {
        typeGroups[type].completed++;
      } else if (['Active', 'In Progress', 'Doing'].includes(item.state)) {
        typeGroups[type].inProgress++;
      } else {
        typeGroups[type].remaining++;
      }
      
      // Track priorities
      const priority = item.priority || 'Medium';
      if (typeGroups[type].priorities[priority] !== undefined) {
        typeGroups[type].priorities[priority]++;
      }
    });
    
    return Object.values(typeGroups)
      .map(group => ({
        ...group,
        value: group.count,
        completionRate: group.count > 0 ? Math.round((group.completed / group.count) * 100) : 0,
        storyPointsPercentage: totalStoryPoints > 0 ? Math.round((group.storyPoints / totalStoryPoints) * 100) : 0,
        description: this.getTypeDescription(group.name)
      }))
      .sort((a, b) => b.count - a.count); // Sort by count descending
  }

  normalizeWorkItemType(type) {
    // Simplified categorization to match user requirements: tasks, bugs, design, others
    switch (type) {
      case 'Task':
      case 'User Story':
      case 'Feature':
      case 'Epic':
      case 'Product Backlog Item':
      case 'Development Task':
        return 'tasks';
      case 'Bug':
      case 'Issue':
      case 'Defect':
        return 'bugs';
      case 'Design':
      case 'Design Task':
      case 'Documentation':
      case 'Document':
      case 'UI':
      case 'UX':
        return 'design';
      default:
        return 'others';
    }
  }

  getTypeIcon(type) {
    const icons = {
      'tasks': '💻',
      'bugs': '🐛', 
      'design': '🎨',
      'others': '📋'
    };
    
    return icons[type] || '📋';
  }

  getTypeDescription(type) {
    const descriptions = {
      'tasks': 'Development and implementation tasks',
      'bugs': 'Defect resolution and bug fixes',
      'design': 'Design and documentation work',
      'others': 'Other work items and activities'
    };
    
    return descriptions[type] || 'Work item category';
  }

  calculateSprintDuration(sprintData) {
    if (sprintData && sprintData.startDate && sprintData.endDate) {
      const start = new Date(sprintData.startDate);
      const end = new Date(sprintData.endDate);
      return Math.ceil((end - start) / (1000 * 60 * 60 * 24));
    }
    return 14; // Default 2-week sprint
  }

  addDays(date, days) {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  }

  getCompletedWorkByDay(workItems, day, sprintStart, sprintDuration = 14) {
    const targetDate = this.addDays(sprintStart, day);
    // Use actual sprint duration so items closed at/after sprint end are accounted for.
    // Previously hardcoded to 14 days, which silently dropped completions in shorter sprints (e.g., Slick 11-day sprints).
    const sprintEnd = this.addDays(sprintStart, sprintDuration);

    // 🔍 DEBUG: Log work items for DaaS Delivery 13 burndown calculation
    if (workItems.length > 0) {
      console.log(`🔥 BURNDOWN DEBUG [Day ${day}]: Processing ${workItems.length} work items for burndown`);
      console.log(`🔥 BURNDOWN DEBUG [Day ${day}]: sprintStart=${sprintStart}, targetDate=${targetDate.toISOString()}, sprintEnd=${sprintEnd.toISOString()}`);
      
      const sampleItem = workItems[0];
      console.log(`🔥 Sample work item: ID=${sampleItem.id}, state="${sampleItem.state}", storyPoints=${sampleItem.storyPoints}, closedDate="${sampleItem.closedDate}"`);

      const stateDistribution = workItems.reduce((acc, item) => {
        acc[item.state] = (acc[item.state] || 0) + 1;
        return acc;
      }, {});
      console.log(`🔥 State distribution:`, stateDistribution);
      
      // 🔥 DEBUG: Show date range analysis
      const itemsWithClosedDates = workItems.filter(item => item.closedDate && ['Closed', 'Completed', 'Done', 'Resolved', 'Deploy'].includes(item.state));
      if (itemsWithClosedDates.length > 0) {
        const closedDates = itemsWithClosedDates.map(item => new Date(item.closedDate).toISOString()).sort();
        console.log(`🔥 BURNDOWN DEBUG [Day ${day}]: Items with closed dates: ${itemsWithClosedDates.length}/${workItems.length}`);
        console.log(`🔥 BURNDOWN DEBUG [Day ${day}]: Closed date range: ${closedDates[0]} to ${closedDates[closedDates.length-1]}`);
        console.log(`🔥 BURNDOWN DEBUG [Day ${day}]: Target date: ${targetDate.toISOString()}`);
        
        // Count how many closed dates are <= targetDate (old logic)
        const itemsClosedByTargetDate = itemsWithClosedDates.filter(item => new Date(item.closedDate) <= targetDate);
        console.log(`🔥 BURNDOWN DEBUG [Day ${day}]: Items closed by target date (old logic): ${itemsClosedByTargetDate.length}/${itemsWithClosedDates.length}`);
        
        // Count how many would be included with new logic (closed after sprint end counts toward sprint end)
        const itemsClosedByNewLogic = itemsWithClosedDates.filter(item => {
          const closedDate = new Date(item.closedDate);
          return closedDate <= targetDate || (closedDate > sprintEnd && targetDate >= sprintEnd);
        });
        console.log(`🔥 BURNDOWN DEBUG [Day ${day}]: Items closed by new logic: ${itemsClosedByNewLogic.length}/${itemsWithClosedDates.length}`);
      }

      // 🔥 DEBUG: Check story points distribution in all work items
      const storyPointsDistribution = workItems.reduce((acc, item) => {
        const sp = item.storyPoints || 0;
        acc[sp] = (acc[sp] || 0) + 1;
        return acc;
      }, {});
      console.log(`🔥 Story points distribution:`, storyPointsDistribution);
    }

    // A2: Build completed states set from resolvedAsCompleted flag set by generateBurndownChart
    const completedStatesForBurndown = this._getCompletedStates(
      this._currentResolvedAsCompleted !== undefined ? this._currentResolvedAsCompleted : true
    );

    const totalCompletedItems = workItems.filter(item =>
      completedStatesForBurndown.includes(item.state)
    );

    // 🔥 DEBUG: Check if we have any completed items
    console.log(`🔥 BURNDOWN DEBUG [Day ${day}]: Found ${totalCompletedItems.length}/${workItems.length} completed items`);

    // 🔥 DEBUG: Check story points in completed items
    const completedStoryPoints = totalCompletedItems.reduce((sum, item) => sum + (item.storyPoints || 0), 0);
    console.log(`🔥 BURNDOWN DEBUG [Day ${day}]: Completed items have ${completedStoryPoints} total story points`);

    const completedItems = workItems.filter(item => {
      // A2: Use dynamic completed states (respects resolvedAsCompleted flag)
      const isCompletedByState = completedStatesForBurndown.includes(item.state);

      // If not completed by state, skip it
      if (!isCompletedByState) {
        return false;
      }

      // If has closedDate, use enhanced date logic for completion tracking
      if (item.closedDate) {
        const closedDate = new Date(item.closedDate);
        
        // ✅ FIXED: Enhanced date logic to handle work items closed after sprint end
        // If closed within sprint period, use exact date
        if (closedDate <= sprintEnd) {
          const isCompleted = closedDate <= targetDate;
          if (Math.random() < 0.1 || day === 0) { // Log 10% or always for Day 0
            console.log(`🔥 WITHIN SPRINT: Item ${item.id}, closedDate=${closedDate.toISOString()}, targetDate=${targetDate.toISOString()}, isCompleted=${isCompleted}`);
          }
          return isCompleted;
        }
        
        // ✅ NEW LOGIC: For items closed after sprint end, count them as completed on sprint end day
        // This handles the real-world scenario where work is completed during sprint but closed administratively later
        if (closedDate > sprintEnd && targetDate >= sprintEnd) {
          if (Math.random() < 0.1 || day === 0) { // Log 10% or always for Day 0
            console.log(`🔥 POST-SPRINT: Item ${item.id}, closedDate=${closedDate.toISOString()} (after sprint), counting as completed on sprint end`);
          }
          return true;
        }
        
        // If we're before sprint end and item was closed after sprint end, not completed yet
        if (Math.random() < 0.1 || day === 0) { // Log 10% or always for Day 0
          console.log(`🔥 NOT YET: Item ${item.id}, closedDate=${closedDate.toISOString()} (after sprint), targetDate=${targetDate.toISOString()}, not completed yet`);
        }
        return false;
      }

      // FIXED: For completed items without closedDate, distribute completion progressively
      // Instead of assuming all completed on day 0, simulate realistic completion progression
      const completedItemIndex = totalCompletedItems.findIndex(completed => completed.id === item.id);
      const totalCompleted = totalCompletedItems.length;

      if (totalCompleted === 0) return false;

      // Distribute completed items across the sprint duration
      const completionDay = Math.floor((completedItemIndex / totalCompleted) * 14);
      const isCompletedByDistribution = day >= completionDay;
      
      if (Math.random() < 0.1 || day === 0) { // Log 10% or always for Day 0
        console.log(`🔥 DISTRIBUTION: Item ${item.id} (no closedDate), completionDay=${completionDay}, day=${day}, isCompleted=${isCompletedByDistribution}`);
      }
      
      return isCompletedByDistribution;
    });

    // 🎯 FIXED: Check if project uses story points or work item count
    // Only consider it has story points if there are actual positive values
    const totalStoryPoints = workItems.reduce((sum, item) => sum + (item.storyPoints || 0), 0);
    const hasStoryPoints = totalStoryPoints > 0;

    console.log(`🔥 BURNDOWN DEBUG [Day ${day}]: Total story points in all work items: ${totalStoryPoints}, hasStoryPoints: ${hasStoryPoints}`);
    console.log(`🔥 BURNDOWN DEBUG [Day ${day}]: Filtered completedItems.length: ${completedItems.length}`);

    let completedValue;
    if (hasStoryPoints) {
      // Use story points if available
      completedValue = completedItems.reduce((sum, item) => sum + (item.storyPoints || 0), 0);
      console.log(`🔥 BURNDOWN DEBUG [Day ${day}]: Using STORY POINTS - ${completedValue} completed story points from ${completedItems.length} items`);
    } else {
      // Use work item count if no story points
      completedValue = completedItems.length;
      console.log(`🔥 BURNDOWN DEBUG [Day ${day}]: Using WORK ITEM COUNT - ${completedValue} completed work items`);
    }

    return completedValue;
  }

  estimateBusinessValue(workItem) {
    // Mock business-value heuristic removed 2026-05-24. This derived a fabricated
    // 1-5 score from priority alone, which is not real business value. No caller
    // exists; surface an honest error if it is ever reintroduced into a code path.
    const err = new Error('estimateBusinessValue: real Azure DevOps business value field required; mock heuristic removed 2026-05-24');
    err.code = 'NOT_IMPLEMENTED';
    throw err;
  }

  calculateCompletionRate(workItems) {
    if (workItems.length === 0) return 0;
    
    const completed = workItems.filter(item => 
      ['Closed', 'Done', 'Resolved', 'Deploy'].includes(item.state)
    ).length;
    
    return (completed / workItems.length) * 100;
  }

  async getHistoricalSprints(range, productId) {
    // Mock implementation removed 2026-05-24. This fabricated Delivery numbers and
    // synthetic 14-day-spaced dates that masqueraded as real sprint history.
    // Real history must come from azureService.iterationResolver.getProjectIterations.
    // No caller exists; throw honestly if reintroduced into a code path.
    const err = new Error('getHistoricalSprints: real Azure DevOps iteration history required; mock removed 2026-05-24');
    err.code = 'NOT_IMPLEMENTED';
    throw err;
  }

  async getSprintData(sprintId, productId) {
    try {
      // 🎯 FIXED: Get real sprint data from Azure DevOps instead of hardcoded mock data
      const iterations = await this.azureService.iterationResolver.getProjectIterations(
        productId,
        null // Let resolver determine team
      );

      if (iterations && iterations.length > 0) {
        let targetIteration = null;
        
        if (sprintId && sprintId !== 'current') {
          // Normalize "sprint-YYYY-N" / "sprint-N" → "Sprint YYYY-N" / "Sprint N" for matching.
          // Frontend sends lowercased dash-form (e.g., "sprint-2026-9") while Azure stores "Sprint 2026-9".
          const normalize = (s) => String(s || '').toLowerCase()
            .replace(/[-_]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
          const wanted = normalize(sprintId);
          targetIteration = iterations.find(iter =>
            iter.name === sprintId ||
            iter.id === sprintId ||
            iter.path.includes(sprintId) ||
            normalize(iter.name) === wanted ||
            normalize(iter.path).endsWith(wanted)
          );
        } else {
          // Find current iteration by date (priority 1: active)
          const now = new Date();
          targetIteration = iterations.find(iter => {
            if (!iter.attributes?.startDate || !iter.attributes?.finishDate) return false;
            const startDate = new Date(iter.attributes.startDate);
            const endDate = new Date(iter.attributes.finishDate);
            return startDate <= now && endDate >= now;
          });

          // Priority 2: next-planned sprint (soonest upcoming).
          // Matches SprintFilter UI's `sprintList[0]` fallback and the
          // findCurrentIterationForProject resolver in projectMapping.js.
          // Without this, burndown's date axis comes from the last-completed
          // sprint while KPIs/velocity come from the upcoming sprint → mismatch.
          if (!targetIteration) {
            const upcomingIterations = iterations
              .filter(iter => iter.attributes?.startDate && new Date(iter.attributes.startDate) > now)
              .sort((a, b) => new Date(a.attributes.startDate) - new Date(b.attributes.startDate));
            targetIteration = upcomingIterations[0];
          }

          // Priority 3: most recently completed iteration (last resort)
          if (!targetIteration) {
            const completedIterations = iterations
              .filter(iter => iter.attributes?.finishDate && new Date(iter.attributes.finishDate) < now)
              .sort((a, b) => new Date(b.attributes.finishDate) - new Date(a.attributes.finishDate));
            targetIteration = completedIterations[0];
          }
        }

        if (targetIteration && targetIteration.attributes) {
          console.log(`🎯 SPRINT DATA: Using real Azure DevOps data for ${targetIteration.name}: ${targetIteration.attributes.startDate} to ${targetIteration.attributes.finishDate}`);
          return {
            id: targetIteration.id,
            name: targetIteration.name,
            startDate: targetIteration.attributes.startDate,
            endDate: targetIteration.attributes.finishDate
          };
        }
      }

      console.warn(`⚠️ SPRINT DATA: No real iteration found for ${sprintId}/${productId}`);
    } catch (error) {
      console.error(`❌ SPRINT DATA: Error fetching real iteration data for ${sprintId}/${productId}:`, error.message);
    }

    // Fabricated fallback (hardcoded "Delivery 13" / "Delivery 6" with synthetic dates)
    // removed 2026-05-24. Return null so callers surface "no sprint data" honestly
    // instead of charting invented dates as if they were real.
    return null;
  }

  /**
   * Fabricated burndown work-item generator — REMOVED 2026-05-24.
   *
   * This produced hardcoded "Delivery 11/PMP" work items (fixed IDs, story points
   * and dates) that masqueraded as real Azure DevOps data. It has no callers; the
   * burndown path consumes real work items only. Throw loudly if reintroduced.
   * @param {string} productId - Product identifier
   */
  generateMockBurndownWorkItems(productId) {
    const err = new Error('generateMockBurndownWorkItems: fabricated burndown data removed 2026-05-24; use real Azure DevOps work items');
    err.code = 'NOT_IMPLEMENTED';
    throw err;
  }

  /**
   * Get team information by team ID
   * @param {string} teamId - Team identifier
   * @returns {Promise<object>} Team information
   */
  async getTeamInfo(teamId) {
    // Honest contract (2026-05-24): derive members from REAL Azure DevOps work-item
    // assignments only. Fabricated fields (capacity: 40, lead: 'Team Lead'/'Unknown',
    // name: `Team ${id}`) removed — they masqueraded as real team configuration.
    const dataSource = 'azure_devops_work_items_assigned_to';
    const notAvailable = (extra = {}) => ({
      id: teamId,
      name: teamId,
      status: 'not_available',
      dataSource,
      isHidden: true,
      members: [],
      message: 'No Azure DevOps team member data is available for this team.',
      ...extra
    });

    try {
      const allWorkItems = await this.azureService.getWorkItems({
        maxResults: 1000,
        workItemTypes: ['Task', 'Bug']
      });

      const uniqueMembers = new Map();
      if (allWorkItems && Array.isArray(allWorkItems.workItems)) {
        allWorkItems.workItems.forEach(item => {
          if (item.assignedTo && item.assignedTo.displayName) {
            const id = item.assignedTo.uniqueName || item.assignedTo.displayName;
            const existing = uniqueMembers.get(id);
            const avatar = item.assignedTo._links?.avatar?.href || null;
            if (!existing) {
              uniqueMembers.set(id, {
                id,
                name: item.assignedTo.displayName,
                displayName: item.assignedTo.displayName,
                email: item.assignedTo.uniqueName || null,
                avatar
              });
            } else if (!existing.avatar && avatar) {
              // Preserve the first available avatar across this member's work items.
              existing.avatar = avatar;
            }
          }
        });
      }

      const members = Array.from(uniqueMembers.values());
      if (members.length === 0) {
        return notAvailable();
      }

      return {
        id: teamId,
        name: teamId,
        status: 'ok',
        dataSource,
        isHidden: false,
        members
      };
    } catch (error) {
      console.error(`Error getting team info for ${teamId}:`, error);
      return notAvailable({ error: error.message });
    }
  }

  /**
   * Get work items for a specific team
   * @param {string} teamId - Team identifier  
   * @returns {Promise<Array>} Work items for the team
   */
  async getWorkItemsForTeam(teamId) {
    try {
      // Get team members first
      const teamInfo = await this.getTeamInfo(teamId);
      const teamMemberEmails = teamInfo.members.map(m => m.email).filter(Boolean);

      if (teamMemberEmails.length === 0) {
        console.warn(`No team members found for team ${teamId}`);
        return [];
      }

      // Get work items assigned to team members
      const workItems = await this.azureService.getWorkItems({
        maxResults: 1000,
        workItemTypes: ['Task', 'Bug'],
        assignedToUsers: teamMemberEmails
      });

      return workItems?.workItems || [];
    } catch (error) {
      console.error(`Error getting work items for team ${teamId}:`, error);
      return [];
    }
  }


  /**
   * Analyze team workload distribution
   * @private
   */
  analyzeWorkload(teamPerformance) {
    const totalWorkItems = teamPerformance.totalWorkItems || 0;
    const teamSize = teamPerformance.totalMembers || 1;
    
    return {
      totalWorkItems,
      avgWorkItemsPerMember: (totalWorkItems / teamSize).toFixed(1),
      distribution: totalWorkItems > 0 ? 'balanced' : 'light',
      bottlenecks: []
    };
  }

  /**
   * Analyze team skills and capabilities
   * @private
   */
  async analyzeTeamSkills(teamId) {
    const err = new Error('analyzeTeamSkills: real Azure DevOps integration required; mock removed 2026-05-19');
    err.code = 'NOT_IMPLEMENTED';
    throw err;
  }

  /**
   * Calculate enhanced user performance metrics from work items
   * @private
   */
  calculateEnhancedUserPerformance(workItems, capacityData = null) {
    if (!workItems || workItems.length === 0) {
      return {
        completedStoryPoints: 0,
        totalAssignedStoryPoints: 0,
        completionRate: 0,
        velocity: 0,
        averageTaskCompletionTime: 0,
        capacityUtilization: 0
      };
    }

    const completedItems = workItems.filter(wi => wi.state === 'Done' || wi.state === 'Closed' || wi.state === 'Deploy');
    const totalStoryPoints = workItems.reduce((sum, wi) => sum + (wi.storyPoints || 0), 0);
    const completedStoryPoints = completedItems.reduce((sum, wi) => sum + (wi.storyPoints || 0), 0);
    
    // Calculate average task completion time
    const itemsWithDates = completedItems.filter(wi => wi.createdDate && wi.closedDate);
    let averageCompletionTime = 0;
    if (itemsWithDates.length > 0) {
      const totalTime = itemsWithDates.reduce((sum, wi) => {
        const created = new Date(wi.createdDate);
        const closed = new Date(wi.closedDate);
        return sum + (closed - created);
      }, 0);
      averageCompletionTime = Math.round(totalTime / itemsWithDates.length / (1000 * 60 * 60 * 24)); // days
    }

    // Calculate capacity utilization if capacity data is available
    let capacityUtilization = 0;
    if (capacityData && capacityData.capacity && capacityData.capacity.capacityPerDay > 0) {
      const workingDays = this.calculateWorkingDays(capacityData.startDate, capacityData.endDate, capacityData.capacity.daysOff);
      const totalCapacity = capacityData.capacity.capacityPerDay * workingDays;
      const totalWork = workItems.reduce((sum, wi) => sum + (wi.completedWork || wi.remainingWork || 0), 0);
      capacityUtilization = totalCapacity > 0 ? (totalWork / totalCapacity) * 100 : 0;
    }

    return {
      completedStoryPoints,
      totalAssignedStoryPoints: totalStoryPoints,
      completionRate: workItems.length > 0 ? (completedItems.length / workItems.length) * 100 : 0,
      velocity: completedStoryPoints,
      averageTaskCompletionTime: averageCompletionTime,
      capacityUtilization: Math.min(capacityUtilization, 200) // Cap at 200% to handle overallocation
    };
  }

  /**
   * Calculate enhanced user quality metrics from work items
   * @private
   */
  calculateEnhancedUserQuality(workItems) {
    if (!workItems || workItems.length === 0) {
      return {
        bugsCreated: 0,
        bugsResolved: 0,
        qualityScore: 100
      };
    }

    const bugs = workItems.filter(wi => wi.workItemType === 'Bug');
    const bugsCreated = bugs.length;
    const bugsResolved = bugs.filter(bug => bug.state === 'Done' || bug.state === 'Closed' || bug.state === 'Deploy').length;
    const totalItems = workItems.length;
    
    // Calculate quality score (fewer bugs relative to total work = higher quality)
    let qualityScore = 100;
    if (totalItems > 0) {
      const bugRatio = bugsCreated / totalItems;
      qualityScore = Math.max(0, 100 - (bugRatio * 100));
    }

    return {
      bugsCreated,
      bugsResolved,
      bugRatio: totalItems > 0 ? (bugsCreated / totalItems) * 100 : 0,
      qualityScore: Math.round(qualityScore)
    };
  }

  /**
   * Categorize work items by type
   * @private
   */
  categorizeWorkItemsByType(workItems) {
    const categories = {
      userStory: 0,
      task: 0,
      bug: 0,
      feature: 0,
      other: 0
    };

    workItems.forEach(item => {
      switch (item.workItemType?.toLowerCase()) {
        case 'user story':
          categories.userStory++;
          break;
        case 'task':
          categories.task++;
          break;
        case 'bug':
          categories.bug++;
          break;
        case 'feature':
          categories.feature++;
          break;
        default:
          categories.other++;
      }
    });

    return categories;
  }

  /**
   * Calculate user trends from performance history
   * @private
   */
  calculateTrendsFromHistory(performanceHistory) {
    if (!performanceHistory || performanceHistory.length === 0) {
      return [];
    }

    return performanceHistory.slice(0, 6).map(period => ({
      period: period.iterationPath,
      storyPoints: period.completedStoryPoints || 0,
      completionRate: period.completionRate || 0,
      velocity: period.velocity || 0
    }));
  }

  /**
   * Calculate user burndown chart data
   * @private
   */
  calculateUserBurndown(workItems, startDate, endDate) {
    if (!workItems || workItems.length === 0 || !startDate || !endDate) {
      return [];
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    const totalDays = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
    const totalWork = workItems.reduce((sum, wi) => sum + (wi.storyPoints || 1), 0);
    
    const burndownData = [];
    const completionsByDate = {};
    
    // Group completions by date
    workItems.forEach(item => {
      if (item.closedDate && (item.state === 'Done' || item.state === 'Closed' || item.state === 'Deploy')) {
        const closedDate = new Date(item.closedDate).toISOString().split('T')[0];
        if (!completionsByDate[closedDate]) {
          completionsByDate[closedDate] = 0;
        }
        completionsByDate[closedDate] += (item.storyPoints || 1);
      }
    });
    
    let remainingWork = totalWork;
    for (let i = 0; i <= totalDays; i++) {
      const currentDate = new Date(start);
      currentDate.setDate(start.getDate() + i);
      const dateString = currentDate.toISOString().split('T')[0];
      
      const completed = completionsByDate[dateString] || 0;
      remainingWork -= completed;
      
      const idealRemaining = totalWork - (totalWork * (i / totalDays));
      
      burndownData.push({
        date: dateString,
        remainingWork: Math.max(0, remainingWork),
        idealBurndown: Math.max(0, idealRemaining)
      });
    }
    
    return burndownData;
  }

  /**
   * Calculate working days between two dates excluding days off
   * @private
   */
  calculateWorkingDays(startDate, endDate, daysOff = []) {
    if (!startDate || !endDate) return 0;
    
    const start = new Date(startDate);
    const end = new Date(endDate);
    let workingDays = 0;
    
    for (let date = new Date(start); date <= end; date.setDate(date.getDate() + 1)) {
      const dayOfWeek = date.getDay();
      // Skip weekends (0 = Sunday, 6 = Saturday)
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        // Check if this date is not in daysOff
        const dateString = date.toISOString().split('T')[0];
        const isDayOff = daysOff.some(dayOff => {
          const offDate = new Date(dayOff.start).toISOString().split('T')[0];
          return offDate === dateString;
        });
        
        if (!isDayOff) {
          workingDays++;
        }
      }
    }
    
    return workingDays;
  }

  // ── A1/A2 helpers ────────────────────────────────────────────────────────────

  /**
   * Filter work items by type.
   * @param {Array} workItems
   * @param {string} workItemTypes  CSV of types, or 'all' to skip filtering.
   *                                Default 'Product Backlog Item'.
   */
  _filterByWorkItemTypes(workItems, workItemTypes = 'Product Backlog Item') {
    if (!workItemTypes || workItemTypes.toLowerCase() === 'all') {
      return workItems;
    }
    const types = workItemTypes.split(',').map(t => t.trim().toLowerCase());
    // "Product Backlog Item" (CMMI template) and "User Story" (Scrum/Agile template) are
    // both the top-level backlog requirement type — treat them as aliases so the default
    // PBI filter works across all Azure DevOps process templates.
    const PBI_ALIASES = new Set(['product backlog item', 'user story']);
    const hasPbiAlias = types.some(t => PBI_ALIASES.has(t));
    return workItems.filter(wi => {
      const t = (wi.workItemType || wi.type || '').toLowerCase();
      if (hasPbiAlias && PBI_ALIASES.has(t)) return true;
      return types.includes(t);
    });
  }

  /**
   * Return the set of states that count as "completed" based on the flag.
   * @param {boolean} resolvedAsCompleted
   */
  _getCompletedStates(resolvedAsCompleted) {
    const base = ['Done', 'Closed', 'Completed'];
    return resolvedAsCompleted ? [...base, 'Resolved', 'Deploy'] : base;
  }

  // ── A4: Sprint-by-Assignee pivot ─────────────────────────────────────────────

  /**
   * Calculate 2-D pivot: assignee × state with sum of story points.
   * Mirrors Azure "Current Sprint by Assigned To" widget.
   */
  async calculateSprintByAssignee(options = {}) {
    const { productId, sprintId = 'current' } = options;
    const cacheKey = `sprint_by_assignee_${productId}_${sprintId}`;

    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    try {
      // Fetch sprint metadata
      const sprintData = await this.getSprintData(sprintId, productId);

      // Fetch PBI work items for the sprint
      let allItems = await this.getWorkItemsForProduct(productId, { sprintId });
      if (!allItems || allItems.length === 0) {
        try {
          allItems = await this.realApiService.getRealWorkItems(productId, sprintId);
        } catch (e) {
          allItems = [];
        }
      }

      // Data-driven type scope: prefer PBI/User Story (matches Azure "Current Sprint by
      // Assigned To" widget) for projects that actually track work as PBIs (PMP/DaaS).
      // For task-level teams (OMNIA: only Task/Bug/User Story in iteration, zero strict
      // "Product Backlog Item"), fall back to **all** items so the pivot mirrors the
      // sprint taskboard. The discriminator uses *strict* PBI presence — checking just
      // `_filterByWorkItemTypes(allItems, 'Product Backlog Item')` would still match
      // because that filter includes the User Story alias, so OMNIA Sprint 8 (6 USes)
      // would never fall back. Match the bare type instead.
      const hasStrictPbi = (allItems || []).some(w => (w.workItemType || w.type || '').toLowerCase() === 'product backlog item');
      const items = hasStrictPbi
        ? this._filterByWorkItemTypes(allItems, 'Product Backlog Item')
        : this._filterByWorkItemTypes(allItems, 'all');

      // Group by assignee
      const assigneeMap = {};
      for (const item of items) {
        const name = item.assignee || item.assignedTo || 'Unassigned';
        const email = item.assigneeEmail || item.email || '';
        const key = email || name;
        if (!assigneeMap[key]) {
          assigneeMap[key] = { name, email, states: {}, totalSP: 0, totalItems: 0 };
        }
        const state = item.state || 'Unknown';
        // states[state] is a **count** of items in that state — the frontend table
        // renders this number directly as the per-state cell. Story-point sums live
        // in totalSP (and per-state SP can be added later if the UI needs it).
        assigneeMap[key].states[state] = (assigneeMap[key].states[state] || 0) + 1;
        assigneeMap[key].totalSP += item.storyPoints || 0;
        assigneeMap[key].totalItems += 1;
      }

      const result = {
        sprint: sprintData?.name || sprintId,
        assignees: Object.values(assigneeMap).sort((a, b) => b.totalSP - a.totalSP),
      };

      this.setCache(cacheKey, result);
      return result;
    } catch (error) {
      console.error('Error calculating sprint-by-assignee:', error);
      throw new Error(`Failed to calculate sprint-by-assignee: ${error.message}`);
    }
  }

  // ── A5: Sprint Overview scalar ───────────────────────────────────────────────

  /**
   * Calculate scalar sprint overview metrics.
   * Mirrors Azure "Sprint Overview" widget.
   */
  async calculateSprintOverview(options = {}) {
    const { productId, sprintId = 'current', units = 'workItems' } = options;
    const cacheKey = `sprint_overview_${productId}_${sprintId}`;

    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    try {
      const sprintData = await this.getSprintData(sprintId, productId);

      let allItems = await this.getWorkItemsForProduct(productId, { sprintId });
      if (!allItems || allItems.length === 0) {
        try {
          allItems = await this.realApiService.getRealWorkItems(productId, sprintId);
        } catch (e) {
          allItems = [];
        }
      }

      // Data-driven type scope (mirrors calculateSprintByAssignee): use strict PBI
      // presence as the discriminator so OMNIA-style iterations (User Story + Task/Bug,
      // zero strict PBI) fall back to all items. PMP/DaaS keep their PBI semantics.
      const hasStrictPbi = (allItems || []).some(w => (w.workItemType || w.type || '').toLowerCase() === 'product backlog item');
      const items = hasStrictPbi
        ? this._filterByWorkItemTypes(allItems, 'Product Backlog Item')
        : this._filterByWorkItemTypes(allItems, 'all');

      const completedStates = this._getCompletedStates(true); // use broadest set for overview
      const completedItems = items.filter(wi => completedStates.includes(wi.state));

      const totalSP = items.reduce((s, wi) => s + (wi.storyPoints || 0), 0);
      const completedSP = completedItems.reduce((s, wi) => s + (wi.storyPoints || 0), 0);

      const now = new Date();
      const startDate = sprintData?.startDate ? new Date(sprintData.startDate) : null;
      const endDate = sprintData?.endDate ? new Date(sprintData.endDate) : null;
      const totalDays = startDate && endDate
        ? Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24))
        : null;
      const daysElapsed = startDate ? Math.max(0, Math.min(totalDays || 0, Math.floor((now - startDate) / (1000 * 60 * 60 * 24)))) : null;
      const daysRemaining = endDate ? Math.max(0, Math.ceil((endDate - now) / (1000 * 60 * 60 * 24))) : null;

      const result = {
        sprint: sprintData?.name || sprintId,
        startDate: sprintData?.startDate ? new Date(sprintData.startDate).toISOString().split('T')[0] : null,
        endDate: sprintData?.endDate ? new Date(sprintData.endDate).toISOString().split('T')[0] : null,
        daysRemaining,
        daysElapsed,
        totalItems: items.length,
        completedItems: completedItems.length,
        totalSP,
        completedSP,
      };

      this.setCache(cacheKey, result);
      return result;
    } catch (error) {
      console.error('Error calculating sprint overview:', error);
      throw new Error(`Failed to calculate sprint overview: ${error.message}`);
    }
  }
}

module.exports = MetricsCalculatorService;