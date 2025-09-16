import React, { useMemo, useCallback } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';


const SprintBurndownChart = React.memo(({ 
  data = [], 
  loading = false, 
  height = 300, 
  showIdealLine = true,
  className = '' 
}) => {
  // Memoize chart data to prevent unnecessary recalculations
  const chartData = useMemo(() => {
    // Only show real data - don't fall back to sample data
    return data.length > 0 ? data : [];
  }, [data]);

  // Memoize calculated values
  const chartMetrics = useMemo(() => {
    if (!chartData.length) return { maxValue: 0, currentActual: 0, currentIdeal: 0, sprintProgress: 0 };
    
    const maxValue = Math.max(...chartData.map(d => Math.max(d.idealRemaining || 0, d.actualRemaining || 0)));
    const currentActual = chartData[chartData.length - 1]?.actualRemaining || 0;
    const currentIdeal = chartData[chartData.length - 1]?.idealRemaining || 0;
    const sprintProgress = ((chartData[0]?.actualRemaining || 0) - currentActual) / (chartData[0]?.actualRemaining || 1) * 100;
    
    return { maxValue, currentActual, currentIdeal, sprintProgress };
  }, [chartData]);

  // Enhanced custom tooltip with better visual design
  const CustomTooltip = useCallback(({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      const variance = data.actualRemaining - data.idealRemaining;
      const isAhead = variance < 0;
      const isBehind = variance > 0;

      return (
        <div className="bg-white p-4 border border-gray-200 rounded-xl shadow-lg backdrop-blur-sm">
          {/* Header */}
          <div className="flex items-center justify-between mb-3">
            <p className="font-semibold text-gray-900">{data.date || label}</p>
            <div className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
              Day {data.day || label}
            </div>
          </div>

          {/* Metrics */}
          <div className="space-y-2 mb-3">
            {payload.map((entry, index) => (
              <div key={index} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full shadow-sm"
                    style={{ backgroundColor: entry.color }}
                  />
                  <span className="text-sm font-medium text-gray-700">{entry.name}</span>
                </div>
                <span className="text-sm font-bold text-gray-900 bg-gray-50 px-2 py-1 rounded">
                  {entry.value} pts
                </span>
              </div>
            ))}
          </div>

          {/* Status indicator */}
          {Math.abs(variance) > 0.1 && (
            <div className={`mt-3 pt-3 border-t border-gray-100 text-sm font-medium flex items-center gap-2 ${
              isAhead ? 'text-success-600' : 'text-error-600'
            }`}>
              <div className={`w-2 h-2 rounded-full ${
                isAhead ? 'bg-success-500' : 'bg-error-500'
              }`}></div>
              {isAhead ?
                `${Math.abs(variance).toFixed(1)} pts ahead of schedule` :
                `${variance.toFixed(1)} pts behind schedule`
              }
            </div>
          )}

          {Math.abs(variance) <= 0.1 && (
            <div className="mt-3 pt-3 border-t border-gray-100 text-sm font-medium flex items-center gap-2 text-primary-600">
              <div className="w-2 h-2 rounded-full bg-primary-500"></div>
              Right on track
            </div>
          )}
        </div>
      );
    }
    return null;
  }, []);

  if (loading) {
    return (
      <div className={`dashboard-card ${className}`}>
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="skeleton h-6 w-48"></div>
            <div className="flex items-center space-x-4">
              <div className="skeleton h-4 w-16"></div>
              <div className="skeleton h-4 w-16"></div>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="skeleton h-4 w-32"></div>
              <div className="skeleton h-4 w-24"></div>
            </div>
            <div className="skeleton h-6 w-20 rounded-full"></div>
          </div>
        </div>

        <div className="relative bg-gray-50 rounded-lg" style={{ height }}>
          <div className="absolute inset-0 flex items-end justify-between p-4">
            {[...Array(8)].map((_, i) => (
              <div
                key={i}
                className="bg-gray-200 rounded-t animate-pulse"
                style={{
                  height: `${Math.random() * 80 + 20}%`,
                  width: '12px',
                  animationDelay: `${i * 0.1}s`
                }}
              />
            ))}
          </div>

          {/* Loading Overlay */}
          <div className="absolute inset-0 flex items-center justify-center bg-white/80 backdrop-blur-sm">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-gray-300 border-t-primary-600 mx-auto mb-2"></div>
              <p className="text-sm text-gray-600">Loading chart data...</p>
            </div>
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-gray-200">
          <div className="grid grid-cols-3 gap-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="text-center">
                <div className="skeleton h-8 w-12 mx-auto mb-2"></div>
                <div className="skeleton h-3 w-16 mx-auto"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const { currentActual, currentIdeal, sprintProgress } = chartMetrics;

  // Show "No Data" state when chartData is empty
  if (chartData.length === 0) {
    return (
      <div className={`dashboard-card ${className}`}>
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-gray-900">Sprint Burndown</h3>
          <p className="text-sm text-gray-500">Sprint burndown chart shows story point completion over time</p>
        </div>
        <div className="flex items-center justify-center bg-gray-50/50 rounded-lg" style={{ height }}>
          <div className="text-center max-w-sm mx-auto p-6">
            <div className="w-16 h-16 mx-auto mb-4 text-gray-300">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-full h-full">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <h4 className="text-base font-medium text-gray-900 mb-2">No Burndown Data</h4>
            <p className="text-sm text-gray-500 mb-4">Start tracking your sprint progress to see the burndown chart</p>
            <button className="btn-secondary text-sm">
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Refresh Data
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`dashboard-card ${className}`}>
      {/* Header */}
      <div className="mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-1">Sprint Burndown</h3>
            <p className="text-sm text-gray-500">Track story point completion over time</p>
          </div>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-primary-500 rounded-full"></div>
              <span className="text-sm font-medium text-gray-600">Actual</span>
            </div>
            {showIdealLine && (
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 border-2 border-dashed border-gray-400 rounded-full"></div>
                <span className="text-sm font-medium text-gray-600">Ideal</span>
              </div>
            )}
          </div>
        </div>

        {/* Progress Summary */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-4 bg-gray-50/50 rounded-lg">
          <div className="flex flex-wrap items-center gap-6">
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">Remaining:</span>
              <span className="font-bold text-lg text-primary-600">{currentActual} pts</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">Progress:</span>
              <span className="font-bold text-lg text-success-600">{sprintProgress.toFixed(1)}%</span>
            </div>
          </div>
          <div className={`px-3 py-1.5 rounded-full text-xs font-semibold ${
            currentActual <= currentIdeal
              ? 'bg-success-100 text-success-700 border border-success-200'
              : 'bg-error-100 text-error-700 border border-error-200'
          }`}>
            {currentActual <= currentIdeal ? '✓ On Track' : '⚠ Behind Schedule'}
          </div>
        </div>
      </div>

      {/* Chart */}
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis 
              dataKey="day"
              tick={{ fontSize: 12, fill: '#6b7280' }}
              axisLine={{ stroke: '#e5e7eb' }}
              tickLine={{ stroke: '#e5e7eb' }}
            />
            <YAxis 
              tick={{ fontSize: 12, fill: '#6b7280' }}
              axisLine={{ stroke: '#e5e7eb' }}
              tickLine={{ stroke: '#e5e7eb' }}
              label={{ value: 'Story Points', angle: -90, position: 'insideLeft', style: { textAnchor: 'middle', fill: '#6b7280' } }}
            />
            <Tooltip content={<CustomTooltip />} />
            
            {/* Zero line reference */}
            <ReferenceLine y={0} stroke="#e5e7eb" strokeDasharray="2 2" />
            
            {/* Ideal burndown line with enhanced styling */}
            {showIdealLine && (
              <Line
                type="linear"
                dataKey="idealRemaining"
                stroke="#6b7280"
                strokeWidth={2}
                strokeDasharray="8 4"
                dot={false}
                name="Ideal Burndown"
                connectNulls={false}
                strokeOpacity={0.8}
              />
            )}

            {/* Actual burndown line with gradient effect */}
            <Line
              type="monotone"
              dataKey="actualRemaining"
              stroke="url(#burndownGradient)"
              strokeWidth={3}
              dot={{
                fill: '#2563eb',
                strokeWidth: 2,
                r: 4,
                filter: 'drop-shadow(0 2px 4px rgba(37, 99, 235, 0.3))'
              }}
              activeDot={{
                r: 7,
                fill: '#2563eb',
                stroke: '#fff',
                strokeWidth: 3,
                filter: 'drop-shadow(0 4px 8px rgba(37, 99, 235, 0.4))'
              }}
              name="Actual Burndown"
              connectNulls={false}
            />

            {/* Gradient definition */}
            <defs>
              <linearGradient id="burndownGradient" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#3b82f6" />
                <stop offset="100%" stopColor="#2563eb" />
              </linearGradient>
            </defs>
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Enhanced Footer Stats */}
      <div className="mt-6 pt-6 border-t border-gray-200">
        <div className="grid grid-cols-3 gap-3 sm:gap-6">
          <div className="text-center p-3 sm:p-4 bg-primary-50/50 rounded-lg">
            <div className="text-xl sm:text-2xl font-bold text-primary-600 mb-1" aria-label={`${currentActual} story points remaining`}>{currentActual}</div>
            <div className="text-xs sm:text-sm font-medium text-gray-600">Remaining</div>
          </div>
          <div className="text-center p-3 sm:p-4 bg-success-50/50 rounded-lg">
            <div className="text-xl sm:text-2xl font-bold text-success-600 mb-1" aria-label={`${((chartData[0]?.idealRemaining || 0) - currentActual).toFixed(0)} story points completed`}>
              {((chartData[0]?.idealRemaining || 0) - currentActual).toFixed(0)}
            </div>
            <div className="text-xs sm:text-sm font-medium text-gray-600">Completed</div>
          </div>
          <div className="text-center p-3 sm:p-4 bg-warning-50/50 rounded-lg">
            <div className="text-xl sm:text-2xl font-bold text-warning-600 mb-1" aria-label={`${sprintProgress.toFixed(0)} percent progress`}>{sprintProgress.toFixed(0)}%</div>
            <div className="text-xs sm:text-sm font-medium text-gray-600">Progress</div>
          </div>
        </div>
      </div>
    </div>
  );
});

// Set display name for better debugging
SprintBurndownChart.displayName = 'SprintBurndownChart';

export default SprintBurndownChart;