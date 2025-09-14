/**
 * Azure DevOps API Service for Sprint Data
 * Handles fetching sprint iterations and work items from Azure DevOps
 */

import * as azdev from "azure-devops-node-api";
import * as wi from "azure-devops-node-api/interfaces/WorkItemTrackingInterfaces";

class AzureDevOpsService {
  constructor() {
    this.orgUrl = `https://dev.azure.com/${process.env.AZURE_DEVOPS_ORG}`;
    this.token = process.env.AZURE_DEVOPS_PAT;
    this.connection = null;
    this.workItemApi = null;
    this.coreApi = null;

    // Will be populated from real API data
    this.projects = [];
    this.projectsInitialized = false;
  }

  /**
   * Initialize projects from real Azure DevOps API
   */
  async initializeProjects() {
    if (!this.projectsInitialized) {
      try {
        this.projects = await this.fetchRealProjectsAndTeams();
        this.projectsInitialized = true;
        console.log(`Initialized ${this.projects.length} projects from Azure DevOps API`);
      } catch (error) {
        console.error('Failed to initialize projects from API, using fallback:', error);
        // Fallback to minimal configuration
        this.projects = [{
          name: 'Product - Partner Management Platform',
          team: 'PMP Developer Team',
          alias: 'PMP'
        }];
        this.projectsInitialized = true;
      }
    }
  }

  async initialize() {
    if (!this.connection) {
      const authHandler = azdev.getPersonalAccessTokenHandler(this.token);
      this.connection = new azdev.WebApi(this.orgUrl, authHandler);
      this.workItemApi = await this.connection.getWorkItemTrackingApi();
      this.coreApi = await this.connection.getCoreApi();
    }
  }

  /**
   * Fetch real projects and teams from Azure DevOps API
   * @returns {Array} Array of projects with their teams
   */
  async fetchRealProjectsAndTeams() {
    try {
      await this.initialize();

      console.log('Fetching real projects from Azure DevOps API...');

      // Get all projects from the organization
      const projects = await this.coreApi.getProjects();
      console.log(`Found ${projects.length} projects in organization`);

      const projectsWithTeams = [];

      for (const project of projects) {
        try {
          // Get teams for each project
          const teams = await this.coreApi.getTeams(project.id);
          console.log(`Project "${project.name}" has ${teams.length} teams`);

          // Filter for projects we're interested in (PMP and DaaS)
          const isTargetProject =
            project.name.toLowerCase().includes('partner') ||
            project.name.toLowerCase().includes('pmp') ||
            project.name.toLowerCase().includes('daas') ||
            project.name.toLowerCase().includes('data as a service');

          if (isTargetProject || teams.some(team =>
            team.name.toLowerCase().includes('pmp') ||
            team.name.toLowerCase().includes('daas')
          )) {

            // Find the most relevant team
            const relevantTeam = teams.find(team =>
              team.name.toLowerCase().includes('developer') ||
              team.name.toLowerCase().includes('dev') ||
              team.name.toLowerCase().includes('pmp') ||
              team.name.toLowerCase().includes('daas')
            ) || teams[0]; // Fallback to first team

            projectsWithTeams.push({
              name: project.name,
              id: project.id,
              team: relevantTeam ? relevantTeam.name : 'default',
              teamId: relevantTeam ? relevantTeam.id : null,
              alias: this.generateProjectAlias(project.name),
              description: project.description || '',
              allTeams: teams.map(t => ({ name: t.name, id: t.id }))
            });

            console.log(`Added project: ${project.name} with team: ${relevantTeam?.name || 'default'}`);
          }
        } catch (teamError) {
          console.warn(`Could not fetch teams for project ${project.name}:`, teamError.message);

          // Still add the project with default team
          const isTargetProject =
            project.name.toLowerCase().includes('partner') ||
            project.name.toLowerCase().includes('pmp') ||
            project.name.toLowerCase().includes('daas');

          if (isTargetProject) {
            projectsWithTeams.push({
              name: project.name,
              id: project.id,
              team: 'default',
              teamId: null,
              alias: this.generateProjectAlias(project.name),
              description: project.description || '',
              allTeams: []
            });
          }
        }
      }

      console.log(`Returning ${projectsWithTeams.length} target projects with teams`);
      return projectsWithTeams;
    } catch (error) {
      console.error('Error fetching real projects and teams:', error);
      throw new Error(`Failed to fetch projects and teams: ${error.message}`);
    }
  }

