import React, { useState, useEffect } from 'react'
import SessionTimeline from './components/SessionTimeline'
import RiskBreakdown from './components/RiskBreakdown'
import IncidentSummary from './components/IncidentSummary'
import AnalystControls from './components/AnalystControls'
import PrivacyBanner from './components/PrivacyBanner'
import RiskChart from './components/RiskChart'
import AdminDashboard from './components/AdminDashboard'
import OrganizationDashboard from './components/OrganizationDashboard'
import UserDetailDashboard from './components/UserDetailDashboard'
import HeroBand from './components/HeroBand'
import SessionGraphCard from './components/SessionGraphCard'
import ZeroContentBand from './components/ZeroContentBand'
import FaqSection from './components/FaqSection'
import CtaBandDark from './components/CtaBandDark'
import FooterLight from './components/FooterLight'
import NotificationCenter from './components/NotificationCenter'
import { Shield, Activity, AlertTriangle } from 'lucide-react'

import LoginPage from './components/LoginPage'

export default function App() {

  const [activeView, setActiveView] = useState('admin') // 'admin' | 'soc'
  const [currentPage, setCurrentPage] = useState('ADMIN') // 'ADMIN' | 'ORGANIZATION' | 'USER_DETAIL'
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
  const [selectedUser, setSelectedUser] = useState(null)
  const [authMode, setAuthMode] = useState('login') // 'login' | 'signup'
  const [authLoading, setAuthLoading] = useState(true)
  const [authError, setAuthError] = useState('')
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [orgName, setOrgName] = useState('')
  const [newOrgName, setNewOrgName] = useState('')

  // Navigation helper that updates React state AND synchronizes HTML5 browser history (pushState)
  const navigateToPage = (page, org = selectedOrg, user = selectedUser, replace = false) => {
    setCurrentPage(page)
    setSelectedOrg(org)
    setSelectedUser(user)

    let path = '/admin'
    if (page === 'ADMIN') {
      path = '/admin'
    } else if (page === 'ORGANIZATION' && org) {
      path = `/orgs/${org.id}`
    } else if (page === 'USER_DETAIL' && user) {
      path = `/orgs/${org?.id || 'default'}/users/${user.id}`
    }

    const stateData = { page, orgId: org?.id, user, userId: user?.id }
    if (replace) {
      window.history.replaceState(stateData, '', path)
    } else {
      window.history.pushState(stateData, '', path)
    }
  }

  // Listen for browser Back & Forward navigation (popstate event)
  useEffect(() => {
    const handlePopState = (e) => {
      const state = e.state
      if (state && state.page) {
        setCurrentPage(state.page)
        if (state.orgId) {
          const found = organizations.find((o) => o.id === state.orgId) || { id: state.orgId, name: 'Workspace ' + state.orgId, role: 'member' }
          setSelectedOrg(found)
        } else if (state.page === 'ADMIN') {
          setSelectedOrg(null)
        }
        if (state.user) {
          setSelectedUser(state.user)
        } else {
          setSelectedUser(null)
        }
      } else {
        const path = window.location.pathname
        const parts = path.split('/').filter(Boolean)
        if (parts[0] === 'orgs' && parts[1]) {
          const orgId = parts[1]
          const matchedOrg = organizations.find((o) => o.id === orgId) || { id: orgId, name: 'Workspace ' + orgId, role: 'member' }
          setSelectedOrg(matchedOrg)
          if (parts[2] === 'users' && parts[3]) {
            const userId = parts[3]
            setSelectedUser({ id: userId, name: userId, email: `${userId}@cipherwatch.io`, os: 'Linux Enterprise', riskScore: 75 })
            setCurrentPage('USER_DETAIL')
          } else {
            setCurrentPage('ORGANIZATION')
          }
        } else {
          setCurrentPage('ADMIN')
          setSelectedOrg(null)
          setSelectedUser(null)
        }
      }
    }

    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [organizations])

  // Check if session cookie is valid on load & restore page state from URL on refresh
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
        const fetchedOrgs = orgs || []
        setOrganizations(fetchedOrgs)

        // Restore route & state from URL path on page refresh (F5)
        const path = window.location.pathname
        const parts = path.split('/').filter(Boolean)

        if (parts[0] === 'orgs' && parts[1]) {
          const orgId = parts[1]
          const matchedOrg = fetchedOrgs.find((o) => o.id === orgId) || { id: orgId, name: 'Workspace ' + orgId, role: 'member' }
          setSelectedOrg(matchedOrg)

          if (parts[2] === 'users' && parts[3]) {
            const userId = parts[3]
            const uObj = { id: userId, name: userId, email: `${userId}@cipherwatch.io`, os: 'Linux Enterprise', riskScore: 75 }
            setSelectedUser(uObj)
            setCurrentPage('USER_DETAIL')
            window.history.replaceState({ page: 'USER_DETAIL', orgId: matchedOrg.id, user: uObj, userId }, '', path)
          } else {
            setCurrentPage('ORGANIZATION')
            window.history.replaceState({ page: 'ORGANIZATION', orgId: matchedOrg.id, user: null }, '', path)
          }
        } else {
          setCurrentPage('ADMIN')
          setSelectedOrg(null)
          setSelectedUser(null)
          window.history.replaceState({ page: 'ADMIN', orgId: null, user: null }, '', '/admin')
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
        let data = {}
        try {
          data = await res.json()
        } catch {
          data = {}
        }
        if (!res.ok) throw new Error(data.detail || `Authentication failed (${res.status})`)
        return data
      })
      .then(() => fetch('/api/auth/me').then((res) => res.json()))
      .then((user) => {
        setCurrentUser(user)
        return fetch('/api/orgs').then((res) => res.json())
      })
      .then((orgs) => {
        setOrganizations(orgs || [])
        setCurrentPage('ADMIN')
        setSelectedOrg(null)
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
      body: JSON.stringify({ email, username, password }),
    })
      .then(async (res) => {
        let data = {}
        try {
          data = await res.json()
        } catch {
          data = {}
        }
        if (!res.ok) throw new Error(data.detail || `Registration failed (${res.status})`)
        return data
      })
      .then(() => fetch('/api/auth/me').then((res) => res.json()))
      .then((user) => {
        setCurrentUser(user)
        return fetch('/api/orgs').then((res) => res.json())
      })
      .then((orgs) => {
        setOrganizations(orgs || [])
        setCurrentPage('ADMIN')
        setSelectedOrg(null)
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




  // 4. Authenticated: Multi-Page Router (Admin, Organization, User Detail)
  if (currentPage === 'ADMIN' || !selectedOrg) {
    return (
      <AdminDashboard
        orgId={selectedOrg?.id}
        selectedOrg={selectedOrg}
        organizations={organizations}
        currentUser={currentUser}
        onSelectOrg={(org) => navigateToPage('ORGANIZATION', org, null)}
        onLogout={handleLogout}
        onSwitchOrg={() => navigateToPage('ADMIN', null, null)}
      />
    )
  }

  if (currentPage === 'USER_DETAIL' && selectedUser) {
    return (
      <UserDetailDashboard
        user={selectedUser}
        org={selectedOrg}
        onBackToOrg={() => navigateToPage('ORGANIZATION', selectedOrg, null)}
        currentUser={currentUser}
        onLogout={handleLogout}
      />
    )
  }

  return (
    <OrganizationDashboard
      org={selectedOrg}
      onBackToAdmin={() => navigateToPage('ADMIN', null, null)}
      currentUser={currentUser}
      onLogout={handleLogout}
      onSwitchOrg={(org) => navigateToPage('ORGANIZATION', org, null)}
      organizations={organizations}
      onSelectOrg={(org) => navigateToPage('ORGANIZATION', org, null)}
      onSelectUser={(user) => navigateToPage('USER_DETAIL', selectedOrg, user)}
    />
  )
}
