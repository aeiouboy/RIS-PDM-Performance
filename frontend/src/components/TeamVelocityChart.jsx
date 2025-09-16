import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Bar, BarChart, ComposedChart, ReferenceLine } from 'recharts';

const TeamVelocityChart = ({ 
  data = [], 
  loading = false, 
  height = 300,
  showCommitmentLine = true,
  showTrendLine = true,
  className = '' 
}) => {

  // Only use real data - don't fall back to sample data
  const chartData = data.length > 0 ? data : [];
  
  // Calculate statistics only if we have data
  const averageVelocity = chartData.length > 0 ? chartData.reduce((sum, item) => sum + item.velocity, 0) / chartData.length : 0;
  const lastThreeAvg = chartData.length >= 3 ? chartData.slice(-3).reduce((sum, item) => sum + item.velocity, 0) / 3 : averageVelocity;
  const trend = chartData.length > 1 ? 
    ((chartData[chartData.length - 1].velocity - chartData[0].velocity) / chartData[0].velocity) * 100 : 0;
  
  const predictability = chartData.length > 0 ? chartData.reduce((sum, item) => {
    return sum + (item.commitment ? (Math.min(item.velocity, item.commitment) / item.commitment) : 1);
  }, 0) / chartData.length * 100 : 0;

  // Enhanced custom tooltip with better design
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const sprintData = payload[0].payload;
      const achievement = sprintData.commitment ?
        ((sprintData.velocity / sprintData.commitment) * 100) : 0;
      const isOverAchieved = achievement > 100;
      const isUnderAchieved = achievement < 80;

      return (
        <div className="bg-white p-4 border border-gray-200 rounded-xl shadow-lg backdrop-blur-sm">
          {/* Header */}
          <div className="flex items-center justify-between mb-3">
            <p className="font-semibold text-gray-900">{label}</p>
            {sprintData.commitment && (
              <div className={`text-xs px-2 py-1 rounded-full font-medium ${
                isOverAchieved
                  ? 'bg-success-100 text-success-700'
                  : isUnderAchieved
                  ? 'bg-warning-100 text-warning-700'
                  : 'bg-primary-100 text-primary-700'
              }`}>
                {achievement.toFixed(1)}% achieved
              </div>
            )}
          </div>

          {/* Metrics */}
          <div className="space-y-2">
            {payload.map((entry, index) => (
              <div key={index} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full shadow-sm"
                    style={{ backgroundColor: entry.color }}
                  />
                  <span className="text-sm font-medium text-gray-700 capitalize">
                    {entry.dataKey === 'velocity' ? 'Delivered' : 'Committed'}
                  </span>
                </div>
                <span className="text-sm font-bold text-gray-900 bg-gray-50 px-2 py-1 rounded">
                  {Number(entry.value).toFixed(1)} pts
                </span>
              </div>
            ))}
          </div>

          {/* Achievement status */}
          {sprintData.commitment && (
            <div className="mt-3 pt-3 border-t border-gray-100">
              <div className={`text-sm font-medium flex items-center gap-2 ${
                isOverAchieved
                  ? 'text-success-600'
                  : isUnderAchieved
                  ? 'text-warning-600'
                  : 'text-primary-600'
              }`}>
                <div className={`w-2 h-2 rounded-full ${
                  isOverAchieved
                    ? 'bg-success-500'
                    : isUnderAchieved
                    ? 'bg-warning-500'
                    : 'bg-primary-500'
                }`}></div>
                {isOverAchieved && 'Exceeded commitment'}
                {isUnderAchieved && 'Below target achievement'}
                {!isOverAchieved && !isUnderAchieved && 'Good achievement rate'}
              </div>
            </div>
          )}
        </div>
      );
    }
    return null;
  };

  if (loading) {
    return (
      <div className={`dashboard-card ${className}`}>
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="skeleton h-6 w-56"></div>
            <div className="flex items-center space-x-4">
              <div className="skeleton h-4 w-16"></div>
              <div className="skeleton h-4 w-20"></div>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="skeleton h-4 w-24"></div>
              <div className="skeleton h-4 w-28"></div>
            </div>
            <div className="flex items-center space-x-3">
              <div className="skeleton h-6 w-16 rounded-full"></div>
              <div className="skeleton h-6 w-24 rounded-full"></div>
            </div>
          </div>
        </div>

        <div className="relative bg-gray-50 rounded-lg" style={{ height }}>
          <div className="absolute inset-0 flex items-end justify-between p-4">
            {[...Array(6)].map((_, i) => (
              <div
                key={i}
                className="bg-gray-200 rounded-t animate-pulse"
                style={{
                  height: `${Math.random() * 80 + 20}%`,
                  width: '16px',
                  animationDelay: `${i * 0.15}s`
                }}
              />
            ))}
          </div>

          {/* Loading Overlay */}
          <div className="absolute inset-0 flex items-center justify-center bg-white/80 backdrop-blur-sm">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-gray-300 border-t-primary-600 mx-auto mb-2"></div>
              <p className="text-sm text-gray-600">Loading velocity data...</p>
            </div>
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-gray-200">
          <div className="grid grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
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

  // Show "No Data" state when chartData is empty
  if (chartData.length === 0) {
    return (
      <div className={`dashboard-card ${className}`}>
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-gray-900">Team Velocity Trend</h3>
          <p className="text-sm text-gray-500">Track team velocity and delivery predictability over sprints</p>
        </div>
        <div className="flex items-center justify-center bg-gray-50/50 rounded-lg" style={{ height }}>
          <div className="text-center max-w-sm mx-auto p-6">
            <div className="w-16 h-16 mx-auto mb-4 text-gray-300">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-full h-full">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            </div>
            <h4 className="text-base font-medium text-gray-900 mb-2">No Velocity Data</h4>
            <p className="text-sm text-gray-500 mb-4">Complete sprints to see velocity trends and team performance patterns</p>
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
            <h3 className="text-lg font-semibold text-gray-900 mb-1">Team Velocity Trend</h3>
            <p className="text-sm text-gray-500">Track velocity and delivery predictability over sprints</p>
          </div>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-primary-500 rounded-full"></div>
              <span className="text-sm font-medium text-gray-600">Velocity</span>
            </div>
            {showCommitmentLine && (
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-success-500 rounded-full"></div>
                <span className="text-sm font-medium text-gray-600">Commitment</span>
              </div>
            )}
          </div>
        </div>

        {/* Enhanced Summary Stats */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 p-4 bg-gray-50/50 rounded-lg">
          <div className="flex flex-wrap items-center gap-6">
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">Average:</span>
              <span className="font-bold text-lg text-primary-600">{averageVelocity.toFixed(1)} pts</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">Last 3:</span>
              <span className="font-bold text-lg text-secondary-600">{lastThreeAvg.toFixed(1)} pts</span>
            </div>
          </div>
          <div className="flex items-center justify-end gap-3">
            <div className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${
              trend >= 5
                ? 'bg-success-100 text-success-700 border-success-200'
                : trend <= -5
                ? 'bg-error-100 text-error-700 border-error-200'
                : 'bg-gray-100 text-gray-700 border-gray-200'
            }`}>
              {trend >= 0 ? '↗' : '↘'} {Math.abs(trend).toFixed(1)}% trend
            </div>
            <div className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${
              predictability >= 80
                ? 'bg-success-100 text-success-700 border-success-200'
                : predictability >= 60
                ? 'bg-warning-100 text-warning-700 border-warning-200'
                : 'bg-error-100 text-error-700 border-error-200'
            }`}>
              {predictability.toFixed(0)}% predictable
            </div>
          </div>
        </div>
      </div>

      {/* Chart */}
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis 
              dataKey="sprint"
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
            
            {/* Average reference line */}
            <ReferenceLine 
              y={averageVelocity} 
              stroke="#9ca3af" 
              strokeDasharray="4 4"
              label={{ value: `Avg: ${averageVelocity.toFixed(1)}`, position: 'topRight' }}
            />
            
            {/* Enhanced commitment bars with gradient */}
            {showCommitmentLine && (
              <Bar
                dataKey="commitment"
                fill="url(#commitmentGradient)"
                opacity={0.4}
                name="Commitment"
                radius={[4, 4, 0, 0]}
              />
            )}

            {/* Enhanced velocity line with shadow */}
            <Line
              type="monotone"
              dataKey="velocity"
              stroke="url(#velocityGradient)"
              strokeWidth={3}
              dot={{
                fill: '#2563eb',
                strokeWidth: 2,
                r: 5,
                filter: 'drop-shadow(0 2px 4px rgba(37, 99, 235, 0.3))'
              }}
              activeDot={{
                r: 8,
                fill: '#2563eb',
                stroke: '#fff',
                strokeWidth: 3,
                filter: 'drop-shadow(0 4px 8px rgba(37, 99, 235, 0.4))'
              }}
              name="Velocity"
            />

            {/* Enhanced commitment line */}
            {showCommitmentLine && (
              <Line
                type="monotone"
                dataKey="commitment"
                stroke="#059669"
                strokeWidth={2}
                strokeDasharray="6 3"
                dot={{
                  fill: '#059669',
                  strokeWidth: 2,
                  r: 4,
                  opacity: 0.8
                }}
                name="Commitment"
                strokeOpacity={0.9}
              />
            )}

            {/* Gradient definitions */}
            <defs>
              <linearGradient id="velocityGradient" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#3b82f6" />
                <stop offset="100%" stopColor="#2563eb" />
              </linearGradient>
              <linearGradient id="commitmentGradient" x1="0" y1="1" x2="0" y2="0">
                <stop offset="0%" stopColor="#10b981" stopOpacity={0.2} />
                <stop offset="100%" stopColor="#10b981" stopOpacity={0.6} />
              </linearGradient>
            </defs>
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Enhanced Footer Stats */}
      <div className="mt-6 pt-6 border-t border-gray-200">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="text-center p-3 sm:p-4 bg-primary-50/50 rounded-lg">
            <div className="text-xl sm:text-2xl font-bold text-primary-600 mb-1" aria-label={`${chartData[chartData.length - 1]?.velocity || 0} story points in current sprint`}>
              {chartData[chartData.length - 1]?.velocity || 0}
            </div>
            <div className="text-xs sm:text-sm font-medium text-gray-600">Current Sprint</div>
          </div>
          <div className="text-center p-3 sm:p-4 bg-success-50/50 rounded-lg">
            <div className="text-xl sm:text-2xl font-bold text-success-600 mb-1" aria-label={`${averageVelocity.toFixed(1)} story points average velocity`}>
              {averageVelocity.toFixed(1)}
            </div>
            <div className="text-xs sm:text-sm font-medium text-gray-600">Average</div>
          </div>
          <div className="text-center p-3 sm:p-4 bg-secondary-50/50 rounded-lg">
            <div className={`text-xl sm:text-2xl font-bold mb-1 ${trend >= 0 ? 'text-success-600' : 'text-error-600'}`} aria-label={`${trend >= 0 ? 'Positive' : 'Negative'} ${Math.abs(trend).toFixed(1)} percent trend`}>
              {trend >= 0 ? '+' : ''}{trend.toFixed(1)}%
            </div>
            <div className="text-xs sm:text-sm font-medium text-gray-600">Trend</div>
          </div>
          <div className="text-center p-3 sm:p-4 bg-purple-50/50 rounded-lg">
            <div className="text-xl sm:text-2xl font-bold text-purple-600 mb-1" aria-label={`${predictability.toFixed(0)} percent predictability`}>{predictability.toFixed(0)}%</div>
            <div className="text-xs sm:text-sm font-medium text-gray-600">Predictability</div>
          </div>
        </div>
      </div>

      {/* Performance Insights */}
      <div className="mt-4 pt-4 border-t border-gray-200">
        <div className="text-sm text-gray-600">
          <span className="font-medium">Insights: </span>
          {trend >= 10 && <span className="text-green-600">🚀 Strong upward trend in velocity.</span>}
          {trend < -10 && <span className="text-red-600">⚠️ Declining velocity trend needs attention.</span>}
          {Math.abs(trend) < 10 && <span className="text-blue-600">📊 Stable velocity pattern.</span>}
          {predictability >= 80 && <span className="ml-2 text-green-600">High delivery predictability.</span>}
          {predictability < 60 && <span className="ml-2 text-yellow-600">Consider improving sprint planning.</span>}
        </div>
      </div>
    </div>
  );
};

export default TeamVelocityChart;