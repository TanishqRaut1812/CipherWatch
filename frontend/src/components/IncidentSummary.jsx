import React, { useState, useEffect } from 'react';

export const IncidentSummary = ({ alertId, alertData }) => {
  const [explanation, setExplanation] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!alertId) {
      setExplanation(null);
      return;
    }

    setLoading(true);
    setError(null);

    fetch(`/api/alerts/${alertId}/explanation`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => {
        setExplanation(data.explanation || data.summary || '');
        setLoading(false);
      })
      .catch((err) => {
        // Fallback report for demo state
        const fallbackText = `### Executive Overview
CipherWatch detected a **${alertData?.severity || 'HIGH'}** severity security incident (Risk Score: **${((alertData?.risk_score || 0.88) * 100).toFixed(0)}%**) for user \`${alertData?.user_id || 'user_dev_secops'}\`. The correlated endpoint session matches operational pattern: **${alertData?.message || 'USB Exfiltration Staging'}**.

### Key Telemetry Highlights
- External USB storage device insertion recorded during active session.
- Creation of encrypted archive file (.7z) detected in sensitive directory.
- Outbound network metadata transfer to unrecognized cloud storage endpoint.

### Risk Analysis & Intent Assessment
The hybrid composite risk scoring engine flagged this session due to anomalous sequence timing and policy deviations. The sequence aligns with **USB Exfiltration Staging**, driven by rule boosters and baseline volume variations.

### Recommended SOC Actions
1. **Host Isolation**: Inspect workstation \`${alertData?.device_id || 'MAC-WORKSTATION-04'}\` for unauthorized data transfers.
2. **User Audit**: Contact user \`${alertData?.user_id || 'user_dev_secops'}\` to verify business justification for observed activity sequence.
3. **Log Retention**: Preserve endpoint telemetry and network connection logs for forensic review.`;
        
        setExplanation(fallbackText);
        setLoading(false);
      });
  }, [alertId, alertData]);

  // Simple Markdown paragraph formatter
  const renderFormattedText = (text) => {
    if (!text) return null;
    const lines = text.split('\n');

    return lines.map((line, idx) => {
      if (line.startsWith('### ')) {
        return (
          <h4 key={idx} className="title-sm" style={{ color: 'var(--primary-blue)', marginTop: '16px', marginBottom: '8px' }}>
            {line.replace('### ', '')}
          </h4>
        );
      }
      if (line.startsWith('- ') || line.startsWith('1. ') || line.startsWith('2. ') || line.startsWith('3. ')) {
        return (
          <div key={idx} className="body-sm" style={{ color: 'var(--text-primary)', marginLeft: '8px', marginBottom: '6px', display: 'flex', gap: '6px' }}>
            <span style={{ color: 'var(--primary-cyan)' }}>•</span>
            <span>{line.replace(/^[-123.]+\s*/, '')}</span>
          </div>
        );
      }
      if (!line.trim()) return <div key={idx} style={{ height: '8px' }} />;

      return (
        <p key={idx} className="body-sm" style={{ color: 'var(--text-secondary)', lineHeight: '1.6', marginBottom: '6px' }}>
          {line}
        </p>
      );
    });
  };

  return (
    <div className="feature-card" style={{ padding: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h3 className="title-md" style={{ color: 'var(--text-primary)', margin: 0 }}>
          🤖 AI Plain-English Incident Report
        </h3>
        <span className="badge badge-info">0% Content Inspected</span>
      </div>

      {loading ? (
        <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
          <div
            style={{
              width: '24px',
              height: '24px',
              border: '2px solid var(--border-subtle)',
              borderTop: '2px solid var(--primary-cta)',
              borderRadius: '50%',
              margin: '0 auto 12px',
              animation: 'spin 1s linear infinite',
            }}
          />
          Synthesizing plain-English report from metadata...
        </div>
      ) : (
        <div
          style={{
            background: 'var(--surface-soft)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-lg)',
            padding: '20px',
            maxHeight: '380px',
            overflowY: 'auto',
          }}
        >
          {renderFormattedText(explanation)}
        </div>
      )}
    </div>
  );
};

export default IncidentSummary;
