import React from 'react';

const FACTOR_METADATA = [
  { key: 'isolation_forest_ml', label: 'Isolation Forest ML', maxPts: 25, color: 'var(--colors-primary)' },
  { key: 'rule_heuristics', label: 'Rule Heuristics', maxPts: 25, color: '#f59e0b' },
  { key: 'folder_sensitivity', label: 'Folder Sensitivity', maxPts: 10, color: 'var(--colors-risk-escalating)' },
  { key: 'baseline_deviation', label: 'Baseline Deviation', maxPts: 15, color: 'var(--colors-info)' },
  { key: 'graph_topology', label: 'Graph Topology', maxPts: 15, color: '#a855f7' },
  { key: 'longitudinal_drift', label: '14-Day Longitudinal Drift', maxPts: 10, color: 'var(--colors-risk-contained)' },
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
    if (score >= 70) return 'badge-danger';
    if (score >= 40) return 'badge-warning';
    return 'badge-success';
  };

  return (
    <div className="alert-feed-card" style={{ padding: '24px', height: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <h3 className="title-md" style={{ color: 'var(--colors-on-dark)', margin: 0 }}>
            Risk Factor Breakdown
          </h3>
          <span className="body-sm" style={{ color: 'var(--colors-muted-strong)' }}>
            Intent: <strong style={{ color: 'var(--colors-primary)' }}>{predicted_intent || 'Analyzing...'}</strong>
          </span>
        </div>
        <div className={`badge ${getScoreBadgeClass(risk_score)} tabular-nums`} style={{ fontSize: '13px', padding: '6px 14px' }}>
          {risk_score} / 100
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {FACTOR_METADATA.map(({ key, label, maxPts, color }) => {
          const val = breakdown?.[key] || 0.0;
          const pct = Math.min(100, Math.max(0, (val / maxPts) * 100));

          return (
            <div key={key}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '6px' }}>
                <span style={{ color: 'var(--colors-muted-strong)' }}>{label}</span>
                <span className="tabular-nums" style={{ color: 'var(--colors-on-dark)', fontWeight: '600' }}>
                  +{val} pts <span style={{ color: 'var(--colors-muted)' }}>/ {maxPts}</span>
                </span>
              </div>
              <div
                style={{
                  width: '100%',
                  height: '6px',
                  backgroundColor: 'var(--colors-canvas-dark)',
                  borderRadius: '3px',
                  overflow: 'hidden',
                  border: '1px solid var(--colors-hairline-on-dark)',
                }}
              >
                <div
                  style={{
                    width: `${pct}%`,
                    height: '100%',
                    backgroundColor: color,
                    borderRadius: '3px',
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
          <div className="body-sm" style={{ textTransform: 'uppercase', color: 'var(--colors-muted)', marginBottom: '8px', letterSpacing: '0.02em', fontSize: '11px', fontWeight: 600 }}>
            Graph Topology Patterns ({topology_multiplier}x Multiplier)
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
                padding: '6px 10px',
                marginBottom: '6px',
              }}
            >
              ⚡ {pat}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default RiskBreakdown;
