import React, { useState } from 'react'
import { Eye, EyeOff, ShieldCheck, Activity, Lock, Zap, Search, AlertTriangle } from 'lucide-react'
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

  // Forgot password 2FA state
  const [forgotStep, setForgotStep] = useState(1) // 1: Send OTP, 2: Reset Password
  const [otp, setOtp] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [forgotLoading, setForgotLoading] = useState(false)
  const [forgotError, setForgotError] = useState('')
  const [forgotSuccess, setForgotSuccess] = useState('')

  const handleSendOtp = async (e) => {
    e.preventDefault()
    setForgotError('')
    setForgotSuccess('')
    setForgotLoading(true)
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Failed to send 2FA OTP verification code.')
      setForgotSuccess(data.message || 'OTP verification code sent to your email!')
      setForgotStep(2)
    } catch (err) {
      setForgotError(err.message)
    } finally {
      setForgotLoading(false)
    }
  }

  const handleResetPassword = async (e) => {
    e.preventDefault()
    setForgotError('')
    setForgotSuccess('')
    setForgotLoading(true)
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp, new_password: newPassword }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Failed to reset password.')
      alert('Password updated successfully! You can now sign in with your new password.')
      setAuthMode('login')
      setForgotStep(1)
      setOtp('')
      setNewPassword('')
    } catch (err) {
      setForgotError(err.message)
    } finally {
      setForgotLoading(false)
    }
  }

  return (
    <div
      className="split-login-container"
      style={{
        display: 'flex',
        minHeight: '100vh',
        width: '100%',
        backgroundColor: '#0b0e11',
      }}
    >
      {/* LEFT PANEL — Hero Section (Full-bleed dark gradient with radial vignette & background graph) */}
      <div
        className="split-left-panel hero-gradient-panel"
        style={{
          width: '52%',
          borderRight: '1px solid var(--colors-hairline-on-dark)',
          padding: '48px 56px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          position: 'relative',
        }}
      >
        {/* Decorative Background Network / Graph Nodes SVG */}
        <svg
          className="hero-bg-graph"
          viewBox="0 0 800 800"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path d="M100 150 L250 280 L400 180 L600 320 L720 200" stroke="#fcd535" strokeWidth="1.5" strokeDasharray="4 4" />
          <path d="M150 450 L300 380 L480 500 L650 410 L750 580" stroke="#fcd535" strokeWidth="1" strokeDasharray="6 6" />
          <path d="M250 280 L300 380" stroke="#fcd535" strokeWidth="1.2" opacity="0.6" />
          <path d="M400 180 L480 500" stroke="#fcd535" strokeWidth="1.2" opacity="0.6" />
          <path d="M600 320 L650 410" stroke="#fcd535" strokeWidth="1.2" opacity="0.6" />
          <circle cx="100" cy="150" r="5" fill="#fcd535" opacity="0.4" />
          <circle cx="250" cy="280" r="7" fill="#fcd535" opacity="0.7" />
          <circle cx="400" cy="180" r="6" fill="#ffe066" opacity="0.6" />
          <circle cx="600" cy="320" r="8" fill="#f0b90b" opacity="0.8" />
          <circle cx="720" cy="200" r="5" fill="#fcd535" opacity="0.5" />
          <circle cx="300" cy="380" r="6" fill="#f6465d" opacity="0.6" />
          <circle cx="480" cy="500" r="7" fill="#0ecb81" opacity="0.7" />
          <circle cx="650" cy="410" r="6" fill="#fcd535" opacity="0.5" />
        </svg>

        <div className="hero-content">
          {/* 1. Top Wordmark & Brand Logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '40px' }}>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: 'var(--rounded-md)',
                background: 'linear-gradient(135deg, #1e2329 0%, #15191e 100%)',
                border: '1px solid rgba(252, 213, 53, 0.4)',
                boxShadow: '0 0 12px rgba(252, 213, 53, 0.25)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: '800',
                fontSize: '16px',
                color: '#fcd535',
                letterSpacing: '-0.5px',
              }}
            >
              CW
            </div>
            <span style={{ fontWeight: '800', fontSize: '20px', letterSpacing: '-0.5px', color: '#ffffff' }}>
              CIPHER<span style={{ color: '#fcd535' }}>WATCH</span>
            </span>
          </div>

          {/* 2. Hero Headline with Gold Accent & Subhead */}
          <div style={{ marginBottom: '36px', maxWidth: '520px' }}>
            <h1
              className="hero-headline-text"
              style={{
                fontSize: '38px',
                fontWeight: '800',
                lineHeight: '1.18',
                letterSpacing: '-0.8px',
                color: '#ffffff',
                marginBottom: '16px',
              }}
            >
              Insider threat detection powered by{' '}
              <span className="text-gradient-primary">metadata-only analytics.</span>
            </h1>
            <p
              style={{
                fontSize: '15px',
                color: '#929aa5',
                lineHeight: '1.55',
                fontWeight: '400',
                margin: 0,
              }}
            >
              Continuous zero-knowledge telemetry across enterprise endpoints with 0% payload capture or document logging.
            </p>
          </div>

          {/* 3. Value-Prop Feature Bullets */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '40px', maxWidth: '440px' }}>
            <div className="feature-bullet-chip">
              <ShieldCheck size={18} style={{ color: '#fcd535', flexShrink: 0 }} />
              <span style={{ fontSize: '13px', fontWeight: '600', color: '#eaecef' }}>
                Zero content capture
              </span>
            </div>

            <div className="feature-bullet-chip">
              <Activity size={18} style={{ color: '#fcd535', flexShrink: 0 }} />
              <span style={{ fontSize: '13px', fontWeight: '600', color: '#eaecef' }}>
                Real-time session graphing
              </span>
            </div>

            <div className="feature-bullet-chip">
              <Lock size={18} style={{ color: '#fcd535', flexShrink: 0 }} />
              <span style={{ fontSize: '13px', fontWeight: '600', color: '#eaecef' }}>
                Metadata-only by design
              </span>
            </div>

            <div className="feature-bullet-chip">
              <Zap size={18} style={{ color: '#fcd535', flexShrink: 0 }} />
              <span style={{ fontSize: '13px', fontWeight: '600', color: '#eaecef' }}>
                SOC-ready in minutes
              </span>
            </div>
          </div>
        </div>

        {/* 4. Bottom Trust Strip Row */}
        <div className="hero-content">
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '12px',
              paddingTop: '24px',
              borderTop: '1px solid rgba(43, 49, 57, 0.8)',
            }}
          >
            <div
              style={{
                backgroundColor: 'rgba(30, 35, 41, 0.7)',
                border: '1px solid var(--colors-hairline-on-dark)',
                borderRadius: 'var(--rounded-lg)',
                padding: '12px 14px',
              }}
            >
              <div className="number-display" style={{ color: '#fcd535', fontSize: '20px', lineHeight: '1.2' }}>
                &lt; 4 min
              </div>
              <div style={{ fontSize: '11px', color: '#707a8a', fontWeight: '500', marginTop: '2px' }}>
                Mean Detection
              </div>
            </div>

            <div
              style={{
                backgroundColor: 'rgba(30, 35, 41, 0.7)',
                border: '1px solid var(--colors-hairline-on-dark)',
                borderRadius: 'var(--rounded-lg)',
                padding: '12px 14px',
              }}
            >
              <div className="number-display" style={{ color: '#fcd535', fontSize: '20px', lineHeight: '1.2' }}>
                0 Bytes
              </div>
              <div style={{ fontSize: '11px', color: '#707a8a', fontWeight: '500', marginTop: '2px' }}>
                Payload Access
              </div>
            </div>

            <div
              style={{
                backgroundColor: 'rgba(30, 35, 41, 0.7)',
                border: '1px solid var(--colors-hairline-on-dark)',
                borderRadius: 'var(--rounded-lg)',
                padding: '12px 14px',
              }}
            >
              <div className="number-display" style={{ color: '#fcd535', fontSize: '20px', lineHeight: '1.2' }}>
                100%
              </div>
              <div style={{ fontSize: '11px', color: '#707a8a', fontWeight: '500', marginTop: '2px' }}>
                Metadata-Only
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* RIGHT PANEL — Centered Login / Register / Forgot Password Card */}
      <div
        className="split-right-panel"
        style={{
          width: '48%',
          backgroundColor: '#0b0e11',
          padding: '48px 40px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          alignItems: 'center',
          position: 'relative',
        }}
      >
        {/* Top Audit Privacy Button Link */}
        <div style={{ width: '100%', display: 'flex', justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={() => setIsPrivacyModalOpen(true)}
            style={{
              padding: '6px 14px',
              backgroundColor: 'var(--colors-surface-card-dark)',
              border: '1px solid var(--colors-hairline-on-dark)',
              borderRadius: 'var(--rounded-pill)',
              color: '#fcd535',
              fontSize: '12px',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 200ms ease-out',
            }}
          >
            <Search size={13} /> Audit Privacy Policy
          </button>
        </div>

        {/* Centered Login / Register / Reset Card */}
        <div className="login-card-container" style={{ margin: 'auto 0' }}>
          {/* Card Top Branding / Title */}
          <div style={{ textAlign: 'center', marginBottom: '28px' }}>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '4px 12px',
                background: 'rgba(252, 213, 53, 0.08)',
                border: '1px solid rgba(252, 213, 53, 0.2)',
                borderRadius: 'var(--rounded-pill)',
                fontSize: '11px',
                fontWeight: '700',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: '#fcd535',
                marginBottom: '16px',
              }}
            >
              {authMode === 'forgot_password' ? '2FA Password Recovery' : 'CipherWatch Portal Access'}
            </div>
            <h2 className="title-lg" style={{ color: '#ffffff', fontSize: '22px', fontWeight: '700', margin: 0 }}>
              {authMode === 'login'
                ? 'Sign In to Terminal'
                : authMode === 'signup'
                ? 'Register Account'
                : 'Reset Password'}
            </h2>
          </div>

          {(authError || forgotError) && (
            <div
              style={{
                padding: '12px 16px',
                borderRadius: 'var(--rounded-md)',
                background: 'rgba(246, 70, 93, 0.1)',
                border: '1px solid rgba(246, 70, 93, 0.3)',
                color: 'var(--colors-risk-escalating)',
                fontSize: '13px',
                marginBottom: '20px',
                lineHeight: '1.4',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <AlertTriangle size={16} style={{ flexShrink: 0 }} /> {authError || forgotError}
            </div>
          )}

          {forgotSuccess && (
            <div
              style={{
                padding: '12px 16px',
                borderRadius: 'var(--rounded-md)',
                background: 'rgba(14, 203, 129, 0.1)',
                border: '1px solid rgba(14, 203, 129, 0.3)',
                color: '#0ecb81',
                fontSize: '13px',
                marginBottom: '20px',
                lineHeight: '1.4',
              }}
            >
              {forgotSuccess}
            </div>
          )}

          {/* FORGOT PASSWORD FORM FLOW */}
          {authMode === 'forgot_password' ? (
            forgotStep === 1 ? (
              <form onSubmit={handleSendOtp}>
                <div style={{ marginBottom: '20px' }}>
                  <label
                    style={{
                      color: '#929aa5',
                      display: 'block',
                      marginBottom: '6px',
                      fontSize: '11px',
                      fontWeight: '700',
                      letterSpacing: '0.05em',
                      textTransform: 'uppercase',
                    }}
                  >
                    Registered Account Email
                  </label>
                  <input
                    type="email"
                    className="login-input"
                    placeholder="analyst@enterprise.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>

                <button
                  type="submit"
                  disabled={forgotLoading}
                  className="btn-glow-primary"
                >
                  {forgotLoading ? 'Sending Resend OTP...' : 'Send 2FA OTP Code'}
                </button>
              </form>
            ) : (
              <form onSubmit={handleResetPassword}>
                <div style={{ marginBottom: '16px' }}>
                  <label
                    style={{
                      color: '#929aa5',
                      display: 'block',
                      marginBottom: '6px',
                      fontSize: '11px',
                      fontWeight: '700',
                      letterSpacing: '0.05em',
                      textTransform: 'uppercase',
                    }}
                  >
                    Email Address
                  </label>
                  <input
                    type="email"
                    className="login-input"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>

                <div style={{ marginBottom: '16px' }}>
                  <label
                    style={{
                      color: '#929aa5',
                      display: 'block',
                      marginBottom: '6px',
                      fontSize: '11px',
                      fontWeight: '700',
                      letterSpacing: '0.05em',
                      textTransform: 'uppercase',
                    }}
                  >
                    6-Digit 2FA Verification Code (OTP)
                  </label>
                  <input
                    type="text"
                    className="login-input"
                    placeholder="123456"
                    maxLength={6}
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                    style={{ fontFamily: 'monospace', letterSpacing: '4px', textAlign: 'center', fontSize: '18px' }}
                    required
                  />
                </div>

                <div style={{ marginBottom: '24px' }}>
                  <label
                    style={{
                      color: '#929aa5',
                      display: 'block',
                      marginBottom: '6px',
                      fontSize: '11px',
                      fontWeight: '700',
                      letterSpacing: '0.05em',
                      textTransform: 'uppercase',
                    }}
                  >
                    New Security Password
                  </label>
                  <input
                    type="password"
                    className="login-input"
                    placeholder="••••••••••••"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                  />
                </div>

                <button
                  type="submit"
                  disabled={forgotLoading}
                  className="btn-glow-primary"
                >
                  {forgotLoading ? 'Updating Password...' : 'Reset Password'}
                </button>
              </form>
            )
          ) : (
            /* LOGIN / REGISTER FORM */
            <form onSubmit={authMode === 'login' ? handleLogin : handleSignup}>
              {authMode === 'signup' && (
                <div style={{ marginBottom: '18px' }}>
                  <label
                    style={{
                      color: '#929aa5',
                      display: 'block',
                      marginBottom: '6px',
                      fontSize: '11px',
                      fontWeight: '700',
                      letterSpacing: '0.05em',
                      textTransform: 'uppercase',
                    }}
                  >
                    Admin Username
                  </label>
                  <input
                    type="text"
                    className="login-input"
                    placeholder="e.g. secops_admin"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                  />
                </div>
              )}

              <div style={{ marginBottom: '18px' }}>
                <label
                  style={{
                    color: '#929aa5',
                    display: 'block',
                    marginBottom: '6px',
                    fontSize: '11px',
                    fontWeight: '700',
                    letterSpacing: '0.05em',
                    textTransform: 'uppercase',
                  }}
                >
                  Email Address
                </label>
                <input
                  type="email"
                  className="login-input"
                  placeholder="analyst@enterprise.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <div style={{ marginBottom: '8px' }}>
                <label
                  style={{
                    color: '#929aa5',
                    display: 'block',
                    marginBottom: '6px',
                    fontSize: '11px',
                    fontWeight: '700',
                    letterSpacing: '0.05em',
                    textTransform: 'uppercase',
                  }}
                >
                  Security Password
                </label>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    className="login-input"
                    placeholder="••••••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    style={{ paddingRight: '44px' }}
                    required
                  />
                  <button
                    type="button"
                    className="eye-toggle-btn"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? (
                      <EyeOff size={18} />
                    ) : (
                      <Eye size={18} />
                    )}
                  </button>
                </div>
              </div>

              {/* Right-aligned Forgot password? link directly under password field */}
              {authMode === 'login' && (
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '24px' }}>
                  <span
                    onClick={() => {
                      setAuthMode('forgot_password')
                      setForgotStep(1)
                      setForgotError('')
                      setForgotSuccess('')
                    }}
                    className="interactive-link"
                    style={{ fontSize: '12px', fontWeight: '500', cursor: 'pointer' }}
                  >
                    Forgot password?
                  </span>
                </div>
              )}

              <button
                type="submit"
                disabled={authLoading}
                className="btn-glow-primary"
                style={{ marginTop: authMode === 'signup' ? '12px' : '0' }}
              >
                {authLoading ? (
                  'Authenticating...'
                ) : authMode === 'login' ? (
                  'Sign In to Terminal'
                ) : (
                  'Register Account'
                )}
              </button>
            </form>
          )}

          {/* Centered New user? Register / Sign In toggle link below button */}
          <div style={{ marginTop: '20px', textAlign: 'center', fontSize: '13px', color: '#707a8a' }}>
            {authMode === 'login' ? (
              <>
                New user?{' '}
                <span
                  onClick={() => setAuthMode('signup')}
                  className="interactive-link"
                  style={{ fontWeight: '600', cursor: 'pointer' }}
                >
                  Register
                </span>
              </>
            ) : authMode === 'signup' ? (
              <>
                Already registered?{' '}
                <span
                  onClick={() => setAuthMode('login')}
                  className="interactive-link"
                  style={{ fontWeight: '600', cursor: 'pointer' }}
                >
                  Sign In
                </span>
              </>
            ) : (
              <>
                Remember your password?{' '}
                <span
                  onClick={() => setAuthMode('login')}
                  className="interactive-link"
                  style={{ fontWeight: '600', cursor: 'pointer' }}
                >
                  Sign In
                </span>
              </>
            )}
          </div>
        </div>

        {/* Footer info line */}
        <div style={{ fontSize: '11px', color: '#707a8a', textAlign: 'center' }}>
          Protected by CipherWatch Zero-Knowledge Telemetry
        </div>
      </div>

      {/* Audit Privacy Disclosure Modal */}
      {isPrivacyModalOpen && <PrivacyModal onClose={() => setIsPrivacyModalOpen(false)} />}
    </div>
  )
}
