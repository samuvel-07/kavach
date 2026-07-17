import React from 'react';

const ITEMS = [
  { id: 'chat',      label: 'Chat',      icon: <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/> },
  { id: 'network',   label: 'Network',   icon: <><circle cx="12" cy="5" r="2"/><circle cx="5" cy="19" r="2"/><circle cx="19" cy="19" r="2"/><line x1="12" y1="7" x2="5" y2="17"/><line x1="12" y1="7" x2="19" y2="17"/></> },
  { id: 'map',       label: 'Map',       icon: <><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/></> },
  { id: 'dashboard', label: 'Dashboard', icon: <><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></> },
  { id: 'audit',     label: 'Audit',     icon: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></>, tag: 'Soon' },
];

export default function Sidebar({ active, onNav }) {
  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <h1>KAVACH</h1>
        <p>Crime Intelligence</p>
      </div>
      <nav className="sidebar-nav">
        {ITEMS.map(it => (
          <button
            key={it.id}
            className={`nav-btn ${active === it.id ? 'active' : ''}`}
            onClick={() => onNav(it.id)}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              {it.icon}
            </svg>
            {it.label}
            {it.tag && <span className="nav-tag">{it.tag}</span>}
          </button>
        ))}
      </nav>
      <div className="sidebar-foot">
        <span className="dot-live" />
        Engine Online
      </div>
    </aside>
  );
}
