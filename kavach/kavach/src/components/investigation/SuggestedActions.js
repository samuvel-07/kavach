import React from 'react';

const ACTIONS = [
  "Verify Phone Records",
  "Compare Similar FIR",
  "Check CCTV",
  "Contact Witness",
  "Search Vehicle",
  "Open Network Analysis",
  "Open Heatmap"
];

export default function SuggestedActions() {
  return (
    <div className="suggested-actions-container">
      <h3>Recommended Actions</h3>
      <ul className="action-list">
        {ACTIONS.map((action, i) => (
          <li key={i} className="action-item">
            <span className="action-check">✔</span>
            <span className="action-text">{action}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
