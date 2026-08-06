import React, { useState } from 'react';

// Lightweight, zero-dependency Recharts-compatible visual chart engine for CipherWatch

export const ResponsiveContainer = ({ width = '100%', height = '100%', children }) => {
  return (
    <div style={{ width, height, position: 'relative', overflow: 'hidden' }}>
      {children}
    </div>
  );
};

export const CartesianGrid = () => null;
export const XAxis = () => null;
export const YAxis = () => null;
export const Cell = () => null;

export const Tooltip = ({ content, contentStyle }) => null;

export const PieChart = ({ children }) => {
  const [hoveredIdx, setHoveredIdx] = useState(null);

  // Extract Pie data & Tooltip from children
  let pieProps = null;
  let cells = [];
  React.Children.forEach(children, child => {
    if (child && child.type === Pie) {
      pieProps = child.props;
      React.Children.forEach(child.props.children, c => {
        if (c && c.props) cells.push(c.props);
      });
    }
  });

  if (!pieProps || !pieProps.data) return null;

  const data = pieProps.data;
  const total = data.reduce((sum, item) => sum + (item.value || 0), 0) || 1;

  let currentAngle = 0;
  const slices = data.map((item, idx) => {
    const value = item.value || 0;
    const percentage = value / total;
    const angle = percentage * 360;
    const startAngle = currentAngle;
    const endAngle = currentAngle + angle;
    currentAngle = endAngle;

    const color = cells[idx]?.fill || item.color || '#fcd535';
    return { ...item, percentage, startAngle, endAngle, color, idx };
  });

  const getCoordinatesForPercent = (percent) => {
    const x = Math.cos(2 * Math.PI * percent);
    const y = Math.sin(2 * Math.PI * percent);
    return [x, y];
  };

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
      <svg viewBox="-1 -1 2 2" style={{ transform: 'rotate(-90deg)', width: '100%', height: '100%', maxHeight: '140px' }}>
        {slices.map((slice) => {
          if (slice.percentage >= 0.999) {
            return (
              <circle
                key={slice.idx}
                cx="0"
                cy="0"
                r="0.75"
                fill="none"
                stroke={slice.color}
                strokeWidth="0.35"
              />
            );
          }

          const [startX, startY] = getCoordinatesForPercent(slice.startAngle / 360);
          const [endX, endY] = getCoordinatesForPercent(slice.endAngle / 360);
          const largeArcFlag = slice.percentage > 0.5 ? 1 : 0;

          const rOuter = hoveredIdx === slice.idx ? 0.88 : 0.82;
          const rInner = 0.52;

          const pathData = [
            `M ${startX * rOuter} ${startY * rOuter}`,
            `A ${rOuter} ${rOuter} 0 ${largeArcFlag} 1 ${endX * rOuter} ${endY * rOuter}`,
            `L ${endX * rInner} ${endY * rInner}`,
            `A ${rInner} ${rInner} 0 ${largeArcFlag} 0 ${startX * rInner} ${startY * rInner}`,
            'Z',
          ].join(' ');

          return (
            <path
              key={slice.idx}
              d={pathData}
              fill={slice.color}
              onMouseEnter={() => setHoveredIdx(slice.idx)}
              onMouseLeave={() => setHoveredIdx(null)}
              style={{
                transition: 'all 0.2s ease',
                cursor: 'pointer',
                opacity: hoveredIdx !== null && hoveredIdx !== slice.idx ? 0.65 : 1,
              }}
            />
          );
        })}
      </svg>
      {hoveredIdx !== null && (
        <div
          style={{
            position: 'absolute',
            bottom: '-24px',
            backgroundColor: '#070a12',
            border: `1px solid ${slices[hoveredIdx].color}`,
            borderRadius: '6px',
            padding: '4px 8px',
            fontSize: '11px',
            color: '#ffffff',
            pointerEvents: 'none',
            whiteSpace: 'nowrap',
            boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
            zIndex: 10,
          }}
        >
          {slices[hoveredIdx].name}: <strong>{slices[hoveredIdx].value}</strong> ({Math.round(slices[hoveredIdx].percentage * 100)}%)
        </div>
      )}
    </div>
  );
};

export const Pie = ({ children }) => null;

