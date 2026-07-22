import React, { useRef, useEffect, useState, useCallback } from 'react';
import cytoscape from 'cytoscape';

const API_BASE = process.env.NODE_ENV === 'development'
  ? 'https://kavach-60078268134.development.catalystserverless.in'
  : '';

const CRIME_TYPES = {
  1: 'Murder', 2: 'Attempt to Murder', 3: 'Grievous Hurt', 4: 'Simple Hurt',
  5: 'Robbery', 6: 'Dacoity', 7: 'House Burglary', 8: 'Theft', 9: 'Vehicle Theft',
  10: 'Chain Snatching', 11: 'Cruelty by Husband', 12: 'Molestation', 13: 'Cheating',
  14: 'Criminal Breach of Trust', 15: 'Online Financial Fraud', 16: 'Identity Theft',
  17: 'NDPS Possession', 18: 'NDPS Trafficking', 19: 'Rioting', 20: 'Unlawful Assembly'
};

function riskColor(risk) {
  if (risk > 70) return '#F87171';
  if (risk >= 40) return '#F5A623';
  return '#5B8DEF';
}

function riskLabel(risk) {
  if (risk > 70) return 'High';
  if (risk >= 40) return 'Medium';
  return 'Low';
}

const getStringColor = (weight) => {
  if (weight >= 3) return '#ef4444'; // red
  if (weight === 2) return '#f5a623'; // amber
  return '#3b82f6'; // thin blue
};

const getRotation = (id) => {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash);
  }
  const angle = (Math.abs(hash) % 7) - 3; // -3 to 3
  return `rotate(${angle}deg)`;
};

const getInitials = (name) => {
  if (!name) return '??';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
};

