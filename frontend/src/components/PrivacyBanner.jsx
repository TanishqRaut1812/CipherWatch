import React, { useState } from 'react';
import { Shield, Search } from 'lucide-react';
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
          <Shield size={16} color="var(--colors-primary)" />
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
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          <Search size={12} /> Audit Privacy Policy & Disclosures
        </button>
      </div>

      {isModalOpen && <PrivacyModal onClose={() => setIsModalOpen(false)} />}
    </>
  );
};

export default PrivacyBanner;
