import React from 'react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from './RechartsCompat';

export const RiskChart = ({ data }) => {
  // Default timeline data if none passed
  const chartData = data && data.length > 0 ? data : [
    { time: '10:00', risk: 12, label: 'Baseline' },
    { time: '10:15', risk: 18, label: 'Dev Activity' },
    { time: '10:30', risk: 45, label: 'USB Insert' },
    { time: '10:45', risk: 88, label: 'Archive Exfil' },
    { time: '11:00', risk: 94, label: 'Cloud Upload' },
    { time: '11:15', risk: 65, label: 'Post-Event' },
  ];

  // Map values to 0-100 scale if 0-1 scale provided
  const formattedData = chartData.map(d => ({
    ...d,
    score: d.risk > 1 ? d.risk : Math.round(d.risk * 100),
  }));

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const p = payload[0].payload;
      const isHigh = p.score >= 70;
      return (
        <div
          style={{
            backgroundColor: '#0c0f1d',
            border: `1px solid ${isHigh ? '#f6465d' : '#fcd535'}`,
            borderRadius: '8px',
            padding: '8px 14px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
            color: '#f8fafc',
            fontSize: '12px',
          }}
        >
          <div style={{ fontWeight: '800', color: isHigh ? '#f6465d' : '#fcd535', marginBottom: '2px' }}>
            {p.label || 'Timeline Event'} ({p.time})
          </div>
          <div>
            Risk Score:{' '}
            <span style={{ fontWeight: '900', color: isHigh ? '#f6465d' : '#0ecb81' }}>
              {p.score}%
            </span>
          </div>
        </div>
      );
    }
    return null;
  };

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
        <span className="body-sm tabular-nums" style={{ color: '#fcd535', fontWeight: '800' }}>
          ● RECHARTS ENGINE LIVE
        </span>
      </div>

      <div style={{ width: '100%', height: 220 }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={formattedData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="rechartsRiskGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#f6465d" stopOpacity={0.45} />
                <stop offset="50%" stopColor="#fcd535" stopOpacity={0.2} />
                <stop offset="100%" stopColor="#0ecb81" stopOpacity={0.0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
            <XAxis dataKey="time" stroke="#64748b" fontSize={11} tickLine={false} />
            <YAxis domain={[0, 100]} stroke="#64748b" fontSize={11} tickLine={false} />
            <Tooltip content={<CustomTooltip />} />
            <Area
              type="monotone"
              dataKey="score"
              stroke="#fcd535"
              strokeWidth={3}
              fillOpacity={1}
              fill="url(#rechartsRiskGradient)"
              activeDot={{ r: 6, fill: '#f6465d', stroke: '#ffffff', strokeWidth: 2 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default RiskChart;