export default function NetworkView({ onAskCase, chatRows, chatEvidence }) {
  const cyRef = useRef(null);
  const containerRef = useRef(null);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [minShared, setMinShared] = useState(2);
  const [search, setSearch] = useState('');
  const [showIsolated, setShowIsolated] = useState(false);
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selected, setSelected] = useState(null);
  const [viewMode, setViewMode] = useState('graph'); // 'graph' | 'board'

  // Filtered network data based on last chat search
  const getFilteredData = useCallback(() => {
    if (!data) return null;
    
    // Build set of crime numbers from chat
    const chatCrimeNos = new Set();
    if (chatRows && chatRows.length > 0) {
      chatRows.forEach(r => {
        if (r.CrimeNo) chatCrimeNos.add(r.CrimeNo);
        if (r.CRIMENO) chatCrimeNos.add(r.CRIMENO); // fallback
      });
    }
    if (chatEvidence && chatEvidence.length > 0) {
      chatEvidence.forEach(e => chatCrimeNos.add(e));
    }

    if (chatCrimeNos.size === 0) return data; // Nothing to filter by

    // A node is kept if it shares at least one case with the chat results
    const filteredNodes = data.nodes.filter(n => 
      n.cases && n.cases.some(c => chatCrimeNos.has(c.crimeNo))
    );
    const filteredNodeIds = new Set(filteredNodes.map(n => n.id));

    // An edge is kept if both nodes are kept and they share at least one case in the chat results
    const filteredEdges = data.edges.filter(e => 
      filteredNodeIds.has(e.source) && 
      filteredNodeIds.has(e.target) &&
      e.caseIds && e.caseIds.some(cid => {
        const sourceNode = filteredNodes.find(n => n.id === e.source);
        const targetNode = filteredNodes.find(n => n.id === e.target);
        if (!sourceNode || !targetNode) return false;
        
        const sourceCases = new Set(sourceNode.cases.map(c => c.crimeNo));
        const targetCases = new Set(targetNode.cases.map(c => c.crimeNo));
        
        return [...sourceCases].some(c => targetCases.has(c) && chatCrimeNos.has(c));
      })
    );

    return {
      nodes: filteredNodes,
      edges: filteredEdges,
      totals: { people: filteredNodes.length, links: filteredEdges.length }
    };
  }, [data, chatRows, chatEvidence]);

  const displayData = getFilteredData() || data;

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const fetchGraph = useCallback(async (ms, iso, q) => {
    setError(null);
    try {
      const resp = await fetch(`${API_BASE}/server/api/api/network?minShared=${ms}&minCases=2&showIsolated=${iso}&search=${encodeURIComponent(q)}`);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const d = await resp.json();
      setData(d);
    } catch (e) {
      setError(String(e.message || e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchGraph(minShared, showIsolated, debouncedSearch); }, [fetchGraph, minShared, showIsolated, debouncedSearch]);

  // Cytoscape initialization (Graph view only)
  useEffect(() => {
    if (viewMode !== 'graph' || !displayData || !containerRef.current) return;

    const elements = [
      ...displayData.nodes.map(n => ({
        data: {
          id: n.id, label: n.name, ...n,
          size: Math.max(20, Math.min(60, 15 + n.caseCount * 8)),
          color: riskColor(n.risk),
        }
      })),
      ...displayData.edges.map((e, i) => ({
        data: {
          id: `e${i}`, source: e.source, target: e.target,
          weight: e.weight, width: Math.max(1, Math.min(6, e.weight * 1.5)),
        }
      }))
    ];

    if (cyRef.current) cyRef.current.destroy();

    const cy = cytoscape({
      container: containerRef.current,
      elements,
      style: [
        {
          selector: 'node',
          style: {
            'background-color': 'data(color)',
            'width': 'data(size)',
            'height': 'data(size)',
            'label': '',
            'border-width': 0,
            'overlay-opacity': 0,
          }
        },
        {
          selector: 'node.show-label',
          style: {
            'label': 'data(label)',
            'font-size': '10px',
            'color': '#E6EBF4',
            'text-background-color': '#0B1220',
            'text-background-opacity': 0.85,
            'text-background-padding': '3px',
            'font-family': 'Inter, sans-serif',
            'text-valign': 'bottom',
            'text-margin-y': 6,
          }
        },
        {
          selector: 'node.highlight',
          style: {
            'border-width': 3,
            'border-color': '#F5A623',
          }
        },
        {
          selector: 'node:selected',
          style: {
            'border-width': 3,
            'border-color': '#22D3EE',
          }
        },
        {
          selector: 'edge',
          style: {
            'width': 'data(width)',
            'line-color': 'rgba(245,166,35,0.35)',
            'curve-style': 'bezier',
            'overlay-opacity': 0,
          }
        }
      ],
      layout: { 
        name: 'cose', 
        animate: false, 
        nodeDimensionsIncludeLabels: true, 
        randomize: true,
        nodeRepulsion: () => 400000,
        componentSpacing: 100
      },
      minZoom: 0.15,
      maxZoom: 4,
    });

    // Show labels at zoom > 0.7
    const updateLabels = () => {
      const z = cy.zoom();
      if (z > 0.7) cy.nodes().addClass('show-label');
      else cy.nodes().removeClass('show-label');
    };
    cy.on('zoom', updateLabels);
    updateLabels();

    cy.on('tap', 'node', (evt) => {
      const d = evt.target.data();
      setSelected(d);
    });

    cy.on('tap', (evt) => {
      if (evt.target === cy) setSelected(null);
    });

    cyRef.current = cy;

    return () => { if (cyRef.current) cyRef.current.destroy(); };
  }, [displayData, viewMode]);

  // Search: highlight matching nodes in Graph view
  useEffect(() => {
    if (viewMode !== 'graph' || !cyRef.current) return;
    const cy = cyRef.current;
    cy.nodes().removeClass('highlight');
    if (!search.trim()) return;
    const q = search.toLowerCase();
    const matches = cy.nodes().filter(n => n.data('name').toLowerCase().includes(q));
    matches.addClass('highlight');
    if (matches.length > 0) {
      cy.animate({ fit: { eles: matches, padding: 80 }, duration: 400 });
    }
  }, [search, viewMode]);

  const handleFit = () => {
    if (viewMode === 'graph' && cyRef.current) {
      cyRef.current.animate({ fit: { padding: 40 }, duration: 300 });
    }
  };

  const handleClosePanel = useCallback(() => setSelected(null), []);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') setSelected(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Compute positions for Board layout
  const getBoardPositions = useCallback(() => {
    if (!displayData?.nodes) return {};
    const nodes = displayData.nodes;
    const edges = displayData.edges;

    const adj = {};
    nodes.forEach(n => adj[n.id] = []);
    edges.forEach(e => {
      if (adj[e.source] && adj[e.target]) {
        adj[e.source].push(e.target);
        adj[e.target].push(e.source);
      }
    });

    const visited = new Set();
    const components = [];
    nodes.forEach(n => {
      if (!visited.has(n.id)) {
        const comp = [];
        const queue = [n.id];
        visited.add(n.id);
        while (queue.length > 0) {
          const curr = queue.shift();
          comp.push(curr);
          (adj[curr] || []).forEach(neighbor => {
            if (!visited.has(neighbor)) {
              visited.add(neighbor);
              queue.push(neighbor);
            }
          });
        }
        components.push(comp);
      }
    });

    components.sort((a, b) => b.length - a.length);

    const width = 1100;
    const height = 750;
    const nodePositions = {};
    const numComp = components.length;

    components.forEach((comp, compIdx) => {
      let cx = width / 2;
      let cy = height / 2;

      if (numComp > 1) {
        const angle = (compIdx / numComp) * 2 * Math.PI;
        const radius = Math.min(width, height) * 0.28;
        cx = width / 2 + radius * Math.cos(angle);
        cy = height / 2 + radius * Math.sin(angle);
      }

      const numNodes = comp.length;
      comp.forEach((nodeId, nodeIdx) => {
        if (numNodes === 1) {
          nodePositions[nodeId] = { x: cx, y: cy };
        } else {
          const angle = (nodeIdx / numNodes) * 2 * Math.PI;
          const radius = Math.max(50, numNodes * 22);
          nodePositions[nodeId] = {
            x: cx + radius * Math.cos(angle),
            y: cy + radius * Math.sin(angle)
          };
        }
      });
    });

    return nodePositions;
  }, [displayData]);

  if (loading) {
    return (
      <div className="page-body">
        <div className="placeholder">
          <div className="thinking" aria-label="Loading network">
            <div className="think-dot" /><div className="think-dot" /><div className="think-dot" />
          </div>
          <p>Building criminal network graph…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page-body">
        <div className="placeholder">
          <div className="placeholder-icon">⚠️</div>
          <h3>Failed to load network</h3>
          <p>{error}</p>
          <button className="btn-ghost" onClick={() => fetchGraph(minShared)}>Retry</button>
        </div>
      </div>
    );
  }

  // Filtered nodes based on client side search (Board mode)
  const isBoardFiltered = (node) => {
    if (!search.trim()) return true;
    return node.name.toLowerCase().includes(search.toLowerCase());
  };

  const boardPositions = getBoardPositions();
  const tooManyNodes = displayData && displayData.nodes && displayData.nodes.length > 50;

  return (
    <div className="page-body net-page">
      {/* Controls bar */}
      <div className="net-controls">
        <div className="net-ctrl-left">
          <label className="net-label" htmlFor="minSharedSlider">
            Min shared cases: <strong>{minShared}</strong>
          </label>
          <input
            id="minSharedSlider"
            type="range" min="1" max="5" value={minShared}
            onChange={e => setMinShared(Number(e.target.value))}
            className="net-slider"
            aria-label="Minimum shared cases filter"
          />
          <input
            type="text"
            placeholder="Search accused…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="net-search"
            aria-label="Search accused by name"
          />
          <label className="net-label" style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
            <input 
              type="checkbox" 
              checked={showIsolated} 
              onChange={e => setShowIsolated(e.target.checked)} 
            />
            Show isolated repeat offenders
          </label>
          {viewMode === 'graph' && (
            <button className="btn-ghost" onClick={handleFit} aria-label="Fit graph to view">Fit</button>
          )}

          {/* View Mode Toggle */}
          <div className="net-view-toggles" style={{ marginLeft: '12px' }}>
            <button 
              className={`net-view-btn ${viewMode === 'graph' ? 'active' : ''}`}
              onClick={() => setViewMode('graph')}
            >
              Graph
            </button>
            <button 
              className={`net-view-btn ${viewMode === 'board' ? 'active' : ''}`}
              onClick={() => setViewMode('board')}
            >
              Board
            </button>
          </div>
        </div>

        <div className="net-legend">
          <span className="legend-chip" style={{ background: '#5B8DEF' }}>Low &lt;40</span>
          <span className="legend-chip" style={{ background: '#F5A623' }}>Med 40–70</span>
          <span className="legend-chip" style={{ background: '#F87171' }}>High &gt;70</span>
          <span className="net-totals">
            {displayData?.nodes?.length} people · {displayData?.edges?.length} links
          </span>
        </div>
      </div>

      {/* Main Panel Canvas Area */}
      {viewMode === 'graph' ? (
        <div className="net-canvas" ref={containerRef} />
      ) : (
        <div className="net-corkboard">
          {tooManyNodes ? (
            <div className="board-chaos-prompt">
              <h3>Too Many Suspects ({displayData?.nodes?.length})</h3>
              <p>
                Rendering more than 50 suspect cards on the board creates visual clutter.
                Please raise the "Min shared cases" filter or switch to Graph view.
              </p>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button className="btn-ghost" onClick={() => setMinShared(prev => Math.min(5, prev + 1))}>
                  Increase Min Shared Cases
                </button>
                <button className="btn-ghost" onClick={() => setViewMode('graph')}>
                  Switch to Graph View
                </button>
              </div>
            </div>
          ) : (
            <div className="corkboard-container">
              {/* Title corner block */}
              <div className="board-title-block">
                <h2>KAVACH — Investigative Network {(chatRows && chatRows.length > 0) || (chatEvidence && chatEvidence.length > 0) ? " (Chat Filtered)" : ""}</h2>
                <p>{displayData?.nodes?.length} suspects · {displayData?.edges?.length} connections · Min shared: {minShared}</p>
              </div>

              {/* Edge strings SVG overlay */}
              <svg className="strings-overlay">
                {displayData?.edges?.map((e, idx) => {
                  const pos1 = boardPositions[e.source];
                  const pos2 = boardPositions[e.target];
                  if (!pos1 || !pos2) return null;
                  
                  const isVisible = displayData.nodes.find(n => n.id === e.source && isBoardFiltered(n)) &&
                                    displayData.nodes.find(n => n.id === e.target && isBoardFiltered(n));
                  if (!isVisible) return null;

                  return (
                    <g key={idx}>
                      <line
                        x1={pos1.x + 80}
                        y1={pos1.y + 70}
                        x2={pos2.x + 80}
                        y2={pos2.y + 70}
                        stroke={getStringColor(e.weight)}
                        strokeWidth={Math.max(1, e.weight)}
                        opacity={0.65}
                      />
                      <foreignObject
                        x={(pos1.x + pos2.x) / 2 + 80 - 15}
                        y={(pos1.y + pos2.y) / 2 + 70 - 10}
                        width="30"
                        height="20"
                      >
                        <div 
                          className="string-midpoint" 
                          style={{ opacity: 0.75 }}
                          title={`${e.weight} shared cases`}
                        >
                          {e.weight}
                        </div>
                      </foreignObject>
                    </g>
                  );
                })}
              </svg>

              {/* Suspect Polaroid Cards */}
              {displayData?.nodes?.map((n) => {
                const pos = boardPositions[n.id];
                if (!pos || !isBoardFiltered(n)) return null;

                const isCardSelected = selected?.id === n.id;
                const borderStyles = n.heinousCount > 0
                  ? `${Math.max(2, n.heinousCount * 1.5)}px solid #b91c1c`
                  : '1px solid #c0bfb9';

                return (
                  <div
                    key={n.id}
                    className={`suspect-card ${isCardSelected ? 'selected' : ''}`}
                    style={{
                      left: `${pos.x}px`,
                      top: `${pos.y}px`,
                      transform: getRotation(n.id),
                      border: borderStyles
                    }}
                    onClick={() => setSelected(n)}
                  >
                    <div className="suspect-pin" />
                    <div className="suspect-photo">
                      {getInitials(n.name)}
                    </div>
                    <div className="suspect-info">
                      <div className="suspect-name" title={n.name}>
                        {n.name}
                      </div>
                      <div className="suspect-meta">
                        <span>Age: {n.age}</span>
                        <span 
                          className="suspect-cases-badge" 
                          title={`${n.caseCount} total cases`}
                        >
                          {n.caseCount} cases
                        </span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                        <span style={{ fontSize: '9px', fontWeight: 'bold', color: riskColor(n.risk) }}>
                          {riskLabel(n.risk)} Risk
                        </span>
                      </div>
                      {n.districts && n.districts.length > 0 && (
                        <div className="suspect-districts" title={n.districts.join(', ')}>
                          {n.districts[0]} {n.districts.length > 1 ? `+${n.districts.length - 1}` : ''}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

              {/* Legend Block */}
              <div className="board-legend">
                <div className="legend-item">
                  <div className="legend-line" style={{ background: '#ef4444' }} />
                  <span>&ge;3 shared cases</span>
                </div>
                <div className="legend-item">
                  <div className="legend-line" style={{ background: '#f5a623' }} />
                  <span>2 shared cases</span>
                </div>
                <div className="legend-item">
                  <div className="legend-line" style={{ background: '#3b82f6' }} />
                  <span>1 shared case</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Detail panel */}
      {selected && (
        <div className="net-panel" role="dialog" aria-label={`Details for ${selected.name}`}>
          <div className="net-panel-head">
            <h3>{selected.name}</h3>
            <button className="net-close" onClick={handleClosePanel} aria-label="Close panel">✕</button>
          </div>
          <div className="net-panel-body">
            <div className="net-meta">
              <span>Age: {selected.age}</span>
              <span>Cases: {selected.caseCount}</span>
              <span>Heinous: {selected.heinousCount}</span>
            </div>

            <div className="net-risk-row">
              <span className="net-risk-label">Risk Score</span>
              <div className="net-risk-bar-bg">
                <div
                  className="net-risk-bar-fill"
                  style={{
                    width: `${selected.risk}%`,
                    background: riskColor(selected.risk),
                  }}
                />
              </div>
              <span className="net-risk-val" style={{ color: riskColor(selected.risk) }}>
                {selected.risk} ({riskLabel(selected.risk)})
              </span>
            </div>

            {selected.districts && selected.districts.length > 0 && (
              <div className="net-section">
                <span className="net-section-label">Districts</span>
                <div className="net-chips">
                  {selected.districts.map((d, i) => (
                    <span key={i} className="ev-chip">{d}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Suspect cases list / timeline */}
            {selected.cases && selected.cases.length > 0 ? (
              <div className="net-section">
                <span className="net-section-label">Case Timeline</span>
                <div className="timeline">
                  {selected.cases.map((c, i) => (
                    <div key={i} className="timeline-item">
                      <div className={`timeline-dot ${c.heinous ? 'heinous' : ''}`} />
                      <div className="timeline-date">{c.date}</div>
                      <div className="timeline-title">{c.crimeNo}</div>
                      <div className="timeline-meta">
                        {CRIME_TYPES[c.typeId] || `Crime Type ${c.typeId}`} · {c.district}
                      </div>
                      <button
                        className="ev-chip ev-chip-btn"
                        onClick={() => onAskCase(c.crimeNo)}
                        style={{ marginTop: '6px', fontSize: '9px', padding: '2px 6px' }}
                      >
                        Ask about this case
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ) : selected.crimeNos && selected.crimeNos.length > 0 && (
              <div className="net-section">
                <span className="net-section-label">Cases</span>
                <div className="net-chips">
                  {selected.crimeNos.map((cn, i) => (
                    <button
                      key={i}
                      className="ev-chip ev-chip-btn"
                      onClick={() => onAskCase(cn)}
                      title={`Ask about case ${cn}`}
                    >
                      {cn}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
