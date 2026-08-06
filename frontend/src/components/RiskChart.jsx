import React, { useState } from 'react';

export const RiskChart = ({ data }) => {
  const [hoveredPoint, setHoveredPoint] = useState(null);

  // Default timeline data if none passed
  const chartData = data && data.length > 0 ? data : [
    { time: '10:00', risk: 0.12, label: 'Baseline' },
    { time: '10:15', risk: 0.18, label: 'Dev Activity' },
    { time: '10:30', risk: 0.45, label: 'USB Insert' },
    { time: '10:45', risk: 0.88, label: 'Archive Exfil' },
    { time: '11:00', risk: 0.94, label: 'Cloud Upload' },
    { time: '11:15', risk: 0.65, label: 'Post-Event' },
  ];

  const width = 500;
  const height = 180;
  const padding = 30;

  const points = chartData.map((d, i) => {
    const x = padding + (i / (chartData.length - 1)) * (width - 2 * padding);
    const y = height - padding - d.risk * (height - 2 * padding);
    return { ...d, x, y };
  });

  const pathD = points.reduce((acc, point, i) => {
    return i === 0 ? `M ${point.x} ${point.y}` : `${acc} L ${point.x} ${point.y}`;
  }, '');

  const areaD = `${pathD} L ${points[points.length - 1].x} ${height - padding} L ${points[0].x} ${height - padding} Z`;

  return (
    <div className="alert-feed-card" style={{ padding: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <div>
          <div className="section-terminal-label" style={{ marginBottom: '4px' }}>
            <span>📈 LONGITUDINAL RISK SCORE TREND</span>
          </div>
          <h3 className="title-sm" style={{ color: 'var(--colors-on-dark)', margin: 0 }}>
            Session Risk Progression
          </h3>
        </div>
        <span className="body-sm tabular-nums" style={{ color: 'var(--colors-primary)', fontWeight: '600' }}>
          ● LIVE TRACKING
        </span>
      </div>

      <div style={{ position: 'relative', width: '100%', overflowX: 'auto' }}>
        <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
          <defs>
            <linearGradient id="riskGradientArea" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f6465d" stopOpacity="0.35" />
              <stop offset="50%" stopColor="#fcd535" stopOpacity="0.15" />
              <stop offset="100%" stopColor="#fcd535" stopOpacity="0.0" />
            </linearGradient>
            <linearGradient id="strokeGradientTrend" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#0ecb81" />
              <stop offset="50%" stopColor="#ffe066" />
              <stop offset="100%" stopColor="#ff6b7a" />
            </linearGradient>
            <filter id="currentPointGlow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="5" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* Grid lines */}
          {[0.25, 0.5, 0.75].map((val) => {
            const y = height - padding - val * (height - 2 * padding);
            return (
              <line
                key={val}
                x1={padding}
                y1={y}
                x2={width - padding}
                y2={y}
                stroke="var(--colors-hairline-on-dark)"
                strokeDasharray="4 4"
              />
            );
          })}

          {/* Filled Area */}
          <path d={areaD} fill="url(#riskGradientArea)" />

          {/* Stroke Path */}
          <path d={pathD} fill="none" stroke="url(#strokeGradientTrend)" strokeWidth="3" strokeLinecap="round" />

          {/* Data Points */}
          {points.map((pt, idx) => {
            const isLatest = idx === points.length - 1;
            return (
              <circle
                key={idx}
                cx={pt.x}
                cy={pt.y}
                r={hoveredPoint === idx ? 7 : isLatest ? 6 : 4}
                fill={pt.risk > 0.7 ? '#ff6b7a' : pt.risk > 0.4 ? '#ffe066' : '#2effa2'}
                stroke="var(--colors-canvas-dark)"
                strokeWidth="2"
                filter={isLatest ? 'url(#currentPointGlow)' : 'none'}
                style={{ cursor: 'pointer', transition: 'all 0.15s ease' }}
                onMouseEnter={() => setHoveredPoint(idx)}
                onMouseLeave={() => setHoveredPoint(null)}
              />
            );
          })}
        </svg>

        {/* Hover Tooltip */}
        {hoveredPoint !== null && (
          <div
            style={{
              position: 'absolute',
              top: '10px',
              left: `${(points[hoveredPoint].x / width) * 100}%`,
              transform: 'translateX(-50%)',
              background: 'var(--colors-canvas-dark)',
              border: '1px solid var(--colors-hairline-on-dark)',
              borderRadius: 'var(--rounded-sm)',
              padding: '6px 12px',
              fontSize: '11px',
              color: 'var(--colors-on-dark)',
              pointerEvents: 'none',
              whiteSpace: 'nowrap',
            }}
          >
            <strong>{points[hoveredPoint].label}</strong> ({points[hoveredPoint].time}):{' '}
            <span className="tabular-nums" style={{ color: points[hoveredPoint].risk > 0.7 ? 'var(--colors-risk-escalating)' : 'var(--colors-risk-contained)' }}>
              {(points[hoveredPoint].risk * 100).toFixed(0)}%
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

export default RiskChart;
