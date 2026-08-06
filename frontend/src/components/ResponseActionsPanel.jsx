import React, { useState } from 'react'

export default function ResponseActionsPanel({ selectedEntity, onFeedbackSubmitted }) {
  const [toast, setToast] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [notes, setNotes] = useState('')

  const handleAction = (actionType) => {
    setSubmitting(true)
    setToast(null)

    setTimeout(() => {
      setSubmitting(false)
      const entityName = selectedEntity?.hostname || selectedEntity?.user_id || 'Target Host'
      if (actionType === 'WARN') {
        setToast(`⚡ Warning notification dispatched to operator of ${entityName}.`)
      } else if (actionType === 'SUSPEND') {
        setToast(`⚠️ Active session for ${entityName} suspended. User locked out.`)
      } else if (actionType === 'TERMINATE') {
        setToast(`🚨 Terminate signal sent! Rust agent on ${entityName} revoking process tree.`)
      } else if (actionType === 'FALSE_POSITIVE') {
        setToast(`✨ Marked False Positive. Baseline tolerance auto-dampened for ${entityName}.`)
        if (onFeedbackSubmitted) onFeedbackSubmitted(selectedEntity?.id, 'FALSE_POSITIVE')
      } else if (actionType === 'CONFIRMED_THREAT') {
        setToast(`🚨 Threat Confirmed. Incident escalated for ${entityName}.`)
        if (onFeedbackSubmitted) onFeedbackSubmitted(selectedEntity?.id, 'CONFIRMED_THREAT')
      } else if (actionType === 'RESOLVED') {
        setToast(`✅ Incident resolved for ${entityName}. Alerts cleared.`)
        if (onFeedbackSubmitted) onFeedbackSubmitted(selectedEntity?.id, 'RESOLVED')
      }
    }, 400)
  }

  // Quiet placeholder state when no entity is selected
  if (!selectedEntity) {
    return (
      <div className="alert-feed-card" style={{ padding: '24px', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center', background: 'var(--gradient-card-surface)' }}>
        <div className="section-terminal-label" style={{ marginBottom: '8px' }}>
          <span>🛡️ RESPONSE ACTIONS WORKSPACE</span>
        </div>
        <div style={{ fontSize: '36px', marginBottom: '8px', opacity: 0.7 }}>🔍</div>
        <h4 className="title-sm" style={{ color: 'var(--colors-muted-strong)', margin: 0 }}>
          No Endpoint Host Selected
        </h4>
        <p className="body-sm" style={{ color: 'var(--colors-muted)', marginTop: '4px', maxWidth: '280px' }}>
          Select an entity from the Monitored Fleet list on the left to stage response actions or submit SOC feedback.
        </p>
      </div>
    )
  }

  const entityName = selectedEntity.hostname || selectedEntity.user_id || selectedEntity.device_id || 'agent-fin04'
  const ip = selectedEntity.ip_address || '192.168.1.45'
  const isOnline = selectedEntity.is_online !== false

  return (
    <div className="alert-feed-card" style={{ padding: '20px', height: '100%', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Header & Scoped Entity Meta */}
      <div>
        <div className="section-terminal-label" style={{ marginBottom: '4px' }}>
          <span>🛡️ SCOPED RESPONSE ACTIONS & SOC TRIAGE</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 className="title-md" style={{ color: 'var(--colors-on-dark)', margin: 0 }}>
            {entityName}
          </h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span className={isOnline ? 'glow-contained' : ''} style={{ width: '8px', height: '8px', borderRadius: '50%', background: isOnline ? 'var(--colors-risk-contained)' : 'var(--colors-muted)' }}></span>
            <span className="body-sm tabular-nums" style={{ color: 'var(--colors-muted-strong)', fontSize: '11px' }}>{ip}</span>
          </div>
        </div>
      </div>

      {/* Escalation Severity Tiers */}
      <div>
        <span className="section-terminal-label" style={{ fontSize: '10px', marginBottom: '8px' }}>
          ESCALATING ENFORCEMENT TIERS
        </span>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '6px' }}>
          <button
            disabled={submitting}
            onClick={() => handleAction('WARN')}
            className="btn-primary"
            style={{ flex: 1, minWidth: '100px', height: '36px', fontSize: '12px' }}
          >
            ⚡ Warn User
          </button>

          <button
            disabled={submitting}
            onClick={() => handleAction('SUSPEND')}
            className="btn-amber-gradient"
            style={{ flex: 1, minWidth: '100px', height: '36px', fontSize: '12px' }}
          >
            ⚠️ Suspend
          </button>

          <button
            disabled={submitting}
            onClick={() => handleAction('TERMINATE')}
            className="btn-danger-outline glow-escalating"
            style={{ flex: 1, minWidth: '100px', height: '36px', fontSize: '12px', background: 'var(--gradient-risk-escalating)', color: '#ffffff', border: 'none' }}
          >
            🚨 Terminate
          </button>
        </div>
      </div>

      {/* Optional Triage Notes Input */}
      <div>
        <span className="section-terminal-label" style={{ fontSize: '10px', marginBottom: '6px' }}>
          TRIAGE & BASELINE ADJUSTMENT NOTES
        </span>
        <input
          type="text"
          className="input-text"
          placeholder="Add optional analyst notes for profile tuning..."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          style={{ fontSize: '12px', height: '34px', marginTop: '4px' }}
        />
      </div>

      {/* Folded SOC Feedback Actions */}
      <div>
        <span className="section-terminal-label" style={{ fontSize: '10px', marginBottom: '8px' }}>
          FOLDED SOC FEEDBACK CONTROLS
        </span>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '6px' }}>
          <button
            disabled={submitting}
            onClick={() => handleAction('FALSE_POSITIVE')}
            className="btn-warning-outline"
            style={{ flex: 1, fontSize: '11px', height: '32px' }}
          >
            ⚡ False Positive
          </button>

          <button
            disabled={submitting}
            onClick={() => handleAction('CONFIRMED_THREAT')}
            className="btn-danger-outline"
            style={{ flex: 1, fontSize: '11px', height: '32px' }}
          >
            🚨 Confirm Threat
          </button>

          <button
            disabled={submitting}
            onClick={() => handleAction('RESOLVED')}
            className="btn-success-outline"
            style={{ flex: 1, fontSize: '11px', height: '32px' }}
          >
            ✅ Resolve Alert
          </button>
        </div>
      </div>

      {/* Action Toast Feedback Banner */}
      {toast && (
        <div
          style={{
            padding: '8px 12px',
            background: 'var(--colors-canvas-dark)',
            border: '1px solid var(--colors-hairline-on-dark)',
            borderRadius: 'var(--rounded-md)',
            fontSize: '11px',
            color: 'var(--colors-primary)',
            fontFamily: 'var(--font-mono)',
            boxShadow: 'var(--shadow-glow-primary)',
          }}
        >
          {toast}
        </div>
      )}
    </div>
  )
}
