import React from 'react';

export default function EvidenceTab({ evidence }) {
  if (!evidence || evidence.length === 0) {
    return <div className="workspace-empty-state">No evidence recorded.</div>;
  }

  const getEvidenceIcon = (type) => {
    const t = type.toLowerCase();
    if (t.includes('knife') || t.includes('weapon')) return '🔪';
    if (t.includes('cctv') || t.includes('video')) return '📹';
    if (t.includes('fingerprint')) return '🖐️';
    if (t.includes('dna')) return '🧬';
    return '📄';
  };

  return (
    <div className="evidence-grid">
      {evidence.map((item, i) => (
        <div key={i} className="evidence-card fade-in-up" style={{ animationDelay: `${i * 0.05}s` }}>
          <div className="evidence-icon">{getEvidenceIcon(item.type)}</div>
          <div className="evidence-details">
            <h4>{item.type}</h4>
            <div className={`evidence-status status-${item.status.toLowerCase()}`}>{item.status}</div>
            {item.detail && <div className="evidence-meta">{item.detail}</div>}
          </div>
        </div>
      ))}
    </div>
  );
}
