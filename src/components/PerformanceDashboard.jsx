/**
 * Performance Dashboard with Sprint Filter
 * Main dashboard component integrating sprint filtering with real Azure DevOps data
 */

import React from 'react';
import SprintFilter from './SprintFilter';
import usePerformanceDashboard from '../hooks/usePerformanceDashboard';

const PerformanceDashboard = () => {
  const {
    selectedSprint,
    performanceData,
    loading,
    error,
    handleSprintChange,
    refreshData,
    getFormattedMetrics
  } = usePerformanceDashboard();

  const metrics = getFormattedMetrics();

  const renderMetricCard = (title, value, subtitle = '', className = '') => (
    <div className={`metric-card ${className}`}>
      <div className="metric-header">
        <h3 className="metric-title">{title}</h3>
        {selectedSprint && (
          <span className="metric-sprint">
            {selectedSprint.name}
          </span>
        )}
      </div>
      <div className="metric-value">{value}</div>
      {subtitle && <div className="metric-subtitle">{subtitle}</div>}
    </div>
  );

  const renderWorkItemBreakdown = (breakdown) => (
    <div className="work-item-breakdown">
      <div className="breakdown-item">
        <span className="breakdown-label">User Stories:</span>
        <span className="breakdown-value">{breakdown.userStories}</span>
      </div>
      <div className="breakdown-item">
        <span className="breakdown-label">Bugs:</span>
        <span className="breakdown-value bugs">{breakdown.bugs}</span>
      </div>
      <div className="breakdown-item">
        <span className="breakdown-label">Tasks:</span>
        <span className="breakdown-value">{breakdown.tasks}</span>
      </div>
    </div>
  );

  return (
    <div className="performance-dashboard">
      {/* Header with Sprint Filter */}
      <div className="dashboard-header">
        <div className="header-left">
          <h1>Performance Dashboard</h1>
          {selectedSprint && (
            <p className="sprint-info">
              Sprint: {selectedSprint.name}
              ({new Date(selectedSprint.startDate).toLocaleDateString()} -
               {new Date(selectedSprint.finishDate).toLocaleDateString()})
            </p>
          )}
        </div>
        <div className="header-right">
          <SprintFilter
            selectedSprint={selectedSprint}
            onSprintChange={handleSprintChange}
            className="dashboard-sprint-filter"
          />
          <button
            onClick={refreshData}
            className="refresh-button"
            disabled={loading}
            title="Refresh data"
          >
            {loading ? '⟳' : '↻'}
          </button>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="error-banner">
          <span className="error-message">{error}</span>
          <button onClick={refreshData} className="retry-button">
            Retry
          </button>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="loading-overlay">
          <div className="loading-spinner"></div>
          <p>Loading performance data...</p>
        </div>
      )}

      {/* Main Metrics Grid */}
      <div className="metrics-grid">
        {metrics ? (
          <>
            {/* Velocity Card */}
            {renderMetricCard(
              'Sprint Velocity',
              `${metrics.velocity.value} SP`,
              metrics.velocity.label,
              'velocity-card'
            )}

            {/* Completion Rate Card */}
            {renderMetricCard(
              'Completion Rate',
              `${metrics.completion.value}%`,
              `${metrics.workItems.completed}/${metrics.workItems.total} items`,
              'completion-card'
            )}

            {/* Work Items Breakdown Card */}
            <div className="metric-card breakdown-card">
              <div className="metric-header">
                <h3 className="metric-title">Work Items</h3>
              </div>
              <div className="metric-value">{metrics.workItems.total}</div>
              {renderWorkItemBreakdown(metrics.breakdown)}
            </div>

            {/* Hours Logged Card */}
            {renderMetricCard(
              'Hours Logged',
              `${metrics.hours.value}h`,
              metrics.hours.label,
              'hours-card'
            )}
          </>
        ) : !loading && !selectedSprint ? (
          <div className="empty-state">
            <div className="empty-message">
              <h3>Select a Sprint</h3>
              <p>Choose a sprint from the dropdown to view performance metrics</p>
            </div>
          </div>
        ) : null}
      </div>

      {/* Sprint Summary */}
      {metrics && performanceData?.sprintInfo && (
        <div className="sprint-summary">
          <h2>Sprint Summary</h2>
          <div className="summary-stats">
            <div className="summary-item">
              <label>Sprint Duration:</label>
              <value>{performanceData.sprintInfo.duration} days</value>
            </div>
            <div className="summary-item">
              <label>Story Points Planned:</label>
              <value>{metrics.velocity.value + (performanceData.totalStoryPoints - performanceData.completedStoryPoints)} SP</value>
            </div>
            <div className="summary-item">
              <label>Story Points Completed:</label>
              <value>{metrics.velocity.value} SP</value>
            </div>
            <div className="summary-item">
              <label>Completion Rate:</label>
              <value>{metrics.completion.value}%</value>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PerformanceDashboard;