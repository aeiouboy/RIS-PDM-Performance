import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { fmt0 } from '../utils/formatNumber';
import { HEADINGS } from '../utils/copyGlossary';

// TODO: per-person capacity from settings
const DEFAULT_CAPACITY_SP = 10;

const STATE_ORDER = [
  'New', 'Approved', 'Committed', 'Active', 'In Progress', 'Done', 'Resolved', 'Deploy', 'Closed',
];

const utilizationPill = (utilization) => {
  let colorClasses;
  let label;
  if (utilization < 50) {
    colorClasses = 'text-amber-700 bg-amber-50 border-amber-200';
    label = 'Under';
  } else if (utilization < 120) {
    colorClasses = 'text-emerald-700 bg-emerald-50 border-emerald-200';
    label = 'Optimal';
  } else {
    colorClasses = 'text-rose-700 bg-rose-50 border-rose-200';
    label = 'Over';
  }
  void label; // label available for future tooltip use
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${colorClasses}`}
    >
      {utilization}%
    </span>
  );
};

const CurrentSprintByAssignee = ({ productId, sprintId = 'current', className = '' }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!productId) return;
    setLoading(true);
    setError(null);

    axios
      .get(`/api/metrics/sprint-by-assignee`, {
        params: { productId, sprintId },
        headers: {
          Authorization: `Bearer ${localStorage.getItem('authToken') || ''}`,
          'Content-Type': 'application/json',
        },
      })
      .then((res) => {
        setData(res.data?.data || null);
      })
      .catch((err) => {
        setError(err?.response?.data?.message || err.message || 'Failed to load assignee data');
      })
      .finally(() => setLoading(false));
  }, [productId, sprintId]);

  // Compute union of all states across assignees, sorted by priority order
  const stateColumns = useMemo(() => {
    if (!data?.assignees?.length) return [];
    const allStates = new Set();
    data.assignees.forEach((a) => {
      Object.keys(a.states || {}).forEach((s) => allStates.add(s));
    });
    const prioritized = STATE_ORDER.filter((s) => allStates.has(s));
    const rest = [...allStates]
      .filter((s) => !STATE_ORDER.includes(s))
      .sort();
    return [...prioritized, ...rest];
  }, [data]);

  const overCapacityCount = useMemo(() => {
    if (!data?.assignees?.length) return 0;
    return data.assignees.filter(
      (a) => Math.round(((a.totalSP ?? 0) / DEFAULT_CAPACITY_SP) * 100) >= 120
    ).length;
  }, [data]);

  return (
    <div className={`bg-white border border-slate-200 shadow-sm rounded-xl p-6 ${className}`}>
      {/* Header */}
      <div className="mb-4">
        <h3 className="text-lg font-semibold tracking-tight text-slate-900" title={HEADINGS.thisSprintByPerson.subtitle}>
          {HEADINGS.thisSprintByPerson.title}
        </h3>
        {!loading && data?.assignees?.length > 0 && overCapacityCount > 0 && (
          <p className="text-xs text-slate-500 mt-1">
            {overCapacityCount} of {data.assignees.length} people are over capacity
          </p>
        )}
        {loading && <div className="h-4 w-40 bg-slate-100 animate-pulse rounded mt-1" />}
      </div>

      {/* Error */}
      {error && !loading && (
        <p className="text-sm text-red-600">{error}</p>
      )}

      {/* Loading skeleton */}
      {loading && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100">
                {['ASSIGNEE', 'NEW', 'COMMITTED', 'DONE', 'TOTAL ITEMS', 'TOTAL SP'].map((h) => (
                  <th
                    key={h}
                    className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-slate-500"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[0, 1, 2].map((i) => (
                <tr key={i} className="border-b border-slate-50">
                  {[0, 1, 2, 3, 4, 5].map((j) => (
                    <td key={j} className="px-3 py-3">
                      <div className="h-4 bg-slate-100 animate-pulse rounded w-12" />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && (!data?.assignees?.length) && (
        <p className="text-sm text-slate-500">No assignees in this sprint yet.</p>
      )}

      {/* Table */}
      {!loading && !error && data?.assignees?.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                  Assignee
                </th>
                {stateColumns.map((state) => (
                  <th
                    key={state}
                    className="px-3 py-2 text-center text-xs font-medium uppercase tracking-wider text-slate-500"
                  >
                    {state}
                  </th>
                ))}
                <th className="px-3 py-2 text-right text-xs font-medium uppercase tracking-wider text-slate-500">
                  Capacity
                </th>
                <th className="px-3 py-2 text-right text-xs font-medium uppercase tracking-wider text-slate-500">
                  Utilization
                </th>
                <th className="px-3 py-2 text-center text-xs font-medium uppercase tracking-wider text-slate-500">
                  Total Items
                </th>
                <th className="px-3 py-2 text-center text-xs font-medium uppercase tracking-wider text-slate-500">
                  Total SP
                </th>
              </tr>
            </thead>
            <tbody>
              {data.assignees.map((assignee, idx) => {
                const utilization = Math.round(((assignee.totalSP ?? 0) / DEFAULT_CAPACITY_SP) * 100);
                return (
                  <tr
                    key={assignee.email || idx}
                    className="border-b border-slate-50 hover:bg-slate-50/70 transition-colors"
                  >
                    <td className="px-3 py-1.5 text-slate-700 font-medium whitespace-nowrap">
                      {assignee.name}
                    </td>
                    {stateColumns.map((state) => (
                      <td key={state} className="px-3 py-1.5 text-center text-slate-700">
                        {assignee.states?.[state] ?? 0}
                      </td>
                    ))}
                    <td className="px-3 py-1.5 text-right text-slate-700">
                      {DEFAULT_CAPACITY_SP}
                    </td>
                    <td className="px-3 py-1.5 text-right">
                      {utilizationPill(utilization)}
                    </td>
                    <td className="px-3 py-1.5 text-center text-slate-700">
                      {fmt0(assignee.totalItems ?? 0)}
                    </td>
                    <td className="px-3 py-1.5 text-center text-slate-900 font-semibold">
                      {fmt0(assignee.totalSP ?? 0)}
                    </td>
                  </tr>
                );
              })}
              {/* Team total footer row */}
              {(() => {
                const totalSP = data.assignees.reduce((sum, a) => sum + (a.totalSP ?? 0), 0);
                const totalItems = data.assignees.reduce((sum, a) => sum + (a.totalItems ?? 0), 0);
                const teamCapacity = data.assignees.length * DEFAULT_CAPACITY_SP;
                const teamUtilization = Math.round((totalSP / teamCapacity) * 100);
                return (
                  <tr className="bg-slate-50/50 font-medium text-slate-700">
                    <td className="px-3 py-1.5 text-slate-600 italic text-xs whitespace-nowrap">
                      Team Total
                    </td>
                    {stateColumns.map((state) => (
                      <td key={state} className="px-3 py-1.5 text-center">
                        {data.assignees.reduce((sum, a) => sum + (a.states?.[state] ?? 0), 0)}
                      </td>
                    ))}
                    <td className="px-3 py-1.5 text-right">
                      {teamCapacity}
                    </td>
                    <td className="px-3 py-1.5 text-right">
                      {utilizationPill(teamUtilization)}
                    </td>
                    <td className="px-3 py-1.5 text-center">
                      {fmt0(totalItems)}
                    </td>
                    <td className="px-3 py-1.5 text-center text-slate-900 font-semibold">
                      {fmt0(totalSP)}
                    </td>
                  </tr>
                );
              })()}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default CurrentSprintByAssignee;
