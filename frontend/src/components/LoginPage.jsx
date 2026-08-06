import React, { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import PrivacyModal from './PrivacyModal'

export default function LoginPage({
  authMode,
  setAuthMode,
  username,
  setUsername,
  email,
  setEmail,
  password,
  setPassword,
  orgName,
  setOrgName,
  authError,
  authLoading,
  handleLogin,
  handleSignup
}) {
  const [showPassword, setShowPassword] = useState(false)
  const [isPrivacyModalOpen, setIsPrivacyModalOpen] = useState(false)

  return (
    <div
      className="split-login-container"
      style={{
        display: 'flex',
        minHeight: '100vh',
        width: '100%',
        backgroundColor: 'var(--colors-canvas-dark)',
      }}
    >
      {/* LEFT PANEL — Brand & Value Prop (55% width, surface-elevated background) */}
      <div
        className="split-left-panel"
        style={{
          width: '55%',
          backgroundColor: 'var(--colors-surface-card-dark)',
          borderRight: '1px solid var(--colors-hairline-on-dark)',
          padding: '48px 56px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
        }}
      >
        <div>
          {/* 1. Logo Mark & Wordmark */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '48px' }}>
            <div
              style={{
                width: '34px',
                height: '34px',
                borderRadius: 'var(--rounded-md)',
                backgroundColor: 'var(--colors-canvas-dark)',
                border: '1px solid var(--colors-hairline-on-dark)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: '700',
                fontSize: '15px',
                color: 'var(--colors-primary)',
              }}
            >
              CW
            </div>
            <span style={{ fontWeight: '700', fontSize: '18px', letterSpacing: '-0.3px', color: 'var(--colors-on-dark)' }}>
              CIPHER<span style={{ color: 'var(--colors-primary)' }}>WATCH</span>
            </span>
          </div>

          {/* 2. Display Headline */}
          <h1 className="display-sm" style={{ color: 'var(--colors-on-dark)', marginBottom: '32px', maxWidth: '480px' }}>
            See the exfiltration. <span style={{ color: 'var(--colors-primary)' }}>Never the content.</span>
          </h1>

          {/* 3. Three Stacked Feature Rows */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '40px' }}>
            <div className="trust-badge" style={{ border: '1px solid var(--colors-hairline-on-dark)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                <span style={{ fontSize: '16px' }}>🛡️</span>
                <strong className="title-sm" style={{ color: 'var(--colors-on-dark)' }}>0% Payload Inspection</strong>
              </div>
              <p className="body-sm" style={{ color: 'var(--colors-muted-strong)', margin: 0 }}>
                Full sequence visibility without reading user file or document payloads.
              </p>
            </div>

            <div className="trust-badge" style={{ border: '1px solid var(--colors-hairline-on-dark)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                <span style={{ fontSize: '16px' }}>📸</span>
                <strong className="title-sm" style={{ color: 'var(--colors-on-dark)' }}>Zero Screen Recording</strong>
              </div>
              <p className="body-sm" style={{ color: 'var(--colors-muted-strong)', margin: 0 }}>
                Complete zero-knowledge endpoint telemetry with zero frame buffer access.
              </p>
            </div>

            <div className="trust-badge" style={{ border: '1px solid var(--colors-hairline-on-dark)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                <span style={{ fontSize: '16px' }}>📋</span>
                <strong className="title-sm" style={{ color: 'var(--colors-on-dark)' }}>Disclosed Metadata Only</strong>
              </div>
              <p className="body-sm" style={{ color: 'var(--colors-muted-strong)', margin: 0 }}>
                Low-level OS telemetry paths, process hashes, and byte counts only.
              </p>
            </div>
          </div>

          {/* 4. Stat Callout Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
            <div className="trust-badge" style={{ backgroundColor: 'var(--colors-canvas-dark)', border: '1px solid var(--colors-hairline-on-dark)', padding: '14px 16px' }}>
              <span className="number-display" style={{ color: 'var(--colors-primary)', fontSize: '24px' }}>&lt; 4 min</span>
              <span className="body-sm" style={{ color: 'var(--colors-muted-strong)', fontSize: '11px', fontWeight: 500 }}>Mean Triage Time</span>
            </div>

            <div className="trust-badge" style={{ backgroundColor: 'var(--colors-canvas-dark)', border: '1px solid var(--colors-hairline-on-dark)', padding: '14px 16px' }}>
              <span className="number-display" style={{ color: 'var(--colors-primary)', fontSize: '24px' }}>0 Bytes</span>
              <span className="body-sm" style={{ color: 'var(--colors-muted-strong)', fontSize: '11px', fontWeight: 500 }}>Payload Storage</span>
            </div>

            <div className="trust-badge" style={{ backgroundColor: 'var(--colors-canvas-dark)', border: '1px solid var(--colors-hairline-on-dark)', padding: '14px 16px' }}>
              <span className="number-display" style={{ color: 'var(--colors-primary)', fontSize: '24px' }}>No. 1</span>
              <span className="body-sm" style={{ color: 'var(--colors-muted-strong)', fontSize: '11px', fontWeight: 500 }}>Privacy Guarantee</span>
            </div>
          </div>
        </div>

        {/* 5. Footer Microcopy Row */}
        <div style={{ display: 'flex', gap: '20px', alignItems: 'center', paddingTop: '32px', borderTop: '1px solid var(--colors-hairline-on-dark)', marginTop: '32px' }}>
          <span className="body-sm" style={{ color: 'var(--colors-muted)', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            🔒 0% Payload Inspection Guarantee
          </span>
          <span className="body-sm" style={{ color: 'var(--colors-muted)', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            ⚡ Sub-millisecond Rust Agent
          </span>
        </div>
      </div>

      {/* RIGHT PANEL — Login Form (45% width, canvas-dark background) */}
      <div
        className="split-right-panel"
        style={{
          width: '45%',
          backgroundColor: 'var(--colors-canvas-dark)',
          padding: '48px 40px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          alignItems: 'center',
          position: 'relative',
        }}
      >
        {/* Top Right Privacy Link */}
        <div style={{ width: '100%', display: 'flex', justifyContent: 'flex-end', marginBottom: '24px' }}>
          <button
            onClick={() => setIsPrivacyModalOpen(true)}
            style={{
              padding: '6px 14px',
              backgroundColor: 'var(--colors-surface-card-dark)',
              border: '1px solid var(--colors-hairline-on-dark)',
              borderRadius: 'var(--rounded-pill)',
              color: 'var(--colors-primary)',
              fontSize: '12px',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            🔍 Audit Privacy Policy & Disclosures
          </button>
        </div>

        {/* Centered Form Wrapper */}
        <div style={{ width: '100%', maxWidth: '400px', margin: 'auto 0' }}>
          <h2 className="title-lg" style={{ color: 'var(--colors-on-dark)', fontSize: '24px', marginBottom: '8px' }}>
            {authMode === 'login' ? 'CipherWatch Access' : 'Create Workspace'}
          </h2>
          <p className="body-sm" style={{ color: 'var(--colors-muted-strong)', marginBottom: '32px', lineHeight: '1.5' }}>
            {authMode === 'login'
              ? 'Enter corporate credentials to inspect metadata threat telemetry.'
              : 'Initialize tenant workspace and security administrator account.'}
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

          <form onSubmit={authMode === 'login' ? handleLogin : handleSignup}>
            {authMode === 'signup' && (
              <div style={{ marginBottom: '20px' }}>
                <label className="body-sm" style={{ color: 'var(--colors-muted-strong)', display: 'block', marginBottom: '8px', fontWeight: '600' }}>
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
              <label className="body-sm" style={{ color: 'var(--colors-muted-strong)', display: 'block', marginBottom: '8px', fontWeight: '600' }}>
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
              <label className="body-sm" style={{ color: 'var(--colors-muted-strong)', display: 'block', marginBottom: '8px', fontWeight: '600' }}>
                SECURITY PASSWORD
              </label>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  className="input-text"
                  placeholder="••••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  style={{ paddingRight: '44px' }}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  style={{
                    position: 'absolute',
                    right: '12px',
                    background: 'none',
                    border: 'none',
                    color: 'var(--colors-muted-strong)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '4px',
                  }}
                >
                  {showPassword ? (
                    <EyeOff size={18} style={{ stroke: 'var(--colors-muted-strong)' }} />
                  ) : (
                    <Eye size={18} style={{ stroke: 'var(--colors-muted-strong)' }} />
                  )}
                </button>
              </div>
            </div>

            {authMode === 'signup' && (
              <div style={{ marginBottom: '28px' }}>
                <label className="body-sm" style={{ color: 'var(--colors-muted-strong)', display: 'block', marginBottom: '8px', fontWeight: '600' }}>
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

            <button
              type="submit"
              disabled={authLoading}
              className="btn-primary"
              style={{ width: '100%', height: '44px', fontSize: '14px', fontWeight: '700' }}
            >
              {authLoading ? 'Authenticating...' : authMode === 'login' ? 'Authenticate Portal' : 'Register Workspace'}
            </button>
          </form>

          <div style={{ marginTop: '24px', textAlign: 'center' }}>
            <button
              onClick={() => {
                setAuthMode(authMode === 'login' ? 'signup' : 'login');
              }}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--colors-primary)',
                fontSize: '13px',
                fontWeight: '600',
                cursor: 'pointer'
              }}
            >
              {authMode === 'login' ? 'Setup new organization workspace →' : 'Log in with existing credentials →'}
            </button>
          </div>
        </div>

        {/* Empty bottom spacer to ensure balance */}
        <div style={{ height: '32px' }} />
      </div>

      {/* Privacy Disclosure Audit Modal */}
      {isPrivacyModalOpen && <PrivacyModal onClose={() => setIsPrivacyModalOpen(false)} />}
    </div>
  )
}
