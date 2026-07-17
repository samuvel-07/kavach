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

/* ── Professional Heat Map ──
   Two-pass approach:
   Pass 1: Draw grayscale intensity blobs (additive blending so overlapping
           areas accumulate brightness → natural density appearance)
   Pass 2: Colorize via ImageData — map intensity to a blue→amber→red gradient
   Radius is zoom-adaptive so dots stay proportional at any zoom level. */

function HeatOverlay({ points }) {
  const map = useMap();
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!map || points.length === 0) return;
    const canvas = document.createElement('canvas');
    canvas.style.pointerEvents = 'none';
    canvasRef.current = canvas;
    const pane = map.getPane('overlayPane');
    pane.appendChild(canvas);

    // Color gradient lookup (256 entries)
    const gradCanvas = document.createElement('canvas');
    gradCanvas.width = 256; gradCanvas.height = 1;
    const gCtx = gradCanvas.getContext('2d');
    const grd = gCtx.createLinearGradient(0, 0, 256, 0);
    grd.addColorStop(0,    'rgba(0,0,0,0)');         // transparent
    grd.addColorStop(0.15, 'rgba(30,60,120,0.4)');   // deep blue
    grd.addColorStop(0.35, 'rgba(34,211,238,0.6)');  // cyan
    grd.addColorStop(0.55, 'rgba(245,166,35,0.75)'); // amber
    grd.addColorStop(0.75, 'rgba(248,113,113,0.85)');// red
    grd.addColorStop(1,    'rgba(255,255,255,0.95)');// white-hot
    gCtx.fillStyle = grd;
    gCtx.fillRect(0, 0, 256, 1);
    const palette = gCtx.getImageData(0, 0, 256, 1).data;

    function draw() {
      const size = map.getSize();
      canvas.width = size.x;
      canvas.height = size.y;
      canvas.style.position = 'absolute';
      const topLeft = map.containerPointToLayerPoint([0, 0]);
      canvas.style.transform = `translate(${topLeft.x}px, ${topLeft.y}px)`;
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Zoom-adaptive radius: smaller at zoom-out, bigger at zoom-in
      const zoom = map.getZoom();
      const radius = Math.max(4, Math.min(40, Math.pow(2, zoom - 5) * 6));
      const intensity = Math.min(0.12, 0.03 + (zoom - 6) * 0.008);

      // Pass 1: grayscale intensity with additive blending
      ctx.globalCompositeOperation = 'lighter';
      points.forEach(p => {
        const pt = map.latLngToContainerPoint([p.lat, p.lng]);
        // Skip offscreen points
        if (pt.x < -radius || pt.y < -radius || pt.x > canvas.width + radius || pt.y > canvas.height + radius) return;
        const g = ctx.createRadialGradient(pt.x, pt.y, 0, pt.x, pt.y, radius);
        const alpha = p.heinous ? intensity * 1.5 : intensity;
        g.addColorStop(0, `rgba(255,255,255,${alpha})`);
        g.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, radius, 0, Math.PI * 2);
        ctx.fill();
      });

      // Pass 2: colorize grayscale → palette
      ctx.globalCompositeOperation = 'source-over';
      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const px = imgData.data;
      for (let i = 0; i < px.length; i += 4) {
        const v = px[i]; // grayscale intensity (R channel from additive white)
        if (v === 0) continue;
        const idx = Math.min(255, v) * 4;
        px[i]     = palette[idx];
        px[i + 1] = palette[idx + 1];
        px[i + 2] = palette[idx + 2];
        px[i + 3] = palette[idx + 3];
      }
      ctx.putImageData(imgData, 0, 0);
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
              onClick={() => setMode('heat')} aria-label="Heat map view">Heat</button>
            <button className={`mode-btn ${mode === 'points' ? 'on' : ''}`}
              onClick={() => setMode('points')} aria-label="Point markers view">Points</button>
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
                <div style={{ color: '#E6EBF4', fontSize: '12px', lineHeight: 1.6 }}>
                  <strong style={{ color: '#F5A623' }}>{p.crimeNo}</strong><br />
                  {CRIME_TYPES[String(p.type)] || 'Unknown'}<br />
                  {p.district} · {p.date}<br />
                  <button
                    onClick={() => onAskCase(p.crimeNo)}
                    style={{
                      marginTop: 6, padding: '4px 10px', borderRadius: 4,
                      border: '1px solid #F5A623', background: 'rgba(245,166,35,0.1)',
                      color: '#F5A623', cursor: 'pointer', fontSize: 11,
                      fontWeight: 600,
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
