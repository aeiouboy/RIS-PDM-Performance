import React, { useState, useEffect } from 'react';
import apiClient from '../lib/apiClient';
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
import SprintOverviewCard from '../components/SprintOverviewCard';
import SprintHealthCard from '../components/SprintHealthCard';
import CurrentSprintByAssignee from '../components/CurrentSprintByAssignee';
import useSwipeNavigation from '../hooks/useSwipeNavigation.jsx';

const Dashboard = () => {
  // Filter states
  const [selectedProduct, setSelectedProduct] = useState('Product - Slick Picking Tool');
  const [selectedSprint, setSelectedSprint] = useState('current');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Reset filters function
  const handleResetFilters = () => {
    setSelectedProduct('Product - Slick Picking Tool');
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

        const response = await apiClient.get(`/api/metrics/sprints?${params.toString()}`);
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
  // Removed getSprintIterationPath - backend now handles iteration resolution
  // Simply pass sprint IDs to API calls and let backend resolve the proper iteration path
  
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
  const [fallbackLoading, setFallbackLoading] = useState(false);
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
  const loading = realtimeLoading || fallbackLoading;
  const error = realtimeError || fallbackError;
  

  // Helper function to normalize project ID for API calls
  const normalizeProjectId = (projectId) => {
    // Ensure we never send just "Product" - always use the full name
    if (projectId === 'Product' || projectId === 'product') {
      return 'Product - Slick Picking Tool';
    }
    return projectId;
  };

  // Fallback API call — re-fetches whenever filters or forceTs change
  useEffect(() => {
    const fetchFallbackData = async () => {
      try {
        setFallbackLoading(true);
        setFallbackError(null);

        const params = new URLSearchParams({
          ...(selectedProduct && selectedProduct !== 'all-projects' && { productId: normalizeProjectId(selectedProduct) }),
          ...(selectedSprint && selectedSprint !== 'all-sprints' && { sprintId: selectedSprint }),
          ...(forceTs ? { noCache: 'true', _: String(forceTs) } : {})
        });
        const qs = params.toString();

        const response = await apiClient.get(`/api/metrics/overview${qs ? `?${qs}` : ''}`, {
          timeout: 10000,
        });

        if (response.data && response.data.data) {
          setFallbackData(response.data.data);
        } else {
          console.error('📊 Invalid response structure:', response.data);
          setFallbackError('Invalid data structure received');
        }
      } catch (err) {
        console.error('📊 Fallback fetch error:', err);
        setFallbackError(`Failed to load dashboard data: ${err.message}`);
      } finally {
        setFallbackLoading(false);
      }
    };

    fetchFallbackData();
  }, [selectedProduct, selectedSprint, forceTs]);

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
        
        const response = await apiClient.get(`/api/metrics/kpis?${params}`);
        setKpiData(response.data.data);
      } catch (error) {
        console.error('❌ Error fetching KPI data:', error);
        setKpiData(null);
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
        
        const response = await apiClient.get(`/api/metrics/burndown?${params}`);
        setBurndownData(response.data.data);
      } catch (error) {
        console.error('❌ Error fetching burndown data:', error);
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
        
        const response = await apiClient.get(`/api/metrics/velocity-trend?${params}`);
        setVelocityTrendData(response.data.data);
      } catch (error) {
        console.error('❌ Error fetching velocity trend data:', error);
        setVelocityTrendData([]); // Empty array will show "no data" state instead of sample data
      } finally {
        setComponentLoading(prev => ({ ...prev, velocity: false }));
      }
    };

    fetchVelocityTrend();
  }, [selectedProduct, forceTs]);


  if (loading) {
    return (
      <div className="dashboard-container py-8 bg-slate-50 min-h-screen flex items-center justify-center">
        <div className="text-center animate-fade-in">
          <div className="animate-spin rounded-full h-10 w-10 border-2 border-slate-200 border-t-blue-600 mx-auto mb-4"></div>
          <p className="text-sm text-slate-600">Loading Dashboard…</p>
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
        className="dashboard-container bg-slate-50 py-8 px-4 max-w-screen-2xl mx-auto animate-fade-in"
        ref={(el) => swipeNavigation.bindSwipeHandlers(el)}
        role="main"
        id="main-content"
        aria-label="Performance Dashboard"
      >
      {/* Compact action row — title moved to global Header; this row keeps page-level controls only */}
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <div className="flex items-center gap-3 min-w-0">
          <RealtimeStatus showDetails={true} showControls={true} />
          {updateCount > 0 && connected && (
            <span className="text-xs text-slate-500 hidden sm:inline">
              <LastUpdateIndicator lastUpdate={lastUpdate} />
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
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
          <ExportButtons exportType="dashboard" period="sprint" className="flex-shrink-0" />
          {!connected && (
            <button
              onClick={refresh}
              disabled={loading}
              className="btn-secondary text-xs h-8 px-3 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Refreshing…' : 'Refresh Data'}
            </button>
          )}
        </div>
      </div>

      {/* Filter Bar — sticky on desktop only; tighter on tablet to avoid eating viewport */}
      <div className="lg:sticky lg:top-0 z-30 py-2 bg-white/85 backdrop-blur-md border-b border-slate-200 mb-6 rounded-lg px-4">
        {/* Single-row filter layout — no separate labels (controls already self-label) + reset inline */}
        <div className="flex items-center gap-2 flex-wrap md:flex-nowrap">
          <div className="flex-1 min-w-[160px]">
            <ProductSelector selectedProduct={selectedProduct} onProductChange={setSelectedProduct} />
          </div>
          <div className="flex-1 min-w-[160px]">
            <SprintFilter
              selectedSprint={selectedSprint}
              onSprintChange={setSelectedSprint}
              selectedProject={selectedProduct}
            />
          </div>
          <div className="flex-1 min-w-[160px]">
            <DateRangePicker startDate={startDate} endDate={endDate} onDateRangeChange={handleDateRangeChange} />
          </div>
          <button
            onClick={handleResetFilters}
            className="p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700 rounded-md transition-colors flex-shrink-0"
            aria-label="Reset all filters"
            title="Reset filters"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>
      </div>

      {/* Sprint Snapshot - single-project only: Health + Overview side-by-side */}
      {selectedProduct !== 'all-projects' && (
        <section className="mb-8 grid grid-cols-1 md:grid-cols-2 gap-6" aria-label="Sprint snapshot">
          <SprintHealthCard
            productId={normalizeProjectId(selectedProduct)}
            sprintId={selectedSprint}
          />
          <SprintOverviewCard
            productId={normalizeProjectId(selectedProduct)}
            sprintId={selectedSprint}
          />
        </section>
      )}

      {/* KPI Cards Section - Enhanced Layout with Staggered Animation */}
      <section className="mb-8" role="region" aria-label="Key sprint metrics">
        <div className="flex justify-end mb-6">
          <div className="text-sm text-gray-500 flex items-center gap-2" role="status" aria-live="polite">
            <div className="w-2 h-2 bg-success-500 rounded-full animate-pulse" aria-hidden="true"></div>
            <span>Live data</span>
          </div>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-4">
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


      {/* Charts Section - Burndown 60% + Velocity 40% side-by-side above xl */}
      <section className="mb-8" role="region" aria-label="Sprint progress charts">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Sprint Burndown Chart Card - Glassmorphism (3/5 width) */}
          <div
            className="lg:col-span-3 group relative backdrop-blur-lg bg-white/80 rounded-2xl border border-white/20 shadow-xl hover:shadow-2xl hover:scale-[1.01] transition-all duration-300 overflow-hidden p-6"
            style={{
              background: 'linear-gradient(135deg, rgba(255,255,255,0.9) 0%, rgba(255,255,255,0.7) 100%)',
              boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.15)'
            }}
          >
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary-400 to-primary-600"></div>
            <SprintBurndownChart
              data={burndownData}
              loading={componentLoading.burndown}
              units="storyPoints"
              height={280}
              className="animate-fade-in"
              style={{ animationDelay: '0.1s' }}
            />
          </div>

          {/* Velocity Trend Chart Card (2/5 width) */}
          <div
            className="lg:col-span-2 group relative backdrop-blur-lg bg-white/80 rounded-2xl border border-white/20 shadow-xl hover:shadow-2xl hover:scale-[1.01] transition-all duration-300 overflow-hidden p-6"
            style={{
              background: 'linear-gradient(135deg, rgba(255,255,255,0.9) 0%, rgba(255,255,255,0.7) 100%)',
              boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.15)'
            }}
          >
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary-400 to-primary-600"></div>
            <TeamVelocityChart
              data={velocityTrendData}
              loading={componentLoading.velocity}
              units="workItems"
              height={280}
              className="animate-fade-in"
              style={{ animationDelay: '0.2s' }}
            />
          </div>
        </div>
      </section>


      {/* This Sprint by Person - single-project only */}
      {selectedProduct !== 'all-projects' && (
        <section className="mb-8" aria-label="This Sprint by Person">
          <CurrentSprintByAssignee
            productId={normalizeProjectId(selectedProduct)}
            sprintId={selectedSprint}
          />
        </section>
      )}

      {/* Task Distribution & Bug Classification Section - Glassmorphism Card */}
      <section className="mb-8" role="region" aria-label="Work Item Breakdown">
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
            sprintId={selectedSprint}
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
