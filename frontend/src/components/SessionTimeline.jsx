import React, { useState } from 'react'

export default function SessionTimeline({ session, onClose }) {
  const [selectedEventId, setSelectedEventId] = useState(null)

  if (!session) {
    return (
      <div className="feature-card" style={{ padding: '32px', textAlign: 'center' }}>
        <div style={{ fontSize: '32px', marginBottom: '12px' }}>📊</div>
        <h3 className="title-md" style={{ color: 'var(--text-primary)', marginBottom: '6px' }}>
          No Active Session Selected
        </h3>
        <p className="body-sm" style={{ color: 'var(--text-secondary)' }}>
          Select an alert or session from the live stream to inspect chronological telemetry steps.
        </p>
      </div>
    )
  }

  const {
    id,
    session_uuid,
    user_id,
    reconstructed_intent = 'Routine Workspace Activity',
    risk_score = 0.0,
    events = [],
    start_time,
    end_time,
  } = session

  const getEventIcon = (eventType) => {
    switch (eventType) {
      case 'USB_INSERT':
      case 'USB_REMOVE':
        return '🔌'
      case 'FILE_CREATE':
      case 'FILE_MODIFY':
      case 'FILE_DELETE':
        return '📁'
      case 'NETWORK_CONNECTION':
        return '🌐'
      case 'PROCESS_LAUNCH':
        return '⚡'
      case 'SCREENSHOT_TAKEN':
        return '📸'
      case 'CLIPBOARD_BURST':
        return '📋'
      default:
        return '📄'
    }
  }

  const getEventBadgeClass = (eventType, metadata = {}) => {
    if (metadata.is_encrypted_archive || metadata.is_sensitive_folder) {
      return 'badge-danger'
    }
    if (eventType === 'USB_INSERT' || eventType === 'NETWORK_CONNECTION') {
      return 'badge-warning'
    }
    return 'badge-info'
  }

  const formatTimestamp = (tsStr) => {
    if (!tsStr) return 'N/A'
    try {
      const d = new Date(tsStr)
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    } catch {
      return tsStr
    }
  }

  const formatBytes = (bytes) => {
    if (!bytes) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  return (
    <div className="feature-card" style={{ padding: '24px', position: 'relative' }}>
      {/* Header Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px', paddingBottom: '16px', borderBottom: '1px solid var(--border-subtle)' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
            <h3 className="title-md" style={{ color: 'var(--text-primary)', margin: 0 }}>
              Session Timeline #{id || session_uuid?.substring(0, 8)}
            </h3>
            <span className="badge badge-info">{user_id}</span>
          </div>
          <p className="body-sm" style={{ color: 'var(--text-secondary)' }}>
            Intent: <strong style={{ color: 'var(--primary-blue)' }}>{reconstructed_intent}</strong>
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ textAlign: 'right' }}>
            <div className="caption" style={{ color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: '600' }}>
              Risk Score
            </div>
            <span className={`badge ${risk_score >= 0.7 ? 'badge-danger' : risk_score >= 0.5 ? 'badge-warning' : 'badge-success'}`} style={{ fontSize: '13px', marginTop: '2px' }}>
              {(risk_score * 100).toFixed(0)}%
            </span>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="btn-secondary"
              style={{ height: '32px', padding: '0 10px', fontSize: '12px' }}
            >
              ✕ Close
            </button>
          )}
        </div>
      </div>

      {/* Timeline Steps */}
      {events.length === 0 ? (
        <div className="body-sm" style={{ padding: '20px 0', textAlign: 'center', color: 'var(--text-muted)' }}>
          No sequential events logged for this session.
        </div>
      ) : (
        <div style={{ position: 'relative', paddingLeft: '24px' }}>
          {/* Vertical Track Line */}
          <div
            style={{
              position: 'absolute',
              left: '11px',
              top: '12px',
              bottom: '12px',
              width: '2px',
              background: 'var(--border-subtle)',
            }}
          />

          {events.map((evt, idx) => {
            const isSelected = selectedEventId === (evt.id || idx)
            const meta = evt.metadata || {}

            return (
              <div
                key={evt.id || idx}
                onClick={() => setSelectedEventId(isSelected ? null : (evt.id || idx))}
                style={{
                  position: 'relative',
                  marginBottom: '16px',
                  cursor: 'pointer',
                  padding: '14px 16px',
                  borderRadius: 'var(--radius-md)',
                  background: isSelected ? 'var(--surface-card-hover)' : 'var(--surface-soft)',
                  border: isSelected ? '1px solid var(--primary-cta)' : '1px solid var(--border-subtle)',
                  transition: 'all 0.15s ease',
                  boxShadow: isSelected ? '0 0 0 1px var(--primary-cta)' : 'none',
                }}
              >
                {/* Node Bullet */}
                <div
                  style={{
                    position: 'absolute',
                    left: '-24px',
                    top: '14px',
                    width: '22px',
                    height: '22px',
                    borderRadius: '50%',
                    background: 'var(--surface-canvas)',
                    border: '2px solid var(--primary-cta)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '11px',
                    zIndex: 1,
                  }}
                >
                  {getEventIcon(evt.event_type)}
                </div>

                {/* Event Summary Line */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span className={`badge ${getEventBadgeClass(evt.event_type, meta)}`}>
                      {evt.event_type}
                    </span>
                    {meta.is_encrypted_archive && (
                      <span className="badge badge-danger">🔒 Encrypted Archive</span>
                    )}
                    {meta.is_sensitive_folder && (
                      <span className="badge badge-warning">⚠️ Sensitive Path</span>
                    )}
                  </div>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                    {formatTimestamp(evt.timestamp)}
                  </span>
                </div>

                {/* Metadata Tags */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', fontSize: '12px', color: 'var(--text-secondary)', marginTop: '6px' }}>
                  {meta.extension && (
                    <span style={{ background: 'var(--surface-canvas)', padding: '2px 8px', borderRadius: '4px', border: '1px solid var(--border-subtle)' }}>
                      Ext: <strong style={{ color: 'var(--text-primary)' }}>{meta.extension}</strong>
                    </span>
                  )}
                  {meta.file_size_bytes && (
                    <span style={{ background: 'var(--surface-canvas)', padding: '2px 8px', borderRadius: '4px', border: '1px solid var(--border-subtle)' }}>
                      Size: <strong style={{ color: 'var(--text-primary)' }}>{formatBytes(meta.file_size_bytes)}</strong>
                    </span>
                  )}
                  {meta.vendor_id && (
                    <span style={{ background: 'var(--surface-canvas)', padding: '2px 8px', borderRadius: '4px', border: '1px solid var(--border-subtle)' }}>
                      USB Vendor: <strong style={{ color: 'var(--text-primary)' }}>{meta.vendor_id}</strong>
                    </span>
                  )}
                  {meta.destination_host && (
                    <span style={{ background: 'var(--surface-canvas)', padding: '2px 8px', borderRadius: '4px', border: '1px solid var(--border-subtle)' }}>
                      Host: <strong style={{ color: 'var(--text-primary)' }}>{meta.destination_host}</strong>
                    </span>
                  )}
                  {meta.process_name && (
                    <span style={{ background: 'var(--surface-canvas)', padding: '2px 8px', borderRadius: '4px', border: '1px solid var(--border-subtle)' }}>
                      Process: <strong style={{ color: 'var(--text-primary)' }}>{meta.process_name}</strong>
                    </span>
                  )}
                </div>

                {/* Expanded JSON details */}
                {isSelected && (
                  <div style={{ marginTop: '12px', paddingTop: '10px', borderTop: '1px dashed var(--border-subtle)' }}>
                    <div className="caption" style={{ color: 'var(--text-muted)', marginBottom: '4px', textTransform: 'uppercase', fontWeight: '600' }}>
                      Raw Metadata Payload (0% Content Fields)
                    </div>
                    <pre style={{ fontSize: '11px', color: 'var(--primary-blue)', background: 'var(--surface-canvas)', border: '1px solid var(--border-subtle)', padding: '10px', borderRadius: 'var(--radius-md)', overflowX: 'auto' }}>
                      {JSON.stringify(meta, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
