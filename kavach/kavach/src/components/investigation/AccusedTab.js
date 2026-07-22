import React from 'react';

export default function AccusedTab({ accused }) {
  if (!accused || accused.length === 0) {
    return <div className="workspace-empty-state">No accused recorded.</div>;
  }

  const openNetworkGraph = (name) => {
    // In a real app, this would emit an event to the parent ChatView to trigger a network search
    console.log("Opening network graph for:", name);
    alert(`Trigger Network Graph for: ${name}`);
  };

  return (
    <div className="accused-grid">
      {accused.map((person, i) => (
        <div 
          key={i} 
          className="accused-card fade-in-up" 
          style={{ animationDelay: `${i * 0.05}s` }}
          onClick={() => openNetworkGraph(person.name)}
          role="button"
          tabIndex={0}
        >
          <div className="accused-photo">
            👤
          </div>
          <div className="accused-details">
            <h4 className="accused-name">{person.name}</h4>
            <div className="accused-meta">Age: {person.age} | Alias: {person.alias}</div>
            {person.gang && <div className="accused-meta">Gang: {person.gang}</div>}
            
            <div className="accused-badges">
              {person.repeatOffender && <span className="badge badge-danger">Repeat Offender ({person.cases} FIRs)</span>}
              <span className={`badge badge-risk-${person.risk.toLowerCase()}`}>Risk: {person.risk}</span>
              <span className="badge badge-status">{person.status}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
