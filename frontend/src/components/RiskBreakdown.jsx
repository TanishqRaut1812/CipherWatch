import React from 'react';

const FACTOR_METADATA = [
  { key: 'isolation_forest_ml', label: 'Isolation Forest ML', maxPts: 25, color: 'var(--primary-cyan)' },
  { key: 'rule_heuristics', label: 'Rule Heuristics', maxPts: 25, color: 'var(--accent-amber)' },
  { key: 'folder_sensitivity', label: 'Folder Sensitivity', maxPts: 10, color: 'var(--accent-red)' },
  { key: 'baseline_deviation', label: 'Baseline Deviation', maxPts: 15, color: 'var(--primary-blue)' },
  { key: 'graph_topology', label: 'Graph Topology', maxPts: 15, color: '#a855f7' },
  { key: 'longitudinal_drift', label: '14-Day Longitudinal Drift', maxPts: 10, color: 'var(--accent-green)' },
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
    <div className="feature-card" style={{ padding: '24px', height: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <h3 className="title-md" style={{ color: 'var(--text-primary)', margin: 0 }}>
            Risk Factor Breakdown
          </h3>
          <span className="body-sm" style={{ color: 'var(--text-secondary)' }}>
            Intent: <strong style={{ color: 'var(--primary-blue)' }}>{predicted_intent || 'Analyzing...'}</strong>
          </span>
        </div>
        <div className={`badge ${getScoreBadgeClass(risk_score)}`} style={{ fontSize: '13px', padding: '6px 14px' }}>
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
                <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
                <span style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', fontWeight: '600' }}>
                  +{val} pts <span style={{ color: 'var(--text-muted)' }}>/ {maxPts}</span>
                </span>
              </div>
              <div
                style={{
                  width: '100%',
                  height: '6px',
                  backgroundColor: 'var(--surface-soft)',
                  borderRadius: '3px',
                  overflow: 'hidden',
                  border: '1px solid var(--border-subtle)',
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
        <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid var(--border-subtle)' }}>
          <div className="caption" style={{ textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '8px', letterSpacing: '0.02em' }}>
            Graph Topology Patterns ({topology_multiplier}x Multiplier)
          </div>
          {matched_patterns.map((pat, idx) => (
            <div
              key={idx}
              style={{
                fontSize: '11px',
                fontFamily: 'var(--font-mono)',
                color: 'var(--primary-blue)',
                background: 'rgba(59, 130, 246, 0.08)',
                border: '1px solid rgba(59, 130, 246, 0.2)',
                borderRadius: 'var(--radius-sm)',
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
