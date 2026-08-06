import React, { useState, useEffect } from 'react'
import SessionTimeline from './components/SessionTimeline'
import RiskBreakdown from './components/RiskBreakdown'
import IncidentSummary from './components/IncidentSummary'
import AnalystControls from './components/AnalystControls'
import PrivacyBanner from './components/PrivacyBanner'
import RiskChart from './components/RiskChart'
import AdminDashboard from './components/AdminDashboard'
import HeroBand from './components/HeroBand'
import SessionGraphCard from './components/SessionGraphCard'
import ZeroContentBand from './components/ZeroContentBand'
import FaqSection from './components/FaqSection'
import CtaBandDark from './components/CtaBandDark'
import FooterLight from './components/FooterLight'

import LoginPage from './components/LoginPage'

export default function App() {

  const [activeView, setActiveView] = useState('admin') // 'admin' | 'soc'
  const [alerts, setAlerts] = useState([])
  const [selectedSession, setSelectedSession] = useState(null)
  const [loading, setLoading] = useState(false)
  const [isConnected, setIsConnected] = useState(true)
  const [alertTabFilter, setAlertTabFilter] = useState('ALL') // 'ALL' | 'CRITICAL' | 'WARNING'
  const [alertSortBy, setAlertSortBy] = useState('threat') // 'threat' | 'date'


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

    const interval = setInterval(fetchAlerts, 10000)
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

  const filteredAlerts = alerts

    .filter((a) => {
      if (alertTabFilter === 'CRITICAL') return a.severity === 'CRITICAL' || a.severity === 'HIGH'
      if (alertTabFilter === 'WARNING') return a.severity === 'WARNING' || a.severity === 'MEDIUM'
      return true
    })
    .sort((a, b) => {
      if (alertSortBy === 'threat') {
        return (b.risk_score || 0) - (a.risk_score || 0)
      }
      return (b.id || 0) - (a.id || 0)
    })


  // 1. Loading Authentication State Screen
  if (authLoading && !currentUser) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--colors-canvas-dark)',
        color: 'var(--colors-muted-strong)'
      }}>
        <div style={{
          width: '40px',
          height: '40px',
          borderRadius: '50%',
          border: '3px solid var(--colors-hairline-on-dark)',
          borderTopColor: 'var(--colors-primary)',
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

  // 2. Unauthenticated state: Split-Screen Login/Signup portal
  if (!currentUser) {
    return (
      <LoginPage
        authMode={authMode}
        setAuthMode={setAuthMode}
        username={username}
        setUsername={setUsername}
        email={email}
        setEmail={setEmail}
        password={password}
        setPassword={setPassword}
        orgName={orgName}
        setOrgName={setOrgName}
        authError={authError}
        authLoading={authLoading}
        handleLogin={handleLogin}
        handleSignup={handleSignup}
      />
    )
  }


  // 3. Authenticated but workspace not selected: Org Selector
  if (!selectedOrg) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: 'var(--colors-canvas-dark)' }}>
        <PrivacyBanner />
        <div style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '40px 24px'
        }}>
          <div className="alert-feed-card" style={{
            width: '100%',
            maxWidth: '520px',
            padding: '40px',
            backgroundColor: 'var(--colors-surface-card-dark)',
            border: '1px solid var(--colors-hairline-on-dark)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <h2 className="display-sm" style={{ color: 'var(--colors-on-dark)', margin: 0 }}>Select Workspace</h2>
              <span className="badge badge-info">{currentUser.username}</span>
            </div>
            <p className="body-sm" style={{ color: 'var(--colors-muted-strong)', marginBottom: '32px' }}>
              Please select a workspace organization to begin telemetry ingestion and fleet monitoring.
            </p>

            {authError && (
              <div style={{
                padding: '12px 16px',
                borderRadius: 'var(--rounded-md)',
                background: 'rgba(246, 70, 93, 0.1)',
                border: '1px solid rgba(246, 70, 93, 0.3)',
                color: 'var(--colors-risk-escalating)',
                fontSize: '13px',
                marginBottom: '24px',
              }}>
                ⚠️ {authError}
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '32px' }}>
              {organizations.map((org) => (
                <div
                  key={org.id}
                  onClick={() => setSelectedOrg(org)}
                  style={{
                    padding: '18px 24px',
                    borderRadius: 'var(--rounded-md)',
                    backgroundColor: 'var(--colors-canvas-dark)',
                    border: '1px solid var(--colors-hairline-on-dark)',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = 'var(--colors-primary)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'var(--colors-hairline-on-dark)';
                  }}
                >
                  <div>
                    <h3 className="title-md" style={{ color: 'var(--colors-on-dark)', margin: 0 }}>{org.name}</h3>
                    <span className="body-sm" style={{ color: 'var(--colors-muted)', marginTop: '4px', display: 'inline-block' }}>
                      Authorization level: <strong style={{ color: 'var(--colors-primary)' }}>{org.role.toUpperCase()}</strong>
                    </span>
                  </div>
                  <span style={{ color: 'var(--colors-primary)', fontSize: '13px', fontWeight: '600' }}>
                    Enter →
                  </span>
                </div>
              ))}
            </div>

            <div style={{
              borderTop: '1px solid var(--colors-hairline-on-dark)',
              paddingTop: '24px'
            }}>
              <h4 className="title-sm" style={{ color: 'var(--colors-on-dark)', marginBottom: '12px' }}>Initialize Additional Workspace</h4>
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
        <FooterLight />
      </div>
    )
  }

  // 4. Authenticated & Selected workspace: Full Dashboard Layout
  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--colors-canvas-dark)', display: 'flex', flexDirection: 'column' }}>
      {/* Top Bar Navigation (top-nav-dark) */}
      <header className="top-nav-dark">
        <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
            <div style={{
              width: '32px',
              height: '32px',
              backgroundColor: 'var(--colors-surface-card-dark)',
              border: '1px solid var(--colors-hairline-on-dark)',
              borderRadius: 'var(--rounded-md)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: '700',
              fontSize: '15px',
              color: 'var(--colors-primary)'
            }}>
              CW
            </div>
            <span style={{ fontWeight: '700', fontSize: '16px', letterSpacing: '-0.3px', color: 'var(--colors-on-dark)' }}>
              CIPHER<span style={{ color: 'var(--colors-primary)' }}>WATCH</span>
            </span>
          </div>

          <nav style={{ display: 'flex', gap: '16px', marginLeft: '16px' }}>
            <button
              onClick={() => setActiveView('admin')}
              style={{
                background: 'none',
                border: 'none',
                color: activeView === 'admin' ? 'var(--colors-primary)' : 'var(--colors-muted-strong)',
                fontWeight: activeView === 'admin' ? '600' : '500',
                fontSize: '14px',
                cursor: 'pointer',
                borderBottom: activeView === 'admin' ? '2px solid var(--colors-primary)' : '2px solid transparent',
                padding: '18px 4px 16px'
              }}
            >
              💻 Live Telemetry & Fleet
            </button>

            <button
              onClick={() => setActiveView('soc')}
              style={{
                background: 'none',
                border: 'none',
                color: activeView === 'soc' ? 'var(--colors-primary)' : 'var(--colors-muted-strong)',
                fontWeight: activeView === 'soc' ? '600' : '500',
                fontSize: '14px',
                cursor: 'pointer',
                borderBottom: activeView === 'soc' ? '2px solid var(--colors-primary)' : '2px solid transparent',
                padding: '18px 4px 16px'
              }}
            >
              🛡️ SOC Threat Sequence
            </button>
          </nav>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--colors-surface-card-dark)', padding: '6px 12px', borderRadius: 'var(--rounded-pill)', border: '1px solid var(--colors-hairline-on-dark)' }}>
            <span className="body-sm" style={{ color: 'var(--colors-muted-strong)' }}>Workspace:</span>
            <strong className="body-sm" style={{ color: 'var(--colors-on-dark)' }}>{selectedOrg.name}</strong>
          </div>

          <button
            onClick={() => setSelectedOrg(null)}
            className="btn-secondary"
            style={{ height: '32px', padding: '0 12px', fontSize: '12px' }}
          >
            Switch
          </button>

          <button
            onClick={handleLogout}
            className="btn-secondary"
            style={{ height: '32px', padding: '0 12px', fontSize: '12px' }}
          >
            Logout
          </button>

          {isConnected ? (
            <span className="badge badge-success">
              ● Telemetry Online
            </span>
          ) : (
            <span className="badge badge-danger">
              ● Disconnected
            </span>
          )}
        </div>
      </header>

      {/* Global Zero-Privacy Banner */}
      <PrivacyBanner />

      {/* Hero Display Section */}
      <HeroBand onSearch={(q) => console.log('Search query:', q)} />

      {/* Primary Dashboard Interactive Workarea */}
      <section style={{ padding: '24px 24px', flex: 1 }}>
        <div className="container">
          {activeView === 'admin' ? (
            <AdminDashboard orgId={selectedOrg.id} />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Session Graph Multi-Hop Visualization Card */}
              <SessionGraphCard session={selectedSession} />

              {/* Main SOC Layout Grid - Asymmetric Information-Density Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(300px, 1fr) minmax(480px, 1.6fr)', gap: '20px', alignItems: 'start' }}>
                
                {/* Left Column: Live Alerts Stream (Narrower, Taller, Scrollable Feed) */}
                <div className="alert-feed-card" style={{ padding: '20px', sticky: 'top', top: '80px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <div>
                      <div className="section-terminal-label" style={{ marginBottom: '4px' }}>
                        <span>🚨 LIVE THREAT ALERT FEED</span>
                      </div>
                      <h2 className="title-md" style={{ color: 'var(--colors-on-dark)', margin: 0 }}>
                        Real-Time Triage
                      </h2>
                    </div>
                    <span className="badge badge-info">{filteredAlerts.length} Alerts</span>
                  </div>

                  {/* Filter Tabs & Sort Controls */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--colors-hairline-on-dark)', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      {['ALL', 'CRITICAL', 'WARNING'].map((tab) => (
                        <button
                          key={tab}
                          onClick={() => setAlertTabFilter(tab)}
                          className={`alert-tab ${alertTabFilter === tab ? 'active' : ''}`}
                        >
                          {tab}
                        </button>
                      ))}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', paddingBottom: '4px' }}>
                      <span style={{ fontSize: '10px', color: 'var(--colors-muted)', fontWeight: 700 }}>SORT:</span>
                      <select
                        value={alertSortBy}
                        onChange={(e) => setAlertSortBy(e.target.value)}
                        className="select-compact"
                        style={{ fontSize: '10px', padding: '2px 6px' }}
                      >
                        <option value="threat">Threat Level</option>
                        <option value="date">Recent First</option>
                      </select>
                    </div>
                  </div>


                  {!isConnected ? (
                    <div style={{ padding: '16px', borderRadius: 'var(--rounded-md)', background: 'rgba(246, 70, 93, 0.1)', border: '1px solid rgba(246, 70, 93, 0.3)', color: 'var(--colors-risk-escalating)', fontSize: '13px' }}>
                      ⚠️ <strong>Backend disconnected</strong> — unable to poll telemetry server
                    </div>
                  ) : loading ? (
                    <div className="body-sm" style={{ color: 'var(--colors-muted)', padding: '20px 0' }}>Loading live telemetry feed...</div>
                  ) : filteredAlerts.length === 0 ? (
                    <div className="body-sm" style={{ color: 'var(--colors-muted)', padding: '20px 0', textAlign: 'center' }}>
                      No threat alerts match filter "{alertTabFilter}".
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '580px', overflowY: 'auto', paddingRight: '4px' }}>
                      {filteredAlerts.map((a) => {
                        const isSelected = selectedSession?.id === a.session_id
                        const isCritical = a.severity === 'CRITICAL'
                        return (
                          <div
                            key={a.id}
                            className={`alert-row ${isSelected && isCritical ? 'glow-escalating' : isSelected ? 'glow-primary' : ''}`}
                            onClick={() => handleSelectAlert(a)}
                            style={{
                              cursor: 'pointer',
                              padding: '12px 14px',
                              borderRadius: 'var(--rounded-md)',
                              background: isSelected ? 'var(--gradient-card-surface)' : 'var(--colors-canvas-dark)',
                              border: isSelected ? `1px solid ${isCritical ? '#f6465d' : '#fcd535'}` : '1px solid var(--colors-hairline-on-dark)',
                              borderLeft: `4px solid ${isCritical ? '#f6465d' : '#0ecb81'}`,
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <div className="pattern-icon-chip" style={{ width: '28px', height: '28px', fontSize: '12px' }}>
                                {isCritical ? '🚨' : '⚠️'}
                              </div>
                              <div style={{ minWidth: 0, flex: 1 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  <strong className="body-sm" style={{ color: 'var(--colors-on-dark)', fontWeight: '600' }}>{a.user_id}</strong>
                                  <span className="body-sm" style={{ color: 'var(--colors-muted)', fontSize: '11px' }}>({a.device_id})</span>
                                </div>
                                <p className="body-sm" style={{ color: 'var(--colors-muted-strong)', marginTop: '2px', fontSize: '11px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                  {a.message}
                                </p>
                              </div>
                            </div>

                            <div style={{ textAlign: 'right', flexShrink: 0 }}>
                              <span className={isCritical ? 'risk-escalating-cell text-gradient-escalating' : 'risk-contained-cell text-gradient-contained'} style={{ fontSize: '14px' }}>
                                {(a.risk_score * 100).toFixed(0)}%
                              </span>
                              <div className="body-sm" style={{ color: 'var(--colors-primary)', fontSize: '10px', fontWeight: '700', marginTop: '2px' }}>
                                Traced →
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>

                {/* Right Column: Detailed Telemetry Analysis Widgets */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  <RiskChart />
                  <AnalystControls alertId={activeAlert?.id} alertStatus={activeAlert?.status} />
                  <SessionTimeline session={selectedSession} onClose={() => setSelectedSession(null)} />
                  <RiskBreakdown />
                  <IncidentSummary alertId={activeAlert?.id} alertData={activeAlert} />
                </div>
              </div>
            </div>
          )}
        </div>
      </section>


      {/* Privacy Proof Zero Content Band */}
      <ZeroContentBand />

      {/* Frequently Asked Security Questions */}
      <FaqSection />

      {/* Enterprise CTA Band */}
      <CtaBandDark onActionClick={() => setActiveView('admin')} />

      {/* Inverted Light-Mode Footer */}
      <FooterLight />
    </div>
  )
}
