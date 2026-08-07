import React, { useState, useEffect, useRef } from 'react';
import { 
  Zap, 
  ShieldAlert, 
  Clock, 
  TrendingUp, 
  AlertTriangle, 
  CheckCircle, 
  Activity, 
  Terminal, 
  ArrowRight,
  Layers,
  Flame,
  Play,
  RotateCw
} from 'lucide-react';

export default function PredictiveBehaviorWidget({ orgId, agentId }) {
  const [sessions, setSessions] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedSessionId, setSelectedSessionId] = useState(null);
  const [simulating, setSimulating] = useState(false);
  const [activeTab, setActiveTab] = useState('sessions'); // 'sessions' | 'simulate' | 'templates'

  const inFlightSessionsRef = useRef(false);
  const inFlightTemplatesRef = useRef(false);

  // 1. Fetch static templates ONCE on mount
  const fetchTemplates = async () => {
    if (inFlightTemplatesRef.current) return;
    inFlightTemplatesRef.current = true;
    try {
      const token = localStorage.getItem('token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const resTpl = await fetch('/api/behavioral-sessions/templates', { headers });
      if (resTpl.ok) {
        const dataTpl = await resTpl.json();
        setTemplates(dataTpl.templates || []);
      }
    } catch (err) {
      console.error("Failed to fetch behavior templates:", err);
    } finally {
      inFlightTemplatesRef.current = false;
    }
  };

  // 2. Fetch active sessions (polled every 5s)
  const fetchSessions = async () => {
    if (inFlightSessionsRef.current) return;
    inFlightSessionsRef.current = true;
    try {
      const token = localStorage.getItem('token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      let sessUrl = '/api/behavioral-sessions/active';
      const params = new URLSearchParams();
      if (orgId) params.append('org_id', orgId);
      if (agentId) params.append('agent_id', agentId);
      if (params.toString()) sessUrl += `?${params.toString()}`;

      const resSess = await fetch(sessUrl, { headers });
      if (resSess.ok) {
        const data = await resSess.json();
        setSessions(data.sessions || []);
        if (data.sessions && data.sessions.length > 0 && !selectedSessionId) {
          setSelectedSessionId(data.sessions[0].session_id);
        }
      }
    } catch (err) {
      console.error("Failed to fetch predictive active sessions:", err);
    } finally {
      setLoading(false);
      inFlightSessionsRef.current = false;
    }
  };

  // Fetch static templates ONCE on mount
  useEffect(() => {
    fetchTemplates();
  }, []);

  // Poll active sessions every 5s
  useEffect(() => {
    fetchSessions();
    const interval = setInterval(fetchSessions, 5000); // Auto refresh active sessions every 5s
    return () => clearInterval(interval);
  }, [orgId, agentId]);

  // Simulate synthetic attack stage event
  const triggerSimulationEvent = async (templateId, stageNum) => {
    setSimulating(true);
    try {
      const token = localStorage.getItem('token');
      const tpl = templates.find(t => t.id === templateId);
      if (!tpl || !tpl.stages[stageNum - 1]) return;

      const stageSpec = tpl.stages[stageNum - 1];
      let syntheticEvent = {
        event_type: stageSpec.event_type || 'process_event',
        agent_id: agentId || 'agent_demo_01',
        user_id: 'john.doe',
        org_id: orgId,
        device_id: agentId || 'agent_demo_01',
        action: stageSpec.matcher.action ? stageSpec.matcher.action[0] : 'execution',
        cmdline: stageSpec.matcher.cmdline_keywords ? stageSpec.matcher.cmdline_keywords[0] : 'python run.py',
        src_path: stageSpec.matcher.path_keywords ? `/home/john/${stageSpec.matcher.path_keywords[0]}/data.zip` : '/tmp/stage.bin'
      };

      const res = await fetch('/api/behavioral-sessions/simulate-event', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(syntheticEvent)
      });

      if (res.ok) {
        await fetchSessions();
      }
    } catch (err) {
      console.error("Simulation error:", err);
    } finally {
      setSimulating(false);
    }
  };

  const selectedSession = sessions.find(s => s.session_id === selectedSessionId) || sessions[0];

  const getRiskBadgeStyle = (score) => {
    if (score >= 80) return { color: '#f6465d', backgroundColor: 'rgba(246, 70, 93, 0.15)', border: '1px solid rgba(246, 70, 93, 0.4)' };
    if (score >= 50) return { color: '#fcd535', backgroundColor: 'rgba(252, 213, 53, 0.15)', border: '1px solid rgba(252, 213, 53, 0.4)' };
    if (score >= 20) return { color: '#fbbf24', backgroundColor: 'rgba(251, 191, 36, 0.15)', border: '1px solid rgba(251, 191, 36, 0.4)' };
    return { color: '#0ecb81', backgroundColor: 'rgba(14, 203, 129, 0.15)', border: '1px solid rgba(14, 203, 129, 0.4)' };
  };

  return (
    <div style={{
      backgroundColor: 'var(--colors-surface-card-dark, #0d111a)',
      border: '1px solid var(--colors-hairline-on-dark, #1e293b)',
      borderRadius: '14px',
      padding: '24px',
      boxShadow: '0 10px 30px rgba(0, 0, 0, 0.4)',
      color: '#f8fafc',
      marginBottom: '24px',
      fontFamily: 'Inter, system-ui, -apple-system, sans-serif'
    }}>
      {/* HEADER BAR */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingBottom: '16px',
        marginBottom: '20px',
        borderBottom: '1px solid #1e293b',
        gap: '16px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            padding: '10px',
            backgroundColor: 'rgba(252, 213, 53, 0.12)',
            border: '1px solid rgba(252, 213, 53, 0.3)',
            borderRadius: '10px',
            color: '#fcd535',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Zap size={22} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '800', color: '#ffffff', letterSpacing: '-0.01em' }}>
                Predictive Behavior Detection Engine
              </h2>
              <span style={{
                fontSize: '10px',
                padding: '3px 8px',
                borderRadius: '20px',
                backgroundColor: 'rgba(14, 203, 129, 0.12)',
                color: '#0ecb81',
                border: '1px solid rgba(14, 203, 129, 0.3)',
                fontWeight: '800',
                letterSpacing: '0.05em',
                textTransform: 'uppercase'
              }}>
                Deterministic FSM
              </span>
            </div>
            <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#64748b' }}>
              Session Reconstruction • Dynamic Risk & Confidence • Future Step Prediction
            </p>
          </div>
        </div>

        {/* CONTROLS & TAB TOGGLES */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            display: 'flex',
            backgroundColor: '#070a12',
            padding: '4px',
            borderRadius: '8px',
            border: '1px solid #1e293b'
          }}>
            <button
              onClick={() => setActiveTab('sessions')}
              style={{
                padding: '6px 14px',
                fontSize: '12px',
                fontWeight: '700',
                borderRadius: '6px',
                backgroundColor: activeTab === 'sessions' ? '#fcd535' : 'transparent',
                color: activeTab === 'sessions' ? '#000000' : '#94a3b8',
                border: 'none',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
            >
              Active Sessions ({sessions.length})
            </button>
            <button
              onClick={() => setActiveTab('simulate')}
              style={{
                padding: '6px 14px',
                fontSize: '12px',
                fontWeight: '700',
                borderRadius: '6px',
                backgroundColor: activeTab === 'simulate' ? '#fcd535' : 'transparent',
                color: activeTab === 'simulate' ? '#000000' : '#94a3b8',
                border: 'none',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
            >
              Simulate Attack Chain
            </button>
            <button
              onClick={() => setActiveTab('templates')}
              style={{
                padding: '6px 14px',
                fontSize: '12px',
                fontWeight: '700',
                borderRadius: '6px',
                backgroundColor: activeTab === 'templates' ? '#fcd535' : 'transparent',
                color: activeTab === 'templates' ? '#000000' : '#94a3b8',
                border: 'none',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
            >
              Templates ({templates.length})
            </button>
          </div>

          <button
            onClick={fetchSessions}
            style={{
              padding: '8px',
              backgroundColor: '#1e293b',
              color: '#cbd5e1',
              borderRadius: '8px',
              border: '1px solid #334155',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            title="Refresh Data"
          >
            <RotateCw size={16} />
          </button>
        </div>
      </div>

      {/* TAB 1: ACTIVE SESSIONS */}
      {activeTab === 'sessions' && (
        <>
          {sessions.length === 0 ? (
            <div style={{
              backgroundColor: '#070a12',
              border: '1px solid #1e293b',
              borderRadius: '12px',
              padding: '40px 24px',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <ShieldAlert size={48} style={{ color: '#0ecb81', opacity: 0.8, marginBottom: '12px' }} />
              <h3 style={{ margin: '0 0 6px 0', fontSize: '16px', fontWeight: '700', color: '#f8fafc' }}>
                No Active Attack Sessions Detected
              </h3>
              <p style={{ margin: '0 0 18px 0', fontSize: '13px', color: '#64748b', maxWidth: '480px', lineHeight: '1.5' }}>
                Telemetry streams are clean. No multi-stage attack patterns are currently reconstructing in memory.
              </p>
              <button
                onClick={() => setActiveTab('simulate')}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#fcd535',
                  color: '#000000',
                  fontWeight: '800',
                  fontSize: '12px',
                  borderRadius: '8px',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  boxShadow: '0 4px 14px rgba(252, 213, 53, 0.25)'
                }}
              >
                <Play size={14} fill="#000000" />
                Launch Attack Simulation Test
              </button>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: '20px' }}>
              {/* SESSION SELECTOR SIDEBAR (4/12) */}
              <div style={{ gridColumn: 'span 4', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <h3 style={{ margin: '0 0 4px 0', fontSize: '11px', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Tracked Behavioral Sessions
                </h3>
                {sessions.map((s) => (
                  <div
                    key={s.session_id}
                    onClick={() => setSelectedSessionId(s.session_id)}
                    style={{
                      padding: '14px',
                      borderRadius: '10px',
                      border: selectedSessionId === s.session_id ? '1px solid #fcd535' : '1px solid #1e293b',
                      backgroundColor: selectedSessionId === s.session_id ? '#182030' : '#070a12',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <span style={{ fontSize: '13px', fontFamily: 'monospace', fontWeight: '800', color: '#fcd535' }}>
                        {s.template_name}
                      </span>
                      <span style={{
                        fontSize: '10px',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        fontWeight: '800',
                        fontFamily: 'monospace',
                        ...getRiskBadgeStyle(s.risk_score)
                      }}>
                        RISK {s.risk_score}
                      </span>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', color: '#94a3b8', marginBottom: '8px' }}>
                      <span>User: <strong style={{ color: '#f8fafc' }}>{s.user_id}</strong></span>
                      <span style={{ fontSize: '11px', fontFamily: 'monospace', color: '#64748b' }}>
                        Stage {s.current_stage}/{s.total_stages}
                      </span>
                    </div>

                    {/* STAGE PROGRESS BAR */}
                    <div style={{ width: '100%', backgroundColor: '#070a12', borderRadius: '4px', height: '6px', overflow: 'hidden', border: '1px solid #1e293b' }}>
                      <div
                        style={{
                          height: '100%',
                          background: 'linear-gradient(90deg, #fcd535, #f6465d)',
                          width: `${(s.current_stage / s.total_stages) * 100}%`,
                          transition: 'width 0.4s ease'
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>

              {/* DETAILED SESSION VIEW (8/12) */}
              {selectedSession && (
                <div style={{ gridColumn: 'span 8', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {/* PREDICTIVE HIGHLIGHT CARD */}
                  <div style={{
                    background: 'linear-gradient(135deg, #070a12 0%, #121824 100%)',
                    border: '1px solid rgba(252, 213, 53, 0.3)',
                    borderRadius: '12px',
                    padding: '20px',
                    position: 'relative'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Flame size={16} color="#fcd535" />
                          <span style={{ fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', color: '#fcd535', letterSpacing: '0.05em' }}>
                            Predictive Engine Forecast
                          </span>
                        </div>
                        <h3 style={{ margin: '6px 0 0 0', fontSize: '17px', fontWeight: '800', color: '#ffffff' }}>
                          Next Predicted Step: <span style={{ color: '#fcd535' }}>{selectedSession.predicted_next_action}</span>
                        </h3>
                      </div>

                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '24px', fontWeight: '900', color: '#fcd535', fontFamily: 'monospace' }}>
                          {selectedSession.predicted_probability}%
                        </div>
                        <div style={{ fontSize: '10px', color: '#64748b', textTransform: 'uppercase', fontFamily: 'monospace' }}>
                          Probability Confidence
                        </div>
                      </div>
                    </div>

                    {/* METRICS ROW */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', paddingTop: '14px', borderTop: '1px solid #1e293b' }}>
                      <div style={{ backgroundColor: '#070a12', padding: '10px 12px', borderRadius: '8px', border: '1px solid #1e293b' }}>
                        <span style={{ fontSize: '10px', textTransform: 'uppercase', color: '#64748b', display: 'block', marginBottom: '2px' }}>Current Risk Score</span>
                        <span style={{ fontSize: '15px', fontWeight: '800', fontFamily: 'monospace', color: selectedSession.risk_score >= 80 ? '#f6465d' : '#fcd535' }}>
                          {selectedSession.risk_score} / 100
                        </span>
                      </div>
                      <div style={{ backgroundColor: '#070a12', padding: '10px 12px', borderRadius: '8px', border: '1px solid #1e293b' }}>
                        <span style={{ fontSize: '10px', textTransform: 'uppercase', color: '#64748b', display: 'block', marginBottom: '2px' }}>FSM Pattern Confidence</span>
                        <span style={{ fontSize: '15px', fontWeight: '800', fontFamily: 'monospace', color: '#38bdf8' }}>
                          {selectedSession.confidence_score}% Match
                        </span>
                      </div>
                      <div style={{ backgroundColor: '#070a12', padding: '10px 12px', borderRadius: '8px', border: '1px solid #1e293b' }}>
                        <span style={{ fontSize: '10px', textTransform: 'uppercase', color: '#64748b', display: 'block', marginBottom: '2px' }}>Estimated Time Window</span>
                        <span style={{ fontSize: '15px', fontWeight: '800', fontFamily: 'monospace', color: '#0ecb81', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Clock size={14} />
                          {selectedSession.estimated_time_seconds > 0 ? `~${selectedSession.estimated_time_seconds}s` : 'Immediate'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* MITRE ATT&CK MAPPER CHAIN */}
                  <div style={{ backgroundColor: '#070a12', border: '1px solid #1e293b', borderRadius: '12px', padding: '16px' }}>
                    <h4 style={{ margin: '0 0 12px 0', fontSize: '11px', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Layers size={14} color="#38bdf8" />
                      MITRE ATT&CK Technique Sequence Mapping
                    </h4>
                    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px' }}>
                      {selectedSession.mitre_techniques && selectedSession.mitre_techniques.length > 0 ? (
                        selectedSession.mitre_techniques.map((m, idx) => (
                          <React.Fragment key={idx}>
                            <div style={{ backgroundColor: '#121824', border: '1px solid rgba(56, 189, 248, 0.3)', padding: '6px 12px', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span style={{ fontFamily: 'monospace', fontWeight: '800', fontSize: '12px', color: '#38bdf8' }}>{m.technique_id}</span>
                              <span style={{ fontSize: '12px', color: '#e2e8f0', fontWeight: '600' }}>{m.technique_name}</span>
                            </div>
                            {idx < selectedSession.mitre_techniques.length - 1 && (
                              <ArrowRight size={14} color="#64748b" />
                            )}
                          </React.Fragment>
                        ))
                      ) : (
                        <span style={{ fontSize: '12px', color: '#64748b', fontStyle: 'italic' }}>No MITRE techniques logged yet.</span>
                      )}
                    </div>
                  </div>

                  {/* RECENT EVENT LOGS FOR THIS SESSION */}
                  <div style={{ backgroundColor: '#070a12', border: '1px solid #1e293b', borderRadius: '12px', padding: '16px' }}>
                    <h4 style={{ margin: '0 0 12px 0', fontSize: '11px', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Terminal size={14} color="#fcd535" />
                      Reconstructed Activity Log Stream
                    </h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '180px', overflowY: 'auto' }}>
                      {selectedSession.recent_events && selectedSession.recent_events.map((ev, idx) => (
                        <div key={idx} style={{ backgroundColor: '#121824', padding: '8px 12px', borderRadius: '6px', border: '1px solid #1e293b', fontFamily: 'monospace', fontSize: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <span style={{ color: '#fcd535', fontWeight: '700', marginRight: '8px' }}>[{ev.event_type}]</span>
                            <span style={{ color: '#e2e8f0' }}>{ev.desc}</span>
                          </div>
                          <span style={{ fontSize: '10px', color: '#64748b' }}>{ev.note}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* TAB 2: SIMULATE ATTACK CHAIN */}
      {activeTab === 'simulate' && (
        <div style={{ backgroundColor: '#070a12', border: '1px solid #1e293b', borderRadius: '12px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '800', color: '#ffffff', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Play size={16} color="#fcd535" />
              Interactive Attack Sequence Simulator
            </h3>
            <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#64748b' }}>
              Select a scenario and click sequential stages to fire synthetic telemetry into the engine. Watch the Finite State Machine reconstruct the session live!
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}>
            {templates.map((tpl) => (
              <div key={tpl.id} style={{ backgroundColor: '#121824', border: '1px solid #1e293b', borderRadius: '10px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div>
                  <h4 style={{ margin: 0, fontSize: '14px', fontWeight: '800', color: '#fcd535' }}>{tpl.name}</h4>
                  <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#94a3b8' }}>{tpl.description}</p>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', paddingTop: '4px' }}>
                  {tpl.stages.map((stg) => (
                    <div key={stg.stage} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#070a12', padding: '8px 12px', borderRadius: '8px', border: '1px solid #1e293b' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ width: '22px', height: '22px', borderRadius: '50%', backgroundColor: 'rgba(252, 213, 53, 0.12)', color: '#fcd535', fontFamily: 'monospace', fontSize: '11px', fontWeight: '800', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(252, 213, 53, 0.3)' }}>
                          {stg.stage}
                        </span>
                        <div>
                          <span style={{ fontSize: '12px', fontWeight: '700', color: '#f8fafc', display: 'block' }}>{stg.name}</span>
                          <span style={{ fontSize: '10px', fontFamily: 'monospace', color: '#38bdf8' }}>{stg.mitre?.technique_id} • {stg.mitre?.technique_name}</span>
                        </div>
                      </div>

                      <button
                        disabled={simulating}
                        onClick={() => triggerSimulationEvent(tpl.id, stg.stage)}
                        style={{
                          padding: '4px 10px',
                          backgroundColor: '#fcd535',
                          color: '#000000',
                          fontSize: '11px',
                          fontWeight: '800',
                          borderRadius: '6px',
                          border: 'none',
                          cursor: 'pointer',
                          opacity: simulating ? 0.5 : 1
                        }}
                      >
                        Fire Stage {stg.stage}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: BEHAVIOR TEMPLATES LIST */}
      {activeTab === 'templates' && (
        <div style={{ backgroundColor: '#070a12', border: '1px solid #1e293b', borderRadius: '12px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '800', color: '#ffffff', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Layers size={16} color="#38bdf8" />
            Loaded Behavior Templates JSON Definitions
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '14px' }}>
            {templates.map((t) => (
              <div key={t.id} style={{ backgroundColor: '#121824', border: '1px solid #1e293b', padding: '14px', borderRadius: '10px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '12px', fontFamily: 'monospace', fontWeight: '800', color: '#fcd535' }}>{t.id}</span>
                  <span style={{ fontSize: '10px', fontFamily: 'monospace', color: '#64748b' }}>{t.stages.length} Stages</span>
                </div>
                <h4 style={{ margin: 0, fontSize: '13px', fontWeight: '800', color: '#ffffff' }}>{t.name}</h4>
                <p style={{ margin: 0, fontSize: '12px', color: '#94a3b8' }}>{t.description}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
