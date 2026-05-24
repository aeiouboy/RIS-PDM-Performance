import React, { useEffect, useState, useMemo } from 'react';
import apiClient from '../lib/apiClient';
import { fmt0 } from '../utils/formatNumber';
import { STATUS_BADGE, getScoreTier, METRIC_DEFS } from '../utils/copyGlossary';
import InfoTooltip from './InfoTooltip';

/**
 * Sprint Health Score — composite 0-100 metric for one-glance sprint health.
 * Pulls from: /sprint-overview + /velocity-trend + /sprint-by-assignee.
 *
 * Score breakdown (each 0-100, then averaged):
 *  - Completion:  completedSP / totalSP × 100 (falls back to items if SP = 0)
 *  - Reliability: mean(velocity / commitment × 100) over last 6 sprints, clamped 0-100
 *  - Balance:     100 − stddev(per-person totalSP) × 10, floored at 0
 * Composite = Math.round(mean of the 3 sub-scores)
 */
const SprintHealthCard = ({ productId, sprintId = 'current', className = '' }) => {
  const [overview, setOverview] = useState(null);
  const [velocityTrend, setVelocityTrend] = useState(null);
  const [assignees, setAssignees] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!productId) return;
    setLoading(true);
    setError(null);

    Promise.all([
      apiClient.get('/api/metrics/sprint-overview', { params: { productId, sprintId } }),
      apiClient.get('/api/metrics/velocity-trend', { params: { productId, range: 6 } }),
      apiClient.get('/api/metrics/sprint-by-assignee', { params: { productId, sprintId } }),
    ])
      .then(([ovRes, velRes, asnRes]) => {
        setOverview(ovRes.data?.data ?? null);
        setVelocityTrend(velRes.data?.data ?? null);
        setAssignees(asnRes.data?.data ?? null);
      })
      .catch((err) => {
        setError(err?.response?.data?.message || err.message || 'Failed to load sprint health');
      })
      .finally(() => setLoading(false));
  }, [productId, sprintId]);

  const scores = useMemo(() => {
    // --- Completion ---
    let completion = 0;
    if (overview) {
      if ((overview.totalSP ?? 0) > 0) {
        completion = ((overview.completedSP ?? 0) / overview.totalSP) * 100;
      } else if ((overview.totalItems ?? 0) > 0) {
        completion = ((overview.completedItems ?? 0) / overview.totalItems) * 100;
      }
    }
    completion = Math.min(100, Math.max(0, completion));

    // --- Reliability ---
    let reliability = 0;
    const sprints = Array.isArray(velocityTrend) ? velocityTrend : [];
    const eligible = sprints.filter((s) => (s.commitment ?? 0) > 0);
    if (eligible.length > 0) {
      const ratios = eligible.map((s) =>
        Math.min(100, Math.max(0, ((s.velocity ?? 0) / s.commitment) * 100))
      );
      reliability = ratios.reduce((sum, r) => sum + r, 0) / ratios.length;
    }

    // --- Balance ---
    let balance = 100;
    const members = Array.isArray(assignees) ? assignees : [];
    if (members.length >= 2) {
      const sps = members.map((a) => a.totalSP ?? 0);
      const mean = sps.reduce((s, v) => s + v, 0) / sps.length;
      const variance = sps.reduce((s, v) => s + (v - mean) ** 2, 0) / sps.length;
      const stddev = Math.sqrt(variance);
      balance = Math.max(0, 100 - stddev * 10);
    }

    const composite = Math.round((completion + reliability + balance) / 3);

    return { completion: Math.round(completion), reliability: Math.round(reliability), balance: Math.round(balance), composite };
  }, [overview, velocityTrend, assignees]);

  // Tier mapping
  const tier =
    scores.composite >= 75
      ? STATUS_BADGE.good
      : scores.composite >= 50
      ? STATUS_BADGE.warn
      : STATUS_BADGE.critical;

  // Plain-language lead sentence: delivery angle (completion + reliability) + balance angle.
  const leadSentence = (() => {
    const { completion, reliability, balance } = scores;
    const delivery =
      completion < 50 || reliability < 50 ? 'Behind on delivery'
      : completion < 80 || reliability < 80 ? 'Delivery is on watch'
      : 'Delivery is on track';
    const balanceText =
      balance >= 80 ? 'team balance is healthy'
      : balance >= 50 ? 'workload is somewhat uneven'
      : 'workload is concentrated on a few people';
    return `${delivery}; ${balanceText}.`;
  })();

  const sprintLabel = overview?.sprint ?? sprintId ?? 'Current sprint';

  // One metric: name + ⓘ definition, value coloured by tier, one-word verdict,
  // a tier-coloured bar, and a plain-language "what this means" line.
  const MetricRow = ({ defKey, value }) => {
    const def = METRIC_DEFS[defKey];
    const tier = getScoreTier(value);
    return (
      <div className="py-2.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-medium text-slate-700">{def.label}</span>
            <InfoTooltip content={def.tooltip} label={`What is ${def.label}?`} />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className={`text-lg font-semibold ${tier.text_cls}`}>{fmt0(value)}%</span>
            <span className={`text-[11px] font-medium ${tier.text_cls}`}>{tier.label}</span>
          </div>
        </div>
        <div className="h-1.5 bg-slate-100 rounded-full mt-1.5 overflow-hidden">
          <div
            className={`h-full ${tier.bar} rounded-full transition-all duration-500`}
            style={{ width: `${Math.min(100, value)}%` }}
          />
        </div>
        <p className="text-xs text-slate-500 mt-1">{def.meaning(value)}</p>
      </div>
    );
  };

  return (
    <div className={`bg-white border border-slate-200 shadow-sm rounded-xl p-6 ${className}`}>
      {/* Top row: title + badge */}
      <div className="flex items-start justify-between mb-4">
        <h3 className="text-lg font-semibold tracking-tight text-slate-900">Sprint Health</h3>
        {!loading && !error && (
          <span
            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium border ${tier.bg} ${tier.text_cls} ${tier.border}`}
          >
            {tier.icon} {tier.text}
          </span>
        )}
      </div>

      {/* Loading skeleton */}
      {loading && (
        <div className="animate-pulse space-y-4">
          <div className="h-14 w-32 bg-slate-100 rounded" />
          <div className="h-4 w-48 bg-slate-100 rounded" />
          <div className="grid grid-cols-3 gap-3 mt-4">
            {[0, 1, 2].map((i) => (
              <div key={i} className="space-y-2">
                <div className="h-3 w-16 bg-slate-100 rounded" />
                <div className="h-8 w-12 bg-slate-100 rounded" />
                <div className="h-1 w-full bg-slate-100 rounded" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Error */}
      {!loading && error && (
        <p className="text-sm text-slate-500">Sprint health unavailable.</p>
      )}

      {/* Content */}
      {!loading && !error && (
        <>
          {/* Big score */}
          <div className="flex items-baseline gap-2">
            <div className="text-5xl font-bold tracking-tight text-slate-900 leading-none">
              {fmt0(scores.composite)}
              <span className="text-2xl text-slate-400 ml-1">/100</span>
            </div>
            <span className="text-xs text-slate-500 ml-1">{sprintLabel}</span>
          </div>

          {/* Plain-language summary */}
          <p className="text-sm text-slate-600 mt-2">{leadSentence}</p>

          {/* Sub-scores — stacked rows, each with meaning + ⓘ threshold definition */}
          <div className="mt-3 divide-y divide-slate-100">
            <MetricRow defKey="completion" value={scores.completion} />
            <MetricRow defKey="reliability" value={scores.reliability} />
            <MetricRow defKey="balance" value={scores.balance} />
          </div>
        </>
      )}
    </div>
  );
};

export default SprintHealthCard;
