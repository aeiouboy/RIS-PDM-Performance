import React, { useMemo } from 'react';
import { LineChart, Line, ResponsiveContainer } from 'recharts';
import { BanknotesIcon, BoltIcon, BugAntIcon, StarIcon } from '@heroicons/react/24/solid';
import { fmt } from '../utils/formatNumber';
import { STATUS_BADGE, getKpiStatus } from '../utils/copyGlossary';

const KPICard = React.memo(({
  title,
  value,
  trend,
  trendValue,
  suffix = '',
  prefix = '',
  format = 'number',
  icon,
  color = 'blue',
  loading = false,
  className = '',
  sparklineData,
  subValue,
  'aria-label': ariaLabel,
  onClick
}) => {
  const formattedValue = useMemo(() => {
    if (loading || value === null || value === undefined) return '--';
    const n = typeof value === 'number' ? value : parseFloat(value);
    if (Number.isNaN(n)) return '--';

    switch (format) {
      case 'currency':
        return new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'USD',
          minimumFractionDigits: n >= 1000000 ? 1 : 0,
          maximumFractionDigits: n >= 1000000 ? 1 : 0
        }).format(n >= 1000000 ? n / 1000000 : n) + (n >= 1000000 ? 'M' : '');
      case 'percentage':
        return `${fmt(n)}%`;
      case 'decimal':
        return fmt(n);
      case 'rating':
        return `${fmt(n)}/5`;
      default:
        return n.toLocaleString();
    }
  }, [value, format, loading]);

  const trendPill = useMemo(() => {
    if (!trend || loading) return null;

    const isPositive = trend > 0;
    const isNegative = trend < 0;
    const magnitude = Math.abs(trend);
    const label = trendValue || `${isPositive ? '+' : ''}${fmt(trend)}%`;

    if (isPositive) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium text-emerald-600 bg-emerald-50">
          ↗ {label}
        </span>
      );
    }
    if (isNegative) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium text-rose-600 bg-rose-50">
          ↘ {label}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium text-slate-500 bg-slate-100">
        → {label || 'No change'}
      </span>
    );
  }, [trend, trendValue, loading]);

  const sparklinePoints = useMemo(() => {
    if (!sparklineData || sparklineData.length <= 2) return null;
    return sparklineData.map((v, i) => ({ i, v }));
  }, [sparklineData]);

  return (
    <div
      className={`relative bg-white border border-slate-200 rounded-xl p-6 overflow-hidden transition-shadow ${onClick ? 'shadow-sm hover:shadow-md cursor-pointer' : 'shadow-sm'} ${className}`}
      tabIndex={onClick ? 0 : undefined}
      role={onClick ? 'button' : 'article'}
      aria-label={ariaLabel || `${title}: ${formattedValue || 'Loading...'}`}
      onClick={onClick}
      onKeyDown={(e) => {
        if (onClick && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          onClick(e);
        }
      }}
    >
      {/* Header row: title + trend pill */}
      <div className="flex items-start justify-between mb-2">
        <h3 className="text-xs font-medium uppercase tracking-wider text-slate-500">
          {title}
          {loading && (
            <span className="ml-2 inline-block animate-spin rounded-full h-3 w-3 border-2 border-slate-300 border-t-slate-600 align-middle" />
          )}
        </h3>
        {!loading && trendPill}
      </div>

      {/* Value row */}
      {loading ? (
        <div className="space-y-2 mt-2">
          <div className="h-9 w-28 bg-slate-100 rounded animate-pulse" />
          <div className="h-4 w-16 bg-slate-100 rounded animate-pulse" />
        </div>
      ) : (
        <>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="text-3xl font-bold tracking-tight text-slate-900">
              {prefix}{formattedValue}
            </span>
            {suffix && (
              <span className="text-sm font-medium text-slate-500 ml-1">{suffix}</span>
            )}
          </div>
          {subValue && (
            <div className="text-xs text-slate-500 mt-1">{subValue}</div>
          )}
        </>
      )}

      {/* Icon — top-right decorative */}
      {icon && (
        <div className="absolute top-5 right-5 w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400">
          <div className="w-5 h-5">{icon}</div>
        </div>
      )}

      {/* Optional sparkline — bottom-right */}
      {sparklinePoints && (
        <div className="absolute bottom-3 right-3 w-24 h-10 opacity-60 pointer-events-none">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={sparklinePoints}>
              <Line
                type="monotone"
                dataKey="v"
                stroke="#2563eb"
                strokeWidth={1.5}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
});

KPICard.displayName = 'KPICard';

// Pre-configured KPI card variants — existing props unchanged, sparklineData optional
export const PLCard = React.memo(({ value, trend, trendValue, loading, sparklineData, subValue }) => (
  <KPICard
    title="P/L YTD"
    value={value >= 1000000 ? value / 1000000 : value}
    trend={trend}
    trendValue={trendValue}
    format="decimal"
    prefix="฿"
    suffix={value >= 1000000 ? 'M' : ''}
    icon={<BanknotesIcon className="w-5 h-5" />}
    color="green"
    loading={loading}
    sparklineData={sparklineData}
    subValue={subValue}
  />
));

export const VelocityCard = React.memo(({ value, trend, trendValue, loading, sparklineData, subValue }) => (
  <KPICard
    title="Velocity"
    value={value}
    trend={trend}
    trendValue={trendValue}
    suffix="pts"
    icon={<BoltIcon className="w-5 h-5" />}
    color="blue"
    loading={loading}
    sparklineData={sparklineData}
    subValue={subValue}
  />
));

export const BugCountCard = React.memo(({ value, trend, trendValue, loading, sparklineData, subValue }) => (
  <KPICard
    title="Bug Count"
    value={value}
    trend={trend}
    trendValue={trendValue}
    icon={<BugAntIcon className="w-5 h-5" />}
    color="red"
    loading={loading}
    sparklineData={sparklineData}
    subValue={subValue}
  />
));

export const SatisfactionCard = React.memo(({ value, trend, trendValue, loading, sparklineData, subValue }) => (
  <KPICard
    title="Satisfaction"
    value={value}
    trend={trend}
    trendValue={trendValue}
    format="rating"
    icon={<StarIcon className="w-5 h-5" />}
    color="orange"
    loading={loading}
    sparklineData={sparklineData}
    subValue={subValue}
  />
));

PLCard.displayName = 'PLCard';
VelocityCard.displayName = 'VelocityCard';
BugCountCard.displayName = 'BugCountCard';
SatisfactionCard.displayName = 'SatisfactionCard';

export default KPICard;
