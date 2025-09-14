/**
 * Sprint Filter Component
 * Dropdown filter for selecting last 4 sprints with real Azure DevOps data
 */

import React, { useState, useEffect } from 'react';
import AzureDevOpsService from '../services/azureDevOpsService';

const SprintFilter = ({ onSprintChange, selectedSprint, className = '' }) => {
  const [sprints, setSprints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const azureService = new AzureDevOpsService();

  useEffect(() => {
    loadSprints();
  }, []);

  const loadSprints = async () => {
    try {
      setLoading(true);
      setError(null);

      const sprintData = await azureService.getLastFourSprints();
      setSprints(sprintData);

      // Auto-select most recent sprint if none selected
      if (!selectedSprint && sprintData.length > 0) {
        onSprintChange(sprintData[0]);
      }
    } catch (err) {
      setError('Failed to load sprints');
      console.error('Sprint loading error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSprintChange = (event) => {
    const sprintId = event.target.value;
    if (sprintId === '') {
      onSprintChange(null);
      return;
    }

    const selectedSprintData = sprints.find(sprint => sprint.id === sprintId);
    if (selectedSprintData) {
      onSprintChange(selectedSprintData);
    }
  };

  const formatSprintLabel = (sprint) => {
    const startDate = new Date(sprint.startDate).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    });
    const endDate = new Date(sprint.finishDate).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });

    return `${sprint.name} (${startDate} - ${endDate})`;
  };

  if (loading) {
    return (
      <div className={`sprint-filter loading ${className}`}>
        <select disabled className="sprint-select">
          <option>Loading sprints...</option>
        </select>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`sprint-filter error ${className}`}>
        <select disabled className="sprint-select">
          <option>Error loading sprints</option>
        </select>
        <button
          onClick={loadSprints}
          className="retry-button"
          title="Retry loading sprints"
        >
          ↻
        </button>
      </div>
    );
  }

  return (
    <div className={`sprint-filter ${className}`}>
      <label htmlFor="sprint-select" className="sprint-label">
        Sprint:
      </label>
      <select
        id="sprint-select"
        className="sprint-select"
        value={selectedSprint?.id || ''}
        onChange={handleSprintChange}
      >
        <option value="">All Time</option>
        {sprints.map(sprint => (
          <option key={sprint.id} value={sprint.id}>
            {formatSprintLabel(sprint)}
          </option>
        ))}
      </select>
      {sprints.length === 0 && (
        <span className="no-sprints">No sprints found</span>
      )}
    </div>
  );
};

export default SprintFilter;