import React, { useMemo } from 'react';

// Enhanced color variants with better accessibility and visual hierarchy
const COLOR_VARIANTS = {
  blue: {
    bg: 'bg-primary-50/50',
    border: 'border-primary-200/50',
    icon: 'bg-primary-100 text-primary-600',
    value: 'text-primary-600',
    accent: 'bg-primary-500'
  },
  green: {
    bg: 'bg-success-50/50',
    border: 'border-success-200/50',
    icon: 'bg-success-100 text-success-600',
    value: 'text-success-600',
    accent: 'bg-success-500'
  },
  orange: {
    bg: 'bg-warning-50/50',
    border: 'border-warning-200/50',
    icon: 'bg-warning-100 text-warning-600',
    value: 'text-warning-600',
    accent: 'bg-warning-500'
  },
  purple: {
    bg: 'bg-purple-50/50',
    border: 'border-purple-200/50',
    icon: 'bg-purple-100 text-purple-600',
    value: 'text-purple-600',
    accent: 'bg-purple-500'
  },
  red: {
    bg: 'bg-error-50/50',
    border: 'border-error-200/50',
    icon: 'bg-error-100 text-error-600',
    value: 'text-error-600',
    accent: 'bg-error-500'
  },
  gray: {
    bg: 'bg-gray-50/50',
    border: 'border-gray-200/50',
    icon: 'bg-gray-100 text-gray-600',
    value: 'text-gray-600',
    accent: 'bg-gray-500'
  }
};

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
  'aria-label': ariaLabel,
  onClick
}) => {
  // Memoize color selection
  const colors = useMemo(() => COLOR_VARIANTS[color] || COLOR_VARIANTS.blue, [color]);

  // Memoize formatted value to prevent unnecessary recalculations
  const formattedValue = useMemo(() => {
    if (loading || value === null || value === undefined) return '--';
    
    switch (format) {
      case 'currency':
        return new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'USD',
          minimumFractionDigits: value >= 1000000 ? 1 : 0,
          maximumFractionDigits: value >= 1000000 ? 1 : 0
        }).format(value >= 1000000 ? value / 1000000 : value) + (value >= 1000000 ? 'M' : '');
      case 'percentage':
        return `${parseFloat(value).toFixed(1)}%`;
      case 'decimal':
        return parseFloat(value).toFixed(1);
      case 'rating':
        return `${parseFloat(value).toFixed(1)}/5`;
      default:
        return value.toLocaleString();
    }
  }, [value, format, loading]);

  // Enhanced trend indicator with better visual feedback
  const trendIcon = useMemo(() => {
    if (!trend || loading) return null;

    const isPositive = trend > 0;
    const isNegative = trend < 0;
    const trendMagnitude = Math.abs(trend);
    const isSignificant = trendMagnitude >= 5;

    if (isPositive) {
      return (
        <div className={`flex items-center gap-1 px-2 py-1 rounded-full transition-colors ${
          isSignificant ? 'bg-success-100 text-success-700' : 'bg-success-50 text-success-600'
        }`}>
          <div className="relative">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M3.293 9.707a1 1 0 010-1.414l6-6a1 1 0 011.414 0l6 6a1 1 0 01-1.414 1.414L10 4.414 4.707 9.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
            </svg>
            {isSignificant && (
              <div className="absolute -top-1 -right-1 w-2 h-2 bg-success-500 rounded-full animate-pulse"></div>
            )}
          </div>
          <span className="text-xs font-semibold">
            {trendValue || `+${trendMagnitude.toFixed(1)}%`}
          </span>
        </div>
      );
    }

    if (isNegative) {
      return (
        <div className={`flex items-center gap-1 px-2 py-1 rounded-full transition-colors ${
          isSignificant ? 'bg-error-100 text-error-700' : 'bg-error-50 text-error-600'
        }`}>
          <div className="relative">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 10.293a1 1 0 010 1.414l-6 6a1 1 0 01-1.414 0l-6-6a1 1 0 111.414-1.414L10 15.586l5.293-5.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
            {isSignificant && (
              <div className="absolute -top-1 -right-1 w-2 h-2 bg-error-500 rounded-full animate-pulse"></div>
            )}
          </div>
          <span className="text-xs font-semibold">
            {trendValue || `${trend.toFixed(1)}%`}
          </span>
        </div>
      );
    }

    return (
      <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-gray-100 text-gray-600">
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
        </svg>
        <span className="text-xs font-semibold">No change</span>
      </div>
    );
  }, [trend, trendValue, loading]);

  return (
    <div
      className={`group relative backdrop-blur-lg bg-white/80 rounded-2xl border border-white/20 shadow-xl hover:shadow-2xl hover:scale-[1.02] focus-ring transition-all duration-300 overflow-hidden ${onClick ? 'cursor-pointer' : ''} ${className}`}
      tabIndex={onClick ? "0" : undefined}
      role={onClick ? "button" : "article"}
      aria-label={ariaLabel || `${title}: ${formattedValue || 'Loading...'}`}
      onClick={onClick}
      onKeyDown={(e) => {
        if (onClick && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          onClick(e);
        }
      }}
      style={{
        background: 'linear-gradient(135deg, rgba(255,255,255,0.9) 0%, rgba(255,255,255,0.7) 100%)',
        boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.15)'
      }}
    >
      {/* Gradient Accent */}
      <div className={`absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-${color}-400 to-${color}-600`}></div>

      {/* Subtle Pattern */}
      <div className={`absolute inset-0 ${colors.bg} opacity-20`}></div>

      {/* Card Content */}
      <div className="relative p-6">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            {/* Title */}
            <div className="flex items-center gap-2 mb-3">
              <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">{title}</h3>
              {loading && (
                <div className="animate-spin rounded-full h-3 w-3 border-2 border-gray-300 border-t-gray-600"></div>
              )}
            </div>

            {/* Value */}
            <div className="mb-4">
              {loading ? (
                <div className="space-y-2">
                  <div className="skeleton h-10 w-24"></div>
                  <div className="skeleton h-4 w-16"></div>
                </div>
              ) : (
                <>
                  <p className={`text-3xl font-bold ${colors.value} leading-none mb-1`}>
                    {prefix}{formattedValue}{suffix}
                  </p>
                  {/* Trend Indicator */}
                  {trendIcon && (
                    <div className="flex items-center">
                      {trendIcon}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Icon */}
          {icon && (
            <div className={`flex-shrink-0 w-14 h-14 bg-gradient-to-br from-${color}-400 to-${color}-600 rounded-2xl flex items-center justify-center shadow-lg group-hover:scale-110 group-hover:rotate-3 transition-all duration-300`}>
              {typeof icon === 'string' ? (
                <span className="text-2xl filter drop-shadow-md">{icon}</span>
              ) : (
                <div className="w-7 h-7 text-white">{icon}</div>
              )}
            </div>
          )}
        </div>

        {/* Loading Progress Bar */}
        {loading && (
          <div className="mt-4">
            <div className="h-1 bg-gray-200 rounded-full overflow-hidden">
              <div className={`h-full ${colors.accent} rounded-full animate-pulse`} style={{ width: '60%' }}></div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
});

// Set display names for better debugging
KPICard.displayName = 'KPICard';

// Pre-configured KPI cards matching PRD specifications with optimizations
export const PLCard = React.memo(({ value, trend, trendValue, loading }) => (
  <KPICard
    title="P/L YTD"
    value={value >= 1000000 ? value / 1000000 : value}
    trend={trend}
    trendValue={trendValue}
    format="decimal"
    prefix="฿"
    suffix={value >= 1000000 ? 'M' : ''}
    icon="💰"
    color="green"
    loading={loading}
  />
));

export const VelocityCard = React.memo(({ value, trend, trendValue, loading }) => (
  <KPICard
    title="Velocity"
    value={value}
    trend={trend}
    trendValue={trendValue}
    suffix=" pts/spr"
    icon="🚀"
    color="blue"
    loading={loading}
  />
));

export const BugCountCard = React.memo(({ value, trend, trendValue, loading }) => (
  <KPICard
    title="Bug Count"
    value={value}
    trend={trend}
    trendValue={trendValue}
    icon="🐛"
    color="red"
    loading={loading}
  />
));

export const SatisfactionCard = React.memo(({ value, trend, trendValue, loading }) => (
  <KPICard
    title="Satisfaction"
    value={value}
    trend={trend}
    trendValue={trendValue}
    format="rating"
    icon="⭐"
    color="orange"
    loading={loading}
  />
));

// Set display names
PLCard.displayName = 'PLCard';
VelocityCard.displayName = 'VelocityCard';
BugCountCard.displayName = 'BugCountCard';
SatisfactionCard.displayName = 'SatisfactionCard';

export default KPICard;