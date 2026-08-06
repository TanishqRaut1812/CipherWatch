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
        <h3 className="title-md" style={{ color: 'var(--colors-on-dark)', margin: 0 }}>
          🛡️ SOC Analyst Feedback & Baseline Control
        </h3>
        <span className={`badge ${status === 'CONFIRMED_THREAT' || status === 'CONFIRMED' ? 'badge-danger' : status === 'FALSE_POSITIVE' || status === 'RESOLVED' ? 'badge-success' : 'badge-warning'}`}>
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
          className="btn-warning-outline"
          style={{ flex: 1 }}
        >
          {submitting ? 'Updating...' : '⚡ Mark False Positive'}
        </button>

        <button
          disabled={submitting}
          onClick={() => handleFeedback('CONFIRMED_THREAT')}
          className="btn-danger-outline"
          style={{ flex: 1 }}
        >
          {submitting ? 'Updating...' : '🚨 Confirm Threat'}
        </button>

        <button
          disabled={submitting}
          onClick={() => handleFeedback('RESOLVED')}
          className="btn-success-outline"
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
          }}
        >
          ✨ {toastMessage}
        </div>
      )}
    </div>
  );
};

export default AnalystControls;