  /**
   * Generate a short alias for project names
   * @param {string} projectName - Full project name
   * @returns {string} Short alias
   */
  generateProjectAlias(projectName) {
    if (projectName.toLowerCase().includes('partner') || projectName.toLowerCase().includes('pmp')) {
      return 'PMP';
    }
    if (projectName.toLowerCase().includes('daas') || projectName.toLowerCase().includes('data as a service')) {
      return 'DaaS';
    }
    // Generate alias from first letters of words
    return projectName.split(/[\s-]+/).map(word => word[0]).join('').toUpperCase().slice(0, 4);
  }

  /**
   * Get the last 4 completed sprint iterations from all configured projects
   * @returns {Array} Array of sprint objects with id, name, dates, and project info
   */
  async getLastFourSprints() {
    try {
      await this.initialize();
      await this.initializeProjects();

      let allSprints = [];

      console.log(`Fetching sprints from ${this.projects.length} projects...`);

      // Fetch sprints from all configured projects
      for (const project of this.projects) {
        try {
          console.log(`Fetching sprints from project: ${project.name}, team: ${project.team}`);

          const iterations = await this.workItemApi.getTeamIterations({
            project: project.name,
            team: project.team
          });

          // Process iterations for this project
          const projectSprints = iterations
            .filter(iteration =>
              iteration.attributes?.finishDate &&
              new Date(iteration.attributes.finishDate) < new Date()
            )
            .map(iteration => ({
              id: `${project.alias}-${iteration.id}`, // Unique ID across projects
              originalId: iteration.id,
              name: `${project.alias}: ${iteration.name}`,
              projectName: project.name,
              projectAlias: project.alias,
              teamName: project.team,
              startDate: iteration.attributes?.startDate,
              finishDate: iteration.attributes?.finishDate,
              path: iteration.path
            }));

          allSprints = allSprints.concat(projectSprints);
          console.log(`Found ${projectSprints.length} completed sprints in ${project.alias}`);
        } catch (projectError) {
          console.warn(`Failed to fetch sprints from ${project.name}:`, projectError.message);
          // Continue with other projects even if one fails
        }
      }

      // Sort all sprints by finish date and get last 4
      const completedSprints = allSprints
        .sort((a, b) =>
          new Date(b.finishDate) - new Date(a.finishDate)
        )
        .slice(0, 4);

      console.log(`Returning ${completedSprints.length} most recent sprints across all projects`);
      return completedSprints;
    } catch (error) {
      console.error('Error fetching sprints:', error);
      throw new Error(`Failed to fetch sprints: ${error.message}`);
    }
  }

  /**
   * Get performance metrics for a specific sprint
   * @param {Object} sprint - The sprint object with project info
   * @returns {Object} Performance metrics for the sprint
   */
  async getSprintPerformanceData(sprint) {
    try {
      await this.initialize();

      // Extract project info from sprint object
      const projectName = sprint.projectName;
      const iterationPath = sprint.path;

      console.log(`Fetching performance data for ${sprint.name} in project ${projectName}`);

      // Query work items for the specific iteration
      const wiql = {
        query: `SELECT [System.Id], [System.Title], [System.State], [System.WorkItemType], [Microsoft.VSTS.Common.StoryPoints], [Microsoft.VSTS.Scheduling.CompletedWork], [System.CreatedDate], [Microsoft.VSTS.Common.ClosedDate], [System.IterationPath]
                FROM workitems
                WHERE [System.IterationPath] = '${iterationPath}'
                AND [System.WorkItemType] IN ('User Story', 'Bug', 'Task')`
      };

      const queryResult = await this.workItemApi.queryByWiql(wiql, {
        project: projectName
      });

      if (!queryResult.workItems || queryResult.workItems.length === 0) {
        console.log(`No work items found for sprint ${sprint.name}`);
        return this.getEmptyMetrics(sprint);
      }

      // Get detailed work item data
      const workItemIds = queryResult.workItems.map(wi => wi.id);
      const workItems = await this.workItemApi.getWorkItems(workItemIds, {
        project: projectName,
        fields: [
          'System.Id', 'System.Title', 'System.State', 'System.WorkItemType',
          'Microsoft.VSTS.Common.StoryPoints', 'Microsoft.VSTS.Scheduling.CompletedWork',
          'System.CreatedDate', 'Microsoft.VSTS.Common.ClosedDate', 'System.IterationPath'
        ]
      });

      console.log(`Found ${workItems.length} work items for ${sprint.name}`);
      return this.calculateSprintMetrics(workItems, sprint);
    } catch (error) {
      console.error('Error fetching sprint performance data:', error);
      return this.getEmptyMetrics(sprint);
    }
  }

