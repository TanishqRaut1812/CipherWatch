import React, { useState, useEffect } from 'react'

export default function SystemDetailModal({ orgId, agentId, onClose }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [timeRange, setTimeRange] = useState(24)
  const [activeTab, setActiveTab] = useState('overview') // 'overview' | 'timeline' | 'processes' | 'fs'
  
  // Timeline state
  const [timelineEvents, setTimelineEvents] = useState([])
  const [timelineCategory, setTimelineCategory] = useState('all')
  const [timelineSearch, setTimelineSearch] = useState('')
  const [timelinePage, setTimelinePage] = useState(1)
  const [timelineTotalPages, setTimelineTotalPages] = useState(1)
  const [timelineLoading, setTimelineLoading] = useState(false)

  useEffect(() => {
    if (!agentId || !orgId) return
    setLoading(true)
    fetch(`/api/admin/orgs/${orgId}/systems/${agentId}?time_range_hours=${timeRange}`)
      .then((res) => res.json())
      .then((resData) => {
        setData(resData)
        setLoading(false)
      })
      .catch((err) => {
        console.error('Failed to load system details:', err)
        setLoading(false)
      })
  }, [agentId, timeRange, orgId])

  useEffect(() => {
    if (!agentId || !orgId) return
    setTimelineLoading(true)
    fetch(`/api/admin/orgs/${orgId}/systems/${agentId}/timeline?event_category=${timelineCategory}&search=${encodeURIComponent(timelineSearch)}&page=${timelinePage}&page_size=15`)
      .then((res) => res.json())
      .then((tData) => {
        setTimelineEvents(tData.items || [])
        setTimelineTotalPages(tData.total_pages || 1)
        setTimelineLoading(false)
      })
      .catch(() => setTimelineLoading(false))
  }, [agentId, timelineCategory, timelineSearch, timelinePage, orgId])

  if (!agentId) return null

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
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
      }}
      onClick={onClose}
    >
      <div
        className="alert-feed-card"
        style={{
          width: '100%',
          maxWidth: '1100px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          backgroundColor: 'var(--colors-surface-card-dark)',
          border: '1px solid var(--colors-hairline-on-dark)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: '20px 28px',
            borderBottom: '1px solid var(--colors-hairline-on-dark)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            backgroundColor: 'var(--colors-canvas-dark)',
          }}
        >
          {loading || !data ? (
            <div className="title-md" style={{ color: 'var(--colors-on-dark)' }}>Loading system telemetry...</div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div
                style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: 'var(--rounded-md)',
                  background: 'var(--colors-surface-elevated-dark)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '20px',
                }}
              >
                💻
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <h2 className="title-lg" style={{ color: 'var(--colors-on-dark)', margin: 0 }}>
                    {data.header.hostname}
                  </h2>
                  <span className={`badge ${data.header.status === 'online' ? 'badge-success' : 'badge-danger'}`}>
                    ● {data.header.status.toUpperCase()}
                  </span>
                  <span className={`badge ${data.header.threat_level === 'critical' ? 'badge-danger' : data.header.threat_level === 'warning' ? 'badge-warning' : 'badge-info'}`}>
                    THREAT: {data.header.threat_level.toUpperCase()}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: '16px', marginTop: '4px', fontSize: '12px', color: 'var(--colors-muted-strong)' }}>
                  <span>ID: <code style={{ color: 'var(--colors-primary)' }}>{data.header.id}</code></span>
                  <span>OS: {data.header.os}</span>
                  <span>IP: {data.header.ip}</span>
                  <span>Version: v{data.header.agent_version}</span>
                </div>
              </div>
            </div>
          )}

          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--colors-muted-strong)',
              fontSize: '24px',
              cursor: 'pointer',
              padding: '4px 8px',
            }}
          >
            ✕
          </button>
        </div>

        {/* Tab Bar + Controls */}
        <div
          style={{
            padding: '12px 28px',
            borderBottom: '1px solid var(--colors-hairline-on-dark)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            backgroundColor: 'var(--colors-canvas-dark)',
          }}
        >
          <div style={{ display: 'flex', gap: '8px' }}>
            {[
              { id: 'overview', label: '📊 Metrics & Overview' },
              { id: 'timeline', label: '📜 Unified Event Timeline' },
              { id: 'processes', label: '⚡ Active Processes' },
              { id: 'fs', label: '📁 Filesystem Activity' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={activeTab === tab.id ? 'btn-primary' : 'btn-secondary'}
                style={{ height: '32px', fontSize: '12px', padding: '0 12px' }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className="body-sm" style={{ color: 'var(--colors-muted)' }}>Range:</span>
            {[1, 6, 24, 168].map((hrs) => (
              <button
                key={hrs}
                onClick={() => setTimeRange(hrs)}
                style={{
                  background: timeRange === hrs ? 'var(--colors-primary)' : 'var(--colors-surface-card-dark)',
                  color: timeRange === hrs ? 'var(--colors-on-primary)' : 'var(--colors-muted-strong)',
                  border: '1px solid var(--colors-hairline-on-dark)',
                  borderRadius: 'var(--rounded-sm)',
                  padding: '2px 8px',
                  fontSize: '11px',
                  cursor: 'pointer',
                  fontWeight: timeRange === hrs ? '700' : '400',
                }}
              >
                {hrs === 168 ? '7d' : `${hrs}h`}
              </button>
            ))}
          </div>
        </div>

        {/* Modal Body */}
        <div style={{ padding: '24px 28px', overflowY: 'auto', flex: 1 }}>
          {loading || !data ? (
            <div className="body-md" style={{ color: 'var(--colors-muted)', textAlign: 'center', padding: '40px' }}>
              Retrieving agent telemetry details...
            </div>
          ) : (
            <>
              {/* TAB 1: OVERVIEW & RESOURCE METRICS */}
              {activeTab === 'overview' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                  {/* Metric Summary Cards */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                    {[
                      { label: 'CPU Usage', val: `${data.metrics_series.slice(-1)[0]?.cpu_percent ?? 0}%`, color: 'var(--colors-primary)' },
                      { label: 'Memory Usage', val: `${data.metrics_series.slice(-1)[0]?.mem_percent ?? 0}%`, color: '#f59e0b' },
                      { label: 'Disk Usage', val: `${data.metrics_series.slice(-1)[0]?.disk_percent ?? 0}%`, color: 'var(--colors-info)' },
                      { label: 'Process Count', val: data.metrics_series.slice(-1)[0]?.process_count ?? 0, color: 'var(--colors-on-dark)' },
                    ].map((card, i) => (
                      <div key={i} className="alert-feed-card" style={{ padding: '16px' }}>
                        <span className="body-sm" style={{ color: 'var(--colors-muted-strong)' }}>{card.label}</span>
                        <div className="number-display" style={{ color: card.color, marginTop: '4px' }}>{card.val}</div>
                      </div>
                    ))}
                  </div>

                  {/* Resource Trend Chart Visualization */}
                  <div className="alert-feed-card" style={{ padding: '20px' }}>
                    <h3 className="title-md" style={{ color: 'var(--colors-on-dark)', marginBottom: '16px' }}>
                      📈 Resource Utilization History ({timeRange}h Window)
                    </h3>
                    {data.metrics_series.length === 0 ? (
                      <div className="body-sm" style={{ color: 'var(--colors-muted)' }}>No metric snapshots recorded in this window.</div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <div style={{ display: 'flex', alignItems: 'flex-end', height: '140px', gap: '6px', padding: '10px 0', borderBottom: '1px solid var(--colors-hairline-on-dark)' }}>
                          {data.metrics_series.map((m, idx) => (
                            <div key={idx} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end' }}>
                              <div
                                title={`CPU: ${m.cpu_percent}% | Mem: ${m.mem_percent}%`}
                                style={{
                                  width: '100%',
                                  height: `${Math.max(m.cpu_percent, 5)}%`,
                                  background: m.cpu_percent > 85 ? 'var(--colors-risk-escalating)' : 'var(--colors-primary)',
                                  borderRadius: '2px 2px 0 0',
                                  transition: 'height 0.2s ease',
                                }}
                              />
                            </div>
                          ))}
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--colors-muted-strong)' }}>
                          <span>{data.metrics_series[0] ? new Date(data.metrics_series[0].timestamp).toLocaleTimeString() : ''}</span>
                          <span>Yellow bars = CPU Utilization (Red if &gt;85%)</span>
                          <span>{data.metrics_series.slice(-1)[0] ? new Date(data.metrics_series.slice(-1)[0].timestamp).toLocaleTimeString() : ''}</span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Active Alerts for this Agent */}
                  <div className="alert-feed-card" style={{ padding: '20px' }}>
                    <h3 className="title-md" style={{ color: 'var(--colors-on-dark)', marginBottom: '16px' }}>
                      🚨 System Alerts ({data.alerts.length})
                    </h3>
                    {data.alerts.length === 0 ? (
                      <div className="body-sm" style={{ color: 'var(--colors-muted)' }}>No threat alerts recorded for this machine.</div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {data.alerts.map((al) => (
                          <div
                            key={al.id}
                            style={{
                              padding: '12px 16px',
                              borderRadius: 'var(--rounded-md)',
                              background: al.severity === 'critical' ? 'rgba(246, 70, 93, 0.08)' : 'var(--colors-canvas-dark)',
                              border: `1px solid ${al.severity === 'critical' ? 'rgba(246, 70, 93, 0.3)' : 'var(--colors-hairline-on-dark)'}`,
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                            }}
                          >
                            <div>
                              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                <span className={`badge ${al.severity === 'critical' ? 'badge-danger' : 'badge-warning'}`}>
                                  {al.severity.toUpperCase()}
                                </span>
                                <code className="body-sm" style={{ color: 'var(--colors-primary)' }}>{al.rule_id}</code>
                                <span className="body-sm tabular-nums" style={{ color: 'var(--colors-muted)' }}>
                                  {new Date(al.timestamp).toLocaleString()}
                                </span>
                              </div>
                              <p className="body-sm" style={{ color: 'var(--colors-on-dark)', marginTop: '4px' }}>
                                {al.message}
                              </p>
                            </div>
                            <span className={`badge ${al.acknowledged ? 'badge-success' : 'badge-warning'}`}>
                              {al.acknowledged ? 'ACKNOWLEDGED' : 'ACTIVE'}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 2: UNIFIED SEARCHABLE TIMELINE */}
              {activeTab === 'timeline' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {/* Filters Bar */}
                  <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                    <input
                      type="text"
                      className="input-text"
                      placeholder="Search processes, paths, cmdlines..."
                      value={timelineSearch}
                      onChange={(e) => {
                        setTimelineSearch(e.target.value)
                        setTimelinePage(1)
                      }}
                      style={{ maxWidth: '360px' }}
                    />
                    <select
                      className="input-text"
                      value={timelineCategory}
                      onChange={(e) => {
                        setTimelineCategory(e.target.value)
                        setTimelinePage(1)
                      }}
                      style={{ width: '180px' }}
                    >
                      <option value="all">All Events (Process + FS)</option>
                      <option value="process">Processes Only</option>
                      <option value="fs">Filesystem Only</option>
                    </select>
                  </div>

                  {timelineLoading ? (
                    <div className="body-sm" style={{ color: 'var(--colors-muted)', padding: '20px 0' }}>Loading timeline...</div>
                  ) : timelineEvents.length === 0 ? (
                    <div className="body-sm" style={{ color: 'var(--colors-muted)', padding: '20px 0' }}>No matching events found.</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {timelineEvents.map((evt) => (
                        <div
                          key={evt.id}
                          style={{
                            padding: '12px 16px',
                            borderRadius: 'var(--rounded-md)',
                            background: 'var(--colors-canvas-dark)',
                            border: '1px solid var(--colors-hairline-on-dark)',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                          }}
                        >
                          <div>
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                              <span className={`badge ${evt.category === 'process' ? 'badge-info' : 'badge-warning'}`}>
                                {evt.category.toUpperCase()}
                              </span>
                              <span className="body-sm tabular-nums" style={{ color: 'var(--colors-muted)' }}>
                                {new Date(evt.timestamp).toLocaleTimeString()}
                              </span>
                              <strong className="body-sm" style={{ color: 'var(--colors-on-dark)' }}>
                                {evt.title}
                              </strong>
                            </div>
                            <div className="body-sm" style={{ color: 'var(--colors-muted-strong)', marginTop: '4px', fontFamily: 'var(--font-mono)' }}>
                              {evt.details}
                            </div>
                          </div>
                        </div>
                      ))}

                      {/* Pagination Controls */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px' }}>
                        <button
                          className="btn-secondary"
                          disabled={timelinePage <= 1}
                          onClick={() => setTimelinePage((p) => p - 1)}
                          style={{ height: '32px', fontSize: '12px' }}
                        >
                          ← Previous
                        </button>
                        <span className="body-sm tabular-nums" style={{ color: 'var(--colors-muted)' }}>
                          Page {timelinePage} of {timelineTotalPages}
                        </span>
                        <button
                          className="btn-secondary"
                          disabled={timelinePage >= timelineTotalPages}
                          onClick={() => setTimelinePage((p) => p + 1)}
                          style={{ height: '32px', fontSize: '12px' }}
                        >
                          Next →
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 3: ACTIVE PROCESSES LIST */}
              {activeTab === 'processes' && (
                <div>
                  <h3 className="title-md" style={{ color: 'var(--colors-on-dark)', marginBottom: '16px' }}>
                    ⚡ Most Recent Process Activity
                  </h3>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid var(--colors-hairline-on-dark)', color: 'var(--colors-muted-strong)' }}>
                          <th style={{ padding: '8px 12px' }}>PID</th>
                          <th style={{ padding: '8px 12px' }}>Name</th>
                          <th style={{ padding: '8px 12px' }}>User</th>
                          <th style={{ padding: '8px 12px' }}>Path / Cmdline</th>
                          <th style={{ padding: '8px 12px' }}>CPU %</th>
                          <th style={{ padding: '8px 12px' }}>RSS Mem</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.latest_processes.map((proc) => (
                          <tr key={proc.id} style={{ borderBottom: '1px solid var(--colors-hairline-on-dark)' }}>
                            <td style={{ padding: '8px 12px', fontFamily: 'var(--font-mono)' }}>{proc.pid}</td>
                            <td style={{ padding: '8px 12px', fontWeight: '500' }}>{proc.name}</td>
                            <td style={{ padding: '8px 12px' }}>{proc.user || 'N/A'}</td>
                            <td style={{ padding: '8px 12px', fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--colors-muted-strong)', maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {proc.exe_path || proc.cmdline}
                            </td>
                            <td style={{ padding: '8px 12px' }} className="tabular-nums">{proc.cpu_percent}%</td>
                            <td style={{ padding: '8px 12px' }} className="tabular-nums">{proc.mem_rss_mb} MB</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* TAB 4: FILESYSTEM ACTIVITY */}
              {activeTab === 'fs' && (
                <div>
                  <h3 className="title-md" style={{ color: 'var(--colors-on-dark)', marginBottom: '16px' }}>
                    📁 Recent Filesystem Events
                  </h3>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid var(--colors-hairline-on-dark)', color: 'var(--colors-muted-strong)' }}>
                          <th style={{ padding: '8px 12px' }}>Time</th>
                          <th style={{ padding: '8px 12px' }}>Event</th>
                          <th style={{ padding: '8px 12px' }}>Path</th>
                          <th style={{ padding: '8px 12px' }}>Dest Path</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.recent_fs_events.map((fs) => (
                          <tr key={fs.id} style={{ borderBottom: '1px solid var(--colors-hairline-on-dark)' }}>
                            <td style={{ padding: '8px 12px', fontSize: '11px', color: 'var(--colors-muted)' }} className="tabular-nums">
                              {new Date(fs.timestamp).toLocaleTimeString()}
                            </td>
                            <td style={{ padding: '8px 12px' }}>
                              <span className={`badge ${fs.event_type === 'deleted' ? 'badge-danger' : fs.event_type === 'created' ? 'badge-success' : 'badge-warning'}`}>
                                {fs.event_type.toUpperCase()}
                              </span>
                            </td>
                            <td style={{ padding: '8px 12px', fontFamily: 'var(--font-mono)', fontSize: '12px' }}>
                              {fs.src_path}
                            </td>
                            <td style={{ padding: '8px 12px', fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--colors-muted)' }}>
                              {fs.dest_path || '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
