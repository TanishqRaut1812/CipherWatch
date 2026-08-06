import React, { useState, useMemo } from 'react'

export default function MonitoredFleetPanel({ systems, selectedSystemId, onSelectSystem }) {
  const [sortBy, setSortBy] = useState('threat') // 'threat' | 'alpha' | 'date'
  const [statusFilter, setStatusFilter] = useState('ALL') // 'ALL' | 'ONLINE' | 'OFFLINE'
  const [riskFilter, setRiskFilter] = useState('ALL') // 'ALL' | 'CRITICAL' | 'ELEVATED' | 'NORMAL'

  // Default mock fleet if none passed from API yet
  const fleetData = useMemo(() => {
    if (systems && systems.length > 0) return systems
    return [
      { id: 'sys-01', hostname: 'agent-fin04', ip_address: '192.168.1.45', os_type: 'Linux Ubuntu', is_online: true, threat_level: 'CRITICAL', active_alerts: 2, session_count: 3, last_seen: 'Just now', created_at: '2026-08-01' },
      { id: 'sys-02', hostname: 'MAC-WORKSTATION-01', ip_address: '192.168.1.12', os_type: 'macOS Sonoma', is_online: true, threat_level: 'HIGH', active_alerts: 1, session_count: 2, last_seen: '2 mins ago', created_at: '2026-08-02' },
      { id: 'sys-03', hostname: 'PC-DEV-OPS-09', ip_address: '192.168.1.88', os_type: 'Windows 11 Enterprise', is_online: true, threat_level: 'MEDIUM', active_alerts: 0, session_count: 5, last_seen: '5 mins ago', created_at: '2026-08-03' },
      { id: 'sys-04', hostname: 'SRV-DB-STAGING-02', ip_address: '10.0.0.14', os_type: 'Linux CentOS', is_online: false, threat_level: 'LOW', active_alerts: 0, session_count: 1, last_seen: '1 hour ago', created_at: '2026-07-28' },
    ]
  }, [systems])

  const filteredAndSortedFleet = useMemo(() => {
    return fleetData
      .filter((item) => {
        // Status filter
        if (statusFilter === 'ONLINE' && !item.is_online) return false
        if (statusFilter === 'OFFLINE' && item.is_online) return false

        // Risk filter
        const level = (item.threat_level || 'LOW').toUpperCase()
        if (riskFilter === 'CRITICAL' && level !== 'CRITICAL') return false
        if (riskFilter === 'ELEVATED' && level !== 'HIGH' && level !== 'MEDIUM') return false
        if (riskFilter === 'NORMAL' && level !== 'LOW') return false

        return true
      })
      .sort((a, b) => {
        if (sortBy === 'threat') {
          const rank = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 }
          return (rank[b.threat_level?.toUpperCase()] || 0) - (rank[a.threat_level?.toUpperCase()] || 0)
        }
        if (sortBy === 'alpha') {
          return (a.hostname || '').localeCompare(b.hostname || '')
        }
        if (sortBy === 'date') {
          return (b.created_at || '').localeCompare(a.created_at || '')
        }
        return 0
      })
  }, [fleetData, sortBy, statusFilter, riskFilter])

  return (
    <div className="alert-feed-card" style={{ padding: '20px', height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header & Section Terminal Label */}
      <div style={{ marginBottom: '14px' }}>
        <div className="section-terminal-label" style={{ marginBottom: '4px' }}>
          <span>💻 MONITORED FLEET ({filteredAndSortedFleet.length})</span>
        </div>
        <h3 className="title-md" style={{ color: 'var(--colors-on-dark)', margin: 0 }}>
          Enrolled Agents & Endpoint Devices
        </h3>
      </div>

      {/* Filter & Sort Controls Bar */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '14px', paddingBottom: '12px', borderBottom: '1px solid var(--colors-hairline-on-dark)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '11px', color: 'var(--colors-muted)', fontWeight: 600 }}>SORT:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="select-compact"
            >
              <option value="threat">Threat Level (High → Low)</option>
              <option value="alpha">Alphabetical (A-Z)</option>
              <option value="date">Date Enrolled</option>
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ fontSize: '11px', color: 'var(--colors-muted)', fontWeight: 600 }}>STATUS:</span>
            {['ALL', 'ONLINE', 'OFFLINE'].map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`filter-pill ${statusFilter === st ? 'active' : ''}`}
              >
                {st}
              </button>
            ))}
          </div>
        </div>

        {/* Risk Tier Filters */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '11px', color: 'var(--colors-muted)', fontWeight: 600 }}>RISK:</span>
          {['ALL', 'CRITICAL', 'ELEVATED', 'NORMAL'].map((rk) => (
            <button
              key={rk}
              onClick={() => setRiskFilter(rk)}
              className={`filter-pill ${riskFilter === rk ? (rk === 'CRITICAL' ? 'active-escalating' : 'active') : ''}`}
            >
              {rk}
            </button>
          ))}
        </div>
      </div>

      {/* Mini-Panels Scrollable Entity List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', overflowY: 'auto', maxHeight: '440px', paddingRight: '4px', flex: 1 }}>
        {filteredAndSortedFleet.length === 0 ? (
          <div className="body-sm" style={{ color: 'var(--colors-muted)', padding: '20px 0', textAlign: 'center' }}>
            No endpoint entities match the active filters.
          </div>
        ) : (
          filteredAndSortedFleet.map((sys) => {
            const isSelected = selectedSystemId === sys.id || selectedSystemId === sys.hostname
            const level = (sys.threat_level || 'LOW').toUpperCase()
            const isEscalating = level === 'CRITICAL' || level === 'HIGH'
            const borderAccentColor = level === 'CRITICAL' ? '#f6465d' : level === 'HIGH' ? '#f59e0b' : '#0ecb81'

            return (
              <div
                key={sys.id}
                onClick={() => onSelectSystem && onSelectSystem(sys)}
                className={`alert-row ${isSelected && isEscalating ? 'glow-escalating' : isSelected ? 'glow-primary' : ''}`}
                style={{
                  cursor: 'pointer',
                  padding: '12px 14px',
                  borderRadius: 'var(--rounded-md)',
                  background: isSelected ? 'var(--gradient-card-surface)' : 'var(--colors-canvas-dark)',
                  border: isSelected ? `1px solid ${borderAccentColor}` : '1px solid var(--colors-hairline-on-dark)',
                  borderLeft: `4px solid ${borderAccentColor}`,
                  transition: 'all 0.15s ease',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', width: '100%' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span className={sys.is_online ? 'glow-contained' : ''} style={{ width: '8px', height: '8px', borderRadius: '50%', background: sys.is_online ? 'var(--colors-risk-contained)' : 'var(--colors-muted)', display: 'inline-block' }}></span>
                      <strong className="body-md" style={{ color: 'var(--colors-on-dark)', fontWeight: '700' }}>
                        {sys.hostname}
                      </strong>
                      <span className="body-sm" style={{ color: 'var(--colors-muted)', fontSize: '11px' }}>
                        {sys.ip_address}
                      </span>
                    </div>

                    {/* One-Line Stat Summary Vocabulary */}
                    <div className="body-sm tabular-nums" style={{ color: 'var(--colors-muted-strong)', marginTop: '4px', fontSize: '11px' }}>
                      {sys.hostname} · {sys.session_count || 1} sessions · <span style={{ color: sys.active_alerts > 0 ? 'var(--colors-risk-escalating)' : 'var(--colors-muted-strong)' }}>{sys.active_alerts || 0} active alerts</span>
                    </div>
                  </div>

                  <span className={`badge ${level === 'CRITICAL' ? 'badge-danger' : level === 'HIGH' ? 'badge-warning' : 'badge-success'}`} style={{ fontSize: '10px' }}>
                    {level}
                  </span>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
