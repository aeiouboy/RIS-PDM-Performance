import React, { useMemo, useCallback } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { fmt, pct } from '../utils/formatNumber';
import ChartTooltip from './ChartTooltip';
import { HEADINGS, getBurndownStatus } from '../utils/copyGlossary';
import InfoTooltip from './InfoTooltip';


const SprintBurndownChart = React.memo(({
  data = [],
  loading = false,
  height = 300,
  showIdealLine = true,
  units = 'storyPoints',
  showScopeTrend = false,
  className = ''
}) => {
  const unitLabel = units === 'workItems' ? 'items' : 'pts';
  const yAxisLabel = units === 'workItems' ? 'Work Items' : 'Story Points';
  // Validate data before processing
  const validateData = useCallback((inputData) => {
    if (!Array.isArray(inputData)) {
      console.warn('SprintBurndownChart: Invalid data format - expected array');
      return [];
    }

    // Filter out invalid entries
    return inputData.filter(item => {
      if (!item || typeof item !== 'object') return false;

      // Check required fields
      const hasRequiredFields =
        (item.date || item.day !== undefined) &&
        (item.actualRemaining !== undefined || item.idealRemaining !== undefined);

      if (!hasRequiredFields) {
        console.warn('SprintBurndownChart: Invalid data entry', item);
        return false;
      }

      return true;
    });
  }, []);

  // Memoize chart data to prevent unnecessary recalculations
  const chartData = useMemo(() => {
    // Validate and filter data
    const validatedData = validateData(data);

    // Only show real data - don't fall back to sample data
    return validatedData.length > 0 ? validatedData : [];
  }, [data, validateData]);

  // Memoize calculated values
  const chartMetrics = useMemo(() => {
    if (!chartData.length) return { maxValue: 0, currentActual: 0, currentIdeal: 0, completed: 0, sprintProgress: 0 };

    const maxValue = Math.max(...chartData.map(d => Math.max(d.idealRemaining || 0, d.actualRemaining || 0)));
    const initialActual = chartData[0]?.actualRemaining || 0;
    const currentActual = chartData[chartData.length - 1]?.actualRemaining || 0;
    const currentIdeal = chartData[chartData.length - 1]?.idealRemaining || 0;
    const completed = Math.max(0, initialActual - currentActual);
    const sprintProgress = initialActual > 0 ? (completed / initialActual) * 100 : 0;

    return { maxValue, currentActual, currentIdeal, completed, sprintProgress };
  }, [chartData]);

  // Custom tooltip using shared ChartTooltip primitive
  const CustomTooltip = useCallback(({ active, payload, label }) => {
    if (!active || !payload || !payload.length) return null;
    const data = payload[0].payload;
    const variance = (data.actualRemaining ?? 0) - (data.idealRemaining ?? 0);
    const isAhead = variance < 0;

    const entries = payload.map((entry) => ({
      label: entry.name,
      value: entry.value,
      unit: unitLabel,
    }));

    const footer = Math.abs(variance) > 0.1
      ? {
          text: isAhead
            ? `${fmt(Math.abs(variance))} ${unitLabel} ahead of schedule`
            : `${fmt(Math.abs(variance))} ${unitLabel} behind schedule`,
          tone: isAhead ? 'good' : 'behind',
        }
      : undefined;

    return (
      <ChartTooltip
        title={`Day ${data.day ?? label}`}
        subtitle={data.date}
        entries={entries}
        footer={footer}
      />
    );
  }, [unitLabel]);

  if (loading) {
    return (
      <div className={`bg-white border border-slate-200 border-l-4 border-l-blue-500 shadow-md rounded-xl p-6 h-full ${className}`}>
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

        <div className="relative bg-slate-50 rounded-lg h-64 sm:h-72">
          <div className="absolute inset-0 flex items-end justify-between p-4">
            {[...Array(8)].map((_, i) => (
              <div
                key={i}
                className="bg-slate-200 rounded-t animate-pulse"
                style={{
                  height: `${[20, 45, 65, 80, 55, 70, 40, 30][i] ?? 50}%`,
                  width: '12px',
                  animationDelay: `${i * 0.1}s`
                }}
              />
            ))}
          </div>

          <div className="absolute inset-0 flex items-center justify-center bg-white/80 backdrop-blur-sm">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-slate-300 border-t-blue-500 mx-auto mb-2"></div>
              <p className="text-sm text-slate-500">Loading chart data...</p>
            </div>
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-slate-100">
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

  const { currentActual, currentIdeal, completed, sprintProgress } = chartMetrics;

  // Show "No Data" state when chartData is empty
  if (chartData.length === 0) {
    return (
      <div className={`bg-white border border-slate-200 border-l-4 border-l-blue-500 shadow-md rounded-xl p-6 h-full ${className}`}>
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-slate-900">Sprint Burndown</h3>
          <p className="text-sm text-slate-500 mt-1">Sprint burndown chart shows story point completion over time</p>
        </div>
        <div className="flex items-center justify-center bg-slate-50/50 rounded-lg h-64 sm:h-72">
          <div className="text-center max-w-sm mx-auto p-6">
            <div className="w-16 h-16 mx-auto mb-4 text-slate-300">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-full h-full">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <h4 className="text-base font-medium text-slate-900 mb-2">No Burndown Data</h4>
            <p className="text-sm text-slate-500 mb-4">Start tracking your sprint progress to see the burndown chart</p>
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
    <div className={`bg-white border border-slate-200 border-l-4 border-l-blue-500 shadow-md rounded-xl p-6 h-full ${className}`}>
      {/* Header */}
      <div className="mb-5">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-4">
          <div>
            <h3 className="text-lg font-semibold tracking-tight text-slate-900" title={HEADINGS.sprintBurndown.subtitle}>{HEADINGS.sprintBurndown.title}</h3>
          </div>
          <div className="flex items-center gap-4 flex-shrink-0">
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 bg-blue-500 rounded-full"></div>
              <span className="text-xs font-medium text-slate-500">Actual</span>
            </div>
            {showIdealLine && (
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 border-2 border-dashed border-slate-400 rounded-full"></div>
                <span className="text-xs font-medium text-slate-500">Ideal</span>
              </div>
            )}
            {showScopeTrend && chartData.some(d => d.totalScope !== undefined) && (
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 border-2 border-dotted border-slate-300 rounded-full"></div>
                <span className="text-xs font-medium text-slate-500">Scope</span>
              </div>
            )}
            {(() => {
              const status = getBurndownStatus(currentActual, currentIdeal, chartData[0]?.actualRemaining);
              return (
                <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold border ${status.bg} ${status.text_cls} ${status.border}`}>
                  <span>{status.icon}</span>
                  <span>{status.text}</span>
                </div>
              );
            })()}
          </div>
        </div>
      </div>

      {/* Plain-language interpretation */}
      <div className="flex items-start gap-1.5 mb-4 -mt-1">
        <p className="text-sm text-slate-600">
          {(() => {
            const initial = chartData[0]?.actualRemaining || 0;
            const variance = currentActual - currentIdeal;
            const ratio = Math.abs(variance) / Math.max(initial, 1);
            if (initial <= 0) return 'No burndown data yet for this sprint.';
            if (ratio <= 0.05) return `On track — actual work is tracking close to the ideal line, with ${fmt(currentActual)} ${unitLabel} left.`;
            if (variance > 0) return `Behind — ${fmt(currentActual)} ${unitLabel} still remain, well above the ideal of ${fmt(currentIdeal)}. Little has burned down.`;
            return `Ahead — only ${fmt(currentActual)} ${unitLabel} remain, below the ideal of ${fmt(currentIdeal)}.`;
          })()}
        </p>
        <InfoTooltip
          label="What do the lines mean?"
          content="Ideal = the straight line if work burned down evenly each day. Actual = work still remaining. Above the ideal line = behind schedule; below = ahead."
        />
      </div>

      {/* Chart */}
      <div className="h-64 sm:h-72">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis
              dataKey="day"
              tick={{ fontSize: 11, fill: '#64748b' }}
              axisLine={{ stroke: '#e2e8f0' }}
              tickLine={{ stroke: '#e2e8f0' }}
            />
            <YAxis
              tick={{ fontSize: 11, fill: '#64748b' }}
              axisLine={{ stroke: '#e2e8f0' }}
              tickLine={{ stroke: '#e2e8f0' }}
              label={{ value: yAxisLabel, angle: -90, position: 'insideLeft', style: { textAnchor: 'middle', fill: '#64748b', fontSize: 11 } }}
            />
            <Tooltip content={<CustomTooltip />} />

            {/* Zero line reference */}
            <ReferenceLine y={0} stroke="#e2e8f0" strokeDasharray="2 2" />

            {/* Ideal burndown line */}
            {showIdealLine && (
              <Line
                type="linear"
                dataKey="idealRemaining"
                stroke="#475569"
                strokeWidth={2}
                strokeDasharray="8 4"
                dot={false}
                name="Ideal Burndown"
                connectNulls={false}
                strokeOpacity={0.8}
              />
            )}

            {/* Scope trendline (optional) */}
            {showScopeTrend && chartData.some(d => d.totalScope !== undefined) && (
              <Line
                type="linear"
                dataKey="totalScope"
                stroke="#cbd5e1"
                strokeWidth={1}
                strokeDasharray="2 4"
                dot={false}
                name="Scope"
                connectNulls={false}
              />
            )}

            {/* Actual burndown line */}
            <Line
              type="monotone"
              dataKey="actualRemaining"
              stroke="#3b82f6"
              strokeWidth={3}
              dot={{
                fill: '#3b82f6',
                strokeWidth: 2,
                r: 4,
                filter: 'drop-shadow(0 2px 4px rgba(59, 130, 246, 0.3))'
              }}
              activeDot={{
                r: 6,
                fill: '#3b82f6',
                stroke: '#fff',
                strokeWidth: 2,
                filter: 'drop-shadow(0 4px 8px rgba(59, 130, 246, 0.4))'
              }}
              name="Actual Burndown"
              connectNulls={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Footer Stats */}
      <div className="mt-4 pt-4 border-t border-slate-100">
        <div className="flex divide-x divide-slate-200">
          <div className="flex-1 px-4 first:pl-0 last:pr-0">
            <div className="text-[10px] text-slate-500 uppercase tracking-wide mb-1">Remaining</div>
            <div className="text-xl font-semibold text-slate-900" aria-label={`${fmt(currentActual)} ${unitLabel} remaining`}>{fmt(currentActual)} <span className="text-sm font-normal text-slate-400">{unitLabel}</span></div>
          </div>
          <div className="flex-1 px-4 first:pl-0 last:pr-0">
            <div className="text-[10px] text-slate-500 uppercase tracking-wide mb-1">Completed</div>
            <div className="text-xl font-semibold text-slate-900" aria-label={`${fmt(completed)} ${unitLabel} completed`}>{fmt(completed)} <span className="text-sm font-normal text-slate-400">{unitLabel}</span></div>
          </div>
          <div className="flex-1 px-4 first:pl-0 last:pr-0">
            <div className="text-[10px] text-slate-500 uppercase tracking-wide mb-1">Progress</div>
            <div className="text-xl font-semibold text-slate-900" aria-label={`${pct(sprintProgress)} progress`}>{pct(sprintProgress)}<span className="text-sm font-normal text-slate-400"></span></div>
          </div>
        </div>
      </div>
    </div>
  );
});

// Set display name for better debugging
SprintBurndownChart.displayName = 'SprintBurndownChart';

// Error Boundary for the chart
class ChartErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('SprintBurndownChart error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 px-4 py-3 rounded-xl">
          <div className="flex items-center">
            <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <span>Error rendering burndown chart. Invalid data format.</span>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Export wrapped component
const SprintBurndownChartWithErrorBoundary = (props) => (
  <ChartErrorBoundary>
    <SprintBurndownChart {...props} />
  </ChartErrorBoundary>
);

export default SprintBurndownChartWithErrorBoundary;
