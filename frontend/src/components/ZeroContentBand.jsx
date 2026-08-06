import React from 'react'

export default function ZeroContentBand() {
  return (
    <section className="zero-content-band" style={{ borderTop: '1px solid var(--colors-hairline-on-dark)', borderBottom: '1px solid var(--colors-hairline-on-dark)' }}>
      <div style={{ maxWidth: '1000px', margin: '0 auto', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '32px' }}>
        {/* Yellow Display-LG Headline */}
        <h2 className="display-lg" style={{ color: 'var(--colors-primary)' }}>
          ZERO CONTENT. EVER.
        </h2>

        {/* Subtext */}
        <p className="body-md" style={{ color: 'var(--colors-muted-strong)', maxWidth: '720px', fontSize: '16px', lineHeight: '1.6' }}>
          CipherWatch architecture guarantees complete zero-knowledge operation. Our endpoint agents record metadata paths, process hashes, and byte counts — without reading document content, recording screens, or keylogging.
        </p>

        {/* 3 Stat Callout Cards with Zero Counts */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '32px', width: '100%', marginTop: '24px' }}>
          <div style={{ padding: '24px', backgroundColor: 'var(--colors-surface-card-dark)', borderRadius: 'var(--rounded-xl)', border: '1px solid var(--colors-hairline-on-dark)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
            <div style={{ fontSize: '32px', marginBottom: '4px' }}>📄</div>
            <div className="number-display" style={{ color: 'var(--colors-primary)', fontSize: '48px' }}>0</div>
            <span className="title-sm" style={{ color: 'var(--colors-on-dark)' }}>Files Read</span>
            <span className="body-sm" style={{ color: 'var(--colors-muted)' }}>0% Payload Inspection</span>
          </div>

          <div style={{ padding: '24px', backgroundColor: 'var(--colors-surface-card-dark)', borderRadius: 'var(--rounded-xl)', border: '1px solid var(--colors-hairline-on-dark)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
            <div style={{ fontSize: '32px', marginBottom: '4px' }}>📸</div>
            <div className="number-display" style={{ color: 'var(--colors-primary)', fontSize: '48px' }}>0</div>
            <span className="title-sm" style={{ color: 'var(--colors-on-dark)' }}>Screens Captured</span>
            <span className="body-sm" style={{ color: 'var(--colors-muted)' }}>Zero Frame Buffer Access</span>
          </div>

          <div style={{ padding: '24px', backgroundColor: 'var(--colors-surface-card-dark)', borderRadius: 'var(--rounded-xl)', border: '1px solid var(--colors-hairline-on-dark)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
            <div style={{ fontSize: '32px', marginBottom: '4px' }}>⌨️</div>
            <div className="number-display" style={{ color: 'var(--colors-primary)', fontSize: '48px' }}>0</div>
            <span className="title-sm" style={{ color: 'var(--colors-on-dark)' }}>Keystrokes Logged</span>
            <span className="body-sm" style={{ color: 'var(--colors-muted)' }}>No Keylogger Hooking</span>
          </div>
        </div>
      </div>
    </section>
  )
}
