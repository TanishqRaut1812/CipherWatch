import React from 'react'

export default function CriticalIncidentBar({ session, onInvestigate }) {
  // If no session passed or risk score is low, show quiet collapsed state
  const isCritical = session && (session.risk_score || 0.88) >= 0.70

  if (!isCritical) {
    return (
      <div
        className="alert-feed-card"
        style={{
          padding: '12px 20px',
          display: 'flex',
          justify: 'space-between',
          alignItems: 'center',
          background: 'var(--gradient-card-surface)',
          border: '1px solid var(--colors-hairline-on-dark)',
          borderRadius: 'var(--rounded-md)',
          marginBottom: '16px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span className="glow-contained" style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--colors-risk-contained)', display: 'inline-block' }}></span>
          <span className="section-terminal-label" style={{ fontSize: '11px', color: 'var(--colors-risk-contained)' }}>
            TIER 1 CRITICAL INCIDENT AUDIT
          </span>
          <span className="body-sm" style={{ color: 'var(--colors-muted-strong)', fontSize: '12px' }}>
            No active critical threats detected — fleet security nominal.
          </span>
        </div>
        <span className="body-sm tabular-nums" style={{ color: 'var(--colors-muted)', fontSize: '11px' }}>
          0 Active Critical Escalations
        </span>
      </div>
    )
  }

  // Compressed event chain summary
  const eventChainSummary = session.events && session.events.length > 0
    ? session.events.map(e => e.event_type.replace('_', ' ')).slice(0, 3).join(' → ')
    : 'Encrypted Archive → USB Insert → Cloud Upload Exfiltration'

  const entityName = session.user_id || session.hostname || session.device_id || 'agent-fin04'
  const riskScorePct = ((session.risk_score || 0.88) * 100).toFixed(0)

  return (
    <div
      className="glow-escalating"
      style={{
        padding: '14px 24px',
        background: 'linear-gradient(135deg, rgba(246, 70, 93, 0.18) 0%, rgba(30, 35, 41, 0.95) 100%)',
        border: '1px solid rgba(246, 70, 93, 0.5)',
        borderRadius: 'var(--rounded-md)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '20px',
        marginBottom: '16px',
        flexWrap: 'wrap',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flex: 1, minWidth: '300px' }}>
        <div
          className="glow-escalating"
          style={{
            padding: '6px 12px',
            borderRadius: 'var(--rounded-sm)',
            background: 'var(--gradient-risk-escalating)',
            color: '#ffffff',
            fontWeight: '700',
            fontSize: '12px',
            letterSpacing: '0.05em',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          <span>🚨 HIGHEST CRITICAL THREAT</span>
        </div>

        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <strong className="body-md" style={{ color: 'var(--colors-on-dark)', fontWeight: 700 }}>
              {entityName}
            </strong>
            <span className="badge badge-danger text-gradient-escalating" style={{ fontSize: '13px', padding: '2px 8px' }}>
              {riskScorePct}% RISK
            </span>
          </div>
          <p className="body-sm" style={{ color: 'var(--colors-muted-strong)', marginTop: '2px', fontFamily: 'var(--font-mono)', fontSize: '11px' }}>
            Sequence: <span style={{ color: 'var(--colors-primary)' }}>{eventChainSummary}</span>
          </p>
        </div>
      </div>

      <button
        onClick={() => onInvestigate && onInvestigate(session)}
        className="btn-primary glow-primary"
        style={{
          height: '36px',
          padding: '0 20px',
          fontSize: '13px',
          whiteSpace: 'nowrap',
        }}
      >
        <span>🔍 Investigate Incident →</span>
      </button>
    </div>
  )
}
