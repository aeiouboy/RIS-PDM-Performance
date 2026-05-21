const express = require('express');
const { query, param, validationResult } = require('express-validator');
const router = express.Router();
const logger = require('../utils/logger');
const { requireRoles } = require('../middleware/auth');
const AzureDevOpsService = require('../src/services/azureDevOpsService');
const { azureDevOpsConfig } = require('../src/config/azureDevOpsConfig');

// Initialise the service the same way metrics.js does
const azureService = new AzureDevOpsService(azureDevOpsConfig);

// Team name confirmed from projectMapping.js line 57
const OMNIA_TEAM = 'Product - OMNIA Team';

/**
 * Map a transformed work-item (from azureDevOpsService.transformWorkItem) to the
 * shape the frontend expects from this route.
 *
 * Preserved shape (from original mock):
 *   id, title, type, state, assignedTo{id,name,email}, priority, storyPoints,
 *   iteration, area, createdDate, changedDate, description, tags, links, comments
 */
function mapWorkItem(item) {
  return {
    id: item.id,
    title: item.title,
    type: item.type,
    state: item.state,
    assignedTo: item.assignee && item.assignee !== 'Unassigned'
      ? {
          id: item.assigneeEmail || item.assignee,
          name: item.assignee,
          email: item.assigneeEmail || null,
        }
      : null,
    priority: item.priority,
    storyPoints: item.storyPoints,
    iteration: item.iterationPath || null,
    area: item.areaPath || null,
    createdDate: item.createdDate || null,
    changedDate: item.changedDate || null,
    description: item.description || null,
    tags: item.tags || [],
    // Relations / comments are not returned by the batch details endpoint;
    // preserve empty arrays so the response shape stays consistent.
    links: [],
    comments: [],
  };
}

/**
 * @route   GET /api/workitems
 * @desc    Get work items from Azure DevOps
 * @access  Private
 * @query   ?assignedTo=userId&state=Active&workItemType=Feature&limit=50&offset=0
 */
