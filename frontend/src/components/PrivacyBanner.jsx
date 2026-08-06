import React, { useState } from 'react';
import PrivacyModal from './PrivacyModal';

export const PrivacyBanner = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <>
      <div
        style={{
          backgroundColor: 'var(--colors-canvas-dark)',
          borderBottom: '1px solid var(--colors-hairline-on-dark)',
          padding: '10px 32px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: '12px',
          fontFamily: 'var(--font-sans)',
          color: 'var(--colors-body)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '14px', color: 'var(--colors-primary)' }}>🛡️</span>
          <span>
            <strong style={{ color: 'var(--colors-primary)' }}>ZERO-PRIVACY INVASION GUARANTEE:</strong> 0% Payload Inspection • Zero Screen Recording • Disclosed Metadata Only
          </span>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          style={{
            padding: '4px 12px',
            background: 'var(--colors-surface-card-dark)',
            border: '1px solid var(--colors-hairline-on-dark)',
            borderRadius: 'var(--rounded-pill)',
            color: 'var(--colors-primary)',
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
