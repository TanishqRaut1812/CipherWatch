import React, { useState } from 'react';
import PrivacyModal from './PrivacyModal';

export const PrivacyBanner = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <>
      <div
        style={{
          background: 'var(--surface-soft)',
          borderBottom: '1px solid var(--border-subtle)',
          padding: '10px 24px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: '12px',
          fontFamily: 'var(--font-sans)',
          color: 'var(--text-primary)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '14px' }}>🛡️</span>
          <span>
            <strong>ZERO-PRIVACY INVASION GUARANTEE:</strong> 0% Payload Inspection • Zero Screen Recording • Disclosed Telemetry Metadata Only
          </span>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          style={{
            padding: '4px 12px',
            background: 'rgba(59, 130, 246, 0.1)',
            border: '1px solid rgba(59, 130, 246, 0.3)',
            borderRadius: 'var(--radius-pill)',
            color: 'var(--primary-blue)',
            fontSize: '11px',
            fontWeight: '600',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
        >
          🔍 Audit Privacy Policy & Disclosures
        </button>
      </div>

      {isModalOpen && <PrivacyModal onClose={() => setIsModalOpen(false)} />}
    </>
  );
};

export default PrivacyBanner;
