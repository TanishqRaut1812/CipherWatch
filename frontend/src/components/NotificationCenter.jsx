import React, { useState, useEffect, useRef } from 'react'
import { Bell, Mail, Inbox, X } from 'lucide-react'

export default function NotificationCenter({ userEmail }) {
  const [isOpen, setIsOpen] = useState(false)
  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [selectedMail, setSelectedMail] = useState(null)
  const [filter, setFilter] = useState('ALL') // 'ALL' | 'CRITICAL'
  const popoverRef = useRef(null)

  const fetchNotifications = () => {
    fetch('/api/notifications/emails')
      .then((res) => (res.ok ? res.json() : { notifications: [], unread_count: 0 }))
      .then((data) => {
        setNotifications(data.notifications || [])
        setUnreadCount(data.unread_count || 0)
      })
      .catch((err) => console.error('Failed to fetch notifications:', err))
  }

  useEffect(() => {
    fetchNotifications()
    const interval = setInterval(fetchNotifications, 5000)
    return () => clearInterval(interval)
  }, [])

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event) {
      if (popoverRef.current && !popoverRef.current.contains(event.target)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleMarkAllRead = () => {
    fetch('/api/notifications/mark-all-read', { method: 'POST' })
      .then(() => fetchNotifications())
      .catch((err) => console.error(err))
  }

  const handleSelectNotification = (item) => {
    fetch(`/api/notifications/${item.id}/read`, { method: 'POST' })
      .then(() => fetchNotifications())
      .catch((err) => console.error(err))

    setSelectedMail(item)
  }

  const filteredNotifications = notifications.filter((n) => {
    if (filter === 'CRITICAL') {
      return n.severity?.toUpperCase() === 'CRITICAL' || n.severity?.toUpperCase() === 'HIGH'
    }
    return true
  })

  return (
    <div style={{ position: 'relative' }} ref={popoverRef}>
      {/* Notification Bell Header Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        title="View Sent Security Email Notifications"
        style={{
          position: 'relative',
          background: isOpen ? 'var(--colors-surface-card-dark)' : 'rgba(255, 255, 255, 0.05)',
          border: isOpen ? '1px solid var(--colors-primary)' : '1px solid var(--colors-hairline-on-dark)',
          borderRadius: 'var(--rounded-md)',
          width: '38px',
          height: '38px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          transition: 'all 0.2s ease',
          outline: 'none',
        }}
        onMouseEnter={(e) => {
          if (!isOpen) e.currentTarget.style.borderColor = 'var(--colors-primary)'
        }}
        onMouseLeave={(e) => {
          if (!isOpen) e.currentTarget.style.borderColor = 'var(--colors-hairline-on-dark)'
        }}
      >
        <Bell size={18} color={isOpen ? 'var(--colors-primary)' : 'var(--colors-on-dark)'} />

        {/* Unread Badge Count Pill */}
        {unreadCount > 0 && (
          <span
            style={{
              position: 'absolute',
              top: '-4px',
              right: '-4px',
              backgroundColor: '#f6465d',
              color: '#ffffff',
              fontSize: '10px',
              fontWeight: '800',
              padding: '2px 6px',
              borderRadius: '10px',
              boxShadow: '0 0 10px rgba(246, 70, 93, 0.8)',
              border: '2px solid var(--colors-canvas-dark)',
              animation: 'pulseBadge 2s infinite',
            }}
          >
            {unreadCount}
          </span>
        )}
      </button>

      {/* Popover Dropdown Panel */}
      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: '48px',
            right: 0,
            width: '420px',
            maxWidth: '90vw',
            backgroundColor: 'var(--colors-surface-card-dark)',
            border: '1px solid var(--colors-hairline-on-dark)',
            borderRadius: '12px',
            boxShadow: '0 16px 40px rgba(0, 0, 0, 0.6), 0 0 15px rgba(252, 213, 53, 0.1)',
            zIndex: 1000,
            overflow: 'hidden',
            animation: 'fadeInDown 0.15s ease-out',
          }}
        >
          {/* Panel Header */}
          <div
            style={{
              padding: '16px 20px',
              backgroundColor: 'var(--colors-canvas-dark)',
              borderBottom: '1px solid var(--colors-hairline-on-dark)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Mail size={16} color="var(--colors-primary)" />
                <h3 style={{ margin: 0, fontSize: '14px', fontWeight: '700', color: '#f8fafc' }}>
                  Resend Email Activity Log
                </h3>
                {unreadCount > 0 && (
                  <span
                    style={{
                      fontSize: '11px',
                      backgroundColor: 'rgba(252, 213, 53, 0.15)',
                      color: 'var(--colors-primary)',
                      border: '1px solid rgba(252, 213, 53, 0.4)',
                      padding: '1px 8px',
                      borderRadius: '12px',
                      fontWeight: '600',
                    }}
                  >
                    {unreadCount} New
                  </span>
                )}
              </div>
              <p style={{ margin: '4px 0 0 0', fontSize: '11px', color: '#94a3b8' }}>
                Threat alerts dispatched to SOC admin via Resend
              </p>
            </div>

            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--colors-primary)',
                  fontSize: '11px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  padding: '4px 8px',
                  borderRadius: '4px',
                }}
              >
                Mark Read
              </button>
            )}
          </div>

          {/* Filter Tabs */}
          <div
            style={{
              display: 'flex',
              gap: '8px',
              padding: '10px 16px',
              backgroundColor: 'var(--colors-surface-card-dark)',
              borderBottom: '1px solid var(--colors-hairline-on-dark)',
            }}
          >
            <button
              onClick={() => setFilter('ALL')}
              style={{
                background: filter === 'ALL' ? 'rgba(252, 213, 53, 0.15)' : 'transparent',
                border: filter === 'ALL' ? '1px solid rgba(252, 213, 53, 0.4)' : 'none',
                color: filter === 'ALL' ? 'var(--colors-primary)' : 'var(--colors-muted-strong)',
                fontSize: '11px',
                fontWeight: '600',
                padding: '4px 10px',
                borderRadius: '6px',
                cursor: 'pointer',
              }}
            >
              All ({notifications.length})
            </button>
            <button
              onClick={() => setFilter('CRITICAL')}
              style={{
                background: filter === 'CRITICAL' ? 'rgba(246, 70, 93, 0.2)' : 'transparent',
                border: filter === 'CRITICAL' ? '1px solid rgba(246, 70, 93, 0.4)' : 'none',
                color: filter === 'CRITICAL' ? '#f6465d' : 'var(--colors-muted-strong)',
                fontSize: '11px',
                fontWeight: '600',
                padding: '4px 10px',
                borderRadius: '6px',
                cursor: 'pointer',
              }}
            >
              High/Critical Only
            </button>
          </div>

          {/* Notifications List */}
          <div style={{ maxHeight: '380px', overflowY: 'auto' }}>
            {filteredNotifications.length === 0 ? (
              <div style={{ padding: '32px 20px', textAlign: 'center', color: '#64748b', fontSize: '13px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                <Inbox size={28} color="var(--colors-muted)" />
                <span>No email alert notifications recorded yet.</span>
                <span style={{ fontSize: '11px', color: 'var(--colors-muted)' }}>
                  Threat alerts will trigger Resend emails automatically.
                </span>
              </div>
            ) : (
              filteredNotifications.map((item) => {
                const isCritical = ['CRITICAL', 'HIGH'].includes(item.severity?.toUpperCase())
                const isUnread = !item.read

                return (
                  <div
                    key={item.id}
                    onClick={() => handleSelectNotification(item)}
                    style={{
                      padding: '14px 18px',
                      borderBottom: '1px solid var(--colors-hairline-on-dark)',
                      backgroundColor: isUnread ? 'rgba(252, 213, 53, 0.04)' : 'var(--colors-canvas-dark)',
                      cursor: 'pointer',
                      transition: 'background 0.15s ease',
                      position: 'relative',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--colors-surface-card-dark)')}
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.backgroundColor = isUnread ? 'rgba(252, 213, 53, 0.04)' : 'var(--colors-canvas-dark)')
                    }
                  >
                    {isUnread && (
                      <div
                        style={{
                          position: 'absolute',
                          left: '6px',
                          top: '50%',
                          transform: 'translateY(-50%)',
                          width: '6px',
                          height: '6px',
                          borderRadius: '50%',
                          backgroundColor: 'var(--colors-primary)',
                        }}
                      />
                    )}

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px' }}>
                      <span
                        style={{
                          fontSize: '10px',
                          fontWeight: '800',
                          letterSpacing: '0.5px',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          backgroundColor: isCritical ? 'rgba(246, 70, 93, 0.15)' : 'rgba(252, 213, 53, 0.15)',
                          color: isCritical ? '#f6465d' : '#fcd535',
                          border: `1px solid ${isCritical ? 'rgba(246, 70, 93, 0.3)' : 'rgba(252, 213, 53, 0.3)'}`,
                        }}
                      >
                        {item.severity?.toUpperCase()} ALERT
                      </span>
                      <span style={{ fontSize: '11px', color: '#64748b' }}>{item.sent_at}</span>
                    </div>

                    <h4 style={{ margin: '6px 0 4px 0', fontSize: '13px', color: '#f1f5f9', fontWeight: '600', lineHeight: 1.3 }}>
                      {item.subject}
                    </h4>

                    <p style={{ margin: 0, fontSize: '11px', color: '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      To: <span style={{ color: '#cbd5e1' }}>{item.admin_email}</span> • Rule: {item.rule_id}
                    </p>

                    <div style={{ marginTop: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '10px', color: 'var(--colors-primary)', fontWeight: '700' }}>
                        Status: {item.status}
                      </span>
                      <span style={{ fontSize: '11px', color: 'var(--colors-primary)', fontWeight: '600' }}>
                        Preview Email
                      </span>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
      )}

      {/* Rich Email Preview Modal */}
      {selectedMail && (
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
          onClick={() => setSelectedMail(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: '720px',
              maxHeight: '90vh',
              backgroundColor: 'var(--colors-canvas-dark)',
              border: '1px solid var(--colors-hairline-on-dark)',
              borderRadius: '16px',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              boxShadow: '0 25px 60px rgba(0, 0, 0, 0.8)',
            }}
          >
            {/* Modal Header Bar */}
            <div
              style={{
                padding: '18px 24px',
                backgroundColor: 'var(--colors-surface-card-dark)',
                borderBottom: '1px solid var(--colors-hairline-on-dark)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Mail size={18} color="var(--colors-primary)" />
                  <h3 style={{ margin: 0, fontSize: '16px', color: '#ffffff', fontWeight: '700' }}>
                    Resend Email Inspector
                  </h3>
                  <span
                    style={{
                      fontSize: '11px',
                      fontWeight: '700',
                      padding: '2px 8px',
                      borderRadius: '10px',
                      backgroundColor: 'rgba(14, 203, 129, 0.2)',
                      color: '#0ecb81',
                      border: '1px solid rgba(14, 203, 129, 0.4)',
                    }}
                  >
                    {selectedMail.status}
                  </span>
                </div>
                <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#94a3b8' }}>
                  To: <strong>{selectedMail.admin_email}</strong> • Dispatched: {selectedMail.sent_at}
                </p>
              </div>

              <button
                onClick={() => setSelectedMail(null)}
                style={{
                  background: 'rgba(255, 255, 255, 0.1)',
                  border: 'none',
                  color: '#ffffff',
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  fontSize: '16px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <X size={14} />
              </button>
            </div>

            {/* Render HTML content safely inside iframe */}
            <div style={{ flex: 1, backgroundColor: 'var(--colors-canvas-dark)', padding: '0', overflow: 'hidden' }}>
              <iframe
                title="Email Preview"
                srcDoc={selectedMail.html_content}
                style={{
                  width: '100%',
                  height: '580px',
                  border: 'none',
                  backgroundColor: 'var(--colors-canvas-dark)',
                }}
              />
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes pulseBadge {
          0% { transform: scale(1); }
          50% { transform: scale(1.15); }
          100% { transform: scale(1); }
        }
        @keyframes fadeInDown {
          from { opacity: 0; transform: translateY(-8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>
    </div>
  )
}
