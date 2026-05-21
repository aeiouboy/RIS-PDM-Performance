import React, { useState, useEffect } from 'react';
import { BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import BugClassificationWidget from './BugClassificationWidget';
import ChartTooltip from './ChartTooltip';
import { HEADINGS } from '../utils/copyGlossary';
import { fmt0 } from '../utils/formatNumber';

const COLORS = {
  tasks: '#3B82F6',  // blue-500
  bugs: '#F43F5E',   // rose-500
  design: '#F59E0B', // amber-500
  others: '#94A3B8'  // slate-400
};

const TaskDistributionDashboard = ({
  productId,
  iterationPath = null,
  assignedTo = null,
  className = ''
}) => {
  const [distributionData, setDistributionData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState({
    includeRemoved: false,
    dateRange: null
  });

  useEffect(() => {
    fetchDistributionData();
  }, [productId, iterationPath, assignedTo, filters]);

  const fetchDistributionData = async () => {
    if (!productId) return;

    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        productId,
        ...(iterationPath && { iterationPath }),
        ...(assignedTo && { assignedTo }),
        includeRemoved: filters.includeRemoved.toString(),
        ...(filters.dateRange && { dateRange: `${filters.dateRange.start},${filters.dateRange.end}` })
      });

      // Other dashboard components attach the bearer token explicitly; this
      // fetch() was sending no auth header at all → endpoint returned 401 and
      // the chart showed the "Failed to fetch data" error state.
      const response = await fetch(`/api/metrics/task-distribution-enhanced?${params}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('authToken') || ''}`
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch data: ${response.statusText}`);
      }

      const data = await response.json();
      setDistributionData(data.data);
    } catch (err) {
      console.error('Error fetching task distribution data:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const prepareBarChartData = () => {
    if (!distributionData?.distribution) return [];

    return Object.entries(distributionData.distribution).map(([type, data]) => ({
      name: type.charAt(0).toUpperCase() + type.slice(1),
      count: data.count,
      storyPoints: data.storyPoints || 0,
      percentage: data.percentage
    }));
  };

  const BarChartTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      const entries = [
        { label: 'Count', value: data.count },
        { label: 'Story Points', value: data.storyPoints, unit: 'pts' },
      ];
      return <ChartTooltip title={label} entries={entries} />;
    }
    return null;
  };

  if (loading) {
    return (
      <div className={`bg-white border border-slate-200 shadow-sm rounded-xl p-6 ${className}`}>
        <div className="animate-pulse">
          <div className="h-6 bg-slate-100 rounded w-1/3 mb-4"></div>
          <div className="h-8 bg-slate-100 rounded-full mb-4"></div>
          <div className="h-4 bg-slate-100 rounded w-full mb-2"></div>
          <div className="h-4 bg-slate-100 rounded w-3/4"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`bg-white border border-red-200 shadow-sm rounded-xl p-6 ${className}`}>
        <div className="text-red-600">
          <h3 className="text-lg font-semibold mb-2">Error Loading Data</h3>
          <p className="text-sm">{error}</p>
          <button
            onClick={fetchDistributionData}
            className="mt-3 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 text-sm"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!distributionData) {
    return (
      <div className={`bg-white border border-slate-200 shadow-sm rounded-xl p-6 ${className}`}>
        <p className="text-slate-500 text-center">No data available</p>
      </div>
    );
  }

  const barData = prepareBarChartData();
  const totalItems = distributionData.metadata?.totalItems || 0;
  const distribution = distributionData.distribution || {};

  // Build stacked bar segments
  const TYPE_META = {
    tasks:   { label: 'Tasks',   icon: '✓', color: '#3B82F6' },
    bugs:    { label: 'Bugs',    icon: '🐞', color: '#E11D48' },
    design:  { label: 'Design',  icon: '✦', color: '#F59E0B' },
    others:  { label: 'Others',  icon: '•', color: '#94A3B8' },
  };
  const stackedSegments = Object.entries(distribution).map(([type, data]) => {
    const meta = TYPE_META[type] || { label: type.charAt(0).toUpperCase() + type.slice(1), icon: '•', color: COLORS[type] || '#94A3B8' };
    return {
      type,
      count: data.count,
      percentage: data.percentage,
      color: meta.color,
      label: meta.label,
      icon: meta.icon,
    };
  });

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Main card */}
      <div className="bg-white border border-slate-200 shadow-sm rounded-xl p-6">
        {/* Title row */}
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-lg font-semibold text-slate-900" title={HEADINGS.workItemBreakdown.subtitle ?? ''}>{HEADINGS.workItemBreakdown.title}</h2>
          <div className="flex items-center gap-4">
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700">
              Total Items: {totalItems.toLocaleString()}
            </span>
            <label className="text-sm text-slate-600 flex items-center gap-1 cursor-pointer">
              <input
                type="checkbox"
                checked={filters.includeRemoved}
                onChange={(e) => setFilters(prev => ({ ...prev, includeRemoved: e.target.checked }))}
                className="rounded border-slate-300"
              />
              Include Removed
            </label>
          </div>
        </div>

        {/* Stacked horizontal bar — replaces Pie chart */}
        <div className="mb-6">
          <div className="h-10 rounded-lg overflow-hidden flex border border-slate-200">
            {stackedSegments.map((seg) => {
              const widthPct = (seg.count / totalItems) * 100;
              const showInline = widthPct >= 12; // only show label inside when segment ≥ 12%
              return (
                <div
                  key={seg.type}
                  className="h-full flex items-center justify-center text-white text-xs font-semibold gap-1.5 transition-all"
                  style={{
                    width: `${widthPct}%`,
                    backgroundColor: seg.color,
                  }}
                  title={`${seg.label}: ${seg.count} (${seg.percentage}%)`}
                >
                  {showInline && (
                    <>
                      <span aria-hidden="true">{seg.icon}</span>
                      <span>{seg.label}</span>
                      <span className="opacity-90">{seg.percentage}%</span>
                    </>
                  )}
                </div>
              );
            })}
          </div>
          {/* Legend — bigger, with icons + counts so it stays scannable for color-blind users */}
          <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2">
            {stackedSegments.map((seg) => (
              <div
                key={seg.type}
                className="flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 bg-white"
              >
                <span
                  className="inline-flex items-center justify-center w-7 h-7 rounded-md text-white text-sm font-semibold flex-shrink-0"
                  style={{ backgroundColor: seg.color }}
                  aria-hidden="true"
                >
                  {seg.icon}
                </span>
                <div className="min-w-0">
                  <div className="text-xs uppercase tracking-wide text-slate-500">{seg.label}</div>
                  <div className="text-sm font-semibold text-slate-900">
                    {seg.count} <span className="text-xs font-normal text-slate-500">({seg.percentage}%)</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Count vs Story Points bar chart — preserved, softer styling */}
        <div className="bg-slate-50 rounded-lg p-4 mb-6">
          <h3 className="text-sm font-medium text-slate-700 mb-4">Count vs Story Points</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={barData} margin={{ left: 0, right: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
              <XAxis
                dataKey="name"
                axisLine={false}
                tickLine={false}
                interval={0}
                tick={(props) => {
                  const { x, y, payload } = props;
                  const key = String(payload.value || '').toLowerCase();
                  const meta = TYPE_META[key] || { color: '#64748B', icon: '' };
                  return (
                    <g transform={`translate(${x},${y})`}>
                      <text x={0} y={0} dy={16} textAnchor="middle" fontSize={12} fontWeight={600} fill={meta.color}>
                        {meta.icon ? `${meta.icon} ` : ''}{payload.value}
                      </text>
                    </g>
                  );
                }}
              />
              <YAxis yAxisId="left" tick={{ fill: '#64748B', fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis yAxisId="right" orientation="right" tick={{ fill: '#64748B', fontSize: 12 }} axisLine={false} tickLine={false} />
              <Tooltip content={<BarChartTooltip />} />
              <Legend wrapperStyle={{ fontSize: 12, color: '#64748B' }} />
              <Bar yAxisId="left" dataKey="count" name="Count" radius={[4, 4, 0, 0]}>
                {barData.map((d) => {
                  const key = String(d.name || '').toLowerCase();
                  const color = (TYPE_META[key] || {}).color || '#3B82F6';
                  return <Cell key={`count-${d.name}`} fill={color} />;
                })}
              </Bar>
              <Bar yAxisId="right" dataKey="storyPoints" name="Story Points" radius={[4, 4, 0, 0]}>
                {barData.map((d) => {
                  const key = String(d.name || '').toLowerCase();
                  const color = (TYPE_META[key] || {}).color || '#3B82F6';
                  // Use 55% opacity (via hex alpha approximation by adding '99') so SP bar is a clearly lighter sibling
                  return <Cell key={`sp-${d.name}`} fill={color} fillOpacity={0.55} />;
                })}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Key Insights */}
        {distributionData.bugClassification && (
          <div>
            <h3 className="text-sm font-semibold text-slate-900 mb-2">Key Insights</h3>
            <div className="divide-y divide-slate-100">
              <div className="flex justify-between items-center py-1.5">
                <span className="text-sm text-slate-600">Bug Ratio</span>
                <span className="text-sm font-semibold text-slate-900">
                  {Math.round((distribution.bugs.count / totalItems) * 100)}%
                </span>
              </div>
              <div className="flex justify-between items-center py-1.5">
                <span className="text-sm text-slate-600">Total Bugs</span>
                <span className="text-sm font-semibold text-slate-900">{distributionData.bugClassification.totalBugs}</span>
              </div>
              <div className="flex justify-between items-center py-1.5">
                <span className="text-sm text-slate-600">Classified Bugs</span>
                <span className="text-sm font-semibold text-slate-900">
                  {distributionData.bugClassification.totalBugs - distributionData.bugClassification.unclassified}
                </span>
              </div>
              <div className="flex justify-between items-center py-1.5">
                <span className="text-sm text-slate-600">Classification Rate</span>
                <span className="text-sm font-semibold text-slate-900">
                  {distributionData.bugClassification.classificationRate}%
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Bug Classification Widget */}
      {distributionData.bugClassification && distributionData.bugClassification.totalBugs > 0 && (
        <BugClassificationWidget
          productId={productId}
          iterationPath={iterationPath}
          bugClassificationData={distributionData.bugClassification}
          className="mt-6"
        />
      )}
    </div>
  );
};

export default TaskDistributionDashboard;
