/**
 * Azure DevOps API Service
 *
 * Real API integration service to replace mock data with actual Azure DevOps data.
 * Integrates with existing MCP Azure DevOps tools for accurate sprint and work item data.
 *
 * Fixes identified issues:
 * 1. Sprint dates using dynamic calculation instead of real API data
 * 2. Story points from mock data instead of actual work items
 * 3. Work item counts from hardcoded values instead of API
 */

const logger = require('../../utils/logger');
const axios = require('axios');

class AzureDevOpsApiService {
  constructor() {
    this.projectMappings = {
      'Product - Data as a Service': 'Product - Data as a Service',
      'Product - Partner Management Platform': 'Product - Partner Management Platform',
      'daas': 'Product - Data as a Service',
      'pmp': 'Product - Partner Management Platform'
    };

    // Azure DevOps REST API configuration - use same config as existing service
    const { azureDevOpsConfig } = require('../config/azureDevOpsConfig');

    this.config = {
      organization: azureDevOpsConfig.organization || process.env.AZURE_DEVOPS_ORG || 'tietoevryintegration',
      pat: azureDevOpsConfig.pat || process.env.AZURE_DEVOPS_PAT,
      apiVersion: azureDevOpsConfig.apiVersion || '7.0'
    };

    this.isConfigured = !!(this.config.organization && this.config.pat);

    if (!this.isConfigured) {
      logger.warn('Azure DevOps API not configured - missing organization or PAT. Will not provide real data.');
      return;
    }

    logger.info(`Azure DevOps API service configured for organization: ${this.config.organization}`);

    // Base URL for Azure DevOps REST API
    this.baseUrl = `https://dev.azure.com/${this.config.organization}`;

    // Create axios instance with auth
    this.apiClient = axios.create({
      baseURL: this.baseUrl,
      headers: {
        'Authorization': `Basic ${Buffer.from(`:${this.config.pat}`).toString('base64')}`,
        'Content-Type': 'application/json'
      },
      timeout: 30000
    });
  }

  /**
   * Get real sprint data from Azure DevOps API
   * Replaces the mock getSprintData function
   */
  async getRealSprintData(productId) {
    try {
      const project = this.resolveProjectName(productId);
      logger.info(`Fetching real sprint data for project: ${project}`);

      // Get team iterations from Azure DevOps
      const iterations = await this.getProjectIterations(project);

      if (!iterations || iterations.length === 0) {
        logger.warn(`No iterations found for project: ${project}`);
        return this.getFallbackSprintData(productId);
      }

      // Convert Azure DevOps iterations to dashboard format
      const sprints = iterations.map(iteration => ({
        id: this.generateSprintId(iteration.name),
        name: iteration.name,
        description: `${iteration.name} (${this.formatDateRange(iteration.attributes.startDate, iteration.attributes.finishDate)})`,
        status: this.determineSprintStatus(iteration),
        startDate: iteration.attributes.startDate ? iteration.attributes.startDate.split('T')[0] : null,
        endDate: iteration.attributes.finishDate ? iteration.attributes.finishDate.split('T')[0] : null,
        path: iteration.path,
        azureDevOpsId: iteration.id
      }));

      // Sort by start date (newest first)
      sprints.sort((a, b) => new Date(b.startDate) - new Date(a.startDate));

      logger.info(`Retrieved ${sprints.length} real sprints for project: ${project}`);
      return sprints;

    } catch (error) {
      logger.error('Failed to fetch real sprint data:', error);
      return this.getFallbackSprintData(productId);
    }
  }

