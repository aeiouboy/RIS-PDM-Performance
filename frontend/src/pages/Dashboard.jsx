import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { ExportButtons } from '../components';
import RealtimeStatus, { LastUpdateIndicator } from '../components/RealtimeStatus';
import { useRealtimeMetrics } from '../contexts/WebSocketContext';
import ProductSelector from '../components/ProductSelector';
import SprintFilter from '../components/SprintFilter';
import DateRangePicker from '../components/DateRangePicker';
import { PLCard, VelocityCard, BugCountCard, SatisfactionCard } from '../components/KPICard';
import SprintBurndownChart from '../components/SprintBurndownChart';
import TeamVelocityChart from '../components/TeamVelocityChart';
import TaskDistributionDashboard from '../components/TaskDistributionDashboard';
import useSwipeNavigation from '../hooks/useSwipeNavigation.jsx';

const Dashboard = () => {
  // Filter states
  const [selectedProduct, setSelectedProduct] = useState('Product - Partner Management Platform');
  const [selectedSprint, setSelectedSprint] = useState('current');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Reset filters function
  const handleResetFilters = () => {
    setSelectedProduct('Product - Partner Management Platform');
    setSelectedSprint('current');
    setStartDate('');
    setEndDate('');
  };
  
  // Sprint data for resolving sprint paths
  const [sprintData, setSprintData] = useState([]);
  // Force refresh trigger timestamp; when set, API calls add noCache
  const [forceTs, setForceTs] = useState(0);
  
  // Fetch sprint data for path resolution (scoped to selected product)
  useEffect(() => {
    const fetchSprintData = async () => {
      try {
        const params = new URLSearchParams({
          ...(selectedProduct && { productId: normalizeProjectId(selectedProduct) }),
          ...(forceTs ? { noCache: 'true', _: String(forceTs) } : {})
        });

        const response = await axios.get(`/api/metrics/sprints?${params.toString()}`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('authToken') || 'mock-token'}`,
            'Content-Type': 'application/json'
          }
        });
        if (response.data && response.data.success && response.data.data) {
          setSprintData(response.data.data);
        }
      } catch (error) {
        console.warn('Could not fetch sprint data for path resolution:', error);
      }
    };

    fetchSprintData();
  }, [selectedProduct, forceTs]);
  
  // Helper function to resolve sprint ID to iteration path
  const getSprintIterationPath = (sprintId) => {
    if (!sprintId || sprintId === 'all-sprints') return null;
    
    // Find sprint from API data
    const sprint = sprintData.find(s => s.id === sprintId);
    if (sprint?.path) {
      // For DaaS, convert full path to simple format
      if (selectedProduct === 'Product - Data as a Service' && sprint.path.includes('\\')) {
        const pathParts = sprint.path.split('\\');
        const iterationName = pathParts[pathParts.length - 1]; // Get last part
        console.log(`📊 DaaS: Converting full path "${sprint.path}" → simple format "${iterationName}"`);
        return iterationName;
      }
      console.log(`📊 Resolved sprint ${sprintId} → ${sprint.path}`);
      return sprint.path;
    }
    
    // Construct iteration path based on project and sprint
    // For DaaS: Use simple format extracted from sprint API data
    // For PMP: Use full path format
    const constructIterationPath = (projectName, sprintName) => {
      if (projectName === 'Product - Data as a Service') {
        // DaaS uses simple "Delivery" format (not full path due to team resolution issues)
        
        // First, try to find the sprint in our sprint data
        const sprint = sprintData.find(s => s.id === sprintName);
        if (sprint) {
          // For DaaS, convert full path to simple format
          // "Product - Data as a Service\Delivery 12" → "Delivery 12"
          if (sprint.path && sprint.path.includes('\\')) {
            const pathParts = sprint.path.split('\\');
            const iterationName = pathParts[pathParts.length - 1]; // Get last part
            console.log(`📊 DaaS: Converting full path "${sprint.path}" → simple format "${iterationName}"`);
            return iterationName;
          }
          // If no backslash, use the name directly
          return sprint.name;
        }
        
        // Handle common sprint name patterns
        if (sprintName === 'current') {
          // Find current sprint by date from sprint data
          const now = new Date();
          const currentSprint = sprintData.find(s => {
            if (s.id === 'current' || (s.startDate && s.endDate)) {
              if (s.id === 'current') return true;
              const startDate = new Date(s.startDate);
              const endDate = new Date(s.endDate);
              return startDate <= now && now <= endDate;
            }
            return false;
          });
          
          if (currentSprint) {
            console.log(`📊 DaaS: Found current sprint "${currentSprint.name}"`);
            return currentSprint.name;
          }
          // If unknown, allow backend to resolve 'current'
          return 'current';
        }
        
        // Handle delivery-X format
        if (sprintName.startsWith('delivery-')) return `Delivery ${sprintName.replace('delivery-', '')}`;
        if (sprintName.startsWith('Delivery ')) return sprintName; // Already in correct format
        return sprintName; // Use as-is for DaaS
        
      } else if (projectName === 'Product - Partner Management Platform') {
        // PMP: prefer backend resolution for 'current'; otherwise full path
        if (sprintName === 'current') return 'current';
        if (sprintName.startsWith('delivery-')) return `${projectName}\\Delivery ${sprintName.replace('delivery-', '')}`;
        return `${projectName}\\${sprintName}`;
      }
      // Default fallback
      return `${projectName}\\${sprintName}`;
    };
    
    const iterationPath = constructIterationPath(selectedProduct, sprintId);
    console.log(`📊 Constructed iteration path: ${selectedProduct} + ${sprintId} → ${iterationPath}`);
    return iterationPath;
  };
  
  // Swipe navigation for mobile
  const swipeNavigation = useSwipeNavigation({ 
    enabled: true, 
    threshold: 100,
    preventScroll: false 
  });

  // Real-time metrics hook with fallback to regular API
  const { 
    data: realtimeData, 
    loading: realtimeLoading, 
    error: realtimeError, 
    connected, 
    lastUpdate, 
    updateCount, 
    refresh 
  } = useRealtimeMetrics('dashboard', { 
    enabled: true,
    pollingFallback: 30000 // 30 second fallback polling
  });

  // Fallback state for backward compatibility
  const [fallbackData, setFallbackData] = useState(null);
  const [fallbackLoading, setFallbackLoading] = useState(true);
  const [fallbackError, setFallbackError] = useState(null);

  // State for component data
  const [kpiData, setKpiData] = useState(null);
  const [burndownData, setBurndownData] = useState([]);
  const [velocityTrendData, setVelocityTrendData] = useState([]);
  const [componentLoading, setComponentLoading] = useState({
    kpis: false,
    burndown: false,
    velocity: false
  });

  // Use real-time data if available, otherwise use fallback
  const data = realtimeData || fallbackData;
  const loading = realtimeLoading && fallbackLoading;
  const error = realtimeError || fallbackError;
  
  // Debug logging
  console.log('📊 Dashboard data state:', {
    realtimeData: !!realtimeData,
    fallbackData: !!fallbackData,
    data: !!data,
    hasKPIs: !!data?.kpis,
    realtimeLoading,
    fallbackLoading,
    loading
  });

  // Fallback API call if real-time is not available
  useEffect(() => {
    const fetchFallbackData = async () => {
      try {
        console.log('📊 Starting fallback data fetch...');
        setFallbackLoading(true);
        setFallbackError(null);
        
        const response = await axios.get(`/api/metrics/overview${forceTs ? `?noCache=true&_=${forceTs}` : ''}`, {
          timeout: 10000, // 10 second timeout
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('authToken') || 'mock-token'}`,
            'Content-Type': 'application/json'
          }
        });
        
        console.log('📊 Fallback response received:', response.data);
        
        if (response.data && response.data.data) {
          setFallbackData(response.data.data);
          console.log('📊 Fallback data set:', response.data.data);
        } else {
          console.error('📊 Invalid response structure:', response.data);
          setFallbackError('Invalid data structure received');
        }
      } catch (err) {
        console.error('📊 Fallback fetch error:', err);
        setFallbackError(`Failed to load dashboard data: ${err.message}`);
      } finally {
        console.log('📊 Fallback fetch completed, setting loading to false');
        setFallbackLoading(false);
      }
    };

    // Always try fallback first, then let real-time override if available
    if (!fallbackData && !fallbackLoading) {
      console.log('📊 Triggering fallback fetch - no data and not loading');
      fetchFallbackData();
    }
    
    // Also fetch fallback if real-time has been loading for too long
    const timeoutId = setTimeout(() => {
      if (realtimeLoading && !realtimeData && !fallbackData) {
        console.log('📊 Real-time taking too long, using fallback');
        fetchFallbackData();
      }
    }, 3000); // 3 second timeout

    return () => clearTimeout(timeoutId);
  }, [realtimeData, realtimeLoading, fallbackData, fallbackLoading, forceTs]);

  // Helper function to normalize project ID for API calls
  const normalizeProjectId = (projectId) => {
    // Ensure we never send just "Product" - always use the full name
    if (projectId === 'Product' || projectId === 'product') {
      return 'Product - Partner Management Platform';
    }
    return projectId;
  };

  // Fetch KPI data when filters change
  useEffect(() => {
    const fetchKPIData = async () => {
      setComponentLoading(prev => ({ ...prev, kpis: true }));
      try {
        const normalizedProductId = normalizeProjectId(selectedProduct);
        const params = new URLSearchParams({
          period: 'sprint',
          ...(normalizedProductId !== 'all-projects' && { productId: normalizedProductId }),
          ...(selectedSprint !== 'all-sprints' && { sprintId: selectedSprint })
        });
        if (forceTs) { params.set('noCache', 'true'); params.set('_', String(forceTs)); }
        
        const response = await axios.get(`/api/metrics/kpis?${params}`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('authToken') || 'mock-token'}`,
            'Content-Type': 'application/json'
          }
        });
        setKpiData(response.data.data);
      } catch (error) {
        console.error('❌ Error fetching KPI data:', error);
        console.log('🔄 KPI data fetch failed - leaving null to show error state');
        setKpiData(null); // Don't use mock data - let components handle error state
      } finally {
        setComponentLoading(prev => ({ ...prev, kpis: false }));
      }
    };

    fetchKPIData();
  }, [selectedProduct, selectedSprint, startDate, endDate, forceTs]);

  // Fetch Burndown data
  useEffect(() => {
    const fetchBurndownData = async () => {
      setComponentLoading(prev => ({ ...prev, burndown: true }));
      try {
        const normalizedProductId = normalizeProjectId(selectedProduct);
        const params = new URLSearchParams({
          ...(normalizedProductId !== 'all-projects' && { productId: normalizedProductId }),
          ...(selectedSprint !== 'all-sprints' && { sprintId: selectedSprint })
        });
        if (forceTs) { params.set('noCache', 'true'); params.set('_', String(forceTs)); }
        
        const response = await axios.get(`/api/metrics/burndown?${params}`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('authToken') || 'mock-token'}`,
            'Content-Type': 'application/json'
          }
        });
        setBurndownData(response.data.data);
      } catch (error) {
        console.error('❌ Error fetching burndown data:', error);
        console.log('🔄 Burndown data fetch failed - leaving empty to show error state');
        setBurndownData([]); // Empty array will show "no data" state instead of sample data
      } finally {
        setComponentLoading(prev => ({ ...prev, burndown: false }));
      }
    };

    fetchBurndownData();
  }, [selectedProduct, selectedSprint, forceTs]);

  // Fetch Velocity Trend data
  useEffect(() => {
    const fetchVelocityTrend = async () => {
      setComponentLoading(prev => ({ ...prev, velocity: true }));
      try {
        const normalizedProductId = normalizeProjectId(selectedProduct);
        // DaaS-specific range: show latest 4 sprints (Delivery 9-12), PMP shows 6
        const range = normalizedProductId === 'Product - Data as a Service' ? '4' : '6';
        const params = new URLSearchParams({
          period: 'sprint',
          range,
          ...(normalizedProductId !== 'all-projects' && { productId: normalizedProductId })
        });
        if (forceTs) { params.set('noCache', 'true'); params.set('_', String(forceTs)); }
        
        const response = await axios.get(`/api/metrics/velocity-trend?${params}`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('authToken') || 'mock-token'}`,
            'Content-Type': 'application/json'
          }
        });
        setVelocityTrendData(response.data.data);
      } catch (error) {
        console.error('❌ Error fetching velocity trend data:', error);
        console.log('🔄 Velocity trend data fetch failed - leaving empty to show error state');
        setVelocityTrendData([]); // Empty array will show "no data" state instead of sample data
      } finally {
        setComponentLoading(prev => ({ ...prev, velocity: false }));
      }
    };

    fetchVelocityTrend();
  }, [selectedProduct, forceTs]);


  if (loading) {
    return (
      <div className="dashboard-container py-8">
        <div className="flex items-center justify-center min-h-64">
          <div className="text-center max-w-md mx-auto">
            {/* Animated Icon and Spinner */}
            <div className="relative mb-8">
              {/* Background pulse */}
              <div className="absolute inset-0 rounded-full bg-blue-100 animate-ping opacity-75"></div>
              <div className="absolute inset-2 rounded-full bg-blue-200 animate-ping opacity-50" style={{ animationDelay: '0.5s' }}></div>

              {/* Main spinner */}
              <div className="relative">
                <div className="animate-spin rounded-full h-16 w-16 border-4 border-gray-200 border-t-blue-600 mx-auto"></div>

                {/* Inner dashboard icon */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="animate-pulse">
                    <svg className="w-6 h-6 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6zM14 9a1 1 0 00-1 1v6a1 1 0 001 1h2a1 1 0 001-1v-6a1 1 0 00-1-1h-2z" />
                    </svg>
                  </div>
                </div>
              </div>
            </div>

            {/* Animated Text */}
            <div className="space-y-3">
              <h3 className="text-xl font-semibold text-gray-900 animate-fade-in">
                Loading Dashboard
              </h3>

              {/* Animated dots */}
              <div className="flex items-center justify-center space-x-1">
                <span className="text-gray-600">Fetching the latest performance data</span>
                <div className="flex space-x-1">
                  <div className="w-1 h-1 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                  <div className="w-1 h-1 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                  <div className="w-1 h-1 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                </div>
              </div>
            </div>

            {/* Progress indicators */}
            <div className="mt-8 space-y-3">
              <div className="flex items-center justify-center space-x-4 text-sm text-gray-500">
                <div className="flex items-center space-x-2 animate-pulse" style={{ animationDelay: '0.5s' }}>
                  <div className="w-2 h-2 bg-green-400 rounded-full animate-ping"></div>
                  <span>Real-time metrics</span>
                </div>
                <div className="flex items-center space-x-2 animate-pulse" style={{ animationDelay: '1s' }}>
                  <div className="w-2 h-2 bg-blue-400 rounded-full animate-ping"></div>
                  <span>Team data</span>
                </div>
                <div className="flex items-center space-x-2 animate-pulse" style={{ animationDelay: '1.5s' }}>
                  <div className="w-2 h-2 bg-purple-400 rounded-full animate-ping"></div>
                  <span>Analytics</span>
                </div>
              </div>

              {/* Progress bar */}
              <div className="w-full bg-gray-200 rounded-full h-1.5 overflow-hidden">
                <div className="h-full bg-gradient-to-r from-blue-500 to-purple-600 rounded-full animate-pulse relative">
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent opacity-30 animate-shimmer"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="dashboard-container py-8">
        <div className="flex items-center justify-center min-h-64">
          <div className="text-center max-w-md mx-auto">
            <div className="w-16 h-16 mx-auto mb-4 text-error-400">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-full h-full">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Dashboard Error</h3>
            <p className="text-error-600 mb-4">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="btn-primary"
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Retry Loading
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Filter change handlers
  const handleDateRangeChange = (start, end) => {
    setStartDate(start);
    setEndDate(end);
  };

  return (
    <>
      {/* Skip to main content link for accessibility */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 bg-primary-600 text-white px-4 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
      >
        Skip to main content
      </a>

      <div
        className="dashboard-container py-8 px-4 max-w-screen-2xl mx-auto animate-fade-in"
        ref={(el) => swipeNavigation.bindSwipeHandlers(el)}
        role="main"
        id="main-content"
        aria-label="Performance Dashboard"
      >
      {/* Header with Title and Status */}
      <header className="mb-8">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
          <div className="flex-1">
            <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-4">
              <h1 className="text-4xl font-bold text-gray-900">RIS Performance Dashboard</h1>
              <div className="flex items-center gap-3">
                <RealtimeStatus showDetails={true} showControls={true} />
                <button
                  onClick={async () => {
                    const ts = Date.now();
                    setForceTs(ts);
                    try {
                      await refresh({ noCache: true });
                    } finally {
                      setTimeout(() => setForceTs(0), 2000);
                    }
                  }}
                  className="btn-primary text-xs h-8 px-3"
                  title="Fetch fresh data now (bypass caches)"
                >
                  Force Refresh
                </button>
              </div>
            </div>
            <p className="text-lg text-gray-600 mb-4">Overview of team and individual performance metrics</p>
            {updateCount > 0 && (
              <div className="flex items-center gap-6 text-sm">
                <LastUpdateIndicator lastUpdate={lastUpdate} />
                {connected && (
                  <span className="text-success-600 font-medium flex items-center gap-1">
                    <div className="w-2 h-2 bg-success-500 rounded-full animate-pulse"></div>
                    {updateCount} real-time update{updateCount > 1 ? 's' : ''} received
                  </span>
                )}
              </div>
            )}
          </div>
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <ExportButtons
              exportType="dashboard"
              period="sprint"
              className="flex-shrink-0"
            />
            {!connected && (
              <button
                onClick={refresh}
                disabled={loading}
                className="btn-secondary text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-gray-300 border-t-gray-600 mr-2"></div>
                    Refreshing...
                  </>
                ) : (
                  'Refresh Data'
                )}
              </button>
            )}
          </div>
        </div>
      </header>
      
      {/* Filter Bar */}
      <section className="bg-white rounded-lg border border-gray-200 shadow-sm mb-6 animate-slide-up">
        <div className="p-4">
          <div className="flex justify-end mb-4">
            <button
              onClick={handleResetFilters}
              className="btn-ghost text-sm hover:bg-gray-100 transition-colors duration-200"
              aria-label="Reset all filters to default values"
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Reset Filters
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <label className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Product</label>
              <ProductSelector
                selectedProduct={selectedProduct}
                onProductChange={setSelectedProduct}
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Sprint</label>
              <SprintFilter
                selectedSprint={selectedSprint}
                onSprintChange={setSelectedSprint}
                selectedProject={selectedProduct}
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Date Range</label>
              <DateRangePicker
                startDate={startDate}
                endDate={endDate}
                onDateRangeChange={handleDateRangeChange}
              />
            </div>
          </div>
        </div>
      </section>

      {/* KPI Cards Section - Enhanced Layout with Staggered Animation */}
      <section className="mb-8" role="region" aria-labelledby="kpi-heading" aria-describedby="kpi-description">
        <div className="flex justify-end mb-6">
          <div className="text-sm text-gray-500 flex items-center gap-2" role="status" aria-live="polite">
            <div className="w-2 h-2 bg-success-500 rounded-full animate-pulse" aria-hidden="true"></div>
            <span>Live data</span>
          </div>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-6">
          <PLCard
            value={kpiData?.pl?.value}
            trend={kpiData?.pl?.trend}
            trendValue={kpiData?.pl?.trendValue}
            loading={componentLoading.kpis}
            className="animate-fade-in"
            style={{ animationDelay: '0.1s' }}
            aria-label="Profit and Loss Year to Date metric"
          />
          <VelocityCard
            value={kpiData?.velocity?.value}
            trend={kpiData?.velocity?.trend}
            trendValue={kpiData?.velocity?.trendValue}
            loading={componentLoading.kpis}
            className="animate-fade-in"
            style={{ animationDelay: '0.2s' }}
            aria-label="Team velocity metric in story points per sprint"
          />
          <BugCountCard
            value={kpiData?.bugs?.value}
            trend={kpiData?.bugs?.trend}
            trendValue={kpiData?.bugs?.trendValue}
            loading={componentLoading.kpis}
            className="animate-fade-in"
            style={{ animationDelay: '0.3s' }}
            aria-label="Active bug count metric"
          />
          <SatisfactionCard
            value={kpiData?.satisfaction?.value}
            trend={kpiData?.satisfaction?.trend}
            trendValue={kpiData?.satisfaction?.trendValue}
            loading={componentLoading.kpis}
            className="animate-fade-in"
            style={{ animationDelay: '0.4s' }}
            aria-label="Team satisfaction rating out of 5"
          />
        </div>
      </section>


      {/* Charts Section - Separated Individual Cards */}
      <section className="mb-8" role="region" aria-labelledby="charts-heading" aria-describedby="charts-description">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Sprint Burndown Chart Card - Glassmorphism */}
          <div
            className="group relative backdrop-blur-lg bg-white/80 rounded-2xl border border-white/20 shadow-xl hover:shadow-2xl hover:scale-[1.01] transition-all duration-300 overflow-hidden p-6"
            style={{
              background: 'linear-gradient(135deg, rgba(255,255,255,0.9) 0%, rgba(255,255,255,0.7) 100%)',
              boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.15)'
            }}
          >
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary-400 to-primary-600"></div>
            <SprintBurndownChart
              data={burndownData}
              loading={componentLoading.burndown}
              height={280}
              className="animate-fade-in"
              style={{ animationDelay: '0.1s' }}
            />
          </div>

          {/* Team Velocity Trend Chart Card - Glassmorphism */}
          <div
            className="group relative backdrop-blur-lg bg-white/80 rounded-2xl border border-white/20 shadow-xl hover:shadow-2xl hover:scale-[1.01] transition-all duration-300 overflow-hidden p-6"
            style={{
              background: 'linear-gradient(135deg, rgba(255,255,255,0.9) 0%, rgba(255,255,255,0.7) 100%)',
              boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.15)'
            }}
          >
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary-400 to-primary-600"></div>
            <TeamVelocityChart
              data={velocityTrendData}
              loading={componentLoading.velocity}
              height={280}
              className="animate-fade-in"
              style={{ animationDelay: '0.2s' }}
            />
          </div>
        </div>
      </section>


      {/* Task Distribution & Bug Classification Section - Glassmorphism Card */}
      <section className="mb-8" role="region" aria-labelledby="distribution-heading">
        <div
          className="group relative backdrop-blur-lg bg-white/80 rounded-2xl border border-white/20 shadow-xl hover:shadow-2xl transition-all duration-300 overflow-hidden p-6"
          style={{
            background: 'linear-gradient(135deg, rgba(255,255,255,0.9) 0%, rgba(255,255,255,0.7) 100%)',
            boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.15)'
          }}
        >
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-purple-400 to-purple-600"></div>
          <TaskDistributionDashboard
            productId={selectedProduct !== 'all-projects' ? normalizeProjectId(selectedProduct) : null}
            iterationPath={getSprintIterationPath(selectedSprint)}
            className="animate-fade-in"
            style={{ animationDelay: '0.3s' }}
          />

          {/* Individual Performance Navigation */}
          <div className="mt-6 pt-6 border-t border-gray-200">
            <div className="flex justify-center">
              <button
                onClick={() => {
                  const productParam = selectedProduct ? `?product=${encodeURIComponent(selectedProduct)}` : '';
                  window.location.href = `/individual${productParam}`;
                }}
                className="px-8 py-4 bg-gradient-to-r from-blue-600 to-blue-700 text-white font-bold rounded-xl shadow-2xl hover:shadow-blue-500/25 hover:scale-105 transform transition-all duration-300 flex items-center gap-3 border-2 border-blue-500"
                aria-label="Navigate to individual performance view"
                style={{
                  background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                  boxShadow: '0 8px 25px rgba(37, 99, 235, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.1)'
                }}
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                View Individual Performance
              </button>
            </div>
          </div>
        </div>
      </section>

      </div>
    </>
  );
};

export default Dashboard;
