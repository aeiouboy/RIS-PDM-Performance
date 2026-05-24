import React, { useState, useRef, useEffect, useId } from 'react';

/**
 * InfoTooltip — accessible ⓘ icon with hover + focus + tap support.
 *
 * Props:
 *   content   {string|React.ReactNode}  — tooltip body text or JSX
 *   label     {string}                 — aria-label for the trigger button (defaults to "More information")
 *   position  {'top'|'bottom'}         — preferred placement (default 'top')
 *   className {string}                 — extra classes on the trigger button
 *
 * Accessibility:
 *   - Trigger is a <button> (keyboard focusable, fires on Enter/Space)
 *   - role="tooltip" on the popup, linked via aria-describedby
 *   - Closes on Escape and on click-outside
 */
const InfoTooltip = ({ content, label = 'More information', position = 'top', className = '' }) => {
  const [open, setOpen] = useState(false);
  const tooltipId = useId();
  const containerRef = useRef(null);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open]);

  // Close on click outside
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    document.addEventListener('touchstart', handler);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('touchstart', handler);
    };
  }, [open]);

  const positionCls = position === 'bottom'
    ? 'top-full mt-1.5'
    : 'bottom-full mb-1.5';

  return (
    <span ref={containerRef} className={`relative inline-flex items-center ${className}`}>
      <button
        type="button"
        aria-label={label}
        aria-describedby={open ? tooltipId : undefined}
        onClick={() => setOpen((v) => !v)}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        className="inline-flex items-center justify-center w-4 h-4 rounded-full text-slate-400 hover:text-slate-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1 transition-colors"
      >
        {/* ⓘ icon — inline SVG so no icon lib dep */}
        <svg
          viewBox="0 0 16 16"
          fill="currentColor"
          aria-hidden="true"
          className="w-3.5 h-3.5"
        >
          <path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1zm0 1.5a5.5 5.5 0 1 1 0 11 5.5 5.5 0 0 1 0-11zm0 2a.75.75 0 1 0 0 1.5A.75.75 0 0 0 8 4.5zm-.75 2.25a.75.75 0 0 0 0 1.5h.25v2.5H7a.75.75 0 0 0 0 1.5h2a.75.75 0 0 0 0-1.5h-.25v-3.25A.75.75 0 0 0 8 6.75h-.75z" />
        </svg>
      </button>

      {open && (
        <div
          id={tooltipId}
          role="tooltip"
          className={`
            absolute z-50 left-1/2 -translate-x-1/2 ${positionCls}
            w-64 bg-slate-900 text-slate-100 text-xs leading-relaxed
            rounded-lg px-3 py-2.5 shadow-xl
            pointer-events-none
          `}
        >
          {/* Arrow */}
          <span
            aria-hidden="true"
            className={`
              absolute left-1/2 -translate-x-1/2
              ${position === 'bottom' ? '-top-1.5 border-b-slate-900' : '-bottom-1.5 border-t-slate-900'}
              w-0 h-0
              border-l-[6px] border-l-transparent
              border-r-[6px] border-r-transparent
              ${position === 'bottom'
                ? 'border-b-[6px] border-b-slate-900'
                : 'border-t-[6px] border-t-slate-900'}
            `}
          />
          {content}
        </div>
      )}
    </span>
  );
};

export default InfoTooltip;
