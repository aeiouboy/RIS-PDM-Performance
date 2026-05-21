import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import dashboardSSEClient from '../services/dashboardSSEClient';

const SprintFilter = ({ selectedSprint, onSprintChange, selectedProject, sprints = [], className = '', forceTs }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [apiSprints, setApiSprints] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const dropdownRef = useRef(null);
  const hasFetchedRef = useRef(false);

  // Fallback sprints if API fails
  const fallbackSprints = [
    { id: 'current', name: 'Current Sprint', description: 'Current Sprint', status: 'active', startDate: new Date().toISOString().split('T')[0], endDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] },
    { id: 'all-sprints', name: 'All Sprints', description: 'All time view', status: 'all', startDate: null, endDate: null }
  ];

  // Fetch sprints from API on component mount
  useEffect(() => {
    const fetchSprints = async () => {
      // Skip API call if sprints are provided as props
      if (sprints && sprints.length > 0) {
        setApiSprints(sprints);
        hasFetchedRef.current = true;
        return;
      }

      // Skip if already fetched or currently loading
      if (hasFetchedRef.current || loading) {
        return;
      }

      hasFetchedRef.current = true;
      setLoading(true);
      setError(null);

      try {
        console.log('🔄 Fetching sprints from API...', selectedProject ? `for project: ${selectedProject}` : '');
        const response = await axios.get('/api/metrics/sprints', {
          params: selectedProject ? { productId: selectedProject } : {},
          timeout: 8000, // Reduced from 10 seconds to 8 seconds
          headers: {
            'Content-Type': 'application/json',
            // Every other component on this page sends the bearer token
            // explicitly (Dashboard.jsx, SprintHealthCard, etc.). When this
            // request was missing it the endpoint returned 401, axios threw,
            // and the catch branch surfaced the "Using fallback data" badge —
            // the sprint dropdown silently showed a synthetic 2-week window.
            Authorization: `Bearer ${localStorage.getItem('authToken') || ''}`
          }
        });

        if (response.data && response.data.success && response.data.data) {
          console.log('✅ Successfully fetched sprints:', response.data.data);
          setApiSprints(response.data.data);
        } else {
          console.warn('⚠️ Invalid sprint response structure:', response.data);
          setApiSprints(fallbackSprints);
        }
      } catch (err) {
        console.error('❌ Error fetching sprints:', err);
        setError(err.message);
        setApiSprints(fallbackSprints);
      } finally {
        setLoading(false);
      }
    };

    fetchSprints();
  }, [sprints, selectedProject, forceTs]); // ✅ Added forceTs for coordinated cache invalidation

  // Reset fetched flag when project changes to force re-fetch
  useEffect(() => {
    if (selectedProject) {
      hasFetchedRef.current = false;
      setApiSprints([]); // Clear existing sprints
    }
  }, [selectedProject]);

  // GOTCHA: Must reset hasFetchedRef when forceTs changes for cache coordination
  useEffect(() => {
    if (forceTs) {
      hasFetchedRef.current = false;
      console.log('🔄 Resetting sprint fetch flag due to forceTs change:', forceTs);
    }
  }, [forceTs]);

  // Real-time sprint data updates integration
  // Following pattern: useRealtimeMetrics hook integration approach
  useEffect(() => {
    const handleSprintDataUpdate = (data) => {
      if (data && data.payload && data.payload.sprints) {
        console.log('📡 Real-time sprint update received:', data.payload.sprints);

        // Filter sprints for current project if needed
        let updatedSprints = data.payload.sprints;
        if (selectedProject && data.payload.projectId && data.payload.projectId !== selectedProject) {
          // This update is for a different project, ignore it
          return;
        }

        setApiSprints(updatedSprints);
        setError(null); // Clear any previous errors since we got fresh data
      }
    };

    // Subscribe to sprint data updates
    const unsubscribe = dashboardSSEClient.subscribe('sprint_data_updated', handleSprintDataUpdate);

    return () => {
      // Cleanup subscription
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [selectedProject]); // Depend on selectedProject for filtering

  // Use API sprints if available, otherwise use provided sprints or fallback
  const sprintList = apiSprints.length > 0 ? apiSprints : (sprints.length > 0 ? sprints : fallbackSprints);

  // Find the current sprint - if selectedSprint is 'current', find the active sprint
  let currentSprint;
  if (selectedSprint === 'current') {
    currentSprint = sprintList.find(s => s.status === 'active') || sprintList[0];
  } else {
    currentSprint = sprintList.find(s => s.id === selectedSprint) || sprintList[0];
  }

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSprintSelect = (sprint) => {
    onSprintChange(sprint.id);
    setIsOpen(false);
  };

  // Visual badge for each sprint status. Active gets a saturated emerald color
  // + dot indicator so PMs can spot the in-flight sprint at a glance.
  const getStatusColor = (status) => {
    switch (status) {
      case 'active':
        return 'bg-emerald-500 text-white border-emerald-600';
      case 'planned':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'completed':
        return 'bg-slate-100 text-slate-600 border-slate-200';
      case 'all':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      default:
        return 'bg-slate-100 text-slate-600 border-slate-200';
    }
  };

  const getStatusIcon = (status) => {
    if (status === 'active') return '●';
    return '';
  };

  const formatDateRange = (startDate, endDate) => {
    if (!startDate || !endDate) return '';
    const start = new Date(startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const end = new Date(endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    return `${start} - ${end}`;
  };

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        disabled={loading}
        className={`w-full bg-white border border-gray-300 rounded-md px-3 py-2 text-left shadow-sm focus:outline-none focus-visible:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 hover:bg-gray-50 transition-colors ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center min-w-0">
            {loading ? (
              <div className="flex-shrink-0 w-6 h-6 mr-3">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
              </div>
            ) : (
              <div className={`flex-shrink-0 px-2 py-1 rounded-full text-xs font-medium mr-3 ${getStatusColor(currentSprint.status)}`}>
                {getStatusIcon(currentSprint.status)} {currentSprint.status.charAt(0).toUpperCase() + currentSprint.status.slice(1)}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium text-gray-900 truncate">
                {loading ? 'Loading sprints...' : currentSprint.name}
                {loading && <span className="text-xs text-gray-500 ml-2">(Loading...)</span>}
                {error && <span className="text-xs text-red-500 ml-2">(Using fallback data)</span>}
              </div>
              <div className="text-xs text-gray-500 truncate">
                {loading ? 'Fetching from Azure DevOps' :
                 (currentSprint.startDate && currentSprint.endDate ?
                  formatDateRange(currentSprint.startDate, currentSprint.endDate) :
                  currentSprint.description)
                }
              </div>
            </div>
          </div>
          <svg
            className={`ml-2 h-5 w-5 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {isOpen && (
        <div className="absolute mt-1 w-full bg-white border border-gray-300 rounded-md shadow-lg max-h-80 overflow-y-auto" style={{ zIndex: 10001, top: '100%', left: 0, right: 0 }}>
          <ul className="max-h-72 overflow-auto py-1" role="listbox">
            {sprintList.filter(sprint => sprint.id !== currentSprint.id).map((sprint) => {
              const isActive = sprint.status === 'active';
              return (
                <li
                  key={sprint.id}
                  onClick={() => handleSprintSelect(sprint)}
                  className={`cursor-pointer select-none px-3 py-2.5 hover:bg-slate-50 border-l-2 ${
                    isActive ? 'border-l-emerald-500 bg-emerald-50/30' :
                    selectedSprint === sprint.id ? 'border-l-blue-500 bg-blue-50' : 'border-l-transparent'
                  }`}
                  role="option"
                  aria-selected={selectedSprint === sprint.id}
                >
                  <div className="flex items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-slate-900 truncate">
                          {sprint.name}
                        </span>
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide border ${getStatusColor(sprint.status)}`}>
                          {getStatusIcon(sprint.status) && <span aria-hidden="true">{getStatusIcon(sprint.status)}</span>}
                          {sprint.status.charAt(0).toUpperCase() + sprint.status.slice(1)}
                        </span>
                      </div>
                      <div className="text-xs text-slate-500 truncate mt-0.5">
                        {sprint.startDate && sprint.endDate ?
                          formatDateRange(sprint.startDate, sprint.endDate) :
                          sprint.description
                        }
                      </div>
                    </div>
                    {selectedSprint === sprint.id && (
                      <svg className="w-5 h-5 text-blue-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
};

export default SprintFilter;