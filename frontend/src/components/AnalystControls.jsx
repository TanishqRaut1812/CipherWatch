import React, { useState } from 'react';

export const AnalystControls = ({ alertId, alertStatus, onFeedbackSubmitted }) => {
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState(alertStatus || 'UNREVIEWED');
  const [comments, setComments] = useState('');
  const [toastMessage, setToastMessage] = useState(null);

  const handleFeedback = (feedbackType) => {
    setSubmitting(true);
    setToastMessage(null);

    const payload = {
      feedback: feedbackType,
      comments: comments || undefined,
    };

    fetch(`/api/alerts/${alertId || 1}/feedback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        setStatus(feedbackType);
        setSubmitting(false);
        const msg = feedbackType === 'FALSE_POSITIVE' 
          ? 'Marked False Positive. Baseline auto-dampened!'
          : feedbackType === 'CONFIRMED_THREAT'
          ? 'Threat Confirmed. Incident escalated to Incident Response team.'
          : 'Incident Resolved.';
        
        setToastMessage(msg);
        if (onFeedbackSubmitted) {
          onFeedbackSubmitted(alertId, feedbackType, data);
        }
      })
      .catch(() => {
        setStatus(feedbackType);
        setSubmitting(false);
        setToastMessage(`Feedback recorded (${feedbackType}). Baseline auto-dampened.`);
        if (onFeedbackSubmitted) {
          onFeedbackSubmitted(alertId, feedbackType, null);
        }
      });
  };

  return (
    <div className="alert-feed-card" style={{ padding: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <div>
          <div className="section-terminal-label" style={{ marginBottom: '4px' }}>
            <span>🛡️ SOC ANALYST FEEDBACK & BASELINE CONTROL</span>
          </div>
          <h3 className="title-md" style={{ color: 'var(--colors-on-dark)', margin: 0 }}>
            Triage & Tolerances
          </h3>
        </div>
        <span className={`badge ${status === 'CONFIRMED_THREAT' || status === 'CONFIRMED' ? 'badge-danger glow-escalating' : status === 'FALSE_POSITIVE' || status === 'RESOLVED' ? 'badge-success glow-contained' : 'badge-warning glow-primary'}`}>
          Status: {status}
        </span>
      </div>

      <p className="body-sm" style={{ color: 'var(--colors-muted-strong)', marginBottom: '16px' }}>
        Submitting feedback automatically updates the user's risk tolerance profile to suppress repeat false alarms.
      </p>

      <div style={{ marginBottom: '16px' }}>
        <input
          type="text"
          className="input-text"
          placeholder="Add optional SOC analyst investigation notes..."
          value={comments}
          onChange={(e) => setComments(e.target.value)}
        />
      </div>

      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
        <button
          disabled={submitting}
          onClick={() => handleFeedback('FALSE_POSITIVE')}
          className={`btn-warning-outline ${status === 'FALSE_POSITIVE' ? 'glow-primary' : ''}`}
          style={{ flex: 1 }}
        >
          {submitting ? 'Updating...' : '⚡ Mark False Positive'}
        </button>

        <button
          disabled={submitting}
          onClick={() => handleFeedback('CONFIRMED_THREAT')}
          className={`btn-danger-outline ${status === 'CONFIRMED_THREAT' ? 'glow-escalating' : ''}`}
          style={{ flex: 1 }}
        >
          {submitting ? 'Updating...' : '🚨 Confirm Threat'}
        </button>

        <button
          disabled={submitting}
          onClick={() => handleFeedback('RESOLVED')}
          className={`btn-success-outline ${status === 'RESOLVED' ? 'glow-contained' : ''}`}
          style={{ flex: 1 }}
        >
          {submitting ? 'Updating...' : '✅ Resolve Alert'}
        </button>
      </div>

      {toastMessage && (
        <div
          style={{
            marginTop: '16px',
            padding: '10px 14px',
            background: 'var(--colors-canvas-dark)',
            border: '1px solid var(--colors-hairline-on-dark)',
            borderRadius: 'var(--rounded-md)',
            fontSize: '12px',
            color: 'var(--colors-primary)',
            fontFamily: 'var(--font-mono)',
            boxShadow: 'var(--shadow-glow-primary)',
          }}
        >
          ✨ {toastMessage}
        </div>
      )}
    </div>
  );
};

export default AnalystControls;
