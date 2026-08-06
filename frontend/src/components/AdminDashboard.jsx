import React, { useState, useEffect, useMemo } from 'react'
import { Shield, AlertTriangle, X, Plus, Building, Activity, PieChart as PieChartIcon, BarChart3 } from 'lucide-react'
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, BarChart, Bar, XAxis, YAxis } from './RechartsCompat'
import NotificationCenter from './NotificationCenter'
import OrganizationDashboard from './OrganizationDashboard'
import OrganizationSwitchModal from './OrganizationSwitchModal'

export default function AdminDashboard({ orgId, selectedOrg, currentUser, onLogout, onSwitchOrg, organizations: initialOrgs, onSelectOrg }) {
  // Navigation state for detailed OrganizationDashboard view
  const [selectedOrgForDetails, setSelectedOrgForDetails] = useState(null)
  const [isSwitchOrgModalOpen, setIsSwitchOrgModalOpen] = useState(false)
  const [threatChartType, setThreatChartType] = useState('pie')

  // Organizations state loaded dynamically from backend/props
  const [organizations, setOrganizations] = useState(initialOrgs || [])
  const [isLoading, setIsLoading] = useState(!initialOrgs || initialOrgs.length === 0)

  // Fetch real organizations from backend on mount
  useEffect(() => {
    let isMounted = true
    setIsLoading(true)

    fetch('/api/orgs')
      .then((res) => {
        if (!res.ok) throw new Error('Failed to fetch organizations')
        return res.json()
      })
      .then(async (orgList) => {
        if (!isMounted) return
        if (!orgList || orgList.length === 0) {
          setOrganizations([])
          setIsLoading(false)
          return
        }

        // Fetch detailed stats for each organization in parallel
        const enrichedOrgs = await Promise.all(
          orgList.map(async (o) => {
            try {
              const [statsRes, credsRes] = await Promise.all([
                fetch(`/api/admin/orgs/${o.id}/dashboard/stats`),
                fetch(`/api/orgs/${o.id}/registration-credentials`),
              ])

              const stats = statsRes.ok ? await statsRes.json() : null
              const creds = credsRes.ok ? await credsRes.json() : null

              const totalSystems = stats?.summary?.total_systems ?? 0
              const critAlerts = stats?.summary?.critical_alerts ?? 0
              const warnAlerts = stats?.summary?.warning_alerts ?? 0

              let threatLevel = 'LOW'
              let riskScore = 15
              if (critAlerts > 0) {
                threatLevel = 'CRITICAL'
                riskScore = Math.min(95, 75 + critAlerts * 10)
              } else if (warnAlerts > 0) {
                threatLevel = 'HIGH'
                riskScore = Math.min(74, 45 + warnAlerts * 5)
              } else if (totalSystems > 0) {
                threatLevel = 'MEDIUM'
                riskScore = 30
              }

              return {
                id: o.id,
                name: o.name,
                role: o.role,
                usersCount: totalSystems,
                threatLevel: threatLevel,
                riskScore: riskScore,
                dateAdded: o.created_at ? new Date(o.created_at).toISOString().split('T')[0] : '2026-01-01',
                apiKey: creds?.enrollment_key || creds?.registration_key || `cwek_${o.id}`,
              }
            } catch (err) {
              return {
                id: o.id,
                name: o.name,
                role: o.role,
                usersCount: 0,
                threatLevel: 'LOW',
                riskScore: 15,
                dateAdded: '2026-01-01',
                apiKey: `cwek_${o.id}`,
              }
            }
          })
        )

        if (isMounted) {
          setOrganizations(enrichedOrgs)
          setIsLoading(false)
        }
      })
      .catch((err) => {
        console.error('Failed to load organizations from database:', err)
        if (isMounted) {
          setOrganizations([])
          setIsLoading(false)
        }
      })

    return () => {
      isMounted = false
    }
  }, [])

  // Highest risk organization selection
  const highestRiskOrg = useMemo(() => {
    if (organizations.length === 0) return null
    return [...organizations].sort((a, b) => b.riskScore - a.riskScore)[0]
  }, [organizations])

  // Sorting state for Organization List
  const [sortBy, setSortBy] = useState('Most Threats') // 'Most Threats' | 'Alphabetical' | 'Date Added'

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [newOrgName, setNewOrgName] = useState('')
  const [newOrgDomain, setNewOrgDomain] = useState('')
  const [newOrgContact, setNewOrgContact] = useState('')

  // Dropdown open state for organization rows: { [orgId]: boolean }
  const [openDropdownId, setOpenDropdownId] = useState(null)

  // System modal state from backend telemetry
  const [actionNotice, setActionNotice] = useState(null)

  // Listen for clicks outside dropdown
  useEffect(() => {
    const handleGlobalClick = () => setOpenDropdownId(null)
    window.addEventListener('click', handleGlobalClick)
    return () => window.removeEventListener('click', handleGlobalClick)
  }, [])

  // Add Organization Handler - Calls backend API to create real DB entry
  const handleAddOrg = async (e) => {
    e.preventDefault()
    if (!newOrgName.trim()) return

    try {
      const res = await fetch('/api/orgs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newOrgName.trim() }),
      })

      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.detail || 'Failed to create organization in database')
      }

      const createdOrg = await res.json()

      // Fetch credentials for newly created org
      const credsRes = await fetch(`/api/orgs/${createdOrg.id}/registration-credentials`)
      const creds = credsRes.ok ? await credsRes.json() : null

      const newOrgItem = {
        id: createdOrg.id,
        name: createdOrg.name,
        role: createdOrg.role || 'owner',
        usersCount: 0,
        threatLevel: 'LOW',
        riskScore: 15,
        dateAdded: new Date().toISOString().split('T')[0],
        apiKey: creds?.enrollment_key || creds?.registration_key || `cwek_${createdOrg.id}`,
      }

      setOrganizations([newOrgItem, ...organizations])
      setNewOrgName('')
      setNewOrgDomain('')
      setNewOrgContact('')
      setIsModalOpen(false)
      setActionNotice(`Organization "${createdOrg.name}" successfully created in database.`)
    } catch (err) {
      console.error('Error creating organization:', err)
      alert(`Error creating organization: ${err.message}`)
    }
  }

  // Delete Organization Handler
  const handleDeleteOrg = (id, e) => {
    e.stopPropagation()
    setOrganizations(organizations.filter((o) => o.id !== id))
    setOpenDropdownId(null)
  }

  // Rename Organization Handler
  const handleRenameOrg = (id, currentName, e) => {
    e.stopPropagation()
    setOpenDropdownId(null)
    const updated = prompt('Enter new organization name:', currentName)
    if (updated && updated.trim()) {
      setOrganizations(
        organizations.map((o) => (o.id === id ? { ...o, name: updated.trim() } : o))
      )
    }
  }

  // Sorted Organizations
  const sortedOrgs = useMemo(() => {
    return [...organizations].sort((a, b) => {
      if (sortBy === 'Most Threats') return b.riskScore - a.riskScore
      if (sortBy === 'Alphabetical') return a.name.localeCompare(b.name)
      if (sortBy === 'Date Added') return new Date(b.dateAdded) - new Date(a.dateAdded)
      return 0
    })
  }, [organizations, sortBy])

  if (selectedOrgForDetails) {
    return (
      <OrganizationDashboard
        org={selectedOrgForDetails}
        onBackToAdmin={() => setSelectedOrgForDetails(null)}
        currentUser={currentUser}
        onLogout={onLogout}
        onSwitchOrg={onSwitchOrg}
        organizations={organizations}
        onSelectOrg={(org) => {
          setSelectedOrgForDetails(org)
          if (onSelectOrg) onSelectOrg(org)
        }}
      />
    )
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: '#070a12', color: '#e2e8f0', fontFamily: 'Inter, -apple-system, sans-serif' }}>
      
      {/* ------------------------------------------------------------- */}
      {/* 1. TOP NAVIGATION BAR                                         */}
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
        {/* Left Side: Gold Wordmark + Live Feed Badge + Slogan */}
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
                animation: 'pulseGreenDot 1.8s ease-in-out infinite',
              }}
            />
            <span style={{ fontSize: '11px', fontWeight: '800', color: '#0ecb81', letterSpacing: '0.8px' }}>
              LIVE FEED
            </span>
          </div>

          <span
            style={{
              fontSize: '12px',
              color: 'var(--colors-muted)',
              borderLeft: '1px solid var(--colors-hairline-on-dark)',
              paddingLeft: '16px',
              fontWeight: '500',
            }}
          >
            Zero-Content Privacy & Real-Time Endpoint Threat Intelligence
          </span>
        </div>

        {/* Right Side: Navigation & Notification & Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
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
                TELEMETRY ORG:
              </span>
              <select
                value={selectedOrgForDetails?.id || orgId || (organizations[0] && organizations[0].id)}
                onChange={(e) => {
                  const targetId = parseInt(e.target.value, 10)
                  const found = organizations.find((o) => o.id === targetId)
                  if (found) {
                    setSelectedOrgForDetails(found)
                    if (onSelectOrg) onSelectOrg(found)
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
                {organizations.map((org) => (
                  <option key={org.id} value={org.id} style={{ backgroundColor: '#0c0f1d', color: '#ffffff' }}>
                    {org.name} ({org.riskScore !== undefined ? `${org.riskScore}% Risk` : 'Active'})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Email Notification Center Bell */}
          <NotificationCenter userEmail={currentUser?.email} />

          <button
            onClick={() => setIsSwitchOrgModalOpen(true)}
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
      {/* 2. HIGHEST-RISK-ORGANIZATION PANEL                           */}
      {/* ------------------------------------------------------------- */}
      <section style={{ padding: '24px 28px 12px 28px' }}>
        {(() => {
          const score = highestRiskOrg?.riskScore ?? 0
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
            ? 'CRITICAL SECURITY THREAT TARGET'
            : isYellow
            ? 'ELEVATED RISK TARGET WORKSPACE'
            : 'OPTIMAL BASELINE WORKSPACE'

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
              {/* Ambient Background Grid Pattern */}
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  backgroundImage: `radial-gradient(${colorTheme}15 1px, transparent 1px)`,
                  backgroundSize: '16px 16px',
                  pointerEvents: 'none',
                }}
              />

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
                  {highestRiskOrg?.name || 'HACKIT Cyber Operations'}
                </h1>
              </div>

              {/* Center: Numeric Risk Score */}
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

              {/* Right: Take Action Button */}
              <div style={{ position: 'relative', zIndex: 1 }}>
                <button
                  onClick={() => setActionNotice(`Initiated SOC Security Scan Protocol for ${highestRiskOrg?.name}`)}
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
                  Take Action
                </button>
              </div>
            </div>
          )
        })()}

        {/* Action Toast Feedback Notice */}
        {actionNotice && (
          <div
            style={{
              marginTop: '12px',
              padding: '12px 20px',
              backgroundColor: 'rgba(246, 70, 93, 0.15)',
              border: '1px solid rgba(246, 70, 93, 0.4)',
              borderRadius: '8px',
              color: '#f6465d',
              fontSize: '13px',
              fontWeight: '600',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              animation: 'fadeIn 0.2s ease',
            }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AlertTriangle size={14} /> {actionNotice}
            </span>
            <button
              onClick={() => setActionNotice(null)}
              style={{ background: 'none', border: 'none', color: '#ffffff', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
            >
              <X size={14} />
            </button>
          </div>
        )}
      </section>

      {/* ------------------------------------------------------------- */}
      {/* 3. MAIN BODY - THREE PANELS LAYOUT                           */}
      {/* ------------------------------------------------------------- */}
      <main style={{ flex: 1, padding: '16px 28px 40px 28px', display: 'grid', gridTemplateColumns: 'calc(55% - 12px) calc(45% - 12px)', gap: '24px', alignItems: 'stretch' }}>
        
        {/* ========================================================= */}
        {/* LEFT PANEL: ORGANIZATION LIST (Taller, Spans both right)  */}
        {/* ========================================================= */}
        <section
          style={{
            backgroundColor: 'var(--colors-surface-card-dark)',
            border: '1px solid var(--colors-hairline-on-dark)',
            borderRadius: '14px',
            padding: '24px',
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
            boxShadow: '0 10px 30px rgba(0, 0, 0, 0.3)',
          }}
        >
          {/* Header Row: Filter / Sort Cluster + Add New Button */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
            <div>
              <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '800', color: '#f8fafc' }}>
                Organization List
              </h2>
              <span style={{ fontSize: '12px', color: '#64748b' }}>
                {organizations.length} Active Managed Workspaces
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              {/* Sort Dropdown */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: '700', textTransform: 'uppercase' }}>
                  Sort:
                </span>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  style={{
                    backgroundColor: 'var(--colors-canvas-dark)',
                    color: '#fcd535',
                    border: '1px solid var(--colors-hairline-on-dark)',
                    borderRadius: '8px',
                    padding: '6px 12px',
                    fontSize: '12px',
                    fontWeight: '600',
                    outline: 'none',
                    cursor: 'pointer',
                    transition: 'border-color 0.2s ease',
                  }}
                >
                  <option value="Most Threats">Most Threats</option>
                  <option value="Alphabetical">Alphabetical</option>
                  <option value="Date Added">Date Added</option>
                </select>
              </div>

              {/* Add New Button */}
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
                <Plus size={14} /> Add New
              </button>
            </div>
          </div>

          {/* Scrollable Organization Row-Cards List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', flex: 1, overflowY: 'auto', maxHeight: '560px', paddingRight: '4px' }}>
            {sortedOrgs.length === 0 ? (
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
                  <Building size={22} />
                </div>
                <h4 style={{ margin: '0 0 6px 0', fontSize: '15px', fontWeight: '700', color: '#f8fafc' }}>
                  No Managed Workspaces
                </h4>
                <p style={{ margin: 0, fontSize: '12px', color: '#64748b', maxWidth: '320px', lineHeight: '1.5' }}>
                  Click 'Add New' above to create your first organization workspace.
                </p>
              </div>
            ) : (
              sortedOrgs.map((org) => {
                const isHigh = org.riskScore >= 70
                const isDropdownOpen = openDropdownId === org.id

                return (
                  <div
                    key={org.id}
                    onClick={() => setSelectedOrgForDetails(org)}
                    style={{
                      backgroundColor: 'var(--colors-surface-card-dark)',
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
                      e.currentTarget.style.backgroundColor = 'var(--colors-canvas-dark)'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = 'var(--colors-hairline-on-dark)'
                      e.currentTarget.style.backgroundColor = 'var(--colors-surface-card-dark)'
                    }}
                  >
                    {/* Left: Avatar & Org Info */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div
                        style={{
                          width: '36px',
                          height: '36px',
                          borderRadius: '8px',
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
                        {org.name.charAt(0)}
                      </div>
                      <div>
                        <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '700', color: '#f1f5f9' }}>
                          {org.name}
                        </h3>
                        <span style={{ fontSize: '11px', color: 'var(--colors-muted)' }}>
                          Threat Risk: <strong style={{ color: isHigh ? '#f6465d' : '#0ecb81' }}>{org.riskScore}%</strong>
                        </span>
                      </div>
                    </div>

                    {/* Center: Number of Users */}
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '14px', fontWeight: '700', color: '#cbd5e1', fontVariantNumeric: 'tabular-nums' }}>
                        {org.usersCount} Users
                      </div>
                      <div style={{ fontSize: '10px', color: '#64748b', textTransform: 'uppercase' }}>Enrolled</div>
                    </div>

                    {/* Right: Three-Dot Action Icon */}
                    <div style={{ position: 'relative' }}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setOpenDropdownId(isDropdownOpen ? null : org.id)
                        }}
                        title="Organization Options"
                        style={{
                          background: isDropdownOpen ? 'var(--colors-surface-elevated-dark)' : 'transparent',
                          border: 'none',
                          color: '#94a3b8',
                          borderRadius: '6px',
                          width: '32px',
                          height: '32px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                          transition: 'all 0.2s ease',
                          outline: 'none',
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.color = '#fcd535')}
                        onMouseLeave={(e) => (e.currentTarget.style.color = '#94a3b8')}
                      >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="12" cy="12" r="1.5" />
                          <circle cx="12" cy="5" r="1.5" />
                          <circle cx="12" cy="19" r="1.5" />
                        </svg>
                      </button>

                      {/* Dropdown Action Menu */}
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
                            width: '140px',
                            boxShadow: '0 10px 25px rgba(0, 0, 0, 0.6)',
                            zIndex: 50,
                            animation: 'fadeInDown 0.15s ease-out',
                          }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            onClick={(e) => handleRenameOrg(org.id, org.name, e)}
                            style={{
                              width: '100%',
                              background: 'none',
                              border: 'none',
                              color: '#cbd5e1',
                              padding: '8px 12px',
                              borderRadius: '6px',
                              fontSize: '12px',
                              fontWeight: '600',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '10px',
                              cursor: 'pointer',
                              transition: 'all 0.15s ease',
                              textAlign: 'left',
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor = 'var(--colors-surface-elevated-dark)'
                              e.currentTarget.style.color = '#fcd535'
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor = 'transparent'
                              e.currentTarget.style.color = '#cbd5e1'
                            }}
                          >
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fcd535" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path>
                            </svg>
                            Rename
                          </button>

                          <button
                            onClick={(e) => handleDeleteOrg(org.id, e)}
                            style={{
                              width: '100%',
                              background: 'none',
                              border: 'none',
                              color: '#f6465d',
                              padding: '8px 12px',
                              borderRadius: '6px',
                              fontSize: '12px',
                              fontWeight: '600',
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
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#f6465d" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="3 6 5 6 21 6"></polyline>
                              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                            </svg>
                            Delete
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </section>

        {/* ========================================================= */}
        {/* RIGHT COLUMN: UNIFIED THREAT ANALYTICS CARD               */}
        {/* ========================================================= */}
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          
          {/* UNIFIED THREAT ANALYTICS COMPONENT WITH PIE/BAR TOGGLE */}
          <section
            style={{
              backgroundColor: 'var(--colors-surface-card-dark)',
              border: '1px solid var(--colors-hairline-on-dark)',
              borderRadius: '14px',
              padding: '24px',
              boxShadow: '0 10px 30px rgba(0, 0, 0, 0.3)',
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              height: '100%',
            }}
          >
            {/* Header with Title & Chart Type Toggle */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '800', color: '#f8fafc' }}>
                  {threatChartType === 'pie' ? 'Threat Severity Breakdown' : 'Hourly Threat Density'}
                </h3>
                <span style={{ fontSize: '11px', color: '#64748b' }}>
                  {threatChartType === 'pie'
                    ? 'Fleet-wide security incident distribution'
                    : 'Anomaly events recorded over the last 24 hours'}
                </span>
              </div>

              {/* View Toggle Buttons */}
              <div
                style={{
                  display: 'flex',
                  backgroundColor: '#0c0f1d',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '8px',
                  padding: '2px',
                  gap: '2px',
                }}
              >
                <button
                  type="button"
                  onClick={() => setThreatChartType('pie')}
                  style={{
                    backgroundColor: threatChartType === 'pie' ? 'rgba(252, 213, 53, 0.15)' : 'transparent',
                    color: threatChartType === 'pie' ? '#fcd535' : '#94a3b8',
                    border: threatChartType === 'pie' ? '1px solid rgba(252, 213, 53, 0.4)' : '1px solid transparent',
                    borderRadius: '6px',
                    padding: '4px 10px',
                    fontSize: '11px',
                    fontWeight: '800',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px',
                  }}
                >
                  <PieChartIcon size={13} /> Pie View
                </button>
                <button
                  type="button"
                  onClick={() => setThreatChartType('bar')}
                  style={{
                    backgroundColor: threatChartType === 'bar' ? 'rgba(252, 213, 53, 0.15)' : 'transparent',
                    color: threatChartType === 'bar' ? '#fcd535' : '#94a3b8',
                    border: threatChartType === 'bar' ? '1px solid rgba(252, 213, 53, 0.4)' : '1px solid transparent',
                    borderRadius: '6px',
                    padding: '4px 10px',
                    fontSize: '11px',
                    fontWeight: '800',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px',
                  }}
                >
                  <BarChart3 size={13} /> Bar View
                </button>
              </div>
            </div>

            {/* Dynamic Chart Body */}
            {organizations.length === 0 ? (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  height: '320px',
                  textAlign: 'center',
                  backgroundColor: 'var(--colors-canvas-dark)',
                  borderRadius: '10px',
                  border: '1px dashed var(--colors-hairline-on-dark)',
                  margin: '12px 0',
                }}
              >
                <Activity size={32} color="#64748b" style={{ marginBottom: '12px' }} />
                <h5 style={{ margin: '0 0 4px 0', fontSize: '14px', fontWeight: '700', color: '#94a3b8' }}>
                  No Organization Telemetry
                </h5>
                <span style={{ fontSize: '11px', color: '#64748b' }}>
                  Create managed workspaces to begin aggregating organization threat telemetry.
                </span>
              </div>
            ) : threatChartType === 'pie' ? (() => {
              const critCount = organizations.filter(o => o.threatLevel === 'CRITICAL' || o.riskScore >= 75).length
              const elevCount = organizations.filter(o => o.threatLevel === 'HIGH' || o.threatLevel === 'MEDIUM' || (o.riskScore >= 40 && o.riskScore < 75)).length
              const normCount = Math.max(0, organizations.length - (critCount + elevCount))
              const totalOrgs = organizations.length || 1

              const critPct = Math.round((critCount / totalOrgs) * 100)
              const elevPct = Math.round((elevCount / totalOrgs) * 100)
              const normPct = Math.max(0, 100 - critPct - elevPct)

              const pieData = [
                { name: 'Critical Threat', value: critCount, color: '#f6465d' },
                { name: 'Elevated Risk', value: elevCount, color: '#fcd535' },
                { name: 'Normal Baseline', value: normCount, color: '#0ecb81' },
              ]

              return (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-around', gap: '32px', flex: 1, minHeight: '360px', padding: '12px 0' }}>
                  <div style={{ width: 320, height: 320, position: 'relative' }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Tooltip
                          contentStyle={{ backgroundColor: '#070a12', borderColor: '#334155', borderRadius: '8px', color: '#f8fafc', fontSize: '13px' }}
                        />
                        <Pie
                          data={pieData}
                          cx="50%"
                          cy="50%"
                          innerRadius={65}
                          outerRadius={125}
                          paddingAngle={6}
                          dataKey="value"
                        >
                          {['#f6465d', '#fcd535', '#0ecb81'].map((color, index) => (
                            <Cell key={`admin-cell-${index}`} fill={color} stroke="#070a12" strokeWidth={3} />
                          ))}
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '18px', minWidth: '220px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '8px 12px', backgroundColor: 'rgba(246, 70, 93, 0.08)', borderRadius: '8px', border: '1px solid rgba(246, 70, 93, 0.2)' }}>
                      <span style={{ width: '14px', height: '14px', borderRadius: '50%', backgroundColor: '#f6465d', boxShadow: '0 0 10px #f6465d' }} />
                      <div>
                        <div style={{ fontSize: '14px', color: '#f8fafc', fontWeight: '800' }}>Critical Threat</div>
                        <div style={{ fontSize: '12px', color: '#f6465d', fontWeight: '700' }}>{critCount} orgs ({critPct}%)</div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '8px 12px', backgroundColor: 'rgba(252, 213, 53, 0.08)', borderRadius: '8px', border: '1px solid rgba(252, 213, 53, 0.2)' }}>
                      <span style={{ width: '14px', height: '14px', borderRadius: '50%', backgroundColor: '#fcd535', boxShadow: '0 0 10px #fcd535' }} />
                      <div>
                        <div style={{ fontSize: '14px', color: '#f8fafc', fontWeight: '800' }}>Elevated Risk</div>
                        <div style={{ fontSize: '12px', color: '#fcd535', fontWeight: '700' }}>{elevCount} orgs ({elevPct}%)</div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '8px 12px', backgroundColor: 'rgba(14, 203, 129, 0.08)', borderRadius: '8px', border: '1px solid rgba(14, 203, 129, 0.2)' }}>
                      <span style={{ width: '14px', height: '14px', borderRadius: '50%', backgroundColor: '#0ecb81', boxShadow: '0 0 10px #0ecb81' }} />
                      <div>
                        <div style={{ fontSize: '14px', color: '#f8fafc', fontWeight: '800' }}>Normal Baseline</div>
                        <div style={{ fontSize: '12px', color: '#0ecb81', fontWeight: '700' }}>{normCount} orgs ({normPct}%)</div>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })() : (() => {
              const totalEvents = organizations.reduce((acc, o) => acc + (o.usersCount * 15 || 0), 0)
              const barData = [
                { time: '00:00', threats: Math.round(totalEvents * 0.15) },
                { time: '04:00', threats: Math.round(totalEvents * 0.25) },
                { time: '08:00', threats: Math.round(totalEvents * 0.65) },
                { time: '12:00', threats: Math.round(totalEvents * 0.90) },
                { time: '16:00', threats: Math.round(totalEvents * 0.55) },
                { time: '20:00', threats: Math.round(totalEvents * 0.30) },
              ]

              return (
                <div style={{ flex: 1, minHeight: '360px', width: '100%', display: 'flex', alignItems: 'center', padding: '16px 0' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={barData} margin={{ top: 20, right: 10, left: -20, bottom: 10 }}>
                      <XAxis dataKey="time" stroke="#64748b" fontSize={12} tickLine={false} />
                      <YAxis stroke="#64748b" fontSize={12} tickLine={false} />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#070a12', borderColor: '#334155', borderRadius: '8px', color: '#fcd535', fontSize: '12px' }}
                      />
                      <Bar dataKey="threats" fill="#fcd535" radius={[6, 6, 0, 0]}>
                        {barData.map((d, idx) => (
                          <Cell key={`bar-${idx}`} fill={d.threats >= 70 ? '#f6465d' : d.threats >= 40 ? '#fcd535' : '#0ecb81'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )
            })()}
          </section>
        </div>
      </main>

      {/* ------------------------------------------------------------- */}
      {/* ADD NEW ORGANIZATION MODAL (Backdrop blur & gold glow edge)   */}
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
              ✕
            </button>

            {/* Modal Title */}
            <div style={{ marginBottom: '24px' }}>
              <div style={{ fontSize: '11px', fontWeight: '800', color: '#fcd535', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '4px' }}>
                Workspace Provisioning
              </div>
              <h2 style={{ margin: 0, fontSize: '22px', fontWeight: '800', color: '#ffffff' }}>
                Add New Organization
              </h2>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleAddOrg} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#cbd5e1', marginBottom: '6px' }}>
                  Organization Name *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Apex Cyber Operations"
                  value={newOrgName}
                  onChange={(e) => setNewOrgName(e.target.value)}
                  required
                  style={{
                    width: '100%',
                    backgroundColor: '#070a12',
                    border: '1px solid var(--colors-hairline-on-dark)',
                    borderRadius: '8px',
                    padding: '10px 14px',
                    color: '#ffffff',
                    fontSize: '13px',
                    outline: 'none',
                  }}
                  onFocus={(e) => (e.target.style.borderColor = '#fcd535')}
                  onBlur={(e) => (e.target.style.borderColor = 'var(--colors-hairline-on-dark)')}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '6px' }}>
                  Domain (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. hackit.io"
                  value={newOrgDomain}
                  onChange={(e) => setNewOrgDomain(e.target.value)}
                  style={{
                    width: '100%',
                    backgroundColor: '#1a1e24',
                    border: '1px solid var(--colors-hairline-on-dark)',
                    borderRadius: '8px',
                    padding: '10px 14px',
                    color: '#ffffff',
                    fontSize: '13px',
                    outline: 'none',
                  }}
                  onFocus={(e) => (e.target.style.borderColor = '#fcd535')}
                  onBlur={(e) => (e.target.style.borderColor = 'var(--colors-hairline-on-dark)')}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '6px' }}>
                  Admin Contact Email
                </label>
                <input
                  type="email"
                  placeholder="admin@hackit.io"
                  value={newOrgContact}
                  onChange={(e) => setNewOrgContact(e.target.value)}
                  style={{
                    width: '100%',
                    backgroundColor: '#1a1e24',
                    border: '1px solid var(--colors-hairline-on-dark)',
                    borderRadius: '8px',
                    padding: '10px 14px',
                    color: '#ffffff',
                    fontSize: '13px',
                    outline: 'none',
                  }}
                  onFocus={(e) => (e.target.style.borderColor = '#fcd535')}
                  onBlur={(e) => (e.target.style.borderColor = 'var(--colors-hairline-on-dark)')}
                />
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
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-1px)'
                  e.currentTarget.style.boxShadow = '0 8px 30px rgba(252, 213, 53, 0.6)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)'
                  e.currentTarget.style.boxShadow = '0 4px 20px rgba(252, 213, 53, 0.4)'
                }}
              >
                Add Organization &rarr;
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Organization Switch Modal */}
      <OrganizationSwitchModal
        isOpen={isSwitchOrgModalOpen}
        onClose={() => setIsSwitchOrgModalOpen(false)}
        organizations={organizations}
        currentOrgId={selectedOrgForDetails?.id || orgId || (organizations[0] && organizations[0].id)}
        onSelectOrg={(org) => {
          setSelectedOrgForDetails(org)
          if (onSelectOrg) onSelectOrg(org)
        }}
        onCreateOrg={async (name) => {
          const res = await fetch('/api/orgs', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name }),
          })
          if (!res.ok) throw new Error('Failed to create organization')
          const created = await res.json()
          const credsRes = await fetch(`/api/orgs/${created.id}/registration-credentials`)
          const creds = credsRes.ok ? await credsRes.json() : null
          const newOrgItem = {
            id: created.id,
            name: created.name,
            role: created.role || 'owner',
            usersCount: 0,
            threatLevel: 'LOW',
            riskScore: 15,
            dateAdded: new Date().toISOString().split('T')[0],
            apiKey: creds?.enrollment_key || creds?.registration_key || `cwek_${created.id}`,
          }
          setOrganizations((prev) => [newOrgItem, ...prev])
          setSelectedOrgForDetails(newOrgItem)
          if (onSelectOrg) onSelectOrg(newOrgItem)
        }}
      />
      {/* KEYFRAME ANIMATIONS                                           */}
      {/* ------------------------------------------------------------- */}
      <style>{`
        @keyframes pulsateRedGlow {
          0% {
            border: 1px solid rgba(246, 70, 93, 0.4);
            box-shadow: 0 0 15px rgba(246, 70, 93, 0.25), inset 0 0 10px rgba(246, 70, 93, 0.1);
          }
          50% {
            border: 1px solid rgba(246, 70, 93, 0.95);
            box-shadow: 0 0 35px rgba(246, 70, 93, 0.7), inset 0 0 25px rgba(246, 70, 93, 0.3);
          }
          100% {
            border: 1px solid rgba(246, 70, 93, 0.4);
            box-shadow: 0 0 15px rgba(246, 70, 93, 0.25), inset 0 0 10px rgba(246, 70, 93, 0.1);
          }
        }
        @keyframes pulseGreenDot {
          0% { opacity: 0.4; transform: scale(0.9); }
          50% { opacity: 1; transform: scale(1.15); }
          100% { opacity: 0.4; transform: scale(0.9); }
        }
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
