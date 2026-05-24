import React, { useState, useEffect, useMemo } from 'react';
import apiClient from '../lib/apiClient';
import { fmt0 } from '../utils/formatNumber';
import { HEADINGS, STATUS_BADGE } from '../utils/copyGlossary';
import InfoTooltip from './InfoTooltip';

/**
 * Sprint Overview Card — a one-glance answer to "where is this sprint?".
 *
 * Visual hierarchy:
 *  - Hero: completion % (the only number the PM needs to read first)
 *  - Two stacked progress bars: Work vs Time — instantly shows if we're ahead/behind
 *  - Secondary line: raw counts (items / SP) for context
 *  - Status pill: derived from work-vs-time delta
 */

const formatDate = (iso) => {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const SprintOverviewCard = ({ productId, sprintId = 'current', className = '' }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!productId) return;
    setLoading(true);
    setError(null);

    apiClient
      .get(`/api/metrics/sprint-overview`, {
        params: { productId, sprintId },
      })
      .then((res) => setData(res.data?.data || null))
      .catch((err) => setError(err?.response?.data?.message || err.message || 'Failed to load sprint overview'))
      .finally(() => setLoading(false));
  }, [productId, sprintId]);

  const derived = useMemo(() => {
    if (!data) return null;
    const totalItems = data.totalItems || 0;
    const completedItems = data.completedItems || 0;
    const totalSP = data.totalSP || 0;
    const completedSP = data.completedSP || 0;

    // Work % uses items as the primary measure (more reliable than SP which is often 0).
    const workPct = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;

    const days = (data.daysElapsed || 0) + (data.daysRemaining || 0);
    const timePct = days > 0 ? Math.round(((data.daysElapsed || 0) / days) * 100) : 0;
    const sprintStarted = (data.daysElapsed || 0) > 0;
    const sprintFinished = (data.daysRemaining || 0) === 0 && sprintStarted;

    // Status: how does Work compare to Time?
    let status = STATUS_BADGE.good; // default On track
    let statusText = 'On track';
    if (!sprintStarted) {
      status = STATUS_BADGE.good;
      statusText = 'Not started';
    } else if (sprintFinished && workPct < 100) {
      status = STATUS_BADGE.behind;
      statusText = `Finished at ${workPct}%`;
    } else if (workPct + 10 < timePct) {
      status = STATUS_BADGE.behind;
      statusText = 'Behind plan';
    } else if (workPct >= timePct + 10) {
      status = STATUS_BADGE.good;
      statusText = 'Ahead of plan';
    }

    // Plain-language one-liner — answers "is this sprint OK?" without decoding the bars.
    const carryItems = Math.max(0, totalItems - completedItems);
    let summary;
    if (!sprintStarted) {
      summary = `Sprint hasn't started yet — ${totalItems} items planned.`;
    } else if (sprintFinished && workPct < 100) {
      summary = `Sprint is over but only ${workPct}% of work is done — ${carryItems} item${carryItems === 1 ? '' : 's'} will carry over.`;
    } else if (workPct + 10 < timePct) {
      summary = `Behind pace — ${timePct}% of the time is gone but only ${workPct}% of work is done.`;
    } else if (workPct >= timePct + 10) {
      summary = `Ahead of pace — ${workPct}% done with only ${timePct}% of the time used.`;
    } else {
      summary = `On pace — ${workPct}% of work done, ${timePct}% of the sprint elapsed.`;
    }

    return { totalItems, completedItems, totalSP, completedSP, workPct, timePct, sprintStarted, sprintFinished, status, statusText, summary };
  }, [data]);

  return (
    <div className={`bg-white border border-slate-200 shadow-sm rounded-xl p-6 ${className}`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="min-w-0">
          <h3 className="text-lg font-semibold tracking-tight text-slate-900" title={HEADINGS.sprintOverview.subtitle}>
            {HEADINGS.sprintOverview.title}
          </h3>
          {!loading && data && (
            <p className="text-xs text-slate-500 mt-0.5">
              {data.sprint} &middot; {formatDate(data.startDate)} &ndash; {formatDate(data.endDate)}
            </p>
          )}
          {loading && <div className="h-3 w-44 bg-slate-100 animate-pulse rounded mt-1.5" />}
        </div>
        {derived && (
          <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border flex-shrink-0 ${derived.status.bg} ${derived.status.text_cls} ${derived.status.border}`}
          >
            <span aria-hidden="true">{derived.status.icon}</span>
            {derived.statusText}
          </span>
        )}
      </div>

      {/* Error */}
      {error && !loading && <p className="text-sm text-rose-600">{error}</p>}

      {/* Empty */}
      {!loading && !error && !data && <p className="text-sm text-slate-500">No sprint data</p>}

      {/* Skeleton */}
      {loading && (
        <div className="space-y-4">
          <div className="h-12 w-32 bg-slate-100 animate-pulse rounded" />
          <div className="h-2 w-full bg-slate-100 animate-pulse rounded" />
          <div className="h-2 w-full bg-slate-100 animate-pulse rounded" />
        </div>
      )}

      {/* Hero + dual progress */}
      {derived && (
        <>
          <div className="flex items-baseline gap-3 mb-1">
            <div className="text-5xl font-bold tracking-tight text-slate-900">{derived.workPct}%</div>
            <div className="text-sm text-slate-500">
              {fmt0(derived.completedItems)} of {fmt0(derived.totalItems)} items
              {derived.totalSP > 0 && (
                <span className="text-slate-400"> &middot; {fmt0(derived.completedSP)} / {fmt0(derived.totalSP)} pts</span>
              )}
            </div>
          </div>

          {/* Plain-language summary */}
          <p className="text-sm text-slate-600 mt-1">{derived.summary}</p>

          {/* Dual progress bars: Work (blue) vs Time (slate) */}
          <div className="mt-4 space-y-2">
            <div className="flex items-center gap-1.5 mb-1">
              <span className="text-[10px] uppercase tracking-wide text-slate-500">Work vs Time</span>
              <InfoTooltip
                label="What do Work and Time mean?"
                content="Work = % of items completed. Time = % of the sprint elapsed. When the Work bar trails the Time bar, the sprint is behind pace."
              />
            </div>
            <div className="flex items-center gap-3">
              <div className="text-[10px] uppercase tracking-wide text-slate-500 w-12 flex-shrink-0">Work</div>
              <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-blue-500 rounded-full transition-all duration-500" style={{ width: `${derived.workPct}%` }} />
              </div>
              <div className="text-xs font-semibold text-slate-700 w-10 text-right">{derived.workPct}%</div>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-[10px] uppercase tracking-wide text-slate-500 w-12 flex-shrink-0">Time</div>
              <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-slate-400 rounded-full transition-all duration-500" style={{ width: `${derived.timePct}%` }} />
              </div>
              <div className="text-xs font-semibold text-slate-700 w-10 text-right">{derived.timePct}%</div>
            </div>
          </div>

          {/* Footer detail */}
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>
              {derived.sprintStarted
                ? `Day ${data.daysElapsed} of ${data.daysElapsed + data.daysRemaining}`
                : `${data.daysRemaining} days until sprint starts`}
            </span>
            <span className="text-slate-400">{data.sprint}</span>
          </div>
        </>
      )}
    </div>
  );
};

export default SprintOverviewCard;
