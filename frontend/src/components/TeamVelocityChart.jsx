import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Bar, BarChart, ComposedChart, ReferenceLine, ReferenceArea } from 'recharts';
import { fmt, fmt0, pct } from '../utils/formatNumber';
import ChartTooltip from './ChartTooltip';
import { STATUS_BADGE, HEADINGS } from '../utils/copyGlossary';
import InfoTooltip from './InfoTooltip';

const TeamVelocityChart = ({
  data = [],
  loading = false,
  height = 300,
  showCommitmentLine = true,
  showTrendLine = true,
  units = 'workItems',
  className = ''
}) => {
  const unitSuffix = units === 'workItems' ? 'items' : 'pts';
  const yAxisLabel = units === 'workItems' ? 'Work Items' : 'Story Points';

  // Only use real data - don't fall back to sample data
  const chartData = data.length > 0 ? data : [];

  // Calculate statistics only if we have data
  const averageVelocity = chartData.length > 0 ? chartData.reduce((sum, item) => sum + item.velocity, 0) / chartData.length : 0;
  const lastThreeAvg = chartData.length >= 3 ? chartData.slice(-3).reduce((sum, item) => sum + item.velocity, 0) / 3 : averageVelocity;
  const trendRaw = chartData.length > 1
    ? (() => {
        const first = chartData[0].velocity;
        const last = chartData[chartData.length - 1].velocity;
        if (first === 0) return last > 0 ? null : 0; // null = "New" case
        return ((last - first) / first) * 100;
      })()
    : 0;
  const trend = (trendRaw === null || !isFinite(trendRaw)) ? 0 : Math.max(-999, Math.min(999, trendRaw));
  const trendIsNew = trendRaw === null || (!isFinite(trendRaw ?? 0) && chartData[chartData.length - 1]?.velocity > 0);

  const predictability = chartData.length > 0 ? chartData.reduce((sum, item) => {
    return sum + (item.commitment ? (Math.min(item.velocity, item.commitment) / item.commitment) : 1);
  }, 0) / chartData.length * 100 : 0;

  // Commitment Reliability: sum(velocity) / sum(commitment) across sprints with commitment > 0
  const totalCommitment = chartData.reduce((sum, item) => sum + (item.commitment || 0), 0);
  const totalVelocity = chartData.reduce((sum, item) => sum + (item.velocity || 0), 0);
  const reliability = totalCommitment > 0 ? Math.round((totalVelocity / totalCommitment) * 100) : null;
  const reliabilityBadge = reliability === null ? null
    : reliability >= 80 ? STATUS_BADGE.good
    : reliability >= 50 ? STATUS_BADGE.warn
    : STATUS_BADGE.critical;

  // Carry-over: unplanned slip as % of commitment (clamped >= 0)
  const carryoverRaw = totalCommitment > 0 ? Math.round(((totalCommitment - totalVelocity) / totalCommitment) * 100) : 0;
  const carryover = Math.max(0, carryoverRaw);

  // Velocity range band (only meaningful with 3+ sprints)
  const velocities = chartData.map(d => d.velocity).filter(v => v != null);
  const minVelocity = velocities.length > 0 ? Math.min(...velocities) : 0;
  const maxVelocity = velocities.length > 0 ? Math.max(...velocities) : 0;
  const showRangeBand = chartData.length >= 3 && maxVelocity > minVelocity;

  // Actionable insight line
  const avgCommitment = totalCommitment > 0 ? totalCommitment / chartData.filter(d => (d.commitment || 0) > 0).length : 0;
  const suggestedReduction = totalCommitment > 0 ? Math.round(avgCommitment - averageVelocity) : 0;
  const showInsightLine = (reliability !== null && reliability < 70) || carryover > 30;

  // Velocity tooltip — delegates rendering to shared ChartTooltip primitive
  const VelocityTooltip = ({ active, payload, label }) => {
    if (!active || !payload || !payload.length) return null;
    const sprintData = payload[0].payload;
    const achievement = sprintData.commitment
      ? (sprintData.velocity / sprintData.commitment) * 100
      : null;
    const badgeTone = achievement === null
      ? null
      : achievement > 100 ? 'good' : achievement < 80 ? 'warn' : 'good';

    return (
      <ChartTooltip
        title={label}
        headerBadge={achievement !== null ? { text: `${fmt(achievement)}% achieved`, tone: badgeTone } : undefined}
        entries={[
          { label: 'Completed', value: sprintData.velocity, unit: unitSuffix },
          ...(sprintData.commitment ? [{ label: 'Planned', value: sprintData.commitment, unit: unitSuffix }] : []),
        ]}
        footer={achievement !== null ? {
          text: achievement > 100 ? 'Exceeded commitment' : achievement < 80 ? 'Below target achievement' : 'Good achievement rate',
          tone: badgeTone,
        } : undefined}
      />
    );
  };

  if (loading) {
    return (
      <div className={`bg-white border border-slate-200 shadow-sm rounded-xl p-6 h-full ${className}`}>
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

        <div className="relative bg-slate-50 rounded-lg h-64 sm:h-72">
          <div className="absolute inset-0 flex items-end justify-between p-4">
            {[...Array(6)].map((_, i) => (
              <div
                key={i}
                className="bg-slate-200 rounded-t animate-pulse"
                style={{
                  height: `${[30, 60, 45, 75, 50, 65][i] ?? 50}%`,
                  width: '16px',
                  animationDelay: `${i * 0.15}s`
                }}
              />
            ))}
          </div>

          <div className="absolute inset-0 flex items-center justify-center bg-white/80 backdrop-blur-sm">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-slate-300 border-t-blue-500 mx-auto mb-2"></div>
              <p className="text-sm text-slate-500">Loading velocity data...</p>
            </div>
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-slate-100">
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
      <div className={`bg-white border border-slate-200 shadow-sm rounded-xl p-6 h-full ${className}`}>
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-slate-900">{HEADINGS.velocityTrend.title}</h3>
          <p className="text-sm text-slate-500 mt-1">{HEADINGS.velocityTrend.subtitle}</p>
        </div>
        <div className="flex items-center justify-center bg-slate-50/50 rounded-lg h-64 sm:h-72">
          <div className="text-center max-w-sm mx-auto p-6">
            <div className="w-16 h-16 mx-auto mb-4 text-slate-300">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-full h-full">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            </div>
            <h4 className="text-base font-medium text-slate-900 mb-2">No Velocity Data</h4>
            <p className="text-sm text-slate-500 mb-4">Complete sprints to see velocity trends and team performance patterns</p>
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
    <div className={`bg-white border border-slate-200 shadow-sm rounded-xl p-6 h-full ${className}`}>
      {/* Header */}
      <div className="mb-5">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-4">
          <div>
            <h3 className="text-lg font-semibold tracking-tight text-slate-900" title={HEADINGS.velocityTrend.subtitle}>{HEADINGS.velocityTrend.title}</h3>
          </div>
          <div className="flex items-center gap-3 flex-wrap flex-shrink-0">
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 bg-indigo-500 rounded-full"></div>
              <span className="text-xs font-medium text-slate-500">Completed</span>
            </div>
            {showCommitmentLine && (
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full"></div>
                <span className="text-xs font-medium text-slate-500">Planned</span>
              </div>
            )}
            <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${
              trend >= 5
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : trend <= -5
                ? 'bg-rose-50 text-rose-700 border-rose-200'
                : 'bg-slate-50 text-slate-600 border-slate-200'
            }`}>
              {trendIsNew ? '✦ New' : `${trend >= 0 ? '↗' : '↘'} ${fmt(Math.abs(trend))}%`}
            </div>
            {reliabilityBadge && (
              <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${reliabilityBadge.bg} ${reliabilityBadge.text_cls} ${reliabilityBadge.border}`}>
                {reliability}% reliable
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Plain-language interpretation */}
      <div className="flex items-start gap-1.5 mb-4 -mt-1">
        <p className="text-sm text-slate-600">
          {(() => {
            if (reliability === null) return 'Not enough sprint history yet to judge velocity reliability.';
            const r = reliability >= 80 ? 'delivers close to what it commits'
              : reliability >= 50 ? `delivers about ${reliability}% of what it commits`
              : 'delivers under half of what it commits';
            const c = carryover > 30 ? `, and carries ${carryover}% of work over to the next sprint` : '';
            return `Over recent sprints the team ${r}${c}.`;
          })()}
        </p>
        <InfoTooltip
          label="What do reliable and carry-over mean?"
          content="Reliable = delivered ÷ committed across recent sprints (higher is better; Good ≥ 80%). Carry-over = committed work that slipped to the next sprint (lower is better; watch above 30%)."
        />
      </div>

      {/* Chart */}
      <div className="h-64 sm:h-72">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis
              dataKey="sprint"
              tick={{ fontSize: 11, fill: '#64748b' }}
              axisLine={{ stroke: '#e2e8f0' }}
              tickLine={{ stroke: '#e2e8f0' }}
            />
            <YAxis
              tick={{ fontSize: 11, fill: '#64748b' }}
              axisLine={{ stroke: '#e2e8f0' }}
              tickLine={{ stroke: '#e2e8f0' }}
              allowDecimals={units !== 'workItems'}
              label={{ value: yAxisLabel, angle: -90, position: 'insideLeft', style: { textAnchor: 'middle', fill: '#64748b', fontSize: 11 } }}
            />
            <Tooltip content={<VelocityTooltip />} />

            {/* Average reference line */}
            <ReferenceLine
              y={averageVelocity}
              stroke="#94a3b8"
              strokeDasharray="4 4"
              label={{ value: `Avg: ${fmt(averageVelocity)}`, position: 'topRight', style: { fontSize: 11, fill: '#64748b' } }}
            />

            {/* Commitment bars */}
            {showCommitmentLine && (
              <Bar
                dataKey="commitment"
                fill="#cbd5e1"
                fillOpacity={0.5}
                name="Planned"
                radius={[4, 4, 0, 0]}
              />
            )}

            {/* Velocity line */}
            <Line
              type="monotone"
              dataKey="velocity"
              stroke="#6366f1"
              strokeWidth={3}
              dot={{
                fill: '#6366f1',
                strokeWidth: 2,
                r: 5,
                filter: 'drop-shadow(0 2px 4px rgba(99, 102, 241, 0.3))'
              }}
              activeDot={{
                r: 7,
                fill: '#6366f1',
                stroke: '#fff',
                strokeWidth: 2,
                filter: 'drop-shadow(0 4px 8px rgba(99, 102, 241, 0.4))'
              }}
              name="Completed"
            />

            {/* Commitment line */}
            {showCommitmentLine && (
              <Line
                type="monotone"
                dataKey="commitment"
                stroke="#475569"
                strokeWidth={2}
                strokeDasharray="6 3"
                dot={{
                  fill: '#475569',
                  strokeWidth: 2,
                  r: 4,
                  opacity: 0.8
                }}
                name="Planned"
                strokeOpacity={0.9}
              />
            )}

            {/* Velocity range band */}
            {showRangeBand && (
              <ReferenceArea
                y1={minVelocity}
                y2={maxVelocity}
                fill="#3b82f6"
                fillOpacity={0.05}
                label={{ value: 'Range', position: 'insideTopRight', style: { fontSize: 10, fill: '#94a3b8' } }}
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Footer Stats */}
      <div className="mt-4 pt-4 border-t border-slate-100">
        <div className="flex divide-x divide-slate-200">
          <div className="flex-1 px-3 first:pl-0 last:pr-0">
            <div className="text-[10px] text-slate-500 uppercase tracking-wide mb-1">Current</div>
            <div className="text-xl font-semibold text-slate-900" aria-label={`${chartData[chartData.length - 1]?.velocity || 0} story points in current sprint`}>
              {chartData[chartData.length - 1]?.velocity || 0} <span className="text-sm font-normal text-slate-400">{unitSuffix}</span>
            </div>
          </div>
          <div className="flex-1 px-3 first:pl-0 last:pr-0">
            <div className="text-[10px] text-slate-500 uppercase tracking-wide mb-1">Average</div>
            <div className="text-xl font-semibold text-slate-900" aria-label={`${fmt(averageVelocity)} story points average velocity`}>
              {fmt(averageVelocity)} <span className="text-sm font-normal text-slate-400">{unitSuffix}</span>
            </div>
          </div>
          <div className="flex-1 px-3 first:pl-0 last:pr-0">
            <div className="text-[10px] text-slate-500 uppercase tracking-wide mb-1">Trend</div>
            <div className={`text-xl font-semibold ${trendIsNew ? 'text-slate-900' : trend >= 0 ? 'text-emerald-600' : 'text-rose-600'}`} aria-label={trendIsNew ? 'New velocity — no prior baseline' : `${trend >= 0 ? 'Positive' : 'Negative'} ${fmt(Math.abs(trend))} percent trend`}>
              {trendIsNew ? 'New' : `${trend >= 0 ? '+' : ''}${fmt(trend)}`}<span className="text-sm font-normal text-slate-400">{!trendIsNew && '%'}</span>
            </div>
          </div>
          <div className="flex-1 px-3 first:pl-0 last:pr-0">
            <div className="text-[10px] text-slate-500 uppercase tracking-wide mb-1">Carry-over</div>
            <div className={`text-xl font-semibold ${carryover > 30 ? 'text-rose-700' : 'text-slate-900'}`} aria-label={`${carryover} percent carry-over`}>
              {carryover}<span className="text-sm font-normal text-slate-400">%</span>
            </div>
          </div>
        </div>
      </div>

      {/* Actionable insight only — shown when reliability is low enough to warrant action */}
      {showInsightLine && suggestedReduction > 0 && (
        <div className="mt-4 pt-4 border-t border-slate-100">
          <div className="text-xs text-amber-700">
            Reliability is {reliability}% — consider lowering commitment by {suggestedReduction} {unitSuffix} to match capacity.
          </div>
        </div>
      )}
    </div>
  );
};

export default React.memo(TeamVelocityChart);
