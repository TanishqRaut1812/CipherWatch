import React, { useState, useEffect } from 'react'
import SessionTimeline from './components/SessionTimeline'
import RiskBreakdown from './components/RiskBreakdown'
import IncidentSummary from './components/IncidentSummary'
import AnalystControls from './components/AnalystControls'
import PrivacyBanner from './components/PrivacyBanner'
import RiskChart from './components/RiskChart'
import AdminDashboard from './components/AdminDashboard'

export default function App() {
  const [activeView, setActiveView] = useState('admin') // 'admin' | 'soc'
  const [alerts, setAlerts] = useState([])
  const [selectedSession, setSelectedSession] = useState(null)
  const [loading, setLoading] = useState(false)
  const [isConnected, setIsConnected] = useState(true)

  // Auth & Multi-Tenancy States
  const [currentUser, setCurrentUser] = useState(null)
  const [organizations, setOrganizations] = useState([])
  const [selectedOrg, setSelectedOrg] = useState(null)
  const [authMode, setAuthMode] = useState('login') // 'login' | 'signup'
  const [authLoading, setAuthLoading] = useState(true)
  const [authError, setAuthError] = useState('')
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [orgName, setOrgName] = useState('')
  const [newOrgName, setNewOrgName] = useState('')

  // Check if session cookie is valid on load
  useEffect(() => {
    fetch('/api/auth/me')
      .then((res) => {
        if (res.ok) return res.json()
        throw new Error('Not authenticated')
      })
      .then((user) => {
        setCurrentUser(user)
        return fetch('/api/orgs').then((res) => res.json())
      })
      .then((orgs) => {
        setOrganizations(orgs || [])
        if (orgs && orgs.length > 0) {
          // If only one, select it automatically
          if (orgs.length === 1) {
            setSelectedOrg(orgs[0])
          }
        }
        setAuthLoading(false)
      })
      .catch(() => {
        setAuthLoading(false)
      })
  }, [])

  // Poll for alerts feed periodically once authenticated & workspace selected
  useEffect(() => {
    if (!currentUser || !selectedOrg) return

    const fetchAlerts = () => {
      fetch(`/api/alerts?org_id=${selectedOrg.id}`)
        .then((res) => {
          if (!res.ok) {
            throw new Error(`HTTP error! status: ${res.status}`)
          }
          return res.json()
        })
        .then((data) => {
          setIsConnected(true)
          setAlerts(Array.isArray(data) ? data : [])
        })
        .catch((err) => {
          console.error('Failed to fetch alerts from backend:', err)
          setIsConnected(false)
          setAlerts([])
        })
    }

    setLoading(true)
    fetchAlerts()
    setLoading(false)

    const interval = setInterval(fetchAlerts, 10000) // Poll for new threat telemetry every 10s
    return () => clearInterval(interval)
  }, [currentUser, selectedOrg])

  const handleLogin = (e) => {
    e.preventDefault()
    setAuthError('')
    setAuthLoading(true)
    fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
      .then(async (res) => {
        const data = await res.json()
        if (!res.ok) throw new Error(data.detail || 'Login failed')
        return data
      })
      .then(() => fetch('/api/auth/me').then((res) => res.json()))
      .then((user) => {
        setCurrentUser(user)
        return fetch('/api/orgs').then((res) => res.json())
      })
      .then((orgs) => {
        setOrganizations(orgs || [])
        if (orgs && orgs.length > 0) {
          if (orgs.length === 1) {
            setSelectedOrg(orgs[0])
          }
        }
        setAuthLoading(false)
      })
      .catch((err) => {
        setAuthError(err.message)
        setAuthLoading(false)
      })
  }

  const handleSignup = (e) => {
    e.preventDefault()
    setAuthError('')
    setAuthLoading(true)
    fetch('/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, username, password, org_name: orgName }),
    })
      .then(async (res) => {
        const data = await res.json()
        if (!res.ok) throw new Error(data.detail || 'Registration failed')
        return data
      })
      .then(() => fetch('/api/auth/me').then((res) => res.json()))
      .then((user) => {
        setCurrentUser(user)
        return fetch('/api/orgs').then((res) => res.json())
      })
      .then((orgs) => {
        setOrganizations(orgs || [])
        if (orgs && orgs.length > 0) {
          if (orgs.length === 1) {
            setSelectedOrg(orgs[0])
          }
        }
        setAuthLoading(false)
      })
      .catch((err) => {
        setAuthError(err.message)
        setAuthLoading(false)
      })
  }

  const handleLogout = () => {
    fetch('/api/auth/logout', { method: 'POST' })
      .then(() => {
        setCurrentUser(null)
        setOrganizations([])
        setSelectedOrg(null)
        setEmail('')
        setUsername('')
        setPassword('')
        setOrgName('')
        setAuthError('')
      })
      .catch((err) => console.error('Logout failed:', err))
  }

  const handleCreateOrg = (e) => {
    e.preventDefault()
    if (!newOrgName) return
    setAuthError('')
    fetch('/api/orgs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newOrgName }),
    })
      .then(async (res) => {
        const data = await res.json()
        if (!res.ok) throw new Error(data.detail || 'Failed to create workspace')
        return data
      })
      .then((newOrg) => {
        setOrganizations([...organizations, newOrg])
        setSelectedOrg(newOrg)
        setNewOrgName('')
      })
      .catch((err) => {
        setAuthError(err.message)
      })
  }

  const handleSelectAlert = (alert) => {
    if (!alert || !alert.session_id) {
      return
    }
    fetch(`/api/events?org_id=${selectedOrg.id}&user_id=${alert.user_id}`)
      .then((res) => (res.ok ? res.json() : []))
      .then((eventsData) => {
        setSelectedSession({
          id: alert.session_id,
          session_uuid: `sess-${alert.session_id}`,
          user_id: alert.user_id,
          device_id: alert.device_id,
          reconstructed_intent: alert.message || 'Suspicious Telemetry Sequence',
          risk_score: alert.risk_score,
          events: eventsData || [],
        })
      })
      .catch(() => {
        setSelectedSession(null)
      })
  }

  const activeAlert = alerts.length > 0 ? (alerts.find((a) => a.session_id === selectedSession?.id) || alerts[0]) : null

  // 1. Loading Authentication State Screen
  if (authLoading && !currentUser) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--surface-canvas)',
        color: 'var(--text-secondary)'
      }}>
        <div style={{
          width: '40px',
          height: '40px',
          borderRadius: '50%',
          border: '3px solid var(--border-subtle)',
          borderTopColor: 'var(--primary-cta)',
          animation: 'spin 1s linear infinite',
          marginBottom: '16px'
        }} />
        <span className="body-md">Authenticating CipherWatch Portal...</span>
        <style>{`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    )
  }

  // 2. Unauthenticated state: Login/Signup portal
  if (!currentUser) {
    return (
      <>
        <PrivacyBanner />
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--surface-canvas)',
          padding: '24px'
        }}>
          <div className="glass-panel-xl" style={{
            width: '100%',
            maxWidth: '440px',
            padding: '40px',
            boxShadow: 'var(--shadow-elevated)',
            border: '1px solid var(--border-active)'
          }}>
            {/* Logo */}
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '24px' }}>
              <div style={{
                width: '48px',
                height: '48px',
                borderRadius: 'var(--radius-md)',
                background: 'linear-gradient(135deg, var(--primary-cta) 0%, var(--primary-cyan) 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: '700',
                fontSize: '22px',
                color: '#ffffff',
                boxShadow: 'var(--shadow-subtle)'
              }}>
                CW
              </div>
            </div>

            <h2 className="display-sm" style={{ textAlign: 'center', color: 'var(--text-primary)', marginBottom: '8px' }}>
              {authMode === 'login' ? 'CipherWatch Access' : 'Create Workspace'}
            </h2>
            <p className="body-sm" style={{ textAlign: 'center', color: 'var(--text-secondary)', marginBottom: '32px' }}>
              {authMode === 'login' 
                ? 'Enter your corporate credentials to monitor organization fleet telemetry.' 
                : 'Initialize a new tenant workspace and security administrator account.'}
            </p>

            {authError && (
              <div style={{
                padding: '12px 16px',
                borderRadius: 'var(--radius-md)',
                background: 'rgba(248, 113, 113, 0.08)',
                border: '1px solid rgba(248, 113, 113, 0.25)',
                color: 'var(--accent-red)',
                fontSize: '13px',
                marginBottom: '24px',
                lineHeight: '1.5'
              }}>
                ⚠️ {authError}
              </div>
            )}

            <form onSubmit={authMode === 'login' ? handleLogin : handleSignup}>
              {authMode === 'signup' && (
                <div style={{ marginBottom: '20px' }}>
                  <label className="caption" style={{ color: 'var(--text-secondary)', display: 'block', marginBottom: '8px', fontWeight: '600' }}>
                    ADMIN USERNAME
                  </label>
                  <input
                    type="text"
                    className="input-text"
                    placeholder="e.g. admin_secops"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                  />
                </div>
              )}

              <div style={{ marginBottom: '20px' }}>
                <label className="caption" style={{ color: 'var(--text-secondary)', display: 'block', marginBottom: '8px', fontWeight: '600' }}>
                  EMAIL ADDRESS
                </label>
                <input
                  type="email"
                  className="input-text"
                  placeholder="e.g. analyst@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <div style={{ marginBottom: authMode === 'signup' ? '20px' : '28px' }}>
                <label className="caption" style={{ color: 'var(--text-secondary)', display: 'block', marginBottom: '8px', fontWeight: '600' }}>
                  SECURITY PASSWORD
                </label>
                <input
                  type="password"
                  className="input-text"
                  placeholder="••••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>

              {authMode === 'signup' && (
                <div style={{ marginBottom: '28px' }}>
                  <label className="caption" style={{ color: 'var(--text-secondary)', display: 'block', marginBottom: '8px', fontWeight: '600' }}>
                    WORKSPACE ORGANIZATION NAME
                  </label>
                  <input
                    type="text"
                    className="input-text"
                    placeholder="e.g. Acme Cyber Security"
                    value={orgName}
                    onChange={(e) => setOrgName(e.target.value)}
                    required
                  />
                </div>
              )}

              <button type="submit" className="btn-primary" style={{ width: '100%', height: '42px', fontSize: '13px' }}>
                {authMode === 'login' ? 'Authenticate Portal' : 'Register Workspace'}
              </button>
            </form>

            <div style={{ marginTop: '24px', textAlign: 'center' }}>
              <button
                onClick={() => {
                  setAuthMode(authMode === 'login' ? 'signup' : 'login');
                  setAuthError('');
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--primary-blue)',
                  fontSize: '13px',
                  fontWeight: '500',
                  cursor: 'pointer'
                }}
              >
                {authMode === 'login' ? 'Setup new organization workspace →' : 'Log in with existing credentials →'}
              </button>
            </div>
          </div>
        </div>
      </>
    )
  }

  // 3. Authenticated but workspace not selected: Org Selector
  if (!selectedOrg) {
    return (
      <>
        <PrivacyBanner />
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--surface-canvas)',
          padding: '24px'
        }}>
          <div className="glass-panel-xl" style={{
            width: '100%',
            maxWidth: '520px',
            padding: '40px',
            boxShadow: 'var(--shadow-elevated)',
            border: '1px solid var(--border-active)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <h2 className="display-sm" style={{ color: 'var(--text-primary)', margin: 0 }}>Select Workspace</h2>
              <span className="badge badge-info">{currentUser.username}</span>
            </div>
            <p className="body-sm" style={{ color: 'var(--text-secondary)', marginBottom: '32px' }}>
              Please select a workspace organization to begin telemetry ingestion and fleet monitoring.
            </p>

            {authError && (
              <div style={{
                padding: '12px 16px',
                borderRadius: 'var(--radius-md)',
                background: 'rgba(248, 113, 113, 0.08)',
                border: '1px solid rgba(248, 113, 113, 0.25)',
                color: 'var(--accent-red)',
                fontSize: '13px',
                marginBottom: '24px',
                lineHeight: '1.5'
              }}>
                ⚠️ {authError}
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '32px' }}>
              {organizations.map((org) => (
                <div
                  key={org.id}
                  onClick={() => setSelectedOrg(org)}
                  className="feature-card"
                  style={{
                    padding: '18px 24px',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = 'var(--primary-cta)';
                    e.currentTarget.style.background = 'var(--surface-card-hover)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'var(--border-subtle)';
                    e.currentTarget.style.background = 'var(--surface-card)';
                  }}
                >
                  <div>
                    <h3 className="title-md" style={{ color: 'var(--text-primary)', margin: 0 }}>{org.name}</h3>
                    <span className="caption" style={{ color: 'var(--text-muted)', marginTop: '4px', display: 'inline-block' }}>
                      Authorization level: <span style={{ color: 'var(--primary-cyan)', fontWeight: '600' }}>{org.role.toUpperCase()}</span>
                    </span>
                  </div>
                  <span style={{ color: 'var(--primary-blue)', fontSize: '13px', fontWeight: '600' }}>
                    Enter →
                  </span>
                </div>
              ))}
            </div>

            <div style={{
              borderTop: '1px solid var(--border-subtle)',
              paddingTop: '24px'
            }}>
              <h4 className="title-sm" style={{ color: 'var(--text-primary)', marginBottom: '12px' }}>Initialize Additional Workspace</h4>
              <form onSubmit={handleCreateOrg} style={{ display: 'flex', gap: '12px' }}>
                <input
                  type="text"
                  className="input-text"
                  placeholder="e.g. Acme EMEA Security"
                  value={newOrgName}
                  onChange={(e) => setNewOrgName(e.target.value)}
                  required
                />
                <button type="submit" className="btn-primary" style={{ whiteSpace: 'nowrap' }}>
                  Create
                </button>
              </form>
            </div>

            <div style={{ marginTop: '40px', display: 'flex', justifyContent: 'center' }}>
              <button
                onClick={handleLogout}
                className="btn-secondary"
                style={{ height: '36px', padding: '0 16px', fontSize: '12px' }}
              >
                Sign Out Account
              </button>
            </div>
          </div>
        </div>
      </>
    )
  }

  // 4. Authenticated & Selected workspace: Render Dashboard
  return (
    <div style={{ minHeight: '100vh', background: 'var(--surface-canvas)' }}>
      <PrivacyBanner />
      <div className="container" style={{ paddingTop: '24px' }}>
        {/* Dashboard Header */}
        <header
          className="glass-panel-xl"
          style={{
            padding: '24px 32px',
            marginBottom: '24px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '16px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: 'var(--radius-md)',
                background: 'linear-gradient(135deg, var(--primary-cta) 0%, var(--primary-cyan) 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: '600',
                fontSize: '18px',
                color: '#ffffff',
                boxShadow: 'var(--shadow-subtle)',
              }}
            >
              CW
            </div>
            <div>
              <h1 className="title-lg" style={{ color: 'var(--text-primary)', margin: 0 }}>
                CipherWatch Security Console
              </h1>
              <p className="body-sm" style={{ color: 'var(--text-secondary)', marginTop: '2px' }}>
                Active Workspace: <strong style={{ color: 'var(--text-primary)' }}>{selectedOrg.name}</strong> • Operator: {currentUser.username}
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            {/* View Switcher Tabs */}
            <div style={{ display: 'flex', background: 'var(--surface-soft)', padding: '4px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
              <button
                onClick={() => setActiveView('admin')}
                style={{
                  background: activeView === 'admin' ? 'var(--primary-cta)' : 'transparent',
                  color: activeView === 'admin' ? '#fff' : 'var(--text-secondary)',
                  border: 'none',
                  borderRadius: 'var(--radius-sm)',
                  padding: '6px 14px',
                  fontSize: '13px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                💻 Agent Telemetry & Fleet
              </button>
              <button
                onClick={() => setActiveView('soc')}
                style={{
                  background: activeView === 'soc' ? 'var(--primary-cta)' : 'transparent',
                  color: activeView === 'soc' ? '#fff' : 'var(--text-secondary)',
                  border: 'none',
                  borderRadius: 'var(--radius-sm)',
                  padding: '6px 14px',
                  fontSize: '13px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                🛡️ SOC Insider Threat
              </button>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                onClick={() => setSelectedOrg(null)}
                className="btn-secondary"
                style={{ height: '32px', padding: '0 12px', fontSize: '11px' }}
              >
                Switch Workspace
              </button>
              <button
                onClick={handleLogout}
                className="btn-danger-outline"
                style={{ height: '32px', padding: '0 12px', fontSize: '11px' }}
              >
                Logout
              </button>
            </div>

            {isConnected ? (
              <span className="badge badge-success">
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'currentColor' }}></span>
                Telemetry Synced
              </span>
            ) : (
              <span className="badge badge-danger">
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'currentColor' }}></span>
                API Offline
              </span>
            )}
          </div>
        </header>

        {/* View Selection */}
        {activeView === 'admin' ? (
          <AdminDashboard orgId={selectedOrg.id} />
        ) : (
          /* SOC Insider Threat View */
          <main style={{ display: 'grid', gridTemplateColumns: 'minmax(320px, 1fr) minmax(440px, 1.4fr)', gap: '24px' }}>
            {/* Left Column: Live Alerts Stream */}
            <div className="feature-card" style={{ padding: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h2 className="title-md" style={{ color: 'var(--text-primary)', margin: 0 }}>Live Security Alerts</h2>
                <span className="badge badge-info">{alerts.length} Alerts</span>
              </div>

              {!isConnected ? (
                <div
                  style={{
                    padding: '16px',
                    borderRadius: 'var(--radius-md)',
                    background: 'rgba(248, 113, 113, 0.08)',
                    border: '1px solid rgba(248, 113, 113, 0.25)',
                    color: 'var(--accent-red)',
                    fontSize: '13px',
                    lineHeight: '1.5',
                  }}
                >
                  ⚠️ <strong>Backend disconnected</strong> — unable to reach CipherWatch API
                </div>
              ) : loading ? (
                <div className="body-sm" style={{ color: 'var(--text-muted)', padding: '20px 0' }}>Loading alerts feed...</div>
              ) : alerts.length === 0 ? (
                <div className="body-sm" style={{ color: 'var(--text-muted)', padding: '20px 0' }}>No active alerts detected.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {alerts.map((a) => {
                    const isSelected = selectedSession?.id === a.session_id
                    return (
                      <div
                        key={a.id}
                        onClick={() => handleSelectAlert(a)}
                        style={{
                          padding: '16px',
                          borderRadius: 'var(--radius-md)',
                          background: isSelected ? 'var(--surface-card-hover)' : 'var(--surface-soft)',
                          border: isSelected ? '1px solid var(--primary-cta)' : '1px solid var(--border-subtle)',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                          boxShadow: isSelected ? '0 0 0 1px var(--primary-cta)' : 'none',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                          <span className="badge badge-info">{a.user_id}</span>
                          <span className={`badge ${a.severity === 'CRITICAL' || a.severity === 'HIGH' ? 'badge-danger' : 'badge-warning'}`}>
                            {a.severity} ({(a.risk_score * 100).toFixed(0)}%)
                          </span>
                        </div>

                        <p className="body-sm" style={{ color: 'var(--text-primary)', marginBottom: '8px', fontWeight: '500' }}>
                          {a.message}
                        </p>

                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-muted)' }}>
                          <span>Device: {a.device_id}</span>
                          <span style={{ color: 'var(--primary-blue)', fontWeight: '500' }}>View session steps →</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Right Column */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <RiskChart />
              <AnalystControls alertId={activeAlert?.id} alertStatus={activeAlert?.status} />
              <SessionTimeline session={selectedSession} onClose={() => setSelectedSession(null)} />
              <RiskBreakdown />
              <IncidentSummary alertId={activeAlert?.id} alertData={activeAlert} />
            </div>
          </main>
        )}
      </div>
    </div>
  )
}
