import React from 'react';

export const PrivacyModal = ({ onClose }) => {
  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(11, 14, 17, 0.88)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1000,
        padding: '20px',
      }}
    >
      <div
        className="alert-feed-card"
        style={{
          width: '100%',
          maxWidth: '620px',
          padding: '32px',
          backgroundColor: 'var(--colors-surface-card-dark)',
          border: '1px solid var(--colors-hairline-on-dark)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2 className="title-lg" style={{ color: 'var(--colors-on-dark)', margin: 0 }}>
            🛡️ Privacy Audit & Data Collection Disclosures
          </h2>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--colors-muted)',
              fontSize: '20px',
              cursor: 'pointer',
            }}
          >
            ✕
          </button>
        </div>

        <p className="body-sm" style={{ color: 'var(--colors-muted-strong)', marginBottom: '24px', lineHeight: '1.6' }}>
          CipherWatch operates strictly on a <strong>disclosed surveillance and metadata-only architecture</strong>.
          Our endpoint agents analyze structural event patterns without inspecting raw payloads or private user content.
        </p>

        {/* Never Collected Section */}
        <div style={{ marginBottom: '24px' }}>
          <h3 className="title-sm" style={{ color: 'var(--colors-risk-escalating)', marginBottom: '12px' }}>
            🚫 NEVER COLLECTED (Zero Ingestion Policy)
          </h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {[
              'File Contents & Documents',
              'Screen Renders & Image Pixels',
              'Keystrokes & Typing Log',
              'Email & Instant Messaging Body Text',
              'Microphone Audio & Webcam Video',
              'Browser History & Form Passwords',
            ].map((item, idx) => (
              <span
                key={idx}
                className="badge badge-danger"
              >
                ✕ {item}
              </span>
            ))}
          </div>
        </div>

        {/* Metadata Only Collected Section */}
        <div style={{ marginBottom: '28px' }}>
          <h3 className="title-sm" style={{ color: 'var(--colors-risk-contained)', marginBottom: '12px' }}>
            ✅ METADATA ONLY (Disclosed Telemetry)
          </h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {[
              'File Extensions & Size (bytes)',
              'Process Execution Names & Hashes',
              'Network Destination IP/Domain & Port',
              'USB Vendor ID & Device Mount Point',
              'Session Timestamps & Event Frequencies',
            ].map((item, idx) => (
              <span
                key={idx}
                className="badge badge-success"
              >
                ✓ {item}
              </span>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            className="btn-primary"
          >
            Acknowledge & Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default PrivacyModal;
