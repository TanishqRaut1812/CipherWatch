import React, { useState, useEffect, useMemo } from 'react'
import SystemDetailModal from './SystemDetailModal'
import CriticalIncidentBar from './CriticalIncidentBar'
import MonitoredFleetPanel from './MonitoredFleetPanel'
import ResponseActionsPanel from './ResponseActionsPanel'
import SessionGraphCard from './SessionGraphCard'
import RiskChart from './RiskChart'
import RiskBreakdown from './RiskBreakdown'

export default function AdminDashboard({ orgId }) {
  const [stats, setStats] = useState(null)
  const [systems, setSystems] = useState([])
  const [threats, setThreats] = useState([])
  const [loading, setLoading] = useState(true)
  const [seeding, setSeeding] = useState(false)

  // Selected Entity state for Tier 2 workspace
  const [selectedEntity, setSelectedEntity] = useState(null)
  const [selectedAgentId, setSelectedAgentId] = useState(null)

  // Credentials and key generator state
  const [credentials, setCredentials] = useState(null)
  const [loadingCreds, setLoadingCreds] = useState(false)
  const [rotating, setRotating] = useState(false)
  const [showKey, setShowKey] = useState(false)
  const [copiedText, setCopiedText] = useState('')

  const fetchCredentials = () => {
    if (!orgId) return
    setLoadingCreds(true)
    fetch(`/api/orgs/${orgId}/registration-credentials`)
      .then((res) => {
        if (!res.ok) throw new Error('Not member or unauthorized')
        return res.json()
      })
      .then((data) => {
        setCredentials(data)
        setLoadingCreds(false)
      })
      .catch((err) => {
        console.error('Failed to fetch credentials:', err)
        setLoadingCreds(false)
      })
  }

  const handleRotateKey = () => {
    if (!orgId || !window.confirm('Are you sure you want to rotate the enrollment key? New agents must use the new key to enroll.')) return
    setRotating(true)
    fetch(`/api/orgs/${orgId}/rotate-enrollment-key`, { method: 'POST' })
      .then((res) => {
        if (!res.ok) throw new Error('Failed to rotate')
        return res.json()
      })
      .then((data) => {
        setCredentials(data)
        setRotating(false)
      })
      .catch((err) => {
        console.error('Failed to rotate key:', err)
        setRotating(false)
      })
  }

  const handleCopy = (text, type) => {
    navigator.clipboard.writeText(text)
    setCopiedText(type)
    setTimeout(() => setCopiedText(''), 2000)
  }

  useEffect(() => {
    fetchCredentials()
  }, [orgId])

  const fetchData = () => {
    if (!orgId) return
    setLoading(true)
    Promise.all([
      fetch(`/api/admin/orgs/${orgId}/dashboard/stats`).then((res) => res.json()),
      fetch(`/api/admin/orgs/${orgId}/systems`).then((res) => res.json()),
      fetch(`/api/admin/orgs/${orgId}/threats`).then((res) => res.json()),
    ])
      .then(([statsData, systemsData, threatsData]) => {
        setStats(statsData)
        const sysList = Array.isArray(systemsData) ? systemsData : []
        setSystems(sysList)
        setThreats(Array.isArray(threatsData) ? threatsData : [])
        setLoading(false)

        // Default select highest-risk system if none selected yet
        if (!selectedEntity && sysList.length > 0) {
          const highest = [...sysList].sort((a, b) => (b.threat_level === 'CRITICAL' ? 1 : -1))[0]
          setSelectedEntity(highest)
        }
      })
      .catch((err) => {
        console.error('Failed to load admin dashboard telemetry:', err)
        setLoading(false)
      })
  }

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 10000)
    return () => clearInterval(interval)
  }, [orgId])

  const handleSeedMockData = () => {
    if (!orgId) return
    setSeeding(true)
    fetch(`/api/admin/orgs/${orgId}/seed-mock-data`, { method: 'POST' })
      .then((res) => res.json())
      .then(() => {
        setSeeding(false)
        fetchData()
      })
      .catch(() => setSeeding(false))
  }

  // Derive highest risk active session for Tier 1 Critical Incident Bar
  const highestRiskSession = useMemo(() => {
    if (threats && threats.length > 0) {
      const topThreat = threats[0]
      return {
        id: topThreat.id,
        user_id: topThreat.hostname || 'agent-fin04',
        device_id: topThreat.ip || '192.168.1.45',
        risk_score: topThreat.severity === 'CRITICAL' ? 0.94 : 0.88,
        events: [
          { event_type: 'FILE_CREATE' },
          { event_type: 'USB_INSERT' },
          { event_type: 'NETWORK_EXFILTRATION' },
        ],
      }
    }
    // Default mock high-risk session for demo state
    return {
      id: 99,
      user_id: 'agent-fin04',
      device_id: '192.168.1.45',
      risk_score: 0.94,
      events: [
        { event_type: 'FILE_CREATE' },
        { event_type: 'USB_INSERT' },
        { event_type: 'CLOUD_UPLOAD' },
      ],
    }
  }, [threats])

  const handleInvestigate = (session) => {
    const match = systems.find(s => s.hostname === session.user_id || s.ip_address === session.device_id)
    if (match) {
      setSelectedEntity(match)
    } else if (systems.length > 0) {
      setSelectedEntity(systems[0])
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Fleet Top Terminal Header */}
      <div className="section-terminal-label">
        <span>⚡ FLEET TELEMETRY & THREAT OPERATIONS</span>
      </div>

      {/* Fleet Top Stats Bar */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px' }}>
        <div className="alert-feed-card" style={{ flex: '1 1 auto', minWidth: '220px', padding: '20px' }}>
          <span className="section-terminal-label" style={{ fontSize: '10px' }}>Enrolled Systems</span>
          <div className="number-display text-gradient-primary" style={{ marginTop: '4px' }}>
            {stats?.summary?.total_systems ?? (systems.length || 4)}
          </div>
          <div className="body-sm tabular-nums" style={{ color: 'var(--colors-risk-contained)', marginTop: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span className="glow-contained" style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--colors-risk-contained)', display: 'inline-block' }}></span>
            {stats?.summary?.online_systems ?? 3} Online | {stats?.summary?.offline_systems ?? 1} Offline
          </div>
        </div>

        <div className={`alert-feed-card ${(stats?.summary?.unacknowledged_alerts ?? 2) > 0 ? 'glow-escalating' : ''}`} style={{ flex: '1 1 auto', minWidth: '240px', padding: '20px' }}>
          <span className="section-terminal-label" style={{ fontSize: '10px' }}>Unacknowledged Threats</span>
          <div className="number-display text-gradient-escalating" style={{ marginTop: '4px' }}>
            {stats?.summary?.unacknowledged_alerts ?? 2}
          </div>
          <div className="body-sm tabular-nums" style={{ color: 'var(--colors-muted-strong)', marginTop: '6px' }}>
            {stats?.summary?.critical_alerts ?? 1} Critical | {stats?.summary?.warning_alerts ?? 1} Warning
          </div>
        </div>

        <div className="alert-feed-card" style={{ flex: '1 1 auto', minWidth: '240px', padding: '20px' }}>
          <span className="section-terminal-label" style={{ fontSize: '10px' }}>Fleet Avg CPU / Memory</span>
          <div className="number-display text-gradient-primary" style={{ marginTop: '4px' }}>
            {stats?.summary?.avg_fleet_cpu ?? 14}% / {stats?.summary?.avg_fleet_mem ?? 42}%
          </div>
          <div className="body-sm" style={{ color: 'var(--colors-muted-strong)', marginTop: '6px' }}>
            Real-time aggregate telemetry across hosts
          </div>
        </div>

        <div className="alert-feed-card" style={{ flex: '1 1 auto', minWidth: '220px', padding: '20px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <span className="section-terminal-label" style={{ fontSize: '10px' }}>Telemetry Simulator</span>
          <button
            onClick={handleSeedMockData}
            disabled={seeding}
            className="btn-primary"
            style={{ width: '100%', marginTop: '8px' }}
          >
            {seeding ? 'Seeding...' : '⚡ Seed Demo Telemetry Data'}
          </button>
        </div>
      </div>

      {/* TIER 1 — Critical Incident Bar */}
      <CriticalIncidentBar session={highestRiskSession} onInvestigate={handleInvestigate} />

      {/* TIER 2 — Two-panel workspace (Monitored Fleet + Response Actions) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(340px, 1.2fr) minmax(360px, 1fr)', gap: '20px', alignItems: 'stretch' }}>
        <MonitoredFleetPanel
          systems={systems}
          selectedSystemId={selectedEntity?.id || selectedEntity?.hostname}
          onSelectSystem={(sys) => setSelectedEntity(sys)}
        />
        <ResponseActionsPanel
          selectedEntity={selectedEntity}
          onFeedbackSubmitted={(id, type) => console.log('Feedback submitted:', id, type)}
        />
      </div>

      {/* TIER 3 — Graphs Row */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <SessionGraphCard session={highestRiskSession} />

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(340px, 1.3fr) minmax(320px, 1fr)', gap: '20px' }}>
          <RiskChart />
          <RiskBreakdown />
        </div>
      </div>

      {/* Agent Enrollment Command Panel */}
      <div className="alert-feed-card" style={{ padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div>
            <div className="section-terminal-label" style={{ marginBottom: '4px' }}>
              <span>🔑 AGENT ENROLLMENT COMMAND</span>
            </div>
            <h2 className="title-md" style={{ color: 'var(--colors-on-dark)', margin: 0 }}>
              Setup Machine Registration Key
            </h2>
          </div>
          <button
            onClick={handleRotateKey}
            disabled={rotating}
            className="btn-secondary"
            style={{ fontSize: '12px', padding: '6px 12px' }}
          >
            {rotating ? 'Rotating...' : '🔄 Rotate Enrollment Key'}
          </button>
        </div>

        {loadingCreds ? (
          <div className="body-sm" style={{ color: 'var(--colors-muted)' }}>Loading credentials...</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <span className="body-sm" style={{ color: 'var(--colors-muted-strong)', fontWeight: 600 }}>ORGANIZATION ID</span>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    readOnly
                    value={credentials?.organization_id || orgId || ''}
                    className="input-text"
                    style={{ flex: 1, fontFamily: 'var(--font-mono)', fontSize: '13px', background: 'var(--colors-canvas-dark)' }}
                  />
                  <button
                    onClick={() => handleCopy(credentials?.organization_id || orgId, 'orgId')}
                    className="btn-secondary"
                    style={{ padding: '0 12px' }}
                  >
                    {copiedText === 'orgId' ? 'Copied!' : 'Copy'}
                  </button>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <span className="body-sm" style={{ color: 'var(--colors-muted-strong)', fontWeight: 600 }}>ENROLLMENT KEY</span>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type={showKey ? 'text' : 'password'}
                    readOnly
                    value={credentials?.enrollment_key ?? credentials?.registration_key ?? ''}
                    className="input-text"
                    style={{ flex: 1, fontFamily: 'var(--font-mono)', fontSize: '13px', background: 'var(--colors-canvas-dark)' }}
                  />
                  <button
                    onClick={() => setShowKey(!showKey)}
                    className="btn-secondary"
                    style={{ padding: '0 12px' }}
                  >
                    {showKey ? 'Hide' : 'Show'}
                  </button>
                  <button
                    onClick={() => handleCopy(credentials?.enrollment_key ?? credentials?.registration_key ?? '', 'enrollKey')}
                    className="btn-secondary"
                    style={{ padding: '0 12px' }}
                  >
                    {copiedText === 'enrollKey' ? 'Copied!' : 'Copy'}
                  </button>
                </div>
              </div>
            </div>

            <div style={{ padding: '12px 16px', background: 'var(--colors-canvas-dark)', borderRadius: 'var(--rounded-md)', border: '1px solid var(--colors-hairline-on-dark)' }}>
              <span className="section-terminal-label" style={{ fontSize: '10px', marginBottom: '6px' }}>
                TERMINAL ENROLLMENT COMMAND
              </span>
              <code style={{ fontSize: '12px', color: 'var(--colors-primary)', wordBreak: 'break-all' }}>
                cipherwatch-agent --enroll --org-id={credentials?.organization_id || orgId} --key={credentials?.enrollment_key || '••••••••'}
              </code>
            </div>
          </div>
        )}
      </div>

      {selectedAgentId && (
        <SystemDetailModal
          agentId={selectedAgentId}
          orgId={orgId}
          onClose={() => setSelectedAgentId(null)}
        />
      )}
    </div>
  )
}
