import React from 'react'

export default function CtaBandDark({ onActionClick }) {
  return (
    <section style={{ padding: '0 24px 80px', backgroundColor: 'var(--colors-canvas-dark)' }}>
      <div className="container">
        <div className="cta-band-dark">
          <div style={{ maxWidth: '640px' }}>
            <span className="eyebrow-pill" style={{ marginBottom: '16px', display: 'inline-block' }}>ENTERPRISE DEPLOYMENT</span>
            <h2 className="display-sm" style={{ color: 'var(--colors-on-dark)', marginBottom: '12px' }}>
              Deploy non-invasive telemetry across your enterprise in minutes.
            </h2>
            <p className="body-md" style={{ color: 'var(--colors-muted-strong)' }}>
              Single lightweight agent executable. Zero payload inspection. Instant SOC threat sequence visibility.
            </p>
          </div>

          <div>
            <button
              onClick={onActionClick}
              className="btn-primary"
              style={{
                padding: '16px 36px',
                height: '52px',
                fontSize: '15px',
                fontWeight: 700,
                whiteSpace: 'nowrap'
              }}
            >
              Request Enterprise Trial →
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}