export const BarChart = ({ data, margin, children }) => {
  const [hoveredIdx, setHoveredIdx] = useState(null);

  if (!data || data.length === 0) return null;

  // Extract Bar keys and Cells
  let barKey = 'events';
  let cells = [];

  React.Children.forEach(children, child => {
    if (child && child.type === Bar) {
      barKey = child.props.dataKey || barKey;
      React.Children.forEach(child.props.children, c => {
        if (c && c.props) cells.push(c.props);
      });
    }
  });

  const values = data.map(d => d[barKey] || d.threats || d.events || 0);
  const maxVal = Math.max(...values, 100);

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', position: 'relative' }}>
      <div style={{ flex: 1, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: '8px', paddingBottom: '20px' }}>
        {data.map((item, idx) => {
          const val = item[barKey] || item.threats || item.events || 0;
          const heightPct = Math.min(100, Math.max(12, (val / maxVal) * 100));
          const color = cells[idx]?.fill || (val >= 90 ? '#f6465d' : val >= 60 ? '#fcd535' : '#0ecb81');
          const isHovered = hoveredIdx === idx;

          return (
            <div
              key={idx}
              onMouseEnter={() => setHoveredIdx(idx)}
              onMouseLeave={() => setHoveredIdx(null)}
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                height: '100%',
                justify: 'flex-end',
                cursor: 'pointer',
                position: 'relative',
              }}
            >
              {isHovered && (
                <div
                  style={{
                    position: 'absolute',
                    top: '-28px',
                    backgroundColor: '#070a12',
                    border: `1px solid ${color}`,
                    borderRadius: '4px',
                    padding: '2px 6px',
                    fontSize: '10px',
                    color: '#ffffff',
                    whiteSpace: 'nowrap',
                    boxShadow: '0 4px 10px rgba(0,0,0,0.5)',
                    zIndex: 10,
                  }}
                >
                  {item.time || `T-${idx}`}: <strong>{val}</strong>
                </div>
              )}
              <div
                style={{
                  width: '80%',
                  maxWidth: '28px',
                  height: `${heightPct}%`,
                  backgroundColor: color,
                  borderRadius: '4px 4px 0 0',
                  boxShadow: isHovered ? `0 0 12px ${color}` : `0 0 6px ${color}40`,
                  transition: 'all 0.2s ease',
                  opacity: isHovered ? 1 : 0.85,
                }}
              />
              <span style={{ fontSize: '10px', color: '#64748b', marginTop: '6px', fontWeight: '600' }}>
                {item.time || ''}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export const Bar = ({ children }) => null;

export const AreaChart = ({ data, children }) => {
  const [hoveredIdx, setHoveredIdx] = useState(null);

  if (!data || data.length === 0) return null;

  const scores = data.map(d => d.score !== undefined ? d.score : (d.risk > 1 ? d.risk : Math.round(d.risk * 100)));
  const width = 500;
  const height = 160;
  const padding = 20;

  const points = data.map((d, i) => {
    const x = padding + (i / Math.max(data.length - 1, 1)) * (width - 2 * padding);
    const score = scores[i];
    const y = height - padding - (score / 100) * (height - 2 * padding);
    return { ...d, score, x, y };
  });

  const pathD = points.reduce((acc, pt, i) => {
    return i === 0 ? `M ${pt.x} ${pt.y}` : `${acc} L ${pt.x} ${pt.y}`;
  }, '');

  const areaD = `${pathD} L ${points[points.length - 1].x} ${height - padding} L ${points[0].x} ${height - padding} Z`;

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: '100%', display: 'block' }}>
        <defs>
          <linearGradient id="compatRiskGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f6465d" stopOpacity="0.45" />
            <stop offset="50%" stopColor="#fcd535" stopOpacity="0.2" />
            <stop offset="100%" stopColor="#0ecb81" stopOpacity="0.0" />
          </linearGradient>
        </defs>

        {/* Grid lines */}
        {[0.25, 0.5, 0.75].map(v => (
          <line
            key={v}
            x1={padding}
            y1={height - padding - v * (height - 2 * padding)}
            x2={width - padding}
            y2={height - padding - v * (height - 2 * padding)}
            stroke="#1e293b"
            strokeDasharray="3 3"
          />
        ))}

        {/* Area fill */}
        <path d={areaD} fill="url(#compatRiskGrad)" />

        {/* Trend stroke */}
        <path d={pathD} fill="none" stroke="#fcd535" strokeWidth="3" strokeLinecap="round" />

        {/* Points */}
        {points.map((pt, i) => {
          const isHigh = pt.score >= 70;
          const isHovered = hoveredIdx === i;
          return (
            <circle
              key={i}
              cx={pt.x}
              cy={pt.y}
              r={isHovered ? 7 : 5}
              fill={isHigh ? '#f6465d' : pt.score >= 40 ? '#fcd535' : '#0ecb81'}
              stroke="#070a12"
              strokeWidth="2"
              style={{ cursor: 'pointer', transition: 'all 0.15s ease' }}
              onMouseEnter={() => setHoveredIdx(i)}
              onMouseLeave={() => setHoveredIdx(null)}
            />
          );
        })}
      </svg>

      {hoveredIdx !== null && (
        <div
          style={{
            position: 'absolute',
            top: '8px',
            left: `${(points[hoveredIdx].x / width) * 100}%`,
            transform: 'translateX(-50%)',
            backgroundColor: '#070a12',
            border: `1px solid ${points[hoveredIdx].score >= 70 ? '#f6465d' : '#fcd535'}`,
            borderRadius: '6px',
            padding: '6px 12px',
            fontSize: '11px',
            color: '#f8fafc',
            pointerEvents: 'none',
            whiteSpace: 'nowrap',
            boxShadow: '0 8px 20px rgba(0,0,0,0.6)',
            zIndex: 10,
          }}
        >
          <div style={{ color: points[hoveredIdx].score >= 70 ? '#f6465d' : '#fcd535', fontWeight: '800' }}>
            {points[hoveredIdx].label || 'Timeline Step'} ({points[hoveredIdx].time})
          </div>
          <div>
            Risk Score: <strong>{points[hoveredIdx].score}%</strong>
          </div>
        </div>
      )}
    </div>
  );
};

export const Area = () => null;

export default {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  AreaChart,
  Area,
  CartesianGrid,
};
