import React, { useState } from 'react'
import { Shield } from 'lucide-react'

export default function HeroBand({ onSearch }) {
  const [query, setQuery] = useState('')

  const handleSearchSubmit = (e) => {
    e.preventDefault()
    if (onSearch) {
      onSearch(query)
    }
  }

  return (
    <section style={{ backgroundColor: 'var(--colors-canvas-dark)', padding: '80px 24px 60px', borderBottom: '1px solid var(--colors-hairline-on-dark)' }}>
      <div style={{ maxWidth: '1100px', margin: '0 auto', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '28px' }}>
        {/* Eyebrow Pill */}
        <div>
          <span className="eyebrow-pill" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <Shield size={14} color="var(--colors-primary)" /> METADATA-ONLY · ZERO CONTENT ACCESS
          </span>
        </div>

        {/* Display Headline */}
        <h1 className="hero-display" style={{ maxWidth: '900px' }}>
          See the exfiltration. <span style={{ color: 'var(--colors-primary)' }}>Never the content.</span>
        </h1>

        {/* Subtitle */}
        <p className="body-md" style={{ color: 'var(--colors-muted-strong)', maxWidth: '680px', fontSize: '16px', lineHeight: '1.6' }}>
          Real-time insider threat telemetry powered by non-invasive metadata intent reconstruction. Full sequence visibility without reading user payload data.
        </p>

        {/* Search Bar (search-input-on-dark) */}
        <form onSubmit={handleSearchSubmit} style={{ display: 'flex', width: '100%', maxWidth: '640px', marginTop: '12px' }}>
          <input
            type="text"
            className="search-input-on-dark"
            placeholder="Search session ID, endpoint hostname, or user hash..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{
              flex: 1,
              height: '48px',
              backgroundColor: 'var(--colors-surface-card-dark)',
              border: '1px solid var(--colors-hairline-on-dark)',
              borderRight: 'none',
              borderRadius: 'var(--rounded-lg) 0 0 var(--rounded-lg)',
              color: 'var(--colors-on-dark)',
              padding: '0 20px',
              fontSize: '14px',
              outline: 'none',
            }}
          />
          <button
            type="submit"
            className="btn-primary-pill"
            style={{
              height: '48px',
              borderRadius: '0 var(--rounded-lg) var(--rounded-lg) 0',
              padding: '0 28px',
              fontSize: '14px',
              fontWeight: 700,
            }}
          >
            Investigate
          </button>
        </form>

        {/* Trust Badge Row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px', width: '100%', maxWidth: '900px', marginTop: '32px' }}>
          <div className="trust-badge" style={{ textAlign: 'left' }}>
            <span className="number-display" style={{ color: 'var(--colors-primary)', fontSize: '32px' }}>&lt; 4 min</span>
            <span className="body-sm" style={{ color: 'var(--colors-muted-strong)', fontWeight: 500 }}>Mean Triage Time</span>
          </div>

          <div className="trust-badge" style={{ textAlign: 'left' }}>
            <span className="number-display" style={{ color: 'var(--colors-primary)', fontSize: '32px' }}>0 Bytes</span>
            <span className="body-sm" style={{ color: 'var(--colors-muted-strong)', fontWeight: 500 }}>Payload Storage</span>
          </div>

          <div className="trust-badge" style={{ textAlign: 'left' }}>
            <span className="number-display" style={{ color: 'var(--colors-primary)', fontSize: '32px' }}>No. 1</span>
            <span className="body-sm" style={{ color: 'var(--colors-muted-strong)', fontWeight: 500 }}>Privacy Guarantee</span>
          </div>
        </div>
      </div>
    </section>
  )
}