router.get('/',
  [
    query('assignedTo').optional().notEmpty().withMessage('Assigned to cannot be empty'),
    query('state').optional().isIn(['New', 'Active', 'Resolved', 'Closed', 'Removed']).withMessage('Invalid state'),
    query('workItemType').optional().isIn(['Epic', 'Feature', 'User Story', 'Task', 'Bug']).withMessage('Invalid work item type'),
    query('iteration').optional().notEmpty().withMessage('Iteration cannot be empty'),
    query('area').optional().notEmpty().withMessage('Area cannot be empty'),
    query('priority').optional().isIn(['1', '2', '3', '4']).withMessage('Invalid priority'),
    query('limit').optional().isInt({ min: 1, max: 200 }).withMessage('Limit must be between 1 and 200'),
    query('offset').optional().isInt({ min: 0 }).withMessage('Offset must be non-negative'),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Validation failed',
          code: 'VALIDATION_ERROR',
          details: errors.array(),
          timestamp: new Date().toISOString(),
        });
      }

      const {
        assignedTo,
        state,
        workItemType,
        iteration,
        area,
        priority,
        limit = 50,
        offset = 0,
      } = req.query;

      logger.info(`Fetching work items for user ${req.user.email}`, {
        filters: { assignedTo, state, workItemType, iteration, area, priority, limit, offset },
        userId: req.user.id,
      });

      // Build queryOptions for the service
      const queryOptions = {
        workItemTypes: workItemType ? [workItemType] : ['Epic', 'Feature', 'User Story', 'Task', 'Bug'],
        states: state ? [state] : null,
        iterationPath: iteration || null,
        areaPath: area || null,
        assignedTo: assignedTo || null,
        maxResults: parseInt(limit) + parseInt(offset), // fetch enough to paginate
      };

      // Step 1: Run WIQL to get matching IDs
      let wiqlResult;
      try {
        wiqlResult = await azureService.getWorkItems(queryOptions);
      } catch (svcError) {
        logger.error('Azure DevOps getWorkItems failed:', svcError);
        return res.status(502).json({
          error: 'Failed to fetch work items from Azure DevOps',
          code: 'AZURE_DEVOPS_ERROR',
          message: svcError.message,
          timestamp: new Date().toISOString(),
        });
      }

      const allIds = (wiqlResult.workItems || []).map(wi => wi.id);

      // Apply priority filter post-query (WIQL result only has IDs; priority is a detail field)
      // We'll filter after fetching details below.

      // Step 2: Paginate IDs before detail fetch to avoid unnecessary API calls
      const total = allIds.length;
      const pageIds = allIds.slice(parseInt(offset), parseInt(offset) + parseInt(limit));

      let workItems = [];
      if (pageIds.length > 0) {
        let detailResult;
        try {
          detailResult = await azureService.getWorkItemDetails(pageIds);
        } catch (svcError) {
          logger.error('Azure DevOps getWorkItemDetails failed:', svcError);
          return res.status(502).json({
            error: 'Failed to fetch work item details from Azure DevOps',
            code: 'AZURE_DEVOPS_ERROR',
            message: svcError.message,
            timestamp: new Date().toISOString(),
          });
        }

        let items = (detailResult.workItems || []).map(mapWorkItem);

        // Apply priority filter (detail-level) if requested
        if (priority) {
          items = items.filter(item => item.priority === parseInt(priority));
        }

        workItems = items;
      }

      res.json({
        data: workItems,
        pagination: {
          total,
          limit: parseInt(limit),
          offset: parseInt(offset),
          hasMore: parseInt(offset) + workItems.length < total,
        },
        filters: {
          assignedTo,
          state,
          workItemType,
          iteration,
          area,
          priority,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route   GET /api/workitems/meta/iterations
 * @desc    Get available iterations/sprints
 * @access  Private
 *
 * NOTE: This route MUST be declared before /:workItemId to avoid Express
 * treating "meta" as a work item ID.
 */
router.get('/meta/iterations', async (req, res, next) => {
  try {
    logger.info(`Fetching iterations for user ${req.user.email}`, {
      userId: req.user.id,
    });

    let result;
    try {
      result = await azureService.getIterations(OMNIA_TEAM, 'all');
    } catch (svcError) {
      logger.error('Azure DevOps getIterations failed:', svcError);
      return res.status(502).json({
        error: 'Failed to fetch iterations from Azure DevOps',
        code: 'AZURE_DEVOPS_ERROR',
        message: svcError.message,
        timestamp: new Date().toISOString(),
      });
    }

    const iterations = (result.iterations || []).map(iter => ({
      id: iter.id,
      name: iter.name,
      path: iter.path,
      startDate: iter.attributes?.startDate || null,
      endDate: iter.attributes?.finishDate || null,
      state: iter.attributes?.timeFrame || null,
      workItemCount: iter.workItemCount || 0,
    }));

    res.json({
      data: iterations,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   GET /api/workitems/meta/areas
 * @desc    Get available area paths
 * @access  Private
 *
 * TODO: AzureDevOpsService does not expose a getAreas() method.
 *       Implement azureService.getAreas() and wire it here when available.
 */
router.get('/meta/areas', async (req, res, next) => {
  try {
    logger.info(`Area paths requested by user ${req.user.email} — not yet implemented`, {
      userId: req.user.id,
    });

    return res.status(501).json({
      error: 'Not implemented',
      code: 'NOT_IMPLEMENTED',
      message: 'Area path listing requires azureService.getAreas() which is not yet available. Implement that method and wire it here.',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   GET /api/workitems/:workItemId
 * @desc    Get specific work item by ID
 * @access  Private
 */
router.get('/:workItemId',
  [
    param('workItemId').isInt({ min: 1 }).withMessage('Work item ID must be a positive integer'),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Validation failed',
          code: 'VALIDATION_ERROR',
          details: errors.array(),
          timestamp: new Date().toISOString(),
        });
      }

      const workItemId = parseInt(req.params.workItemId);

      logger.info(`Fetching work item ${workItemId} for user ${req.user.email}`, {
        workItemId,
        userId: req.user.id,
      });

      let detailResult;
      try {
        detailResult = await azureService.getWorkItemDetails([workItemId]);
      } catch (svcError) {
        logger.error(`Azure DevOps getWorkItemDetails(${workItemId}) failed:`, svcError);
        return res.status(502).json({
          error: 'Failed to fetch work item from Azure DevOps',
          code: 'AZURE_DEVOPS_ERROR',
          message: svcError.message,
          timestamp: new Date().toISOString(),
        });
      }

      const items = detailResult.workItems || [];
      if (items.length === 0) {
        return res.status(404).json({
          error: 'Work item not found',
          code: 'WORK_ITEM_NOT_FOUND',
          workItemId,
          timestamp: new Date().toISOString(),
        });
      }

      const workItem = mapWorkItem(items[0]);

      res.json({
        data: workItem,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route   PUT /api/workitems/:workItemId
 * @desc    Update work item (limited fields)
 * @access  Private
 */
router.put('/:workItemId',
  [
    param('workItemId').isInt({ min: 1 }).withMessage('Work item ID must be a positive integer'),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Validation failed',
          code: 'VALIDATION_ERROR',
          details: errors.array(),
          timestamp: new Date().toISOString(),
        });
      }

      const workItemId = parseInt(req.params.workItemId);
      const updates = req.body;

      logger.info(`Updating work item ${workItemId} for user ${req.user.email}`, {
        workItemId,
        updates: Object.keys(updates),
        userId: req.user.id,
      });

      // Map route-level field names to service-level field names
      const serviceUpdates = {};
      if (updates.title !== undefined) serviceUpdates.title = updates.title;
      if (updates.description !== undefined) serviceUpdates.description = updates.description;
      if (updates.state !== undefined) serviceUpdates.state = updates.state;
      if (updates.assignedTo !== undefined) {
        // Route accepts assignedTo as a string (email/display name) or null
        serviceUpdates.assignedTo = updates.assignedTo?.email || updates.assignedTo || null;
      }
      if (updates.storyPoints !== undefined) serviceUpdates.storyPoints = updates.storyPoints;
      if (updates.priority !== undefined) serviceUpdates.priority = updates.priority;
      if (updates.tags !== undefined) serviceUpdates.tags = updates.tags;
      if (updates.area !== undefined) serviceUpdates.areaPath = updates.area;
      if (updates.iteration !== undefined) serviceUpdates.iterationPath = updates.iteration;

      let updated;
      try {
        updated = await azureService.updateWorkItem(workItemId, serviceUpdates);
      } catch (svcError) {
        logger.error(`Azure DevOps updateWorkItem(${workItemId}) failed:`, svcError);
        return res.status(502).json({
          error: 'Failed to update work item in Azure DevOps',
          code: 'AZURE_DEVOPS_ERROR',
          message: svcError.message,
          timestamp: new Date().toISOString(),
        });
      }

      res.json({
        data: mapWorkItem(updated),
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  }
);

module.exports = router;
