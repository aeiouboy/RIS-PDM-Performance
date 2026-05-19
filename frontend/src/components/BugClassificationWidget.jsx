import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LabelList } from 'recharts';
import ChartTooltip from './ChartTooltip';
import { HEADINGS } from '../utils/copyGlossary';

const ENVIRONMENT_COLORS = {
  Deploy: '#10B981', // green
  Prod: '#F43F5E',   // rose
  SIT: '#F59E0B',    // amber
  UAT: '#8B5CF6',    // violet
  Other: '#64748B',  // slate
  Unclassified: '#94A3B8' // slate-400
};

const BugClassificationWidget = ({
  productId,
  iterationPath = null,
  bugClassificationData = null,
  environment = null,
  className = ''
}) => {
  const [detailedData, setDetailedData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedEnvironment, setSelectedEnvironment] = useState(environment);
  const [showPatterns, setShowPatterns] = useState(false);
  const [patternsData, setPatternsData] = useState(null);
  const [viewMode, setViewMode] = useState('bar'); // 'bar' | 'pie'

  useEffect(() => {
    if (productId) {
      fetchDetailedData();
    }
  }, [productId, selectedEnvironment, iterationPath]);

  const fetchDetailedData = async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (selectedEnvironment) params.append('environment', selectedEnvironment);
      if (iterationPath) params.append('iterationPath', iterationPath);

      const queryString = params.toString() ? `?${params.toString()}` : '';
      const response = await fetch(`/api/metrics/bug-classification/${encodeURIComponent(productId)}${queryString}`);

      if (!response.ok) {
        throw new Error(`Failed to fetch data: ${response.statusText}`);
      }

      const data = await response.json();
      setDetailedData(data);
    } catch (err) {
      console.error('Error fetching bug classification data:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchBugPatterns = async () => {
    if (!productId) return;

    setLoading(true);
    try {
      const params = new URLSearchParams({
        projectId: productId,
        timeRange: '3months',
        ...(selectedEnvironment && { environment: selectedEnvironment })
      });

      const response = await fetch(`/api/metrics/bug-patterns?${params}`);

      if (!response.ok) {
        throw new Error(`Failed to fetch patterns: ${response.statusText}`);
      }

      const data = await response.json();
      setPatternsData(data.patterns);
      setShowPatterns(true);
    } catch (err) {
      console.error('Error fetching bug patterns:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const prepareEnvironmentData = (data = bugClassificationData) => {
    if (!data?.environmentBreakdown) return [];

    return Object.entries(data.environmentBreakdown).map(([env, envData]) => ({
      name: env,
      count: envData.count,
      percentage: envData.percentage,
      color: ENVIRONMENT_COLORS[env] || '#64748B'
    })).filter(item => item.count > 0);
  };

  const EnvTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      const entries = [
        { label: 'Count', value: data.count ?? data.value },
        { label: 'Percent', value: data.percentage, unit: '%' },
      ];
      return <ChartTooltip title={data.name ?? label} entries={entries} />;
    }
    return null;
  };

  const environmentData = prepareEnvironmentData();

  return (
    <div className={`bg-white border border-slate-200 shadow-sm rounded-xl p-6 ${className}`}>
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-lg font-semibold text-slate-900" title={HEADINGS.bugBreakdown.subtitle ?? ''}>{HEADINGS.bugBreakdown.title}</h3>
        <div className="flex items-center gap-3">
          {/* View toggle */}
          <div className="hidden md:flex text-xs rounded border border-slate-200 overflow-hidden">
            <button
              onClick={() => setViewMode('bar')}
              aria-pressed={viewMode === 'bar'}
              className={`px-3 py-1 ${viewMode === 'bar' ? 'bg-slate-100 text-slate-900' : 'bg-white text-slate-500'}`}
              title="Bar view"
            >
              Bar
            </button>
            <button
              onClick={() => setViewMode('pie')}
              aria-pressed={viewMode === 'pie'}
              className={`px-3 py-1 ${viewMode === 'pie' ? 'bg-slate-100 text-slate-900' : 'bg-white text-slate-500'}`}
              title="Pie view"
            >
              Pie
            </button>
          </div>
          <select
            value={selectedEnvironment || ''}
            onChange={(e) => setSelectedEnvironment(e.target.value || null)}
            className="border border-slate-200 rounded px-3 py-1 text-sm text-slate-700 bg-white"
          >
            <option value="">All Environments</option>
            <option value="Deploy">Deploy</option>
            <option value="Prod">Production</option>
            <option value="SIT">SIT</option>
            <option value="UAT">UAT</option>
          </select>
          <button
            onClick={fetchBugPatterns}
            disabled={loading}
            className="px-4 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 text-sm"
          >
            {loading ? 'Loading...' : 'View Patterns'}
          </button>
        </div>
      </div>

      {/* Summary tiles — 4-up grid */}
      {bugClassificationData && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <div className="bg-slate-50 rounded-lg p-3">
            <div className="text-xs uppercase tracking-wide text-slate-500 mb-1">Total Bugs</div>
            <div className="text-2xl font-bold text-slate-900">{bugClassificationData.totalBugs || 0}</div>
          </div>
          <div className="bg-slate-50 rounded-lg p-3">
            <div className="text-xs uppercase tracking-wide text-slate-500 mb-1">Classified</div>
            <div className="text-2xl font-bold text-slate-900">{bugClassificationData.classificationRate || 0}%</div>
          </div>
          <div className="bg-slate-50 rounded-lg p-3">
            <div className="text-xs uppercase tracking-wide text-slate-500 mb-1">Prod Issues</div>
            <div className="text-2xl font-bold text-slate-900">{bugClassificationData.prodIssues || 0}</div>
          </div>
          <div className="bg-slate-50 rounded-lg p-3">
            <div className="text-xs uppercase tracking-wide text-slate-500 mb-1">Unclassified</div>
            <div className="text-2xl font-bold text-slate-900">{bugClassificationData.unclassified || 0}</div>
          </div>
        </div>
      )}

      {/* Environment Visualization */}
      {environmentData.length > 0 && (
        <div className="mb-6 bg-slate-50 rounded-lg p-4">
          <h4 className="text-sm font-medium text-slate-700 mb-4">
            {viewMode === 'bar' ? 'Bugs by Environment' : 'Environment Distribution'}
          </h4>
          {viewMode === 'bar' ? (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={environmentData} margin={{ left: 0, right: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis dataKey="name" tick={{ fill: '#64748B', fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fill: '#64748B', fontSize: 12 }} axisLine={false} tickLine={false} />
                <Tooltip content={<EnvTooltip />} />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {environmentData.map((entry, index) => (
                    <Cell key={`bar-cell-${index}`} fill={entry.color} />
                  ))}
                  <LabelList dataKey="count" position="top" formatter={(v, e) => {
                    if (!e || e.index === undefined || !environmentData[e.index]) {
                      return `${v}`;
                    }
                    return `${v} (${environmentData[e.index].percentage}%)`;
                  }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie
                  data={environmentData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percentage }) => percentage > 5 ? `${name}: ${percentage}%` : ''}
                  outerRadius={90}
                  fill="#8884d8"
                  dataKey="count"
                >
                  {environmentData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip content={<EnvTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      )}

      {/* Striped table for sample bugs.
          Source priority: parent's `bugClassificationData.environmentBreakdown` (same source as the bar chart above) ➜
          falls back to legacy `detailedData.bugsByEnvironment` for older callers.
          The earlier version only used `detailedData` which was a separate (often-stale) fetch, so the table
          showed 0 even when the chart had real counts. */}
      {(bugClassificationData?.environmentBreakdown || detailedData?.bugsByEnvironment) && (
        <div className="mb-6">
          <h4 className="text-sm font-medium text-slate-700 mb-3">Environment Details</h4>
          <div className="overflow-x-auto rounded-lg border border-slate-100">
            <table className="min-w-full">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Environment</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Count</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">%</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Sample Bugs</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {Object.entries(bugClassificationData?.environmentBreakdown || detailedData?.bugsByEnvironment || {}).map(([env, data], rowIdx) => (
                  <tr key={env} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                          style={{ backgroundColor: ENVIRONMENT_COLORS[env] || '#94A3B8' }}
                        />
                        <span className="text-sm font-medium text-slate-900">{env}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm font-semibold text-slate-900">
                      {data.count}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-600">
                      {data.percentage}%
                    </td>
                    <td className="px-4 py-3">
                      {data.bugs && data.bugs.length > 0 ? (
                        <div className="space-y-0.5">
                          {data.bugs.slice(0, 2).map(bug => (
                            <div key={bug.id} className="flex items-baseline gap-2">
                              <span className="font-mono text-xs text-blue-600 flex-shrink-0">#{bug.id}</span>
                              <span className="text-sm text-slate-700 truncate max-w-md">{bug.title}</span>
                            </div>
                          ))}
                          {data.bugs.length > 2 && (
                            <span className="text-xs text-blue-600 hover:underline cursor-pointer">
                              +{data.bugs.length - 2} more...
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400">No samples</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Bug Patterns */}
      {showPatterns && patternsData && (
        <div className="border-t border-slate-100 pt-6">
          <div className="flex justify-between items-center mb-4">
            <h4 className="text-sm font-medium text-slate-700">Bug Patterns &amp; Insights</h4>
            <button
              onClick={() => setShowPatterns(false)}
              className="text-sm text-slate-400 hover:text-slate-600"
            >
              Hide Patterns
            </button>
          </div>

          {patternsData.insights && patternsData.insights.length > 0 && (
            <div className="bg-blue-50 p-4 rounded-lg mb-4">
              <h5 className="text-sm font-medium text-slate-800 mb-2">Key Insights</h5>
              <ul className="text-sm text-slate-600 space-y-1 list-disc list-inside">
                {patternsData.insights.map((insight, index) => (
                  <li key={index}>{insight}</li>
                ))}
              </ul>
            </div>
          )}

          {patternsData.frequentBugTypes && Object.keys(patternsData.frequentBugTypes).length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h5 className="text-sm font-medium text-slate-700 mb-2">Top Bug Types</h5>
                <div className="space-y-2">
                  {Object.entries(patternsData.frequentBugTypes).slice(0, 5).map(([type, count]) => (
                    <div key={type} className="flex justify-between items-center p-2 bg-slate-50 rounded">
                      <span className="text-sm text-slate-700">{type}</span>
                      <span className="text-sm font-semibold text-slate-900">{count}</span>
                    </div>
                  ))}
                </div>
              </div>

              {patternsData.environmentTrends && Object.keys(patternsData.environmentTrends).length > 0 && (
                <div>
                  <h5 className="text-sm font-medium text-slate-700 mb-2">Environment Trends</h5>
                  <div className="space-y-2">
                    {Object.entries(patternsData.environmentTrends).map(([env, data]) => (
                      <div key={env} className="flex justify-between items-center p-2 bg-slate-50 rounded">
                        <span className="text-sm text-slate-700">{env}</span>
                        <div className="text-right">
                          <div className="text-sm font-semibold text-slate-900">{data.count}</div>
                          {data.avgResolutionDays > 0 && (
                            <div className="text-xs text-slate-500">{data.avgResolutionDays}d avg</div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Recommendations */}
      {detailedData?.insights?.recommendations && (
        <div className="mt-4 pt-4 border-t border-slate-100">
          <h4 className="text-sm font-medium text-slate-700 mb-2">Recommendations</h4>
          <ul className="text-sm text-slate-600 list-disc list-inside space-y-1">
            {detailedData.insights.recommendations.map((rec, index) => (
              <li key={index}>{rec}</li>
            ))}
          </ul>
        </div>
      )}

      {error && (
        <div className="mt-4 text-red-600 text-sm p-3 bg-red-50 rounded-lg border border-red-100">
          <strong>Error:</strong> {error}
        </div>
      )}
    </div>
  );
};

export default BugClassificationWidget;
