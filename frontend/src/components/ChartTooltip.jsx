import React from 'react';
import { fmt } from '../utils/formatNumber';
import { STATUS_BADGE } from '../utils/copyGlossary';

/**
 * Unified chart tooltip — used by SprintBurndownChart, TeamVelocityChart,
 * TaskDistributionDashboard, and any other recharts-based widget.
 *
 * @param {Object}   props
 * @param {string}   [props.title]          - Primary heading (e.g., "Day 5", "Bug")
 * @param {string}   [props.subtitle]       - Secondary heading (e.g., "May 22")
 * @param {Object}   [props.headerBadge]    - { text, tone: 'good'|'warn'|'behind'|'critical' }
 *                                            For time-axis charts use tone in {'good','behind'} only.
 * @param {string}   [props.description]    - Single-paragraph descriptor (distribution-style tooltips)
 * @param {Array}    [props.entries]        - [{ label, value, unit }] where unit is 'pts' | 'items'
 * @param {Object}   [props.footer]         - { text, tone } — same enum constraints as headerBadge
 */

const TONE_TO_STYLE = {
  good:     'bg-emerald-50 text-emerald-700 border-emerald-200',
  warn:     'bg-amber-50 text-amber-700 border-amber-200',
  behind:   'bg-rose-50 text-rose-700 border-rose-200',
  critical: 'bg-rose-50 text-rose-700 border-rose-200',
};

/** Extract just the text-color class from a TONE_TO_STYLE value. */
function toneTextClass(tone) {
  const style = TONE_TO_STYLE[tone] || TONE_TO_STYLE.critical;
  const match = style.match(/text-\S+/);
  return match ? match[0] : 'text-slate-600';
}

const ChartTooltip = ({ title, subtitle, headerBadge, description, entries = [], footer }) => {
  return (
    <div className="bg-white p-3 border border-slate-200 rounded-lg shadow-md text-sm min-w-[180px]">
      {(title || subtitle || headerBadge) && (
        <div className="flex items-center justify-between gap-3 mb-2">
          <div>
            {title && <div className="font-semibold text-slate-900">{title}</div>}
            {subtitle && <div className="text-xs text-slate-500">{subtitle}</div>}
          </div>
          {headerBadge && (
            <span
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border ${TONE_TO_STYLE[headerBadge.tone] || TONE_TO_STYLE.critical}`}
            >
              {headerBadge.text}
            </span>
          )}
        </div>
      )}

      {description && (
        <p className="text-xs text-slate-600 mb-2 leading-snug">{description}</p>
      )}

      {entries.length > 0 && (
        <div className="space-y-1">
          {entries.map((e, i) => (
            <div key={i} className="flex items-baseline justify-between gap-3">
              <span className="text-xs text-slate-500">{e.label}</span>
              <span className="text-sm font-semibold text-slate-900">
                {fmt(e.value)}
                {e.unit ? (
                  <span className="text-xs font-normal text-slate-500 ml-1">{e.unit}</span>
                ) : null}
              </span>
            </div>
          ))}
        </div>
      )}

      {footer && (
        <div
          className={`mt-2 pt-2 border-t border-slate-100 text-xs font-medium ${toneTextClass(footer.tone)}`}
        >
          {footer.text}
        </div>
      )}
    </div>
  );
};

export default ChartTooltip;
