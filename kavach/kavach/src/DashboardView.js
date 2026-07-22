import React, { useState, useEffect } from 'react';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
  ReferenceArea,
} from 'recharts';

const API_BASE = process.env.NODE_ENV === 'development'
  ? 'https://kavach-60078268134.development.catalystserverless.in' : '';

const STATUS_NAMES = { 1: 'Under Investigation', 2: 'Charge Sheeted', 3: 'False Case', 4: 'Undetected', 5: 'Trial' };
const PIE_COLORS = ['#F5A623', '#22D3EE', '#34D399', '#F87171', '#A78BFA'];

function fmt(n) { return Number(n).toLocaleString(); }

function KPI({ label, value, caption }) {
  return (
    <div className="kpi">
      <div className="kpi-val">{value}</div>
      <div className="kpi-label">{label}</div>
      {caption && <div className="kpi-cap">{caption}</div>}
    </div>
  );
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tip">
      <div className="chart-tip-label">{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color || '#E6EBF4' }}>
          {p.name}: <strong>{fmt(p.value)}</strong>
        </div>
      ))}
    </div>
  );
};

export default function DashboardView() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const resp = await fetch(`${API_BASE}/server/api/api/stats`);
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        setData(await resp.json());
      } catch (e) { setError(String(e.message || e)); }
      finally { setLoading(false); }
    })();
  }, []);

  if (loading) {
    return (
      <div className="page-body"><div className="placeholder">
        <div className="thinking"><div className="think-dot"/><div className="think-dot"/><div className="think-dot"/></div>
        <p>Loading dashboard…</p>
      </div></div>
    );
  }
  if (error) {
    return (
      <div className="page-body"><div className="placeholder">
        <div className="placeholder-icon">⚠️</div><h3>Dashboard error</h3><p>{error}</p>
      </div></div>
    );
  }

  const { byMonth, byDistrict, byType, byStatus, snatchByMonth, total } = data;

  // KPIs
  const heinousCount = Object.entries(byType).reduce((s, [, c]) => s + c, 0); // placeholder, compute from raw
  const statusCounts = byStatus || {};
  const csRate = total > 0 ? (((Number(statusCounts[2] || 0) + Number(statusCounts[5] || 0)) / total) * 100).toFixed(1) : 0;
  const activeInv = Number(statusCounts[1] || 0);

  // Chart data
  const monthData = Object.entries(byMonth).sort(([a], [b]) => a.localeCompare(b))
    .map(([m, c]) => ({ month: m, cases: c }));

  const snatchData = Object.entries(snatchByMonth || {}).sort(([a], [b]) => a.localeCompare(b))
    .map(([m, c]) => ({ month: m, cases: c }));

  // Oct-Dec reference areas
  const years = [...new Set(snatchData.map(d => d.month.slice(0, 4)))];
  const octDecBands = years.map(y => ({ x1: `${y}-10`, x2: `${y}-12` }));

  const districtData = Object.entries(byDistrict)
    .filter(([d]) => d && d !== 'null' && d !== 'undefined')
    .sort(([, a], [, b]) => b - a).slice(0, 8)
    .map(([d, c]) => ({ district: d, cases: c }));

  const statusData = Object.entries(byStatus)
    .map(([id, c]) => ({ name: STATUS_NAMES[id] || `Status ${id}`, value: c }));

  return (
    <div className="page-body dash-page">
      <div className="dash-scroll">
        {/* KPI row */}
        <div className="kpi-row">
          <KPI label="Total Cases" value={fmt(total)} caption="All registered FIRs" />
          <KPI label="Chargesheet Rate" value={`${csRate}%`} caption="Charge sheeted + Trial" />
          <KPI label="Active Investigations" value={fmt(activeInv)} caption="Currently under investigation" />
          <KPI label="Crime Types" value={Object.keys(byType).length} caption="Distinct categories" />
        </div>

        {/* Charts grid */}
        <div className="dash-grid">
          {/* 1: Cases per month */}
          <div className="dash-card">
            <div className="dash-card-head">
              <h4>Cases per Month</h4>
              <span className="dash-card-cap">Monthly FIR registration trend</span>
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={monthData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1E2A42" />
                <XAxis dataKey="month" tick={{ fill: '#6B82A0', fontSize: 10 }} tickLine={false} />
                <YAxis tick={{ fill: '#6B82A0', fontSize: 10 }} tickLine={false} axisLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Line type="monotone" dataKey="cases" stroke="#F5A623" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* 2: Chain snatching trend */}
          <div className="dash-card">
            <div className="dash-card-head">
              <h4>Chain Snatching Trend</h4>
              <span className="dash-card-cap">Seasonal spike highlighted (Oct–Dec)</span>
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={snatchData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1E2A42" />
                {octDecBands.map((b, i) => (
                  <ReferenceArea key={i} x1={b.x1} x2={b.x2} fill="rgba(248,113,113,0.08)" />
                ))}
                <XAxis dataKey="month" tick={{ fill: '#6B82A0', fontSize: 10 }} tickLine={false} />
                <YAxis tick={{ fill: '#6B82A0', fontSize: 10 }} tickLine={false} axisLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Line type="monotone" dataKey="cases" stroke="#22D3EE" strokeWidth={2} dot={false} name="Chain snatching" />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* 3: Top districts */}
          <div className="dash-card">
            <div className="dash-card-head">
              <h4>Top 8 Districts</h4>
              <span className="dash-card-cap">By total registered cases</span>
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={districtData} layout="vertical" margin={{ left: 80 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1E2A42" horizontal={false} />
                <XAxis type="number" tick={{ fill: '#6B82A0', fontSize: 10 }} tickLine={false} axisLine={false} />
                <YAxis type="category" dataKey="district" tick={{ fill: '#9BB0C9', fontSize: 11 }} tickLine={false} axisLine={false} width={80} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="cases" fill="#F5A623" radius={[0, 4, 4, 0]} barSize={14} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* 4: Case status donut */}
          <div className="dash-card">
            <div className="dash-card-head">
              <h4>Case Status</h4>
              <span className="dash-card-cap">Distribution of investigation outcomes</span>
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={statusData}
                  cx="50%" cy="50%"
                  innerRadius={55} outerRadius={85}
                  dataKey="value"
                  stroke="#131C2E"
                  strokeWidth={2}
                >
                  {statusData.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
                <Legend
                  iconType="circle"
                  iconSize={8}
                  wrapperStyle={{ fontSize: 11, color: '#9BB0C9' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
