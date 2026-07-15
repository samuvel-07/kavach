import React, { useRef, useEffect, useState, useCallback } from 'react';
import cytoscape from 'cytoscape';

const API_BASE = process.env.NODE_ENV === 'development'
  ? 'https://kavach-60078268134.development.catalystserverless.in'
  : '';

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

export default function NetworkView({ onAskCase }) {
  const cyRef = useRef(null);
  const containerRef = useRef(null);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [minShared, setMinShared] = useState(2);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);

  const fetchGraph = useCallback(async (ms) => {
    setLoading(true);
    setError(null);
    try {
      const resp = await fetch(`${API_BASE}/server/api/api/network?minShared=${ms}&minCases=2`);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const d = await resp.json();
      setData(d);
    } catch (e) {
      setError(String(e.message || e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchGraph(minShared); }, [fetchGraph, minShared]);

  useEffect(() => {
    if (!data || !containerRef.current) return;

    const elements = [
      ...data.nodes.map(n => ({
        data: {
          id: n.id, label: n.name, ...n,
          size: Math.max(20, Math.min(60, 15 + n.caseCount * 8)),
          color: riskColor(n.risk),
        }
      })),
      ...data.edges.map((e, i) => ({
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
      layout: { name: 'cose', animate: false, nodeDimensionsIncludeLabels: true, randomize: true },
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
  }, [data]);

  // Search: highlight matching nodes
  useEffect(() => {
    if (!cyRef.current) return;
    const cy = cyRef.current;
    cy.nodes().removeClass('highlight');
    if (!search.trim()) return;
    const q = search.toLowerCase();
    const matches = cy.nodes().filter(n => n.data('name').toLowerCase().includes(q));
    matches.addClass('highlight');
    if (matches.length > 0) {
      cy.animate({ fit: { eles: matches, padding: 80 }, duration: 400 });
    }
  }, [search]);

  const handleFit = () => {
    if (cyRef.current) cyRef.current.animate({ fit: { padding: 40 }, duration: 300 });
  };

  const handleClosePanel = useCallback(() => setSelected(null), []);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') setSelected(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

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
          <button className="btn-ghost" onClick={handleFit} aria-label="Fit graph to view">Fit</button>
        </div>
        <div className="net-legend">
          <span className="legend-chip" style={{ background: '#5B8DEF' }}>Low &lt;40</span>
          <span className="legend-chip" style={{ background: '#F5A623' }}>Med 40–70</span>
          <span className="legend-chip" style={{ background: '#F87171' }}>High &gt;70</span>
          <span className="net-totals">
            {data?.totals?.people} people · {data?.totals?.links} links
          </span>
        </div>
      </div>

      {/* Canvas */}
      <div className="net-canvas" ref={containerRef} />

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

            {selected.crimeNos && selected.crimeNos.length > 0 && (
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