  /**
   * Calculate performance metrics from work items
   * @param {Array} workItems - Array of work items
   * @returns {Object} Calculated metrics
   */
  calculateSprintMetrics(workItems) {
    const metrics = {
      totalStoryPoints: 0,
      completedStoryPoints: 0,
      totalWorkItems: workItems.length,
      completedWorkItems: 0,
      totalHours: 0,
      bugCount: 0,
      userStoryCount: 0,
      taskCount: 0,
      velocity: 0,
      completionRate: 0
    };

    workItems.forEach(item => {
      const fields = item.fields;
      const workItemType = fields['System.WorkItemType'];
      const state = fields['System.State'];
      const storyPoints = fields['Microsoft.VSTS.Common.StoryPoints'] || 0;
      const completedWork = fields['Microsoft.VSTS.Scheduling.CompletedWork'] || 0;

      // Count by type
      if (workItemType === 'Bug') metrics.bugCount++;
      if (workItemType === 'User Story') metrics.userStoryCount++;
      if (workItemType === 'Task') metrics.taskCount++;

      // Story points and completion
      metrics.totalStoryPoints += storyPoints;
      metrics.totalHours += completedWork;

      if (state === 'Done' || state === 'Closed' || state === 'Resolved') {
        metrics.completedWorkItems++;
        metrics.completedStoryPoints += storyPoints;
      }
    });

    // Calculate derived metrics
    metrics.velocity = metrics.completedStoryPoints;
    metrics.completionRate = metrics.totalWorkItems > 0
      ? Math.round((metrics.completedWorkItems / metrics.totalWorkItems) * 100)
      : 0;

    return metrics;
  }

  /**
   * Return empty metrics structure
   */
  getEmptyMetrics(sprint = null) {
    return {
      totalStoryPoints: 0,
      completedStoryPoints: 0,
      totalWorkItems: 0,
      completedWorkItems: 0,
      totalHours: 0,
      bugCount: 0,
      userStoryCount: 0,
      taskCount: 0,
      velocity: 0,
      completionRate: 0,
      projectInfo: sprint ? {
        name: sprint.projectName,
        alias: sprint.projectAlias
      } : null
    };
  }

  /**
   * Get all available projects and teams for debugging
   * @returns {Array} All projects with teams
   */
  async getAllProjectsDebug() {
    try {
      await this.initialize();

      const allProjects = await this.coreApi.getProjects();
      const projectsWithTeams = [];

      for (const project of allProjects) {
        try {
          const teams = await this.coreApi.getTeams(project.id);
          projectsWithTeams.push({
            name: project.name,
            id: project.id,
            description: project.description || '',
            teams: teams.map(t => ({ name: t.name, id: t.id }))
          });
        } catch (error) {
          projectsWithTeams.push({
            name: project.name,
            id: project.id,
            description: project.description || '',
            teams: [],
            error: error.message
          });
        }
      }

      return projectsWithTeams;
    } catch (error) {
      console.error('Error fetching all projects:', error);
      throw error;
    }
  }
}

export default AzureDevOpsService;