import React, { useState } from 'react'

export default function SessionGraphCard({ session }) {
  const [hoveredNode, setHoveredNode] = useState(null)

  // Default graph nodes if session events aren't loaded yet
  const defaultChain = [
    { id: 1, type: 'FILE_CREATE', label: 'Sensitive Doc Access', timestamp: '10:42:10', path: '/finance/q3_payroll.zip', risk: 0.25 },
    { id: 2, type: 'USB_INSERT', label: 'Unverified USB Storage', timestamp: '10:43:05', path: 'VID:045E_PID:07A5', risk: 0.65 },
    { id: 3, type: 'FILE_MODIFY', label: 'Archive Multi-Part Split', timestamp: '10:44:18', path: '/tmp/part_01.tar.gz', risk: 0.82 },
    { id: 4, type: 'NETWORK_CONNECTION', label: 'Exfiltration Burst', timestamp: '10:45:00', path: '185.220.101.4:443', risk: 0.96 },
  ]

  const nodes = session && session.events && session.events.length > 0
    ? session.events.map((evt, idx) => ({
        id: idx + 1,
        type: evt.event_type,
        label: evt.metadata?.extension ? `${evt.event_type} (.${evt.metadata.extension})` : evt.event_type,
        timestamp: evt.timestamp ? new Date(evt.timestamp).toLocaleTimeString() : `Step ${idx + 1}`,
        path: evt.metadata?.destination_host || evt.metadata?.vendor_id || evt.metadata?.process_name || 'Metadata Event',
        risk: idx === session.events.length - 1 ? (session.risk_score || 0.88) : 0.2 + idx * 0.2,
      }))
    : defaultChain

  return (
    <div className="session-graph-card" style={{ padding: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <div>
          <div className="section-terminal-label" style={{ marginBottom: '4px' }}>
            <span>⚡ MULTI-HOP EVENT CHAIN GRAPH</span>
          </div>
          <h3 className="title-md" style={{ color: 'var(--colors-on-dark)', margin: 0 }}>
            Reconstructed Telemetry Causality Sequence
          </h3>
        </div>
        <span className="badge badge-warning" style={{ fontFamily: 'var(--font-mono)' }}>
          {nodes.length} Nodes Traced
        </span>
      </div>

      {/* SVG Interactive Multi-Hop Graph */}
      <div style={{ position: 'relative', width: '100%', backgroundColor: 'var(--colors-canvas-dark)', borderRadius: 'var(--rounded-lg)', border: '1px solid var(--colors-hairline-on-dark)', padding: '24px 16px', overflowX: 'auto' }}>
        <svg viewBox="0 0 760 160" style={{ width: '100%', minWidth: '600px', height: 'auto', display: 'block' }}>
          <defs>
            <linearGradient id="edgeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#3b82f6" />
              <stop offset="50%" stopColor="#fcd535" />
              <stop offset="100%" stopColor="#f6465d" />
            </linearGradient>
            <linearGradient id="yellowNodeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#ffe066" />
              <stop offset="100%" stopColor="#f0b90b" />
            </linearGradient>
            <linearGradient id="redNodeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#ff6b7a" />
              <stop offset="100%" stopColor="#f6465d" />
            </linearGradient>
            <filter id="nodeGlowEscalating" x="-40%" y="-40%" width="180%" height="180%">
              <feGaussianBlur stdDeviation="6" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* Connective Edges */}
          {nodes.map((node, i) => {
            if (i === nodes.length - 1) return null
            const x1 = 80 + i * (600 / Math.max(nodes.length - 1, 1))
            const x2 = 80 + (i + 1) * (600 / Math.max(nodes.length - 1, 1))
            const y = 80
            return (
              <g key={`edge-${i}`}>
                <line
                  x1={x1}
                  y1={y}
                  x2={x2}
                  y2={y}
                  stroke={i === nodes.length - 2 ? 'url(#redNodeGrad)' : 'url(#edgeGradient)'}
                  strokeWidth="3"
                  strokeDasharray={i === nodes.length - 2 ? '6 4' : 'none'}
                />
                {/* Arrowhead Marker */}
                <polygon
                  points={`${x2 - 10},${y - 5} ${x2},${y} ${x2 - 10},${y + 5}`}
                  fill={i === nodes.length - 2 ? '#f6465d' : '#fcd535'}
                />
              </g>
            )
          })}

          {/* Graph Nodes */}
          {nodes.map((node, i) => {
            const cx = 80 + i * (600 / Math.max(nodes.length - 1, 1))
            const cy = 80
            const isHighRisk = node.risk >= 0.80 || i === nodes.length - 1
            const isHovered = hoveredNode === i

            return (
              <g
                key={`node-${i}`}
                onMouseEnter={() => setHoveredNode(i)}
                onMouseLeave={() => setHoveredNode(null)}
                style={{ cursor: 'pointer' }}
              >
                {/* Outer Ring with Glow strictly reserved for >80% risk nodes */}
                <circle
                  cx={cx}
                  cy={cy}
                  r={isHovered ? 24 : 20}
                  fill="var(--colors-surface-card-dark)"
                  stroke={isHighRisk ? 'url(#redNodeGrad)' : 'url(#yellowNodeGrad)'}
                  strokeWidth={isHighRisk ? '3' : '2'}
                  filter={isHighRisk ? 'url(#nodeGlowEscalating)' : 'none'}
                  style={{ transition: 'all 0.2s ease' }}
                />

                {/* Node Number */}
                <text
                  x={cx}
                  y={cy + 5}
                  textAnchor="middle"
                  fill={isHighRisk ? '#ff6b7a' : '#ffe066'}
                  fontSize="12"
                  fontWeight="700"
                  fontFamily="Inter, sans-serif"
                >
                  {i + 1}
                </text>

                {/* Node Label Above */}
                <text
                  x={cx}
                  y={cy - 30}
                  textAnchor="middle"
                  fill="var(--colors-on-dark)"
                  fontSize="12"
                  fontWeight="600"
                  fontFamily="Inter, sans-serif"
                >
                  {node.type}
                </text>

                {/* Timestamp Below */}
                <text
                  x={cx}
                  y={cy + 42}
                  textAnchor="middle"
                  fill="var(--colors-muted)"
                  fontSize="10"
                  fontFamily="Inter, sans-serif"
                  className="tabular-nums"
                >
                  {node.timestamp}
                </text>

                {/* Risk Indicator Tag */}
                <rect
                  x={cx - 24}
                  y={cy + 50}
                  width="48"
                  height="16"
                  rx="4"
                  fill={isHighRisk ? 'rgba(246, 70, 93, 0.2)' : 'rgba(14, 203, 129, 0.2)'}
                  stroke={isHighRisk ? '#f6465d' : '#0ecb81'}
                  strokeWidth="1"
                />
                <text
                  x={cx}
                  y={cy + 62}
                  textAnchor="middle"
                  fill={isHighRisk ? '#ff6b7a' : '#2effa2'}
                  fontSize="9"
                  fontWeight="700"
                  fontFamily="Inter, sans-serif"
                  className="tabular-nums"
                >
                  {(node.risk * 100).toFixed(0)}%
                </text>
              </g>
            )
          })}
        </svg>

        {/* Hovered Node Detail Footer */}
        <div style={{ marginTop: '16px', paddingTop: '12px', borderTop: '1px solid var(--colors-hairline-on-dark)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span className="body-sm" style={{ color: 'var(--colors-muted-strong)' }}>
            Hovered Step Details: <strong style={{ color: 'var(--colors-on-dark)' }}>{hoveredNode !== null ? nodes[hoveredNode].label : 'Hover over any node to inspect payload-free metadata'}</strong>
          </span>
          <span className="number-sm" style={{ color: hoveredNode !== null && nodes[hoveredNode].risk >= 0.80 ? 'var(--colors-risk-escalating)' : 'var(--colors-risk-contained)' }}>
            {hoveredNode !== null ? `Risk Assessment: ${(nodes[hoveredNode].risk * 100).toFixed(0)}%` : 'Sequence State: Reconstructed'}
          </span>
        </div>
      </div>
    </div>
  )
}
