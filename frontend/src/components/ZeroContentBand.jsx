import React from 'react'

export default function ZeroContentBand() {
  return (
    <section className="zero-content-band" style={{ borderTop: '1px solid var(--colors-hairline-on-dark)', borderBottom: '1px solid var(--colors-hairline-on-dark)', padding: '64px 24px' }}>
      <div style={{ maxWidth: '1000px', margin: '0 auto', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '24px' }}>
        {/* Section Terminal Label */}
        <div className="section-terminal-label" style={{ fontSize: '12px' }}>
          <span>🔒 ZERO-KNOWLEDGE ARCHITECTURE PROOF</span>
        </div>

        {/* Yellow Display-LG Gradient Headline */}
        <h2 className="display-lg text-gradient-primary" style={{ margin: 0 }}>
          ZERO CONTENT. EVER.
        </h2>

        {/* Subtext */}
        <p className="body-md" style={{ color: 'var(--colors-muted-strong)', maxWidth: '720px', fontSize: '15px', lineHeight: '1.6' }}>
          CipherWatch architecture guarantees complete zero-knowledge operation. Our endpoint agents record metadata paths, process hashes, and byte counts — without reading document content, recording screens, or keylogging.
        </p>

        {/* 3 Stat Callout Cards with Zero Counts */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '24px', width: '100%', marginTop: '16px' }}>
          <div className="alert-feed-card" style={{ padding: '28px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
            <div style={{ fontSize: '32px', marginBottom: '4px' }}>📄</div>
            <div className="number-display text-gradient-primary" style={{ fontSize: '54px' }}>0</div>
            <span className="title-sm" style={{ color: 'var(--colors-on-dark)', fontWeight: '700' }}>Files Read</span>
            <span className="body-sm" style={{ color: 'var(--colors-muted-strong)' }}>0% Payload Inspection</span>
          </div>

          <div className="alert-feed-card" style={{ padding: '28px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
            <div style={{ fontSize: '32px', marginBottom: '4px' }}>📸</div>
            <div className="number-display text-gradient-primary" style={{ fontSize: '54px' }}>0</div>
            <span className="title-sm" style={{ color: 'var(--colors-on-dark)', fontWeight: '700' }}>Screens Captured</span>
            <span className="body-sm" style={{ color: 'var(--colors-muted-strong)' }}>Zero Frame Buffer Access</span>
          </div>

          <div className="alert-feed-card" style={{ padding: '28px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
            <div style={{ fontSize: '32px', marginBottom: '4px' }}>⌨️</div>
            <div className="number-display text-gradient-primary" style={{ fontSize: '54px' }}>0</div>
            <span className="title-sm" style={{ color: 'var(--colors-on-dark)', fontWeight: '700' }}>Keystrokes Logged</span>
            <span className="body-sm" style={{ color: 'var(--colors-muted-strong)' }}>No Keylogger Hooking</span>
          </div>
        </div>
      </div>
    </section>
  )
}
