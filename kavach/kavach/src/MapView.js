import React, { useState, useEffect, useCallback, useRef } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

const API_BASE = process.env.NODE_ENV === 'development'
  ? 'https://kavach-60078268134.development.catalystserverless.in' : '';

const CRIME_TYPES = {
  '': 'All Crime Types', '1': 'Murder', '2': 'Attempt to Murder', '3': 'Grievous Hurt',
  '4': 'Simple Hurt', '5': 'Robbery', '6': 'Dacoity', '7': 'House Burglary',
  '8': 'Theft', '9': 'Vehicle Theft', '10': 'Chain Snatching', '11': 'Cruelty by Husband',
  '12': 'Molestation', '13': 'Cheating', '14': 'Criminal Breach of Trust',
  '15': 'Online Financial Fraud', '16': 'Identity Theft', '17': 'NDPS Possession',
  '18': 'NDPS Trafficking', '19': 'Rioting', '20': 'Unlawful Assembly',
};

/* Heat layer via canvas overlay — lightweight, no extra dep */
function HeatOverlay({ points }) {
  const map = useMap();
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!map || points.length === 0) return;
    const canvas = document.createElement('canvas');
    canvasRef.current = canvas;
    const pane = map.getPane('overlayPane');
    pane.appendChild(canvas);

    function draw() {
      const size = map.getSize();
      canvas.width = size.x;
      canvas.height = size.y;
      canvas.style.position = 'absolute';
      const topLeft = map.containerPointToLayerPoint([0, 0]);
      canvas.style.transform = `translate(${topLeft.x}px, ${topLeft.y}px)`;
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      points.forEach(p => {
        const pt = map.latLngToContainerPoint([p.lat, p.lng]);
        const r = 18;
        const grd = ctx.createRadialGradient(pt.x, pt.y, 0, pt.x, pt.y, r);
        if (p.heinous) {
          grd.addColorStop(0, 'rgba(248,113,113,0.6)');
          grd.addColorStop(1, 'rgba(248,113,113,0)');
        } else {
          grd.addColorStop(0, 'rgba(245,166,35,0.5)');
          grd.addColorStop(1, 'rgba(245,166,35,0)');
        }
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, r, 0, Math.PI * 2);
        ctx.fillStyle = grd;
        ctx.fill();
      });
    }

    draw();
    map.on('moveend zoomend', draw);
    return () => {
      map.off('moveend zoomend', draw);
      if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
    };
  }, [map, points]);

  return null;
}

export default function MapView({ onAskCase }) {
  const [points, setPoints] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [mode, setMode] = useState('heat');
  const [crimeType, setCrimeType] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const params = new URLSearchParams();
      if (crimeType) params.set('crimeType', crimeType);
      if (from) params.set('from', from + '-01');
      if (to) params.set('to', to + '-31');
      const resp = await fetch(`${API_BASE}/server/api/api/map?${params}`);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const d = await resp.json();
      setPoints(d.points || []);
      setTotal(d.total || 0);
    } catch (e) { setError(String(e.message || e)); }
    finally { setLoading(false); }
  }, [crimeType, from, to]);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (error) {
    return (
      <div className="page-body">
        <div className="placeholder">
          <div className="placeholder-icon">⚠️</div>
          <h3>Failed to load map data</h3>
          <p>{error}</p>
          <button className="btn-ghost" onClick={fetchData}>Retry</button>
        </div>
      </div>
    );
  }

  return (
    <div className="page-body map-page">
      <div className="map-controls">
        <div className="map-ctrl-left">
          <select
            value={crimeType}
            onChange={e => setCrimeType(e.target.value)}
            className="map-select"
            aria-label="Filter by crime type"
          >
            {Object.entries(CRIME_TYPES).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
          <input type="month" value={from} onChange={e => setFrom(e.target.value)}
            className="map-date" aria-label="From date" placeholder="From" />
          <input type="month" value={to} onChange={e => setTo(e.target.value)}
            className="map-date" aria-label="To date" placeholder="To" />
          <div className="map-mode-toggle">
            <button className={`mode-btn ${mode === 'heat' ? 'on' : ''}`}
              onClick={() => setMode('heat')}>Heat</button>
            <button className={`mode-btn ${mode === 'points' ? 'on' : ''}`}
              onClick={() => setMode('points')}>Points</button>
          </div>
        </div>
        <div className="map-badge">
          {loading ? '…' : total.toLocaleString()} incidents
        </div>
      </div>

      <div className="map-container">
        <MapContainer
          center={[15.0, 76.0]}
          zoom={7}
          style={{ height: '100%', width: '100%', background: '#0B1220' }}
          zoomControl={false}
        >
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            attribution='&copy; <a href="https://carto.com/">CARTO</a>'
          />
          {mode === 'heat' && <HeatOverlay points={points} />}
          {mode === 'points' && points.map(p => (
            <CircleMarker
              key={p.id}
              center={[p.lat, p.lng]}
              radius={p.heinous ? 5 : 3}
              pathOptions={{
                color: p.heinous ? '#F87171' : '#F5A623',
                fillColor: p.heinous ? '#F87171' : '#F5A623',
                fillOpacity: 0.7, weight: 0,
              }}
            >
              <Popup>
                <div style={{ color: '#0B1220', fontSize: '12px', lineHeight: 1.5 }}>
                  <strong>{p.crimeNo}</strong><br />
                  {CRIME_TYPES[String(p.type)] || 'Unknown'}<br />
                  {p.district} · {p.date}<br />
                  <button
                    onClick={() => onAskCase(p.crimeNo)}
                    style={{
                      marginTop: 4, padding: '3px 8px', borderRadius: 4,
                      border: '1px solid #F5A623', background: 'transparent',
                      color: '#F5A623', cursor: 'pointer', fontSize: 11,
                    }}
                  >Ask KAVACH about this case</button>
                </div>
              </Popup>
            </CircleMarker>
          ))}
        </MapContainer>
      </div>
    </div>
  );
}
