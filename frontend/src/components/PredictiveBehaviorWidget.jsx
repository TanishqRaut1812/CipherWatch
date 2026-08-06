import React, { useState, useEffect } from 'react';
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

  // Fetch active sessions & templates
  const fetchBehaviorData = async () => {
    try {
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };

      // 1. Get active behavioral sessions
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

      // 2. Get templates
      const resTpl = await fetch('/api/behavioral-sessions/templates', { headers });
      if (resTpl.ok) {
        const dataTpl = await resTpl.json();
        setTemplates(dataTpl.templates || []);
      }
    } catch (err) {
      console.error("Failed to fetch predictive behavior data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBehaviorData();
    const interval = setInterval(fetchBehaviorData, 5000); // Auto refresh every 5s
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
        await fetchBehaviorData();
      }
    } catch (err) {
      console.error("Simulation error:", err);
    } finally {
      setSimulating(false);
    }
  };

  const selectedSession = sessions.find(s => s.session_id === selectedSessionId) || sessions[0];

  const getRiskColorClass = (score) => {
    if (score >= 80) return 'text-red-500 bg-red-500/10 border-red-500/30';
    if (score >= 50) return 'text-amber-500 bg-amber-500/10 border-amber-500/30';
    if (score >= 20) return 'text-yellow-400 bg-yellow-400/10 border-yellow-400/30';
    return 'text-emerald-400 bg-emerald-400/10 border-emerald-400/30';
  };

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6 shadow-2xl text-neutral-100 font-sans">
      {/* HEADER BAR */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center pb-5 mb-6 border-b border-neutral-800 gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-500/10 border border-amber-500/30 rounded-lg text-amber-400">
              <Zap className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white tracking-wide flex items-center gap-2">
                Predictive Behavior Detection Engine
                <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 uppercase tracking-widest font-mono">
                  Deterministic FSM
                </span>
              </h2>
              <p className="text-xs text-neutral-400 mt-0.5">
                Session Reconstruction • Dynamic Risk & Confidence • Future Step Prediction
              </p>
            </div>
          </div>
        </div>

        {/* CONTROLS & TAB TOGGLES */}
        <div className="flex items-center gap-2">
          <div className="flex bg-neutral-950 p-1 rounded-lg border border-neutral-800">
            <button
              onClick={() => setActiveTab('sessions')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                activeTab === 'sessions'
                  ? 'bg-amber-500 text-black shadow-md'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              Active Sessions ({sessions.length})
            </button>
            <button
              onClick={() => setActiveTab('simulate')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                activeTab === 'simulate'
                  ? 'bg-amber-500 text-black shadow-md'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              Simulate Attack Chain
            </button>
            <button
              onClick={() => setActiveTab('templates')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                activeTab === 'templates'
                  ? 'bg-amber-500 text-black shadow-md'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              Templates ({templates.length})
            </button>
          </div>

          <button
            onClick={fetchBehaviorData}
            className="p-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-lg transition-all border border-neutral-700"
            title="Refresh Data"
          >
            <RotateCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* TAB 1: ACTIVE SESSIONS */}
      {activeTab === 'sessions' && (
        <>
          {sessions.length === 0 ? (
            <div className="bg-neutral-950 border border-neutral-800 rounded-xl p-10 text-center">
              <ShieldAlert className="w-12 h-12 text-emerald-500/50 mx-auto mb-3" />
              <h3 className="text-base font-semibold text-neutral-300">No Active Attack Sessions Detected</h3>
              <p className="text-xs text-neutral-500 max-w-md mx-auto mt-1">
                Telemetry streams are clean. No multi-stage attack patterns are currently reconstructing in memory.
              </p>
              <button
                onClick={() => setActiveTab('simulate')}
                className="mt-4 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs rounded-lg transition-all inline-flex items-center gap-2"
              >
                <Play className="w-3.5 h-3.5" />
                Launch Attack Simulation Test
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* SESSION SELECTOR SIDEBAR (4/12) */}
              <div className="lg:col-span-4 space-y-3">
                <h3 className="text-xs font-bold text-neutral-400 uppercase tracking-wider mb-2">
                  Tracked Behavioral Sessions
                </h3>
                {sessions.map((s) => (
                  <div
                    key={s.session_id}
                    onClick={() => setSelectedSessionId(s.session_id)}
                    className={`p-4 rounded-xl border cursor-pointer transition-all ${
                      selectedSessionId === s.session_id
                        ? 'bg-neutral-800 border-amber-500/60 shadow-lg'
                        : 'bg-neutral-950/60 border-neutral-800 hover:border-neutral-700 hover:bg-neutral-950'
                    }`}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-xs font-mono font-bold text-amber-400">
                        {s.template_name}
                      </span>
                      <span className={`text-[10px] px-2 py-0.5 rounded font-mono font-bold border ${getRiskColorClass(s.risk_score)}`}>
                        RISK {s.risk_score}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs text-neutral-400 mb-2">
                      <span>User: <strong className="text-neutral-200">{s.user_id}</strong></span>
                      <span className="font-mono text-neutral-500 text-[11px]">
                        Stage {s.current_stage}/{s.total_stages}
                      </span>
                    </div>

                    {/* STAGE PROGRESS BAR */}
                    <div className="w-full bg-neutral-900 rounded-full h-1.5 overflow-hidden border border-neutral-800">
                      <div
                        className="h-full bg-gradient-to-r from-amber-500 to-red-500 transition-all duration-500"
                        style={{ width: `${(s.current_stage / s.total_stages) * 100}%` }}
                      ></div>
                    </div>
                  </div>
                ))}
              </div>

              {/* DETAILED SESSION VIEW (8/12) */}
              {selectedSession && (
                <div className="lg:col-span-8 space-y-5">
                  {/* PREDICTIVE HIGHLIGHT CARD */}
                  <div className="bg-gradient-to-r from-neutral-950 via-neutral-900 to-neutral-950 border border-amber-500/30 rounded-xl p-5 relative overflow-hidden">
                    <div className="absolute -top-10 -right-10 w-32 h-32 bg-amber-500/10 rounded-full blur-2xl pointer-events-none"></div>
                    
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <Flame className="w-4 h-4 text-amber-400" />
                          <span className="text-xs font-bold uppercase tracking-wider text-amber-400">
                            Predictive Engine Forecast
                          </span>
                        </div>
                        <h3 className="text-lg font-extrabold text-white mt-1">
                          Next Predicted Step: <span className="text-amber-300">{selectedSession.predicted_next_action}</span>
                        </h3>
                      </div>

                      <div className="text-right">
                        <div className="text-2xl font-black text-amber-400 font-mono">
                          {selectedSession.predicted_probability}%
                        </div>
                        <div className="text-[10px] text-neutral-400 uppercase font-mono">
                          Probability Confidence
                        </div>
                      </div>
                    </div>

                    {/* METRICS ROW */}
                    <div className="grid grid-cols-3 gap-4 pt-3 border-t border-neutral-800 text-xs">
                      <div className="bg-neutral-950/80 p-3 rounded-lg border border-neutral-800">
                        <span className="text-neutral-500 block text-[10px] uppercase">Current Risk Score</span>
                        <span className={`text-base font-bold font-mono ${selectedSession.risk_score >= 80 ? 'text-red-400' : 'text-amber-400'}`}>
                          {selectedSession.risk_score} / 100
                        </span>
                      </div>
                      <div className="bg-neutral-950/80 p-3 rounded-lg border border-neutral-800">
                        <span className="text-neutral-500 block text-[10px] uppercase">FSM Pattern Confidence</span>
                        <span className="text-base font-bold text-cyan-400 font-mono">
                          {selectedSession.confidence_score}% Match
                        </span>
                      </div>
                      <div className="bg-neutral-950/80 p-3 rounded-lg border border-neutral-800">
                        <span className="text-neutral-500 block text-[10px] uppercase">Estimated Time Window</span>
                        <span className="text-base font-bold text-emerald-400 font-mono flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" />
                          {selectedSession.estimated_time_seconds > 0 ? `~${selectedSession.estimated_time_seconds}s` : 'Immediate'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* MITRE ATT&CK MAPPER CHAIN */}
                  <div className="bg-neutral-950 border border-neutral-800 rounded-xl p-5">
                    <h4 className="text-xs font-bold text-neutral-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                      <Layers className="w-4 h-4 text-cyan-400" />
                      MITRE ATT&CK Technique Sequence Mapping
                    </h4>
                    <div className="flex flex-wrap items-center gap-2">
                      {selectedSession.mitre_techniques && selectedSession.mitre_techniques.length > 0 ? (
                        selectedSession.mitre_techniques.map((m, idx) => (
                          <React.Fragment key={idx}>
                            <div className="bg-neutral-900 border border-cyan-500/30 px-3 py-2 rounded-lg flex items-center gap-2">
                              <span className="font-mono font-bold text-xs text-cyan-400">{m.technique_id}</span>
                              <span className="text-xs text-neutral-300 font-medium">{m.technique_name}</span>
                            </div>
                            {idx < selectedSession.mitre_techniques.length - 1 && (
                              <ArrowRight className="w-4 h-4 text-neutral-600 shrink-0" />
                            )}
                          </React.Fragment>
                        ))
                      ) : (
                        <span className="text-xs text-neutral-500 italic">No MITRE techniques logged yet.</span>
                      )}
                    </div>
                  </div>

                  {/* RECENT EVENT LOGS FOR THIS SESSION */}
                  <div className="bg-neutral-950 border border-neutral-800 rounded-xl p-5">
                    <h4 className="text-xs font-bold text-neutral-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                      <Terminal className="w-4 h-4 text-amber-400" />
                      Reconstructed Activity Log Stream
                    </h4>
                    <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                      {selectedSession.recent_events && selectedSession.recent_events.map((ev, idx) => (
                        <div key={idx} className="bg-neutral-900/80 p-2.5 rounded-lg border border-neutral-800 font-mono text-xs flex justify-between items-center">
                          <div>
                            <span className="text-amber-400 font-bold mr-2">[{ev.event_type}]</span>
                            <span className="text-neutral-200">{ev.desc}</span>
                          </div>
                          <span className="text-[10px] text-neutral-500">{ev.note}</span>
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
        <div className="bg-neutral-950 border border-neutral-800 rounded-xl p-6 space-y-6">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Play className="w-4 h-4 text-amber-400" />
              Interactive Attack Sequence Simulator
            </h3>
            <p className="text-xs text-neutral-400 mt-1">
              Select a scenario and click sequential stages to fire synthetic telemetry into the engine. Watch the Finite State Machine reconstruct the session live!
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {templates.map((tpl) => (
              <div key={tpl.id} className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 space-y-3">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="text-sm font-bold text-amber-400">{tpl.name}</h4>
                    <p className="text-xs text-neutral-400 mt-0.5">{tpl.description}</p>
                  </div>
                </div>

                <div className="space-y-2 pt-2">
                  {tpl.stages.map((stg) => (
                    <div key={stg.stage} className="flex items-center justify-between bg-neutral-950 p-2.5 rounded-lg border border-neutral-800">
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-amber-500/10 text-amber-400 font-mono text-[10px] font-bold flex items-center justify-center border border-amber-500/20">
                          {stg.stage}
                        </span>
                        <div>
                          <span className="text-xs font-bold text-neutral-200 block">{stg.name}</span>
                          <span className="text-[10px] font-mono text-cyan-400">{stg.mitre?.technique_id} • {stg.mitre?.technique_name}</span>
                        </div>
                      </div>

                      <button
                        disabled={simulating}
                        onClick={() => triggerSimulationEvent(tpl.id, stg.stage)}
                        className="px-3 py-1 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-black text-xs font-bold rounded transition-all flex items-center gap-1"
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
        <div className="bg-neutral-950 border border-neutral-800 rounded-xl p-6 space-y-4">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Layers className="w-4 h-4 text-cyan-400" />
            Loaded Behavior Templates JSON Definitions
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {templates.map((t) => (
              <div key={t.id} className="bg-neutral-900 border border-neutral-800 p-4 rounded-xl space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-mono font-bold text-amber-400">{t.id}</span>
                  <span className="text-[10px] font-mono text-neutral-500">{t.stages.length} Stages</span>
                </div>
                <h4 className="text-sm font-bold text-white">{t.name}</h4>
                <p className="text-xs text-neutral-400">{t.description}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
