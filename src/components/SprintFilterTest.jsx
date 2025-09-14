/**
 * Sprint Filter Test Component
 * Use this to test Azure DevOps integration before full dashboard integration
 */

import React, { useState, useEffect } from 'react';
import SprintFilter from './SprintFilter';
import AzureDevOpsService from '../services/azureDevOpsService';
import '../styles/PerformanceDashboard.css';

const SprintFilterTest = () => {
  const [selectedSprint, setSelectedSprint] = useState(null);
  const [discoveredProjects, setDiscoveredProjects] = useState([]);
  const [loading, setLoading] = useState(false);

  const azureService = new AzureDevOpsService();

  const handleSprintChange = (sprint) => {
    setSelectedSprint(sprint);
    console.log('Selected Sprint:', sprint);
  };

  const discoverProjects = async () => {
    try {
      setLoading(true);
      const projects = await azureService.getAllProjectsDebug();
      setDiscoveredProjects(projects);
      console.log('All discovered projects:', projects);
    } catch (error) {
      console.error('Error discovering projects:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="performance-dashboard">
      <div className="dashboard-header">
        <div className="header-left">
          <h1>Sprint Filter Test</h1>
          <p>Testing Azure DevOps integration for last 4 sprints</p>
        </div>
        <div className="header-right">
          <SprintFilter
            selectedSprint={selectedSprint}
            onSprintChange={handleSprintChange}
            className="dashboard-sprint-filter"
          />
        </div>
      </div>

      {/* Sprint Information Display */}
      {selectedSprint && (
        <div className="metrics-grid">
          <div className="metric-card">
            <div className="metric-header">
              <h3 className="metric-title">Selected Sprint</h3>
            </div>
            <div className="metric-value">{selectedSprint.name}</div>
            <div className="metric-subtitle">
              {new Date(selectedSprint.startDate).toLocaleDateString()} -
              {new Date(selectedSprint.finishDate).toLocaleDateString()}
            </div>
          </div>

          <div className="metric-card">
            <div className="metric-header">
              <h3 className="metric-title">Sprint ID</h3>
            </div>
            <div className="metric-value">{selectedSprint.id}</div>
            <div className="metric-subtitle">Azure DevOps Iteration ID</div>
          </div>

          <div className="metric-card">
            <div className="metric-header">
              <h3 className="metric-title">Sprint Path</h3>
            </div>
            <div className="metric-value" style={{ fontSize: '16px' }}>
              {selectedSprint.path}
            </div>
            <div className="metric-subtitle">Azure DevOps Path</div>
          </div>
        </div>
      )}

      {!selectedSprint && (
        <div className="empty-state">
          <div className="empty-message">
            <h3>Select a Sprint</h3>
            <p>Choose a sprint from the dropdown to test Azure DevOps integration</p>
          </div>
        </div>
      )}

      {/* Environment Check */}
      <div className="sprint-summary">
        <h2>Environment Configuration</h2>
        <div className="summary-stats">
          <div className="summary-item">
            <label>Azure DevOps Org:</label>
            <value>{process.env.AZURE_DEVOPS_ORG || 'Not configured'}</value>
          </div>
          <div className="summary-item">
            <label>PAT Token:</label>
            <value>{process.env.AZURE_DEVOPS_PAT ? 'Configured' : '❌ Missing'}</value>
          </div>
          <div className="summary-item">
            <label>Auto-Discovery:</label>
            <value>✅ Enabled</value>
          </div>
        </div>

        <div style={{ marginTop: '20px' }}>
          <button
            onClick={discoverProjects}
            disabled={loading}
            className="refresh-button"
          >
            {loading ? 'Discovering...' : 'Discover All Projects & Teams'}
          </button>
        </div>

        {/* Discovered Projects */}
        {discoveredProjects.length > 0 && (
          <div style={{ marginTop: '20px' }}>
            <h3>Discovered Projects ({discoveredProjects.length})</h3>
            <div style={{ maxHeight: '300px', overflow: 'auto' }}>
              {discoveredProjects.map((project, index) => (
                <div key={index} style={{
                  border: '1px solid #dee2e6',
                  padding: '10px',
                  margin: '5px 0',
                  borderRadius: '4px',
                  backgroundColor: project.name.toLowerCase().includes('partner') ||
                                project.name.toLowerCase().includes('pmp') ||
                                project.name.toLowerCase().includes('daas') ?
                                '#e8f5e8' : '#f8f9fa'
                }}>
                  <div><strong>{project.name}</strong></div>
                  {project.description && <div style={{ fontSize: '12px', color: '#6c757d' }}>{project.description}</div>}
                  <div style={{ fontSize: '12px', marginTop: '5px' }}>
                    Teams: {project.teams.length > 0 ?
                      project.teams.map(t => t.name).join(', ') :
                      'No teams found'
                    }
                  </div>
                  {project.error && <div style={{ color: 'red', fontSize: '12px' }}>Error: {project.error}</div>}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SprintFilterTest;