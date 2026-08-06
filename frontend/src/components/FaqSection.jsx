import React, { useState } from 'react'

export default function FaqSection() {
  const [openIndex, setOpenIndex] = useState(null)

  const faqs = [
    {
      q: 'How does CipherWatch detect insider threats without reading file contents?',
      a: 'CipherWatch monitors low-level OS telemetry metadata including file access frequency, process lineage, encrypted archive creation flags, USB device vendor IDs, and network egress burst rates. By analyzing sequence context rather than reading payload text, CipherWatch flags exfiltration intent while protecting user data privacy.'
    },
    {
      q: 'Is any private employee data or payload file transmitted to the cloud?',
      a: 'Never. CipherWatch agents operate under a mathematical zero-knowledge privacy guarantee. Raw document contents, keystrokes, and screen images remain 100% untouched. Only metadata event records (timestamps, hashes, byte counts, and process names) leave the local endpoint.'
    },
    {
      q: 'How fast does intent reconstruction run on local agent endpoints?',
      a: 'The local Rust-core metadata agent processes OS kernel telemetry in real-time with sub-millisecond overhead (<0.5% CPU utilization). Multi-hop causal sequences are compiled continuously, enabling triage response in under 4 minutes.'
    },
    {
      q: 'Can CipherWatch co-exist with our existing EDR and SIEM solutions?',
      a: 'Yes. CipherWatch is lightweight and designed to operate alongside enterprise EDR solutions (CrowdStrike, Defender, SentinelOne). Telemetry logs can be forwarded to your SIEM via standard syslog or API integrations.'
    },
    {
      q: 'How does the SOC analyst feedback loop prevent repeat false positives?',
      a: 'When an analyst marks an alert as FALSE_POSITIVE, CipherWatch auto-adjusts the user baseline model for that specific sequence, dampening false alarms across similar developer or admin workloads.'
    }
  ]

  const toggleFaq = (index) => {
    setOpenIndex(openIndex === index ? null : index)
  }

  return (
    <section style={{ padding: '80px 24px', backgroundColor: 'var(--colors-canvas-dark)' }}>
      <div style={{ maxWidth: '900px', margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: '48px' }}>
          <span className="eyebrow-pill" style={{ marginBottom: '12px' }}>EXPLAINABILITY & PRIVACY</span>
          <h2 className="display-sm" style={{ color: 'var(--colors-on-dark)', marginTop: '8px' }}>
            Frequently Asked Security Questions
          </h2>
        </div>

        <div style={{ borderTop: '1px solid var(--colors-hairline-on-dark)' }}>
          {faqs.map((faq, idx) => {
            const isOpen = openIndex === idx
            return (
              <div key={idx} className="faq-row" onClick={() => toggleFaq(idx)}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h3 className="title-sm" style={{ color: 'var(--colors-on-dark)', margin: 0 }}>
                    {faq.q}
                  </h3>
                  <span style={{
                    fontSize: '14px',
                    color: 'var(--colors-primary)',
                    transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                    transition: 'transform 0.2s ease'
                  }}>
                    ▼
                  </span>
                </div>

                {isOpen && (
                  <p className="body-sm" style={{ color: 'var(--colors-muted-strong)', marginTop: '14px', lineHeight: '1.6' }}>
                    {faq.a}
                  </p>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
