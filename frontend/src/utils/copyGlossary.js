/**
 * Copy normalization primitives — consumed by all dashboard widgets.
 *
 * Status badge system: 4 levels. Non-time-axis widgets use {good | warn | critical}.
 * Time-axis widgets (Sprint Burndown) use only {good | behind} — see comment on behind.
 *
 * DO NOT consolidate `behind` and `critical` even though they share rose palette —
 * they intentionally carry different text to preserve semantics for screen readers
 * and reviewers.
 */

/** Deep-freeze: freezes the container and every nested object value. */
function deepFreeze(obj) {
  Object.freeze(obj);
  Object.values(obj).forEach((v) => {
    if (v && typeof v === 'object' && !Object.isFrozen(v)) deepFreeze(v);
  });
  return obj;
}

export const STATUS_BADGE = deepFreeze({
  good: {
    key: 'good',
    text: 'On track',
    icon: '✓',
    bg: 'bg-emerald-50',
    text_cls: 'text-emerald-700',
    border: 'border-emerald-200',
  },
  warn: {
    key: 'warn',
    text: 'At risk',
    icon: '⚠',
    bg: 'bg-amber-50',
    text_cls: 'text-amber-700',
    border: 'border-amber-200',
  },
  behind: {
    key: 'behind',
    text: 'Behind schedule',
    icon: '⚠',
    bg: 'bg-rose-50',
    text_cls: 'text-rose-700',
    border: 'border-rose-200',
    /** Only for time-axis charts (e.g., Sprint Burndown). */
  },
  critical: {
    key: 'critical',
    text: 'Off track',
    icon: '⚠',
    bg: 'bg-rose-50',
    text_cls: 'text-rose-700',
    border: 'border-rose-200',
    /** For non-time-axis widgets (KPI, distribution, classification). */
  },
});

export const UNIT_LABEL = deepFreeze({
  /** Plural noun in headings ("Story Points completed"). */
  storyPoints: { full: 'Story Points', compact: 'pts' },
  /** Plural noun in headings ("Work Items completed"). */
  workItems:   { full: 'Work Items',   compact: 'items' },
});

/**
 * Section heading glossary — single source of truth.
 * Components reference HEADINGS.x.title and .subtitle to render their card header.
 */
export const HEADINGS = deepFreeze({
  sprintOverview:       { title: 'Sprint Overview',       subtitle: 'Where the team stands in the current sprint' },
  velocityTrend:        { title: 'Velocity Trend',        subtitle: 'Completed work over recent sprints' },
  sprintBurndown:       { title: 'Sprint Burndown',       subtitle: 'Remaining work over the sprint duration' },
  workItemBreakdown:    { title: 'Work Item Breakdown',   subtitle: 'How work is distributed across types' },
  bugBreakdown:         { title: 'Bug Breakdown',         subtitle: 'Where bugs land in the pipeline' },
  thisSprintByPerson:   { title: 'This Sprint by Person', subtitle: "Each teammate's current sprint workload" },
});

/**
 * Burndown status threshold helper — explicit so executors don't invent thresholds.
 * Returns the STATUS_BADGE entry for the burndown header pill.
 *
 * Within 5% of plan → good. Else behind.
 * Time-axis charts only support 2 states (good | behind) — there is no "at risk" middle.
 *
 * @param {number|null} currentActual  - Actual remaining work at current day
 * @param {number|null} currentIdeal   - Ideal remaining work at current day
 * @param {number|null} initialActual  - Total work at sprint start (denominator)
 * @returns {Object} STATUS_BADGE entry
 */
export function getBurndownStatus(currentActual, currentIdeal, initialActual) {
  const variance = (currentActual ?? 0) - (currentIdeal ?? 0);
  const denom = Math.max(initialActual ?? 0, 1);
  const ratio = Math.abs(variance) / denom;
  return ratio <= 0.05 ? STATUS_BADGE.good : STATUS_BADGE.behind;
}

/**
 * Generic KPI/distribution status helper (non-time-axis widgets).
 * Caller provides the comparison; returns the matching badge.
 *
 * @param {'good'|'warn'|'critical'} level
 * @returns {Object} STATUS_BADGE entry
 */
export function getKpiStatus(level) {
  return STATUS_BADGE[level] ?? STATUS_BADGE.critical;
}

/**
 * Higher-is-better 0–100 score tiers (Sprint Health sub-scores, commitment reliability…).
 * Good ≥ 80 · Watch 50–79 · Low < 50. Returns a one-word verdict + colour classes.
 * value null/undefined/NaN → neutral "No data" (never invent a tier for missing data).
 *
 * @param {number|null} value
 * @returns {{key:string,label:string,text_cls:string,bar:string}}
 */
export function getScoreTier(value) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return { key: 'na', label: 'No data', text_cls: 'text-slate-400', bar: 'bg-slate-300' };
  }
  if (value >= 80) return { key: 'good',  label: 'Good',  text_cls: 'text-emerald-700', bar: 'bg-emerald-500' };
  if (value >= 50) return { key: 'watch', label: 'Watch', text_cls: 'text-amber-700',   bar: 'bg-amber-500' };
  return { key: 'low', label: 'Low', text_cls: 'text-rose-700', bar: 'bg-rose-500' };
}

/** Shared threshold legend shown in ⓘ tooltips for 0–100 scores. */
export const SCORE_TIER_LEGEND = 'Good ≥ 80 · Watch 50–79 · Low < 50';

/**
 * Plain-language definitions for the dashboard's hero metrics. Each entry:
 *  - label:   short display name
 *  - tooltip: what the metric is + how to read good/bad (rendered in the ⓘ icon)
 *  - meaning: (value:number) => human one-liner describing the CURRENT value
 * meaning() assumes a real number — callers must skip/guard when the value is null
 * so we never fabricate a meaning for missing data.
 */
export const METRIC_DEFS = deepFreeze({
  completion: {
    label: 'Completion',
    tooltip: `Share of committed story points finished this sprint. ${SCORE_TIER_LEGEND}.`,
    meaning: (v) => v >= 80 ? 'most committed work is done'
      : v >= 50 ? `about ${Math.round(v)}% of committed work is done`
      : `only ~${Math.round(v)}% of committed work is done`,
  },
  reliability: {
    label: 'Reliability',
    tooltip: `Average of delivered ÷ committed over the last 6 sprints. ${SCORE_TIER_LEGEND}.`,
    meaning: (v) => v >= 80 ? 'the team usually delivers what it commits'
      : v >= 50 ? `the team usually delivers about ${Math.round(v)}% of the plan`
      : 'the team usually delivers under half of the plan',
  },
  balance: {
    label: 'Balance',
    tooltip: `How evenly story points are spread across the team — 100 = perfectly even. ${SCORE_TIER_LEGEND}.`,
    meaning: (v) => v >= 80 ? 'work is evenly spread across the team'
      : v >= 50 ? 'work is somewhat uneven across the team'
      : 'work is concentrated on a few people',
  },
});
