import React from 'react';

const FACTOR_METADATA = [
  { key: 'isolation_forest_ml', label: 'Isolation Forest ML', maxPts: 25, grad: 'var(--gradient-primary)' },
  { key: 'rule_heuristics', label: 'Rule Heuristics', maxPts: 25, grad: 'var(--gradient-primary-reverse)' },
  { key: 'folder_sensitivity', label: 'Folder Sensitivity', maxPts: 10, grad: 'var(--gradient-risk-escalating)' },
  { key: 'baseline_deviation', label: 'Baseline Deviation', maxPts: 15, grad: 'linear-gradient(135deg, #ffe066 0%, #fcd535 100%)' },
  { key: 'graph_topology', label: 'Graph Topology', maxPts: 15, grad: 'linear-gradient(135deg, #ff7b89 0%, #f6465d 100%)' },
  { key: 'longitudinal_drift', label: '14-Day Longitudinal Drift', maxPts: 10, grad: 'var(--gradient-risk-contained)' },
];

export const RiskBreakdown = ({ breakdownData }) => {
  const data = breakdownData || {
    risk_score: 78.5,
    predicted_intent: 'Cloud Exfiltration Staging',
    breakdown: {
      isolation_forest_ml: 22.5,
      rule_heuristics: 20.0,
      folder_sensitivity: 2.5,
      baseline_deviation: 10.0,
      graph_topology: 15.5,
      longitudinal_drift: 8.0,
    },
    matched_patterns: [
      'TRIPLE_EXFILTRATION_CHAIN: Encrypted Archive + USB Insert + Cloud Upload',
    ],
    topology_multiplier: 1.5,
  };

  const { risk_score, predicted_intent, breakdown, matched_patterns, topology_multiplier } = data;

  const getScoreBadgeClass = (score) => {
    if (score >= 70) return 'badge-danger glow-escalating';
    if (score >= 40) return 'badge-warning';
    return 'badge-success';
  };

  return (
    <div className="alert-feed-card" style={{ padding: '24px', height: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <div className="section-terminal-label" style={{ marginBottom: '4px' }}>
            <span>📊 RISK FACTOR BREAKDOWN</span>
          </div>
          <h3 className="title-md" style={{ color: 'var(--colors-on-dark)', margin: 0 }}>
            Intent: <span className="text-gradient-primary">{predicted_intent || 'Analyzing...'}</span>
          </h3>
        </div>
        <div className={`badge ${getScoreBadgeClass(risk_score)} tabular-nums`} style={{ fontSize: '13px', padding: '6px 14px' }}>
          {risk_score} / 100
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {FACTOR_METADATA.map(({ key, label, maxPts, grad }) => {
          const val = breakdown?.[key] || 0.0;
          const pct = Math.min(100, Math.max(0, (val / maxPts) * 100));

          // Vary progress bar height by point weight
          const barHeight = val >= 18 ? 12 : val >= 10 ? 8 : 5;
          const isHeavy = val >= 18;

          return (
            <div key={key}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '6px' }}>
                <span style={{ color: 'var(--colors-muted-strong)', fontWeight: isHeavy ? '600' : '400' }}>{label}</span>
                <span className="tabular-nums" style={{ color: isHeavy ? 'var(--colors-primary)' : 'var(--colors-on-dark)', fontWeight: '600' }}>
                  +{val} pts <span style={{ color: 'var(--colors-muted)' }}>/ {maxPts}</span>
                </span>
              </div>
              <div
                style={{
                  width: '100%',
                  height: `${barHeight}px`,
                  backgroundColor: 'var(--colors-canvas-dark)',
                  borderRadius: '4px',
                  overflow: 'hidden',
                  border: '1px solid var(--colors-hairline-on-dark)',
                }}
              >
                <div
                  style={{
                    width: `${pct}%`,
                    height: '100%',
                    background: grad,
                    borderRadius: '4px',
                    boxShadow: isHeavy ? 'var(--shadow-glow-primary)' : 'none',
                    transition: 'width 0.4s ease',
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {matched_patterns && matched_patterns.length > 0 && (
        <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid var(--colors-hairline-on-dark)' }}>
          <div className="section-terminal-label" style={{ marginBottom: '8px' }}>
            GRAPH TOPOLOGY PATTERNS ({topology_multiplier}x MULTIPLIER)
          </div>
          {matched_patterns.map((pat, idx) => (
            <div
              key={idx}
              style={{
                fontSize: '11px',
                fontFamily: 'var(--font-mono)',
                color: 'var(--colors-primary)',
                background: 'var(--colors-canvas-dark)',
                border: '1px solid var(--colors-hairline-on-dark)',
                borderRadius: 'var(--rounded-sm)',
                padding: '8px 12px',
                marginBottom: '6px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <span style={{ color: 'var(--colors-primary)' }}>⚡</span> {pat}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default RiskBreakdown;
