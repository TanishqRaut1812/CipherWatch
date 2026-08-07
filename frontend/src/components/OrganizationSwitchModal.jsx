import React, { useState } from 'react'
import { Building, Shield, Plus, X, Check, AlertTriangle } from 'lucide-react'

export default function OrganizationSwitchModal({
  isOpen,
  onClose,
  organizations = [],
  currentOrgId,
  onSelectOrg,
  onCreateOrg,
}) {
  const [newOrgName, setNewOrgName] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')

  if (!isOpen) return null

  const handleCreate = async (e) => {
    e.preventDefault()
    if (!newOrgName.trim()) return
    setError('')
    setIsSubmitting(true)
    try {
      if (onCreateOrg) {
        await onCreateOrg(newOrgName.trim())
      }
      setNewOrgName('')
      setIsSubmitting(false)
    } catch (err) {
      setError(err.message || 'Failed to create workspace')
      setIsSubmitting(false)
    }
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.82)',
        backdropFilter: 'blur(8px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        animation: 'fadeIn 0.2s ease',
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '620px',
          backgroundColor: '#0c0f1d',
          border: '1px solid rgba(252, 213, 53, 0.35)',
          borderRadius: '16px',
          padding: '32px',
          boxShadow: '0 24px 60px rgba(0, 0, 0, 0.9), 0 0 30px rgba(252, 213, 53, 0.15)',
          position: 'relative',
          overflow: 'hidden',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Ambient Top Glow */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '3px',
            background: 'linear-gradient(90deg, #f6465d 0%, #fcd535 50%, #0ecb81 100%)',
          }}
        />

        {/* Modal Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <Building size={18} color="#fcd535" />
              <span style={{ fontSize: '11px', fontWeight: '800', color: '#fcd535', letterSpacing: '1px' }}>
                WORKSPACE MANAGEMENT
              </span>
            </div>
            <h2 style={{ fontSize: '22px', fontWeight: '800', color: '#ffffff', margin: 0 }}>
              Switch Organization
            </h2>
            <p style={{ fontSize: '13px', color: '#94a3b8', margin: '4px 0 0 0' }}>
              Select an authorized organization workspace to switch live threat telemetry monitoring context.
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'rgba(255, 255, 255, 0.06)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              color: '#cbd5e1',
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = '#ffffff')}
            onMouseLeave={(e) => (e.currentTarget.style.color = '#cbd5e1')}
          >
            <X size={16} />
          </button>
        </div>

        {error && (
          <div
            style={{
              padding: '10px 14px',
              borderRadius: '8px',
              backgroundColor: 'rgba(246, 70, 93, 0.12)',
              border: '1px solid rgba(246, 70, 93, 0.4)',
              color: '#f6465d',
              fontSize: '12px',
              marginBottom: '16px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <AlertTriangle size={14} /> {error}
          </div>
        )}

        {/* Organizations List Scrollable Container */}
        <div style={{ flex: 1, overflowY: 'auto', paddingRight: '4px', marginBottom: '24px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {organizations.map((org) => {
              const isSelected = org.id === currentOrgId
              const risk = org.riskScore !== undefined ? org.riskScore : 0
              const isHigh = risk >= 70
              const isMed = risk >= 40 && risk < 70
              const badgeColor = isHigh ? '#f6465d' : isMed ? '#fcd535' : '#0ecb81'

              return (
                <div
                  key={org.id}
                  onClick={() => {
                    if (onSelectOrg) onSelectOrg(org)
                    onClose()
                  }}
                  style={{
                    padding: '16px 20px',
                    borderRadius: '12px',
                    backgroundColor: isSelected ? 'rgba(252, 213, 53, 0.08)' : '#121626',
                    border: isSelected ? '1.5px solid #fcd535' : '1px solid rgba(255, 255, 255, 0.08)',
                    cursor: 'pointer',
                    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    boxShadow: isSelected ? '0 0 20px rgba(252, 213, 53, 0.15)' : 'none',
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.borderColor = 'rgba(252, 213, 53, 0.5)'
                      e.currentTarget.style.transform = 'translateY(-1px)'
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)'
                      e.currentTarget.style.transform = 'translateY(0)'
                    }
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <div
                      style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '10px',
                        backgroundColor: isSelected ? 'rgba(252, 213, 53, 0.15)' : 'rgba(255, 255, 255, 0.04)',
                        border: `1px solid ${isSelected ? '#fcd535' : 'rgba(255, 255, 255, 0.1)'}`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: isSelected ? '#fcd535' : '#94a3b8',
                      }}
                    >
                      <Building size={20} />
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <h4 style={{ margin: 0, fontSize: '15px', fontWeight: '800', color: '#ffffff' }}>
                          {org.name}
                        </h4>
                        {isSelected && (
                          <span
                            style={{
                              fontSize: '10px',
                              fontWeight: '900',
                              backgroundColor: '#fcd535',
                              color: '#070a12',
                              padding: '2px 8px',
                              borderRadius: '12px',
                              letterSpacing: '0.5px',
                            }}
                          >
                            ACTIVE
                          </span>
                        )}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '4px', fontSize: '12px', color: '#64748b' }}>
                        <span>
                          Role: <strong style={{ color: '#cbd5e1' }}>{(org.role || 'MEMBER').toUpperCase()}</strong>
                        </span>
                        <span>•</span>
                        <span>
                          Threat Level:{' '}
                          <strong style={{ color: badgeColor }}>
                            {isHigh ? 'CRITICAL' : isMed ? 'WARNING' : 'HEALTHY'} ({risk}%)
                          </strong>
                        </span>
                      </div>
                    </div>
                  </div>

                  <button
                    style={{
                      background: isSelected ? '#fcd535' : 'rgba(255, 255, 255, 0.06)',
                      color: isSelected ? '#070a12' : '#fcd535',
                      border: isSelected ? 'none' : '1px solid rgba(252, 213, 53, 0.3)',
                      padding: '8px 16px',
                      borderRadius: '8px',
                      fontSize: '12px',
                      fontWeight: '800',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {isSelected ? <Check size={14} /> : null}
                    {isSelected ? 'Active Workspace' : 'Switch →'}
                  </button>
                </div>
              )
            })}
          </div>
        </div>

        {/* Modal Footer: Initialize New Workspace */}
        <div style={{ borderTop: '1px solid rgba(255, 255, 255, 0.1)', paddingTop: '20px' }}>
          <span style={{ fontSize: '11px', fontWeight: '800', color: '#94a3b8', letterSpacing: '0.5px', display: 'block', marginBottom: '8px' }}>
            + INITIALIZE NEW WORKSPACE
          </span>
          <form onSubmit={handleCreate} style={{ display: 'flex', gap: '10px' }}>
            <input
              type="text"
              placeholder="Enter new workspace organization name..."
              value={newOrgName}
              onChange={(e) => setNewOrgName(e.target.value)}
              style={{
                flex: 1,
                backgroundColor: '#121626',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                borderRadius: '8px',
                padding: '10px 14px',
                color: '#ffffff',
                fontSize: '13px',
                outline: 'none',
              }}
            />
            <button
              type="submit"
              disabled={isSubmitting || !newOrgName.trim()}
              style={{
                backgroundColor: '#fcd535',
                color: '#070a12',
                border: 'none',
                borderRadius: '8px',
                padding: '0 18px',
                fontSize: '13px',
                fontWeight: '800',
                cursor: 'pointer',
                opacity: !newOrgName.trim() ? 0.6 : 1,
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                whiteSpace: 'nowrap',
              }}
            >
              <Plus size={16} /> Create Workspace
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