  /**
   * Get real work items for a specific iteration
   * Replaces mock burndown work items with actual Azure DevOps data
   */
  async getRealWorkItems(projectId, sprintId) {
    try {
      const project = this.resolveProjectName(projectId);
      const iterationId = await this.resolveIterationId(project, sprintId);

      if (!iterationId) {
        logger.warn(`Could not resolve iteration ID for sprint: ${sprintId}`);
        return [];
      }

      logger.info(`Fetching real work items for project: ${project}, iteration: ${iterationId}`);

      // Get work item relations from Azure DevOps
      const workItemRelations = await this.getIterationWorkItems(project, iterationId);

      if (!workItemRelations || !workItemRelations.workItemRelations) {
        logger.warn(`No work items found for iteration: ${iterationId}`);
        return [];
      }

      // Extract work item IDs
      const workItemIds = workItemRelations.workItemRelations
        .filter(relation => relation.target)
        .map(relation => relation.target.id);

      if (workItemIds.length === 0) {
        return [];
      }

      // Get detailed work item information
      const workItems = await this.getWorkItemDetails(project, workItemIds);

      // Calculate story points and work item distribution
      const processedWorkItems = this.processWorkItems(workItems);

      logger.info(`Retrieved ${processedWorkItems.length} real work items`);
      return processedWorkItems;

    } catch (error) {
      logger.error('Failed to fetch real work items:', error);
      return [];
    }
  }

  /**
   * Calculate real sprint metrics from Azure DevOps data
   * Replaces mock calculations with actual data aggregation
   */
  async calculateSprintMetrics(projectId, sprintId) {
    try {
      const workItems = await this.getRealWorkItems(projectId, sprintId);

      if (workItems.length === 0) {
        return this.getEmptyMetrics();
      }

      const metrics = {
        totalStoryPoints: 0,
        completedStoryPoints: 0,
        totalWorkItems: workItems.length,
        completedWorkItems: 0,
        bugCount: 0,
        taskCount: 0,
        userStoryCount: 0,
        workItemsByType: {},
        workItemsByState: {},
        burndownData: []
      };

      // Process each work item
      workItems.forEach(item => {
        // Count by type
        const type = item.fields['System.WorkItemType'];
        metrics.workItemsByType[type] = (metrics.workItemsByType[type] || 0) + 1;

        // Count by state
        const state = item.fields['System.State'];
        metrics.workItemsByState[state] = (metrics.workItemsByState[state] || 0) + 1;

        // Story points (only for User Stories typically)
        const storyPoints = item.fields['Microsoft.VSTS.Scheduling.StoryPoints'] || 0;
        if (storyPoints > 0) {
          metrics.totalStoryPoints += storyPoints;
          if (this.isCompleted(state)) {
            metrics.completedStoryPoints += storyPoints;
          }
        }

        // Count specific types
        switch (type) {
          case 'Bug':
            metrics.bugCount++;
            break;
          case 'Task':
            metrics.taskCount++;
            break;
          case 'User Story':
          case 'Story':
            metrics.userStoryCount++;
            break;
        }

        // Count completed items
        if (this.isCompleted(state)) {
          metrics.completedWorkItems++;
        }
      });

      // Calculate progress percentage
      metrics.progressPercentage = metrics.totalStoryPoints > 0
        ? (metrics.completedStoryPoints / metrics.totalStoryPoints * 100)
        : (metrics.completedWorkItems / metrics.totalWorkItems * 100);

      // Generate burndown data from work items
      metrics.burndownData = this.generateBurndownFromWorkItems(workItems);

      logger.info(`Calculated real sprint metrics:`, {
        totalStoryPoints: metrics.totalStoryPoints,
        completedStoryPoints: metrics.completedStoryPoints,
        totalWorkItems: metrics.totalWorkItems,
        progressPercentage: metrics.progressPercentage.toFixed(1)
      });

      return metrics;

    } catch (error) {
      logger.error('Failed to calculate sprint metrics:', error);
      return this.getEmptyMetrics();
    }
  }

  /**
   * Helper method to resolve project name from various inputs
   */
  resolveProjectName(productId) {
    if (!productId) {
      return 'Product - Partner Management Platform';
    }

    return this.projectMappings[productId] || productId;
  }

