/**
 * Performance Dashboard Hook
 * Manages sprint filtering and performance data loading
 */

import { useState, useEffect, useCallback } from 'react';
import AzureDevOpsService from '../services/azureDevOpsService';

const usePerformanceDashboard = () => {
  const [selectedSprint, setSelectedSprint] = useState(null);
  const [performanceData, setPerformanceData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const azureService = new AzureDevOpsService();

  /**
   * Load performance data for selected sprint
   */
  const loadPerformanceData = useCallback(async (sprint) => {
    if (!sprint) {
      setPerformanceData(null);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const data = await azureService.getSprintPerformanceData(sprint.id);

      // Enhance data with sprint information
      const enhancedData = {
        ...data,
        sprintInfo: {
          name: sprint.name,
          startDate: sprint.startDate,
          finishDate: sprint.finishDate,
          duration: calculateSprintDuration(sprint.startDate, sprint.finishDate)
        }
      };

      setPerformanceData(enhancedData);
    } catch (err) {
      setError(`Failed to load performance data: ${err.message}`);
      console.error('Performance data loading error:', err);
    } finally {
      setLoading(false);
    }
  }, [azureService]);

  /**
   * Handle sprint selection change
   */
  const handleSprintChange = useCallback(async (sprint) => {
    setSelectedSprint(sprint);
    await loadPerformanceData(sprint);
  }, [loadPerformanceData]);

  /**
   * Refresh current sprint data
   */
  const refreshData = useCallback(async () => {
    if (selectedSprint) {
      await loadPerformanceData(selectedSprint);
    }
  }, [selectedSprint, loadPerformanceData]);

  /**
   * Calculate sprint duration in days
   */
  const calculateSprintDuration = (startDate, endDate) => {
    if (!startDate || !endDate) return 0;
    const start = new Date(startDate);
    const end = new Date(endDate);
    return Math.ceil((end - start) / (1000 * 60 * 60 * 24));
  };

  /**
   * Get formatted performance metrics for display
   */
  const getFormattedMetrics = () => {
    if (!performanceData) return null;

    return {
      velocity: {
        value: performanceData.velocity,
        label: 'Story Points Completed',
        trend: calculateVelocityTrend()
      },
      completion: {
        value: performanceData.completionRate,
        label: 'Completion Rate (%)',
        format: 'percentage'
      },
      workItems: {
        total: performanceData.totalWorkItems,
        completed: performanceData.completedWorkItems,
        label: 'Work Items'
      },
      breakdown: {
        userStories: performanceData.userStoryCount,
        bugs: performanceData.bugCount,
        tasks: performanceData.taskCount
      },
      hours: {
        value: performanceData.totalHours,
        label: 'Hours Logged'
      }
    };
  };

  /**
   * Calculate velocity trend (placeholder for future enhancement)
   */
  const calculateVelocityTrend = () => {
    // TODO: Compare with previous sprints for trend calculation
    return 'stable';
  };

  return {
    selectedSprint,
    performanceData,
    loading,
    error,
    handleSprintChange,
    refreshData,
    getFormattedMetrics
  };
};

export default usePerformanceDashboard;