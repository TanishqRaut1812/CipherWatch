import React, { useState, useEffect } from 'react'
import SystemDetailModal from './SystemDetailModal'

export default function AdminDashboard({ orgId }) {
  const [stats, setStats] = useState(null)
  const [systems, setSystems] = useState([])
  const [threats, setThreats] = useState([])
  const [loading, setLoading] = useState(true)
  const [seeding, setSeeding] = useState(false)
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
    if (!orgId || !window.confirm('Are you sure you want to rotate the enrollment key? New agents must use the new key to enroll. Existing enrolled agents will continue to function normally.')) return
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

  // Filters
  const [search, setSearch] = useState('')
  const [osFilter, setOsFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [threatFilter, setThreatFilter] = useState('')

  const fetchData = () => {
    if (!orgId) return
    setLoading(true)
    Promise.all([
      fetch(`/api/admin/orgs/${orgId}/dashboard/stats`).then((res) => res.json()),
      fetch(`/api/admin/orgs/${orgId}/systems?search=${encodeURIComponent(search)}&os=${encodeURIComponent(osFilter)}&status=${encodeURIComponent(statusFilter)}&threat_level=${encodeURIComponent(threatFilter)}`).then((res) => res.json()),
      fetch(`/api/admin/orgs/${orgId}/threats`).then((res) => res.json()),
    ])
      .then(([statsData, systemsData, threatsData]) => {
        setStats(statsData)
        setSystems(Array.isArray(systemsData) ? systemsData : [])
        setThreats(Array.isArray(threatsData) ? threatsData : [])
        setLoading(false)
      })
      .catch((err) => {
        console.error('Failed to load admin dashboard telemetry:', err)
        setLoading(false)
      })
  }

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 10000) // Poll every 10s for real-time-ish telemetry updates
    return () => clearInterval(interval)
  }, [search, osFilter, statusFilter, threatFilter, orgId])

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

  const handleAcknowledgeThreat = (threatId) => {
    if (!orgId) return
    fetch(`/api/admin/orgs/${orgId}/threats/${threatId}/acknowledge`, { method: 'POST' })
      .then((res) => res.json())
      .then(() => fetchData())
      .catch((err) => console.error('Failed to acknowledge threat:', err))
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Fleet Top Stats Bar */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
        <div className="glass-panel" style={{ padding: '20px' }}>
          <span className="caption" style={{ color: 'var(--text-muted)' }}>Enrolled Systems</span>
          <div className="display-sm" style={{ color: 'var(--text-primary)', marginTop: '4px' }}>
            {stats?.summary?.total_systems ?? 0}
          </div>
          <div className="caption" style={{ color: 'var(--accent-green)', marginTop: '6px' }}>
            ● {stats?.summary?.online_systems ?? 0} Online | {stats?.summary?.offline_systems ?? 0} Offline
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '20px' }}>
          <span className="caption" style={{ color: 'var(--text-muted)' }}>Active Unacknowledged Threats</span>
          <div className="display-sm" style={{ color: (stats?.summary?.critical_alerts ?? 0) > 0 ? 'var(--accent-red)' : 'var(--accent-amber)', marginTop: '4px' }}>
            {stats?.summary?.unacknowledged_alerts ?? 0}
          </div>
          <div className="caption" style={{ color: 'var(--text-secondary)', marginTop: '6px' }}>
            {stats?.summary?.critical_alerts ?? 0} Critical | {stats?.summary?.warning_alerts ?? 0} Warning
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '20px' }}>
          <span className="caption" style={{ color: 'var(--text-muted)' }}>Fleet Avg CPU / Memory</span>
          <div className="display-sm" style={{ color: 'var(--primary-cta)', marginTop: '4px' }}>
            {stats?.summary?.avg_fleet_cpu ?? 0}% / {stats?.summary?.avg_fleet_mem ?? 0}%
          </div>
          <div className="caption" style={{ color: 'var(--text-secondary)', marginTop: '6px' }}>
            Real-time aggregate across hosts
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <span className="caption" style={{ color: 'var(--text-muted)' }}>Demo / Testing Controls</span>
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

      {/* Agent Enrollment Card */}
      <div className="feature-card" style={{ padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div>
            <h2 className="title-md" style={{ color: 'var(--text-primary)', margin: 0 }}>
              🔑 Agent Enrollment & Setup Command
            </h2>
            <p className="caption" style={{ color: 'var(--text-secondary)', marginTop: '4px' }}>
              Enroll new physical host machines/PCs into this organization fleet using the secure registration key.
            </p>
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
          <div className="body-sm" style={{ color: 'var(--text-muted)' }}>Loading credentials...</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <span className="caption" style={{ color: 'var(--text-muted)' }}>Organization ID (organization_id)</span>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    readOnly
                    value={credentials?.organization_id || orgId || ''}
                    className="input-text"
                    style={{ flex: 1, fontFamily: 'var(--font-mono)', fontSize: '13px', background: 'rgba(255,255,255,0.02)' }}
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
                <span className="caption" style={{ color: 'var(--text-muted)' }}>Enrollment Key (enrollment_key)</span>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type={showKey ? 'text' : 'password'}
                    readOnly
                    value={credentials?.enrollment_key ?? credentials?.registration_key ?? ''}
                    className="input-text"
                    style={{ flex: 1, fontFamily: 'var(--font-mono)', fontSize: '13px', background: 'rgba(255,255,255,0.02)' }}
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

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '4px' }}>
              <span className="caption" style={{ color: 'var(--text-muted)' }}>Setup command for physical machines / endpoints:</span>
              <div style={{ display: 'flex', gap: '8px' }}>
                <pre style={{
                  flex: 1,
                  background: 'var(--surface-soft)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  padding: '12px 16px',
                  margin: 0,
                  fontSize: '12px',
                  color: 'var(--primary-cyan)',
                  overflowX: 'auto',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-all'
                }}>
                  {`python -m agent.main --setup --org-id ${credentials?.organization_id || orgId} --enrollment-key ${credentials?.enrollment_key ?? credentials?.registration_key ?? '<key>'}`}
                </pre>
                <button
                  onClick={() => handleCopy(`python -m agent.main --setup --org-id ${credentials?.organization_id || orgId} --enrollment-key ${credentials?.enrollment_key ?? credentials?.registration_key ?? ''}`, 'cmd')}
                  className="btn-primary"
                  style={{ padding: '0 16px', fontSize: '12px' }}
                >
                  {copiedText === 'cmd' ? 'Copied!' : 'Copy Command'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Main Grid: Active Threats Panel + Fleet Systems View */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(320px, 1fr) minmax(500px, 1.8fr)', gap: '24px' }}>
        {/* Left Panel: Active Threats Feed */}
        <div className="feature-card" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h2 className="title-md" style={{ color: 'var(--text-primary)', margin: 0 }}>
              🚨 Active Threats Panel
            </h2>
            <span className={`badge ${(threats.length > 0) ? 'badge-danger' : 'badge-success'}`}>
              {threats.length} Unacknowledged
            </span>
          </div>

          {threats.length === 0 ? (
            <div className="body-sm" style={{ color: 'var(--text-muted)', padding: '20px 0', textAlign: 'center' }}>
              No active unacknowledged threats detected. Fleet secure.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {threats.map((t) => (
                <div
                  key={t.id}
                  style={{
                    padding: '16px',
                    borderRadius: 'var(--radius-md)',
                    background: t.severity.toLowerCase() === 'critical' ? 'rgba(248, 113, 113, 0.08)' : 'var(--surface-soft)',
                    border: `1px solid ${t.severity.toLowerCase() === 'critical' ? 'rgba(248, 113, 113, 0.25)' : 'var(--border-subtle)'}`,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                      <span className={`badge ${t.severity.toLowerCase() === 'critical' ? 'badge-danger' : 'badge-warning'}`}>
                        {t.severity.toUpperCase()}
                      </span>
                      <code className="caption" style={{ color: 'var(--primary-cyan)' }}>{t.rule_id}</code>
                    </div>
                    <button
                      onClick={() => handleAcknowledgeThreat(t.id)}
                      className="btn-secondary"
                      style={{ height: '26px', padding: '0 10px', fontSize: '11px' }}
                    >
                      Acknowledge
                    </button>
                  </div>

                  <p className="body-sm" style={{ color: 'var(--text-primary)', fontWeight: '500', margin: 0 }}>
                    {t.message}
                  </p>

                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-muted)' }}>
                    <span>Host: <strong>{t.hostname}</strong> ({t.ip})</span>
                    <span>{new Date(t.timestamp).toLocaleTimeString()}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right Panel: Enrolled Systems Grid / List */}
        <div className="feature-card" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <h2 className="title-md" style={{ color: 'var(--text-primary)', margin: 0 }}>
                💻 Enrolled Systems Fleet ({systems.length})
              </h2>
              <p className="caption" style={{ color: 'var(--text-secondary)' }}>
                Click any machine to inspect telemetry, process trees, and filesystem watchdog activity.
              </p>
            </div>

            {/* Filters */}
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <input
                type="text"
                className="input-text"
                placeholder="Search hostname or IP..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ width: '160px', height: '34px', fontSize: '12px' }}
              />
              <select
                className="input-text"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                style={{ width: '110px', height: '34px', fontSize: '12px' }}
              >
                <option value="">All Status</option>
                <option value="online">Online</option>
                <option value="offline">Offline</option>
              </select>
              <select
                className="input-text"
                value={threatFilter}
                onChange={(e) => setThreatFilter(e.target.value)}
                style={{ width: '120px', height: '34px', fontSize: '12px' }}
              >
                <option value="">All Threats</option>
                <option value="none">None</option>
                <option value="warning">Warning</option>
                <option value="critical">Critical</option>
              </select>
            </div>
          </div>

          {loading ? (
            <div className="body-sm" style={{ color: 'var(--text-muted)', padding: '20px 0' }}>Loading enrolled systems...</div>
          ) : systems.length === 0 ? (
            <div className="body-sm" style={{ color: 'var(--text-muted)', padding: '20px 0', textAlign: 'center' }}>
              No enrolled systems found. Click "Seed Demo Telemetry Data" above to generate demo systems.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {systems.map((sys) => (
                <div
                  key={sys.id}
                  onClick={() => setSelectedAgentId(sys.id)}
                  style={{
                    padding: '16px',
                    borderRadius: 'var(--radius-md)',
                    background: 'var(--surface-soft)',
                    border: '1px solid var(--border-subtle)',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '16px',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--primary-cta)')}
                  onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border-subtle)')}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <div
                      style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: 'var(--radius-md)',
                        background: 'var(--surface-strong)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '18px',
                      }}
                    >
                      {sys.os.toLowerCase().includes('win') ? '🪟' : sys.os.toLowerCase().includes('mac') ? '🍎' : '🐧'}
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <strong className="body-md" style={{ color: 'var(--text-primary)' }}>{sys.hostname}</strong>
                        <span className={`badge ${sys.status === 'online' ? 'badge-success' : 'badge-danger'}`}>
                          {sys.status.toUpperCase()}
                        </span>
                        <span className={`badge ${sys.threat_level === 'critical' ? 'badge-danger' : sys.threat_level === 'warning' ? 'badge-warning' : 'badge-info'}`}>
                          {sys.threat_level.toUpperCase()}
                        </span>
                      </div>
                      <div style={{ display: 'flex', gap: '12px', marginTop: '4px', fontSize: '12px', color: 'var(--text-muted)' }}>
                        <span>IP: {sys.ip}</span>
                        <span>OS: {sys.os}</span>
                        <span>v{sys.agent_version}</span>
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                    <div style={{ textAlign: 'right' }}>
                      <div className="caption" style={{ color: 'var(--text-muted)' }}>CPU / Mem</div>
                      <div className="body-sm" style={{ color: 'var(--text-primary)', fontWeight: '600', marginTop: '2px' }}>
                        {sys.latest_metrics.cpu_percent.toFixed(1)}% / {sys.latest_metrics.mem_percent.toFixed(1)}%
                      </div>
                    </div>
                    <span style={{ color: 'var(--primary-blue)', fontSize: '13px', fontWeight: '500' }}>
                      Inspect →
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* System Detail View Modal */}
      {selectedAgentId && (
        <SystemDetailModal orgId={orgId} agentId={selectedAgentId} onClose={() => setSelectedAgentId(null)} />
      )}
    </div>
  )
}