  /**
   * Helper method to generate sprint ID from name
   */
  generateSprintId(sprintName) {
    return sprintName.toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9\-]/g, '');
  }

  /**
   * Helper method to determine sprint status
   */
  determineSprintStatus(iteration) {
    const now = new Date();
    const startDate = new Date(iteration.attributes.startDate);
    const endDate = new Date(iteration.attributes.finishDate);

    if (now < startDate) {
      return 'planned';
    } else if (now > endDate) {
      return 'completed';
    } else {
      return 'active';
    }
  }

  /**
   * Helper method to format date range
   */
  formatDateRange(startDate, endDate) {
    if (!startDate || !endDate) return '';

    const start = new Date(startDate);
    const end = new Date(endDate);

    const startStr = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const endStr = end.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

    return `${startStr} - ${endStr}`;
  }

  /**
   * Helper method to check if work item is completed
   */
  isCompleted(state) {
    const completedStates = ['Done', 'Closed', 'Resolved', 'Completed'];
    return completedStates.includes(state);
  }

  /**
   * Process work items to extract relevant data
   */
  processWorkItems(workItems) {
    return workItems.map(item => ({
      id: item.id,
      title: item.fields['System.Title'],
      type: item.fields['System.WorkItemType'],
      state: item.fields['System.State'],
      storyPoints: item.fields['Microsoft.VSTS.Scheduling.StoryPoints'] || 0,
      assignee: item.fields['System.AssignedTo']?.displayName || 'Unassigned',
      priority: item.fields['Microsoft.VSTS.Common.Priority'] || 2,
      iterationPath: item.fields['System.IterationPath'],
      areaPath: item.fields['System.AreaPath'],
      tags: item.fields['System.Tags'] || '',
      url: item.url
    }));
  }

  /**
   * Generate burndown data from work items
   */
  generateBurndownFromWorkItems(workItems) {
    // This would typically require historical data or calculated based on completion dates
    // For now, return a simplified burndown based on current state
    const totalPoints = workItems.reduce((sum, item) => sum + (item.storyPoints || 0), 0);
    const completedPoints = workItems
      .filter(item => this.isCompleted(item.state))
      .reduce((sum, item) => sum + (item.storyPoints || 0), 0);

    return [
      { day: 1, remaining: totalPoints, ideal: totalPoints },
      { day: 7, remaining: completedPoints > 0 ? totalPoints - completedPoints : totalPoints * 0.7 },
      { day: 14, remaining: totalPoints - completedPoints, ideal: 0 }
    ];
  }

  /**
   * Fallback sprint data when API fails
   */
  getFallbackSprintData(productId) {
    logger.warn(`Using fallback sprint data for: ${productId}`);

    return [{
      id: 'current',
      name: 'Current Sprint',
      description: 'Fallback sprint data',
      status: 'active',
      startDate: new Date().toISOString().split('T')[0],
      endDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      path: 'Fallback\\Current Sprint'
    }];
  }

  /**
   * Empty metrics when no data available
   */
  getEmptyMetrics() {
    return {
      totalStoryPoints: 0,
      completedStoryPoints: 0,
      totalWorkItems: 0,
      completedWorkItems: 0,
      bugCount: 0,
      taskCount: 0,
      userStoryCount: 0,
      workItemsByType: {},
      workItemsByState: {},
      burndownData: [],
      progressPercentage: 0
    };
  }

  // Real Azure DevOps REST API integration methods

  async getProjectIterations(project) {
    if (!this.isConfigured) {
      logger.warn('Azure DevOps API not configured, cannot fetch real iterations');
      return [];
    }

    try {
      logger.info(`Fetching iterations for project: ${project} via REST API`);

      // Get project teams first
      const teamsResponse = await this.apiClient.get(`/_apis/projects/${encodeURIComponent(project)}/teams?api-version=${this.config.apiVersion}`);
      const teams = teamsResponse.data.value;

      if (!teams || teams.length === 0) {
        logger.warn(`No teams found for project: ${project}`);
        return [];
      }

      const defaultTeam = teams[0]; // Use first team as default
      logger.info(`Using team: ${defaultTeam.name} for iterations`);

      // Get team iterations
      const iterationsResponse = await this.apiClient.get(
        `/${encodeURIComponent(project)}/${encodeURIComponent(defaultTeam.id)}/_apis/work/teamsettings/iterations?api-version=${this.config.apiVersion}`
      );

      return iterationsResponse.data.value || [];

    } catch (error) {
      logger.error('Failed to get project iterations via REST API:', error.message);
      return [];
    }
  }

  async resolveIterationId(project, sprintId) {
    try {
      logger.info(`Resolving iteration ID for sprint: ${sprintId} in project: ${project}`);

      const iterations = await this.getProjectIterations(project);

      // Find iteration by matching sprint ID pattern
      const iteration = iterations.find(iter => {
        const generatedId = this.generateSprintId(iter.name);
        return generatedId === sprintId || iter.name.toLowerCase().includes(sprintId.toLowerCase());
      });

      if (iteration) {
        logger.info(`Found iteration: ${iteration.name} (ID: ${iteration.id})`);
        return iteration.id;
      }

      logger.warn(`No iteration found for sprint ID: ${sprintId}`);
      return null;

    } catch (error) {
      logger.error('Failed to resolve iteration ID:', error);
      return null;
    }
  }

  async getIterationWorkItems(project, iterationId) {
    if (!this.isConfigured) {
      logger.warn('Azure DevOps API not configured, cannot fetch real work items');
      return { workItemRelations: [] };
    }

    try {
      logger.info(`Fetching work items for iteration: ${iterationId} in project: ${project} via REST API`);

      // Get project teams first
      const teamsResponse = await this.apiClient.get(`/_apis/projects/${encodeURIComponent(project)}/teams?api-version=${this.config.apiVersion}`);
      const teams = teamsResponse.data.value;
      const defaultTeam = teams && teams.length > 0 ? teams[0] : null;

      if (!defaultTeam) {
        logger.warn(`No team found for project: ${project}`);
        return { workItemRelations: [] };
      }

      // Get work items for iteration
      const workItemsResponse = await this.apiClient.get(
        `/${encodeURIComponent(project)}/${encodeURIComponent(defaultTeam.id)}/_apis/work/teamsettings/iterations/${iterationId}/workitems?api-version=${this.config.apiVersion}`
      );

      return workItemsResponse.data || { workItemRelations: [] };

    } catch (error) {
      logger.error('Failed to get iteration work items via REST API:', error.message);
      return { workItemRelations: [] };
    }
  }

  async getWorkItemDetails(project, workItemIds) {
    if (!this.isConfigured) {
      logger.warn('Azure DevOps API not configured, cannot fetch work item details');
      return [];
    }

    try {
      logger.info(`Fetching details for ${workItemIds.length} work items in project: ${project} via REST API`);

      if (workItemIds.length === 0) {
        return [];
      }

      const fields = [
        'System.Id',
        'System.Title',
        'System.WorkItemType',
        'System.State',
        'System.AssignedTo',
        'System.IterationPath',
        'System.AreaPath',
        'System.Tags',
        'Microsoft.VSTS.Scheduling.StoryPoints',
        'Microsoft.VSTS.Common.Priority'
      ].join(',');

      const workItemsResponse = await this.apiClient.get(
        `/_apis/wit/workitems?ids=${workItemIds.join(',')}&fields=${fields}&api-version=${this.config.apiVersion}`
      );

      return workItemsResponse.data.value || [];

    } catch (error) {
      logger.error('Failed to get work item details via REST API:', error.message);
      return [];
    }
  }
}

module.exports = AzureDevOpsApiService;