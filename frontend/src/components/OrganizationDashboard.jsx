import React, { useState, useMemo, useEffect } from 'react'
import { Shield, Activity, Building, Key, RefreshCw, Edit3, Trash2, Plus, ChevronDown, Copy, Check, Eye, EyeOff, User, Info, X, PieChart as PieChartIcon, BarChart2 as BarChartIcon } from 'lucide-react'
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, BarChart, Bar, XAxis, YAxis } from './RechartsCompat'
import NotificationCenter from './NotificationCenter'
import UserDetailDashboard from './UserDetailDashboard'
import OrganizationSwitchModal from './OrganizationSwitchModal'
import PredictiveBehaviorWidget from './PredictiveBehaviorWidget'

export default function OrganizationDashboard({ org, onBackToAdmin, currentUser, onLogout, onSwitchOrg, onSelectUser, organizations, onSelectOrg, onSwitchView }) {
  const [selectedUser, setSelectedUser] = useState(null)
  const [isSwitchModalOpen, setIsSwitchModalOpen] = useState(false)

  // Current organization data fallback
  const currentOrg = org || {
    id: 'org-1',
    name: 'Default Organization',
    riskScore: 15,
    apiKey: '',
  }

  // Current Enrollment Key state (supports Rotate Enrollment Key)
  const [currentKey, setCurrentKey] = useState(currentOrg.apiKey || '')

  // API key masking state & Copy Toast feedback states
  const [isKeyVisible, setIsKeyVisible] = useState(false)
  const [copiedOrgIdToast, setCopiedOrgIdToast] = useState(false)
  const [copiedKeyToast, setCopiedKeyToast] = useState(false)
  const [copiedCommandToast, setCopiedCommandToast] = useState(false)

  // Users/agents state loaded from database
  const [users, setUsers] = useState([])
  const [isLoadingUsers, setIsLoadingUsers] = useState(true)

  // Right column chart toggle state ('pie' | 'bar')
  const [rightChartView, setRightChartView] = useState('pie')

  // Fetch real registration credentials & enrolled agents for this org
  useEffect(() => {
    let isMounted = true

    // Fetch credentials
    fetch(`/api/orgs/${currentOrg.id}/registration-credentials`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (isMounted && data) {
          setCurrentKey(data.enrollment_key || data.registration_key || '')
        }
      })
      .catch((err) => console.error('Error fetching org credentials:', err))

    // Fetch enrolled agents (systems)
    setIsLoadingUsers(true)
    fetch(`/api/admin/orgs/${currentOrg.id}/systems`)
      .then((res) => (res.ok ? res.json() : []))
      .then((agents) => {
        if (!isMounted) return
        if (Array.isArray(agents)) {
          const mappedUsers = agents.map((a) => {
            const osLower = (a.os || '').toLowerCase()
            const osType = osLower.includes('mac') ? 'macos' : osLower.includes('win') ? 'windows' : 'linux'
            
            let risk = 15
            if (a.threat_level === 'critical') risk = 88
            else if (a.threat_level === 'warning' || a.threat_level === 'high') risk = 62
            else if (a.active_alert_count > 0) risk = 45

            return {
              id: a.id,
              name: a.hostname || a.id,
              email: `${(a.hostname || a.id).toLowerCase().replace(/[^a-z0-9]/g, '.')}@${currentOrg.name.toLowerCase().replace(/[^a-z0-9]/g, '')}.internal`,
              os: a.os || 'Linux / Unknown',
              osType: osType,
              riskScore: risk,
              dateAdded: a.enrolled_at ? new Date(a.enrolled_at).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
              device: a.hostname || a.id,
              ipAddress: a.ip || '127.0.0.1',
              lastSeen: a.last_seen_at ? new Date(a.last_seen_at).toLocaleString() : 'Just now',
              status: a.status || 'online',
              threatLevel: a.threat_level || 'none',
              activeAlerts: a.active_alert_count || 0,
            }
          })
          setUsers(mappedUsers)
        } else {
          setUsers([])
        }
        setIsLoadingUsers(false)
      })
      .catch((err) => {
        console.error('Error fetching enrolled agents for org:', err)
        if (isMounted) {
          setUsers([])
          setIsLoadingUsers(false)
        }
      })

    return () => {
      isMounted = false
    }
  }, [currentOrg.id])

  // Sorting state for User List
  const [sortBy, setSortBy] = useState('Most Threats') // 'Most Threats' | 'Alphabetical' | 'Date Added'

  // Modal state for adding a user
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [newUserName, setNewUserName] = useState('')
  const [newUserEmail, setNewUserEmail] = useState('')
  const [newUserOS, setNewUserOS] = useState('Windows 11')

  // Action Notice Toast
  const [actionNotice, setActionNotice] = useState(null)

  // Three-dot dropdown state per user
  const [openDropdownId, setOpenDropdownId] = useState(null)

  // Listen for global clicks to dismiss dropdown
  useEffect(() => {
    const handleGlobalClick = () => setOpenDropdownId(null)
    window.addEventListener('click', handleGlobalClick)
    return () => window.removeEventListener('click', handleGlobalClick)
  }, [])

  // Copy Org ID to clipboard
  const handleCopyOrgId = () => {
    navigator.clipboard.writeText(currentOrg.id)
    setCopiedOrgIdToast(true)
    setTimeout(() => setCopiedOrgIdToast(false), 2000)
  }

  // Copy Enrollment Key to clipboard
  const handleCopyKey = () => {
    navigator.clipboard.writeText(currentKey)
    setCopiedKeyToast(true)
    setTimeout(() => setCopiedKeyToast(false), 2000)
  }

  // Copy Full Agent Setup Command to clipboard
  const handleCopyCommand = () => {
    const cmd = `cipherwatch-agent setup --server-url http://localhost:8000 --org-id ${currentOrg.id} --enrollment-key ${currentKey}`
    navigator.clipboard.writeText(cmd)
    setCopiedCommandToast(true)
    setTimeout(() => setCopiedCommandToast(false), 2000)
  }

  // Rotate Enrollment Key Handler - calls real backend endpoint to persist in DB
  const handleRotateKey = async () => {
    try {
      const res = await fetch(`/api/orgs/${currentOrg.id}/rotate-enrollment-key`, {
        method: 'POST',
      })
      if (!res.ok) {
        throw new Error('Failed to rotate enrollment key in database')
      }
      const data = await res.json()
      setCurrentKey(data.enrollment_key)
      setActionNotice(`Successfully rotated enrollment key for ${currentOrg.name}. Update existing host machine agents.`)
    } catch (err) {
      console.error('Error rotating enrollment key:', err)
      alert(`Key rotation failed: ${err.message}`)
    }
  }

  // Add User Handler (note: Endpoints enroll automatically via agent CLI command, but UI allows manually staging endpoint)
  const handleAddUser = (e) => {
    e.preventDefault()
    if (!newUserName.trim()) return

    const osTypeMap = {
      'Windows 11': 'windows',
      'macOS Sonoma': 'macos',
      'Ubuntu Linux': 'linux',
    }

    const newUser = {
      id: `agent-manual-${Date.now().toString(36)}`,
      name: newUserName.trim(),
      email: newUserEmail.trim() || `${newUserName.toLowerCase().replace(/\s+/g, '.')}@internal.cipherwatch`,
      os: newUserOS,
      osType: osTypeMap[newUserOS] || 'windows',
      riskScore: 15,
      dateAdded: new Date().toISOString().split('T')[0],
      device: newUserName.trim(),
      ipAddress: '192.168.1.100',
      lastSeen: 'Pending enrollment',
      status: 'offline',
    }

    setUsers([newUser, ...users])
    setNewUserName('')
    setNewUserEmail('')
    setIsModalOpen(false)
    setActionNotice(`Endpoint "${newUserName.trim()}" staged. Run the setup command on the target host machine to complete enrollment.`)
  }

  // Delete/Revoke User Handler - calls backend API to revoke agent record in DB
  const handleDeleteUser = async (id, e) => {
    if (e) e.stopPropagation()
    setOpenDropdownId(null)

    try {
      const res = await fetch(`/api/agents/${id}/revoke`, {
        method: 'POST',
      })
      if (res.ok) {
        setUsers(users.filter((u) => u.id !== id))
        setActionNotice(`Agent endpoint ${id} has been revoked and removed from database.`)
      } else {
        // Fallback filter local state if mock/manual ID
        setUsers(users.filter((u) => u.id !== id))
        setActionNotice(`Endpoint removed from dashboard.`)
      }
    } catch (err) {
      setUsers(users.filter((u) => u.id !== id))
    }
  }

  // Rename User Handler
  const handleRenameUser = (id, currentName, e) => {
    if (e) e.stopPropagation()
    setOpenDropdownId(null)
    const updated = prompt('Enter new user name:', currentName)
    if (updated && updated.trim()) {
      setUsers(users.map((u) => (u.id === id ? { ...u, name: updated.trim() } : u)))
    }
  }

  // Sorted Users
  const sortedUsers = useMemo(() => {
    return [...users].sort((a, b) => {
      if (sortBy === 'Most Threats') return b.riskScore - a.riskScore
      if (sortBy === 'Alphabetical') return a.name.localeCompare(b.name)
      if (sortBy === 'Date Added') return new Date(b.dateAdded) - new Date(a.dateAdded)
      return 0
    })
  }, [users, sortBy])

  // OS Icon Helper (No emojis - Clean Badges)
  const renderOSIcon = (osType) => {
    if (osType === 'windows') {
      return <span style={{ fontSize: '10px', fontWeight: '800', backgroundColor: '#1e293b', color: '#38bdf8', padding: '2px 6px', borderRadius: '4px' }}>WIN</span>
    }
    if (osType === 'macos') {
      return <span style={{ fontSize: '10px', fontWeight: '800', backgroundColor: '#1e293b', color: '#f8fafc', padding: '2px 6px', borderRadius: '4px' }}>MAC</span>
    }
    return <span style={{ fontSize: '10px', fontWeight: '800', backgroundColor: '#1e293b', color: '#fcd535', padding: '2px 6px', borderRadius: '4px' }}>LNX</span>
  }



  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: '#070a12', color: '#e2e8f0', fontFamily: 'Inter, -apple-system, sans-serif' }}>
      
      {/* ------------------------------------------------------------- */}
      {/* 1. TOP NAVIGATION BAR (IDENTICAL TO ADMIN DASHBOARD)          */}
      {/* ------------------------------------------------------------- */}
      <header
        style={{
          height: '64px',
          background: 'linear-gradient(180deg, #181a20 0%, #0b0e11 100%)',
          borderBottom: '1px solid rgba(252, 213, 53, 0.15)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 28px',
          position: 'sticky',
          top: 0,
          zIndex: 100,
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.4)',
        }}
      >
        {/* Left Side: Wordmark + Live Feed + Slogan */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span
              style={{
                fontSize: '22px',
                fontWeight: '900',
                letterSpacing: '-0.5px',
                background: 'linear-gradient(135deg, #ffe066 0%, #fcd535 50%, #f0b90b 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                textShadow: '0 0 20px rgba(252, 213, 53, 0.25)',
              }}
            >
              CipherWatch
            </span>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: 'rgba(14, 203, 129, 0.12)',
              border: '1px solid rgba(14, 203, 129, 0.3)',
              padding: '4px 10px',
              borderRadius: '20px',
            }}
          >
            <span
              style={{
                width: '7px',
                height: '7px',
                borderRadius: '50%',
                backgroundColor: '#0ecb81',
                boxShadow: '0 0 8px #0ecb81',
              }}
            />
            <span style={{ fontSize: '11px', fontWeight: '800', color: '#0ecb81', letterSpacing: '0.8px' }}>
              LIVE FEED
            </span>
          </div>

          <span
            style={{
              fontSize: '12px',
              color: '#64748b',
              borderLeft: '1px solid var(--colors-hairline-on-dark)',
              paddingLeft: '16px',
              fontWeight: '500',
            }}
          >
            Zero-Content Privacy & Real-Time Endpoint Threat Intelligence
          </span>
        </div>

        {/* Right Side: Back Button + Organization Selector + Notification Center + Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button
            onClick={onBackToAdmin}
            style={{
              background: 'rgba(252, 213, 53, 0.1)',
              border: '1px solid rgba(252, 213, 53, 0.3)',
              color: '#fcd535',
              padding: '6px 14px',
              borderRadius: '8px',
              fontSize: '12px',
              fontWeight: '800',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(252, 213, 53, 0.2)')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'rgba(252, 213, 53, 0.1)')}
          >
            &larr; All Organizations
          </button>

          {/* Organization Switcher Dropdown */}
          {organizations && organizations.length > 0 && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                backgroundColor: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(252, 213, 53, 0.3)',
                padding: '4px 12px',
                borderRadius: '8px',
              }}
            >
              <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: '800', letterSpacing: '0.5px' }}>
                SWITCH ORG:
              </span>
              <select
                value={currentOrg.id}
                onChange={(e) => {
                  const targetId = parseInt(e.target.value, 10)
                  const found = organizations.find((o) => o.id === targetId)
                  if (found && onSelectOrg) {
                    onSelectOrg(found)
                  }
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#fcd535',
                  fontWeight: '800',
                  fontSize: '12px',
                  cursor: 'pointer',
                  outline: 'none',
                }}
              >
                {organizations.map((o) => (
                  <option key={o.id} value={o.id} style={{ backgroundColor: '#0c0f1d', color: '#ffffff' }}>
                    {o.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Email Notification Bell */}
          <NotificationCenter userEmail={currentUser?.email} />

          <button
            onClick={() => setIsSwitchModalOpen(true)}
            style={{
              background: 'rgba(252, 213, 53, 0.1)',
              border: '1px solid rgba(252, 213, 53, 0.3)',
              color: '#fcd535',
              padding: '6px 14px',
              borderRadius: '8px',
              fontSize: '12px',
              cursor: 'pointer',
              fontWeight: '800',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <Building size={13} /> Switch Org
          </button>

          {onLogout && (
            <button
              onClick={onLogout}
              style={{
                background: 'rgba(246, 70, 93, 0.1)',
                border: '1px solid rgba(246, 70, 93, 0.3)',
                color: '#f6465d',
                padding: '6px 12px',
                borderRadius: '8px',
                fontSize: '12px',
                cursor: 'pointer',
                fontWeight: '700',
              }}
            >
              Logout
            </button>
          )}
        </div>
      </header>

      {/* ------------------------------------------------------------- */}
      {/* 2. ORGANIZATION IDENTITY PANEL (DYNAMIC RISK GLOW)            */}
      {/* ------------------------------------------------------------- */}
      <section style={{ padding: '24px 28px 12px 28px' }}>
        {(() => {
          const score = currentOrg.riskScore ?? 0
          const isRed = score >= 70
          const isYellow = score >= 40 && score < 70
          const isGreen = score < 40

          const colorTheme = isRed ? '#f6465d' : isYellow ? '#fcd535' : '#0ecb81'
          const bgGradient = isRed
            ? 'linear-gradient(135deg, #1b0a10 0%, #120609 100%)'
            : isYellow
            ? 'linear-gradient(135deg, #1f1b0a 0%, #141106 100%)'
            : 'linear-gradient(135deg, #091a14 0%, #05110d 100%)'
          const borderColor = isRed
            ? '1px solid rgba(246, 70, 93, 0.45)'
            : isYellow
            ? '1px solid rgba(252, 213, 53, 0.45)'
            : '1px solid rgba(14, 203, 129, 0.45)'
          const shadowGlow = isRed
            ? '0 0 25px rgba(246, 70, 93, 0.25)'
            : isYellow
            ? '0 0 25px rgba(252, 213, 53, 0.25)'
            : '0 0 25px rgba(14, 203, 129, 0.25)'
          const badgeText = isRed
            ? 'CRITICAL SECURITY THREAT WORKSPACE'
            : isYellow
            ? 'MANAGED ORGANIZATION WORKSPACE'
            : 'OPTIMAL SECURITY BASELINE WORKSPACE'

          return (
            <div
              style={{
                background: bgGradient,
                border: borderColor,
                boxShadow: shadowGlow,
                borderRadius: '14px',
                padding: '24px 32px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                position: 'relative',
                overflow: 'hidden',
                transition: 'all 0.4s ease',
              }}
            >
              {/* Left: Organization Name */}
              <div style={{ position: 'relative', zIndex: 1 }}>
                <div
                  style={{
                    fontSize: '11px',
                    fontWeight: '800',
                    color: colorTheme,
                    letterSpacing: '1.5px',
                    textTransform: 'uppercase',
                    marginBottom: '6px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                >
                  <Building size={14} color={colorTheme} />
                  <span>{badgeText}</span>
                </div>
                <h1
                  style={{
                    margin: 0,
                    fontSize: '28px',
                    fontWeight: '800',
                    color: '#ffffff',
                    letterSpacing: '-0.5px',
                  }}
                >
                  {currentOrg.name}
                </h1>
              </div>

              {/* Center: Numeric Risk Score in Tabular Figures */}
              <div style={{ position: 'relative', zIndex: 1, textAlign: 'center' }}>
                <div style={{ fontSize: '11px', textTransform: 'uppercase', color: '#94a3b8', fontWeight: '700', letterSpacing: '1px' }}>
                  Aggregate Threat Risk Score
                </div>
                <div
                  style={{
                    fontSize: '44px',
                    fontWeight: '900',
                    color: colorTheme,
                    fontVariantNumeric: 'tabular-nums',
                    letterSpacing: '-1px',
                    textShadow: `0 0 20px ${colorTheme}80`,
                    marginTop: '2px',
                    transition: 'color 0.3s ease',
                  }}
                >
                  {score}%
                </div>
              </div>

              {/* Right: Action Button */}
              <div style={{ position: 'relative', zIndex: 1 }}>
                <button
                  onClick={() => setActionNotice(`Updated Security Policy & Telemetry Filters for ${currentOrg.name}`)}
                  style={{
                    background: isRed
                      ? 'linear-gradient(135deg, #f6465d 0%, #d9263e 100%)'
                      : isYellow
                      ? 'linear-gradient(135deg, #ffe066 0%, #fcd535 50%, #f0b90b 100%)'
                      : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                    color: isYellow ? '#070a12' : '#ffffff',
                    border: 'none',
                    padding: '14px 28px',
                    borderRadius: '10px',
                    fontSize: '14px',
                    fontWeight: '800',
                    letterSpacing: '0.5px',
                    cursor: 'pointer',
                    boxShadow: `0 4px 20px ${colorTheme}50`,
                    transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                    outline: 'none',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-2px)'
                    e.currentTarget.style.boxShadow = `0 8px 30px ${colorTheme}80`
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)'
                    e.currentTarget.style.boxShadow = `0 4px 20px ${colorTheme}50`
                  }}
                >
                  Configure Policy &rarr;
                </button>
              </div>
            </div>
          )
        })()}
      </section>

      {/* ------------------------------------------------------------- */}
      {/* PREDICTIVE BEHAVIOR DETECTION ENGINE WIDGET                   */}
      {/* ------------------------------------------------------------- */}
      <section style={{ padding: '0 28px 16px 28px' }}>
        <PredictiveBehaviorWidget orgId={currentOrg.id} />
      </section>

      {/* ------------------------------------------------------------- */}
      {/* 3. AGENT ENROLLMENT & SETUP COMMAND PANEL                     */}
      {/* ------------------------------------------------------------- */}
      <section style={{ padding: '0 28px 16px 28px' }}>
        <div
          style={{
            backgroundColor: 'var(--colors-surface-card-dark)',
            border: '1px solid var(--colors-hairline-on-dark)',
            borderRadius: '14px',
            padding: '24px 28px',
            boxShadow: '0 10px 30px rgba(0, 0, 0, 0.35)',
            display: 'flex',
            flexDirection: 'column',
            gap: '20px',
          }}
        >
          {/* Card Header & Rotate Button */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '800', color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Key size={18} color="var(--colors-primary)" /> Agent Enrollment & Setup Command
              </h2>
              <div style={{ fontSize: '12px', color: '#64748b', marginTop: '3px' }}>
                Enroll physical host machines/PCs into this organization fleet using the secure registration key.
              </div>
            </div>

            <button
              onClick={handleRotateKey}
              style={{
                backgroundColor: 'var(--colors-canvas-dark)',
                border: '1px solid var(--colors-hairline-on-dark)',
                color: '#cbd5e1',
                padding: '8px 14px',
                borderRadius: '8px',
                fontSize: '12px',
                fontWeight: '700',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = '#fcd535'
                e.currentTarget.style.color = '#fcd535'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--colors-hairline-on-dark)'
                e.currentTarget.style.color = '#cbd5e1'
              }}
            >
              <RefreshCw size={14} /> Rotate Enrollment Key
            </button>
          </div>

          {/* Row 1: Org ID & Enrollment Key Input Fields side by side */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
            {/* Field 1: Organization ID */}
            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: '800', color: '#94a3b8', letterSpacing: '0.8px', textTransform: 'uppercase', marginBottom: '8px' }}>
                ORGANIZATION ID (organization_id)
              </label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  readOnly
                  value={currentOrg.id}
                  style={{
                    flex: 1,
                    backgroundColor: 'var(--colors-canvas-dark)',
                    border: '1px solid var(--colors-hairline-on-dark)',
                    borderRadius: '8px',
                    padding: '8px 12px',
                    color: '#ffffff',
                    fontSize: '12px',
                    fontFamily: 'JetBrains Mono, monospace',
                    outline: 'none',
                  }}
                />
                <button
                  onClick={handleCopyOrgId}
                  style={{
                    backgroundColor: copiedOrgIdToast ? '#0ecb81' : 'var(--colors-surface-card-dark)',
                    border: `1px solid ${copiedOrgIdToast ? '#0ecb81' : 'var(--colors-hairline-on-dark)'}`,
                    color: copiedOrgIdToast ? '#070a12' : '#cbd5e1',
                    borderRadius: '8px',
                    padding: '0 16px',
                    fontSize: '12px',
                    fontWeight: '700',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                  }}
                >
                  {copiedOrgIdToast ? '✓ Copied' : 'Copy'}
                </button>
              </div>
            </div>

            {/* Field 2: Enrollment Key */}
            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: '800', color: '#94a3b8', letterSpacing: '0.8px', textTransform: 'uppercase', marginBottom: '8px' }}>
                ENROLLMENT KEY (enrollment_key)
              </label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  readOnly
                  value={isKeyVisible ? currentKey : '••••••••••••••••••••••••••••••••••••••••'}
                  style={{
                    flex: 1,
                    backgroundColor: 'var(--colors-canvas-dark)',
                    border: '1px solid var(--colors-hairline-on-dark)',
                    borderRadius: '8px',
                    padding: '10px 14px',
                    color: '#fcd535',
                    fontFamily: '"JetBrains Mono", monospace, Courier, sans-serif',
                    fontSize: '13px',
                    outline: 'none',
                    letterSpacing: isKeyVisible ? '0.5px' : '2px',
                  }}
                />
                <button
                  onClick={() => setIsKeyVisible(!isKeyVisible)}
                  style={{
                    backgroundColor: 'var(--colors-surface-card-dark)',
                    border: '1px solid var(--colors-hairline-on-dark)',
                    color: '#cbd5e1',
                    borderRadius: '8px',
                    padding: '0 14px',
                    fontSize: '12px',
                    fontWeight: '700',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                  }}
                >
                  {isKeyVisible ? 'Hide' : 'Show'}
                </button>
                <button
                  onClick={handleCopyKey}
                  style={{
                    backgroundColor: copiedKeyToast ? '#0ecb81' : 'var(--colors-surface-card-dark)',
                    border: `1px solid ${copiedKeyToast ? '#0ecb81' : 'var(--colors-hairline-on-dark)'}`,
                    color: copiedKeyToast ? '#070a12' : '#cbd5e1',
                    borderRadius: '8px',
                    padding: '0 16px',
                    fontSize: '12px',
                    fontWeight: '700',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                  }}
                >
                  {copiedKeyToast ? '✓ Copied' : 'Copy'}
                </button>
              </div>
            </div>
          </div>

          {/* Row 2: Setup Command */}
          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: '800', color: '#94a3b8', letterSpacing: '0.8px', textTransform: 'uppercase', marginBottom: '8px' }}>
              Setup command for physical host machines:
            </label>
            <div style={{ display: 'flex', gap: '12px' }}>
              <div
                style={{
                  flex: 1,
                  backgroundColor: 'var(--colors-canvas-dark)',
                  border: '1px solid var(--colors-hairline-on-dark)',
                  borderRadius: '8px',
                  padding: '12px 16px',
                  color: '#ffe066',
                  fontFamily: '"JetBrains Mono", monospace, Courier, sans-serif',
                  fontSize: '13px',
                  fontWeight: '600',
                  wordBreak: 'break-all',
                }}
              >
                cipherwatch-agent setup --server-url http://localhost:8000 --org-id {currentOrg.id} --enrollment-key {currentKey}
              </div>

              <button
                onClick={handleCopyCommand}
                style={{
                  background: copiedCommandToast ? '#0ecb81' : 'linear-gradient(135deg, #ffe066 0%, #fcd535 50%, #f0b90b 100%)',
                  color: '#070a12',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '0 24px',
                  fontSize: '13px',
                  fontWeight: '800',
                  cursor: 'pointer',
                  boxShadow: '0 4px 14px rgba(252, 213, 53, 0.35)',
                  whiteSpace: 'nowrap',
                  transition: 'all 0.2s ease',
                }}
              >
                {copiedCommandToast ? '✓ Command Copied!' : 'Copy Command'}
              </button>
            </div>
          </div>
        </div>

        {/* Action Notice Banner */}
        {actionNotice && (
          <div
            style={{
              marginTop: '12px',
              padding: '12px 20px',
              backgroundColor: 'rgba(252, 213, 53, 0.12)',
              border: '1px solid rgba(252, 213, 53, 0.3)',
              borderRadius: '8px',
              color: '#fcd535',
              fontSize: '13px',
              fontWeight: '600',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Info size={14} /> {actionNotice}</span>
            <button onClick={() => setActionNotice(null)} style={{ background: 'none', border: 'none', color: '#ffffff', cursor: 'pointer' }}>✕</button>
          </div>
        )}
      </section>

      {/* ------------------------------------------------------------- */}
      {/* 4. MAIN BODY - THREE PANELS (SAME LAYOUT AS ADMIN DASHBOARD)  */}
      {/* ------------------------------------------------------------- */}
      <main style={{ flex: 1, padding: '8px 28px 40px 28px', display: 'grid', gridTemplateColumns: 'calc(55% - 12px) calc(45% - 12px)', gap: '24px', alignItems: 'stretch' }}>
        
        {/* ========================================================= */}
        {/* LEFT PANEL: USER LIST (Taller, Spans both right panels)  */}
        {/* ========================================================= */}
        <section
          style={{
            backgroundColor: 'var(--colors-surface-card-dark)',
            border: '1px solid var(--colors-hairline-on-dark)',
            borderRadius: '14px',
            padding: '24px',
            boxShadow: '0 10px 30px rgba(0, 0, 0, 0.35)',
            display: 'flex',
            flexDirection: 'column',
            gap: '20px',
          }}
        >
          {/* Header & Sort Control */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '800', color: '#f8fafc' }}>
                Organization Fleet Users
              </h2>
              <span
                style={{
                  fontSize: '11px',
                  backgroundColor: 'rgba(252, 213, 53, 0.12)',
                  color: '#fcd535',
                  border: '1px solid rgba(252, 213, 53, 0.3)',
                  padding: '2px 8px',
                  borderRadius: '10px',
                  fontWeight: '700',
                }}
              >
                {users.length} Enrolled
              </span>
            </div>

            {/* Controls Right */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              {/* Sort Selector */}
              <div style={{ position: 'relative' }}>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  style={{
                    backgroundColor: 'var(--colors-canvas-dark)',
                    border: '1px solid var(--colors-hairline-on-dark)',
                    color: '#f1f5f9',
                    borderRadius: '8px',
                    padding: '8px 30px 8px 12px',
                    fontSize: '12px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    outline: 'none',
                    appearance: 'none',
                  }}
                >
                  <option value="Most Threats">Sort: Risk Score</option>
                  <option value="Alphabetical">Sort: Name (A-Z)</option>
                  <option value="Date Added">Sort: Date Added</option>
                </select>
                <div style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', fontSize: '10px', color: '#94a3b8' }}>
                  ▼
                </div>
              </div>

              {/* Add New User Button */}
              <button
                onClick={() => setIsModalOpen(true)}
                style={{
                  background: 'linear-gradient(135deg, #ffe066 0%, #fcd535 50%, #f0b90b 100%)',
                  color: '#070a12',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '8px 16px',
                  fontSize: '13px',
                  fontWeight: '800',
                  cursor: 'pointer',
                  boxShadow: '0 4px 14px rgba(252, 213, 53, 0.3)',
                  transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                  outline: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-1px)'
                  e.currentTarget.style.boxShadow = '0 6px 20px rgba(252, 213, 53, 0.5)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)'
                  e.currentTarget.style.boxShadow = '0 4px 14px rgba(252, 213, 53, 0.3)'
                }}
              >
                <Plus size={14} /> Add User
              </button>
            </div>
          </div>

          {/* Scrollable User Row-Cards List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', flex: 1, overflowY: 'auto', maxHeight: '560px', paddingRight: '4px' }}>
            {sortedUsers.length === 0 ? (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '48px 24px',
                  textAlign: 'center',
                  backgroundColor: 'var(--colors-canvas-dark)',
                  border: '1px dashed var(--colors-hairline-on-dark)',
                  borderRadius: '10px',
                  margin: 'auto 0',
                }}
              >
                <div
                  style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: '50%',
                    backgroundColor: 'rgba(252, 213, 53, 0.1)',
                    border: '1px solid rgba(252, 213, 53, 0.2)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#fcd535',
                    marginBottom: '14px',
                  }}
                >
                  <User size={22} />
                </div>
                <h4 style={{ margin: '0 0 6px 0', fontSize: '15px', fontWeight: '700', color: '#f8fafc' }}>
                  No Enrolled Fleet Users
                </h4>
                <p style={{ margin: 0, fontSize: '12px', color: '#64748b', maxWidth: '320px', lineHeight: '1.5' }}>
                  Run the agent setup command below on an endpoint to enroll a device to this organization workspace.
                </p>
              </div>
            ) : (
              sortedUsers.map((user) => {
                const isHigh = user.riskScore >= 70
                const isDropdownOpen = openDropdownId === user.id

                return (
                  <div
                    key={user.id}
                    onClick={() => {
                      if (onSelectUser) onSelectUser(user)
                      else setSelectedUser(user)
                    }}
                    style={{
                      backgroundColor: 'var(--colors-canvas-dark)',
                      border: '1px solid var(--colors-hairline-on-dark)',
                      borderRadius: '10px',
                      padding: '16px 20px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      transition: 'all 0.25s ease',
                      position: 'relative',
                      cursor: 'pointer',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = 'rgba(252, 213, 53, 0.4)'
                      e.currentTarget.style.backgroundColor = 'var(--colors-surface-card-dark)'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = 'var(--colors-hairline-on-dark)'
                      e.currentTarget.style.backgroundColor = 'var(--colors-canvas-dark)'
                    }}
                  >
                    {/* Left: User Avatar & Info */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div
                        style={{
                          width: '38px',
                          height: '38px',
                          borderRadius: '50%',
                          backgroundColor: isHigh ? 'rgba(246, 70, 93, 0.12)' : 'rgba(252, 213, 53, 0.12)',
                          border: `1px solid ${isHigh ? 'rgba(246, 70, 93, 0.3)' : 'rgba(252, 213, 53, 0.3)'}`,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: isHigh ? '#f6465d' : '#fcd535',
                          fontWeight: '800',
                          fontSize: '14px',
                        }}
                      >
                        {user.name.charAt(0)}
                      </div>
                      <div>
                        <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '700', color: '#f1f5f9' }}>
                          {user.name}
                        </h3>
                        <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                          {user.email} • <span style={{ color: '#cbd5e1' }}>{user.os}</span>
                        </div>
                      </div>
                    </div>

                    {/* Right: Risk Badge & Actions */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                      {/* Risk Badge */}
                      <div style={{ textAlign: 'right' }}>
                        <div
                          style={{
                            fontSize: '12px',
                            fontWeight: '800',
                            color: isHigh ? '#f6465d' : '#0ecb81',
                          }}
                        >
                          {user.riskScore}%
                        </div>
                        <span style={{ fontSize: '10px', color: '#64748b' }}>
                          Risk Score
                        </span>
                      </div>

                      {/* Action Dropdown Trigger */}
                      <div style={{ position: 'relative' }}>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setOpenDropdownId(isDropdownOpen ? null : user.id)
                          }}
                          style={{
                            background: isDropdownOpen ? 'var(--colors-hairline-on-dark)' : 'transparent',
                            border: 'none',
                            color: '#94a3b8',
                            width: '32px',
                            height: '32px',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            transition: 'all 0.15s ease',
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.color = '#fcd535')}
                          onMouseLeave={(e) => (e.currentTarget.style.color = '#94a3b8')}
                        >
                          •••
                        </button>

                        {/* Dropdown Card */}
                        {isDropdownOpen && (
                          <div
                            style={{
                              position: 'absolute',
                              right: 0,
                              top: '36px',
                              backgroundColor: 'var(--colors-surface-card-dark)',
                              border: '1px solid var(--colors-hairline-on-dark)',
                              borderRadius: '8px',
                              padding: '6px',
                              width: '130px',
                              boxShadow: '0 10px 25px rgba(0, 0, 0, 0.6)',
                              zIndex: 50,
                            }}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              onClick={() => {
                                setOpenDropdownId(null)
                                if (onSelectUser) onSelectUser(user)
                                else setSelectedUser(user)
                              }}
                              style={{
                                width: '100%',
                                padding: '6px 10px',
                                backgroundColor: 'transparent',
                                border: 'none',
                                color: '#f8fafc',
                                fontSize: '12px',
                                borderRadius: '4px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '10px',
                                cursor: 'pointer',
                                transition: 'all 0.15s ease',
                                textAlign: 'left',
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.backgroundColor = 'rgba(252, 213, 53, 0.15)'
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.backgroundColor = 'transparent'
                              }}
                            >
                              <Edit3 size={14} /> View Details
                            </button>
                            <button
                              onClick={() => {
                                setOpenDropdownId(null)
                                setUsers(users.filter(u => u.id !== user.id))
                              }}
                              style={{
                                width: '100%',
                                padding: '6px 10px',
                                backgroundColor: 'transparent',
                                border: 'none',
                                color: '#f6465d',
                                fontSize: '12px',
                                borderRadius: '4px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '10px',
                                cursor: 'pointer',
                                transition: 'all 0.15s ease',
                                textAlign: 'left',
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.backgroundColor = 'rgba(246, 70, 93, 0.15)'
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.backgroundColor = 'transparent'
                              }}
                            >
                              <Trash2 size={14} /> Delete
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </section>

        {/* ========================================================= */}
        {/* RIGHT COLUMN: USER-LEVEL PIE CHART & BAR GRAPH            */}
        {/* ========================================================= */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* RIGHT COLUMN: SINGLE DYNAMIC TELEMETRY CHART PANEL WITH PIE/BAR FLIP TOGGLE */}
          <section
            style={{
              backgroundColor: 'var(--colors-surface-card-dark)',
              border: '1px solid var(--colors-hairline-on-dark)',
              borderRadius: '14px',
              padding: '24px',
              boxShadow: '0 10px 30px rgba(0, 0, 0, 0.3)',
            }}
          >
            {/* Header with Title, Subtitle, and Segmented Toggle Pill */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', gap: '12px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '800', color: '#f8fafc' }}>
                  {rightChartView === 'pie' ? 'User Risk Level Distribution' : 'User Event Density Trends'}
                </h3>
                <span style={{ fontSize: '11px', color: '#64748b' }}>
                  {rightChartView === 'pie'
                    ? 'Risk classification across enrolled user endpoints'
                    : 'Hourly telemetry events generated across endpoints'}
                </span>
              </div>

              {/* Segmented View Toggle Switch */}
              <div
                style={{
                  display: 'flex',
                  backgroundColor: 'var(--colors-canvas-dark)',
                  border: '1px solid var(--colors-hairline-on-dark)',
                  borderRadius: '8px',
                  padding: '3px',
                  gap: '2px',
                }}
              >
                <button
                  type="button"
                  onClick={() => setRightChartView('pie')}
                  title="Switch to Pie Chart view"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '6px 12px',
                    fontSize: '11px',
                    fontWeight: '700',
                    borderRadius: '6px',
                    border: 'none',
                    backgroundColor: rightChartView === 'pie' ? 'var(--colors-primary)' : 'transparent',
                    color: rightChartView === 'pie' ? 'var(--colors-canvas-dark)' : 'var(--colors-muted-strong)',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <PieChartIcon size={14} />
                  <span>Pie</span>
                </button>

                <button
                  type="button"
                  onClick={() => setRightChartView('bar')}
                  title="Switch to Bar Chart view"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '6px 12px',
                    fontSize: '11px',
                    fontWeight: '700',
                    borderRadius: '6px',
                    border: 'none',
                    backgroundColor: rightChartView === 'bar' ? 'var(--colors-primary)' : 'transparent',
                    color: rightChartView === 'bar' ? 'var(--colors-canvas-dark)' : 'var(--colors-muted-strong)',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <BarChartIcon size={14} />
                  <span>Bar</span>
                </button>
              </div>
            </div>

            {/* Dynamic Chart View Canvas */}
            <div style={{ minHeight: '260px', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {(() => {
                if (users.length === 0) {
                  return (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: '100%', padding: '24px', textAlign: 'center' }}>
                      <Activity size={32} color="#64748b" style={{ marginBottom: '12px' }} />
                      <h5 style={{ margin: '0 0 4px 0', fontSize: '14px', fontWeight: '700', color: '#94a3b8' }}>
                        No Telemetry Available
                      </h5>
                      <span style={{ fontSize: '11px', color: '#64748b' }}>
                        Enroll endpoints to populate real-time risk distribution and event trends.
                      </span>
                    </div>
                  )
                }

                if (rightChartView === 'pie') {
                  const highRisk = users.filter(u => u.riskScore >= 70).length
                  const modRisk = users.filter(u => u.riskScore >= 40 && u.riskScore < 70).length
                  const compliant = Math.max(0, users.length - (highRisk + modRisk))

                  const pieData = [
                    { name: 'High Risk', value: highRisk, color: '#f6465d' },
                    { name: 'Moderate Risk', value: modRisk, color: '#fcd535' },
                    { name: 'Compliant', value: compliant, color: '#0ecb81' },
                  ]

                  return (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-around', gap: '20px', width: '100%', padding: '10px 0' }}>
                      <div style={{ width: 220, height: 220 }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Tooltip
                              contentStyle={{ backgroundColor: '#070a12', borderColor: '#334155', borderRadius: '8px', color: '#f8fafc', fontSize: '12px' }}
                            />
                            <Pie
                              data={pieData}
                              cx="50%"
                              cy="50%"
                              innerRadius={48}
                              outerRadius={95}
                              paddingAngle={5}
                              dataKey="value"
                            >
                              {['#f6465d', '#fcd535', '#0ecb81'].map((color, index) => (
                                <Cell key={`cell-${index}`} fill={color} stroke="#070a12" strokeWidth={2} />
                              ))}
                            </Pie>
                          </PieChart>
                        </ResponsiveContainer>
                      </div>

                      {/* Pie Chart Legend */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#f6465d', boxShadow: '0 0 8px #f6465d' }} />
                          <span style={{ fontSize: '13px', color: '#cbd5e1', fontWeight: '700' }}>
                            High Risk ({highRisk})
                          </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#fcd535', boxShadow: '0 0 8px #fcd535' }} />
                          <span style={{ fontSize: '13px', color: '#cbd5e1', fontWeight: '700' }}>
                            Moderate Risk ({modRisk})
                          </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#0ecb81', boxShadow: '0 0 8px #0ecb81' }} />
                          <span style={{ fontSize: '13px', color: '#cbd5e1', fontWeight: '700' }}>
                            Compliant ({compliant})
                          </span>
                        </div>
                      </div>
                    </div>
                  )
                }

                // rightChartView === 'bar'
                const totalUserEvents = users.reduce((sum, u) => sum + (u.eventsCount || 0), 0)
                const userBarData = [
                  { time: '00:00', events: Math.round(totalUserEvents * 0.10) },
                  { time: '04:00', events: Math.round(totalUserEvents * 0.20) },
                  { time: '08:00', events: Math.round(totalUserEvents * 0.70) },
                  { time: '12:00', events: Math.round(totalUserEvents * 0.95) },
                  { time: '16:00', events: Math.round(totalUserEvents * 0.60) },
                  { time: '20:00', events: Math.round(totalUserEvents * 0.35) },
                ]

                return (
                  <div style={{ height: '240px', width: '100%' }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={userBarData}
                        margin={{ top: 10, right: 10, left: -25, bottom: 0 }}
                      >
                        <XAxis dataKey="time" stroke="#64748b" fontSize={11} tickLine={false} />
                        <YAxis stroke="#64748b" fontSize={11} tickLine={false} />
                        <Tooltip
                          contentStyle={{ backgroundColor: '#070a12', borderColor: '#334155', borderRadius: '8px', color: '#fcd535', fontSize: '12px' }}
                        />
                        <Bar dataKey="events" fill="#fcd535" radius={[4, 4, 0, 0]}>
                          {userBarData.map((d, idx) => (
                            <Cell key={`bar-${idx}`} fill={d.events >= 70 ? '#f6465d' : d.events >= 40 ? '#fcd535' : '#0ecb81'} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )
              })()}
            </div>
          </section>
        </div>
      </main>

      {/* ------------------------------------------------------------- */}
      {/* ADD NEW USER MODAL (BLURRED BACKDROP & GOLD GLOW EDGE)        */}
      {/* ------------------------------------------------------------- */}
      {isModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(8px)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
            animation: 'fadeIn 0.2s ease-out',
          }}
          onClick={() => setIsModalOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: '480px',
              background: 'linear-gradient(135deg, #1e2329 0%, #15191e 100%)',
              border: '1px solid #fcd535',
              borderRadius: '16px',
              padding: '32px',
              boxShadow: '0 0 35px rgba(252, 213, 53, 0.25), 0 20px 50px rgba(0, 0, 0, 0.8)',
              position: 'relative',
              animation: 'scaleUp 0.22s cubic-bezier(0.16, 1, 0.3, 1)',
            }}
          >
            {/* Top Right "X" Close Button */}
            <button
              onClick={() => setIsModalOpen(false)}
              style={{
                position: 'absolute',
                top: '20px',
                right: '20px',
                background: 'rgba(255, 255, 255, 0.08)',
                border: 'none',
                color: '#94a3b8',
                borderRadius: '50%',
                width: '32px',
                height: '32px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '16px',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = '#ffffff'
                e.currentTarget.style.backgroundColor = 'rgba(246, 70, 93, 0.3)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = '#94a3b8'
                e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.08)'
              }}
            >
              <X size={14} />
            </button>

            {/* Modal Title */}
            <div style={{ marginBottom: '24px' }}>
              <div style={{ fontSize: '11px', fontWeight: '800', color: '#fcd535', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '4px' }}>
                User Endpoint Provisioning
              </div>
              <h2 style={{ margin: 0, fontSize: '22px', fontWeight: '800', color: '#ffffff' }}>
                Add Enrolled User
              </h2>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleAddUser} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#cbd5e1', marginBottom: '6px' }}>
                  Full Name *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Alexander Wright"
                  value={newUserName}
                  onChange={(e) => setNewUserName(e.target.value)}
                  required
                  style={{
                    width: '100%',
                    backgroundColor: '#070a12',
                    border: '1px solid var(--colors-hairline-on-dark)',
                    borderRadius: '8px',
                    padding: '12px 16px',
                    color: '#ffffff',
                    fontSize: '14px',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                  onFocus={(e) => (e.target.style.borderColor = '#fcd535')}
                  onBlur={(e) => (e.target.style.borderColor = 'var(--colors-hairline-on-dark)')}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#cbd5e1', marginBottom: '6px' }}>
                  Work Email Address
                </label>
                <input
                  type="email"
                  placeholder="e.g. a.wright@hackit.io"
                  value={newUserEmail}
                  onChange={(e) => setNewUserEmail(e.target.value)}
                  style={{
                    width: '100%',
                    backgroundColor: '#070a12',
                    border: '1px solid var(--colors-hairline-on-dark)',
                    borderRadius: '8px',
                    padding: '12px 16px',
                    color: '#ffffff',
                    fontSize: '14px',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                  onFocus={(e) => (e.target.style.borderColor = '#fcd535')}
                  onBlur={(e) => (e.target.style.borderColor = 'var(--colors-hairline-on-dark)')}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#cbd5e1', marginBottom: '6px' }}>
                  Endpoint Operating System
                </label>
                <select
                  value={newUserOS}
                  onChange={(e) => setNewUserOS(e.target.value)}
                  style={{
                    width: '100%',
                    backgroundColor: '#070a12',
                    border: '1px solid var(--colors-hairline-on-dark)',
                    borderRadius: '8px',
                    padding: '12px 16px',
                    color: '#ffffff',
                    fontSize: '14px',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                >
                  <option value="Windows 11">Windows 11</option>
                  <option value="macOS Sonoma">macOS Sonoma</option>
                  <option value="Ubuntu Linux">Ubuntu Linux</option>
                </select>
              </div>

              {/* Primary Gold Add Button */}
              <button
                type="submit"
                style={{
                  marginTop: '10px',
                  width: '100%',
                  background: 'linear-gradient(135deg, #ffe066 0%, #fcd535 50%, #f0b90b 100%)',
                  color: '#070a12',
                  border: 'none',
                  borderRadius: '10px',
                  padding: '14px',
                  fontSize: '15px',
                  fontWeight: '800',
                  letterSpacing: '0.5px',
                  cursor: 'pointer',
                  boxShadow: '0 4px 20px rgba(252, 213, 53, 0.4)',
                  transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                  outline: 'none',
                }}
              >
                Enroll User Endpoint
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Organization Switch Modal */}
      <OrganizationSwitchModal
        isOpen={isSwitchModalOpen}
        onClose={() => setIsSwitchModalOpen(false)}
        organizations={organizations}
        currentOrgId={currentOrg.id}
        onSelectOrg={(targetOrg) => {
          if (onSelectOrg) onSelectOrg(targetOrg)
        }}
      />

      {/* ------------------------------------------------------------- */}
      {/* KEYFRAME ANIMATIONS                                           */}
      {/* ------------------------------------------------------------- */}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes fadeInDown {
          from { opacity: 0; transform: translateY(-6px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes scaleUp {
          from { opacity: 0; transform: scale(0.92); }
          to { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  )
}
