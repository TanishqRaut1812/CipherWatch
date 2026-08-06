import React from 'react'

export default function FooterLight() {
  return (
    <footer className="footer-light">
      <div style={{ maxWidth: '1280px', margin: '0 auto' }}>
        {/* 6-Column Links Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '32px', marginBottom: '64px' }}>
          <div>
            <h4 className="title-sm" style={{ color: 'var(--colors-body-on-light)', marginBottom: '16px', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Product</h4>
            <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <li><a href="#agent" style={{ color: '#4a5568', textDecoration: 'none', fontSize: '13px' }}>Telemetry Agent</a></li>
              <li><a href="#engine" style={{ color: '#4a5568', textDecoration: 'none', fontSize: '13px' }}>Intent Reconstruction</a></li>
              <li><a href="#rules" style={{ color: '#4a5568', textDecoration: 'none', fontSize: '13px' }}>Threat Rule Engine</a></li>
              <li><a href="#api" style={{ color: '#4a5568', textDecoration: 'none', fontSize: '13px' }}>Integration API</a></li>
            </ul>
          </div>

          <div>
            <h4 className="title-sm" style={{ color: 'var(--colors-body-on-light)', marginBottom: '16px', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Detection</h4>
            <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <li><a href="#exfil" style={{ color: '#4a5568', textDecoration: 'none', fontSize: '13px' }}>Exfiltration Sequences</a></li>
              <li><a href="#anomaly" style={{ color: '#4a5568', textDecoration: 'none', fontSize: '13px' }}>Anomaly Analytics</a></li>
              <li><a href="#risk" style={{ color: '#4a5568', textDecoration: 'none', fontSize: '13px' }}>Longitudinal Risk Chart</a></li>
              <li><a href="#usb" style={{ color: '#4a5568', textDecoration: 'none', fontSize: '13px' }}>USB Storage Watchdog</a></li>
            </ul>
          </div>

          <div>
            <h4 className="title-sm" style={{ color: 'var(--colors-body-on-light)', marginBottom: '16px', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Analysts</h4>
            <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <li><a href="#triage" style={{ color: '#4a5568', textDecoration: 'none', fontSize: '13px' }}>SOC Console Triage</a></li>
              <li><a href="#export" style={{ color: '#4a5568', textDecoration: 'none', fontSize: '13px' }}>Forensic Timeline Export</a></li>
              <li><a href="#fleet" style={{ color: '#4a5568', textDecoration: 'none', fontSize: '13px' }}>Fleet System Admin</a></li>
              <li><a href="#audit" style={{ color: '#4a5568', textDecoration: 'none', fontSize: '13px' }}>Audit Logging</a></li>
            </ul>
          </div>

          <div>
            <h4 className="title-sm" style={{ color: 'var(--colors-body-on-light)', marginBottom: '16px', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Resources</h4>
            <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <li><a href="#docs" style={{ color: '#4a5568', textDecoration: 'none', fontSize: '13px' }}>Documentation</a></li>
              <li><a href="#whitepaper" style={{ color: '#4a5568', textDecoration: 'none', fontSize: '13px' }}>Privacy Whitepaper</a></li>
              <li><a href="#portal" style={{ color: '#4a5568', textDecoration: 'none', fontSize: '13px' }}>Security Portal</a></li>
              <li><a href="#specs" style={{ color: '#4a5568', textDecoration: 'none', fontSize: '13px' }}>API Specs</a></li>
            </ul>
          </div>

          <div>
            <h4 className="title-sm" style={{ color: 'var(--colors-body-on-light)', marginBottom: '16px', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Legal</h4>
            <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <li><a href="#guarantee" style={{ color: '#4a5568', textDecoration: 'none', fontSize: '13px' }}>Privacy Guarantee</a></li>
              <li><a href="#terms" style={{ color: '#4a5568', textDecoration: 'none', fontSize: '13px' }}>Terms of Service</a></li>
              <li><a href="#soc2" style={{ color: '#4a5568', textDecoration: 'none', fontSize: '13px' }}>Compliance & SOC2</a></li>
              <li><a href="#gdpr" style={{ color: '#4a5568', textDecoration: 'none', fontSize: '13px' }}>GDPR Disclosures</a></li>
            </ul>
          </div>

          <div>
            <h4 className="title-sm" style={{ color: 'var(--colors-body-on-light)', marginBottom: '16px', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Community</h4>
            <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <li><a href="#github" style={{ color: '#4a5568', textDecoration: 'none', fontSize: '13px' }}>GitHub Research</a></li>
              <li><a href="#discord" style={{ color: '#4a5568', textDecoration: 'none', fontSize: '13px' }}>Security Discord</a></li>
              <li><a href="#twitter" style={{ color: '#4a5568', textDecoration: 'none', fontSize: '13px' }}>@CipherWatchSec</a></li>
              <li><a href="#contact" style={{ color: '#4a5568', textDecoration: 'none', fontSize: '13px' }}>Contact Security Ops</a></li>
            </ul>
          </div>
        </div>

        {/* Bottom Inversion Bar */}
        <div style={{ paddingTop: '24px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '28px', height: '28px', backgroundColor: '#181a20', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyCenter: 'center', fontWeight: '700', fontSize: '14px', color: 'var(--colors-primary)' }}>
              CW
            </div>
            <span style={{ fontWeight: 700, fontSize: '14px', color: '#181a20' }}>
              CIPHER<span style={{ color: '#d97706' }}>WATCH</span>
            </span>
            <span style={{ fontSize: '12px', color: '#718096', marginLeft: '12px' }}>
              © {new Date().getFullYear()} CipherWatch Inc. Zero-Content Insider Threat Platform.
            </span>
          </div>

          <div style={{ fontSize: '12px', color: '#718096', display: 'flex', gap: '16px' }}>
            <span>🔒 0% Payload Inspection Guarantee</span>
            <span>⚡ Sub-millisecond Rust Agent</span>
          </div>
        </div>
      </div>
    </footer>
  )
}
