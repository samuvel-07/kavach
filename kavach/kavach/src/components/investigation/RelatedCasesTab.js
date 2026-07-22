import React from 'react';

export default function RelatedCasesTab({ relatedCases }) {
  if (!relatedCases || relatedCases.length === 0) {
    return <div className="workspace-empty-state">No related cases found.</div>;
  }

  return (
    <div className="related-cases-grid">
      {relatedCases.map((rc, i) => (
        <div key={i} className="related-case-card fade-in-up" style={{ animationDelay: `${i * 0.05}s` }}>
          <div className="rc-header">
            <h4>Case #{rc.id}</h4>
            <div className="rc-confidence">{rc.confidence}% Match</div>
          </div>
          <div className="rc-reasons">
            <div className="rc-label">AI Matched On:</div>
            <ul className="rc-reason-list">
              {rc.reasons.map((r, idx) => (
                <li key={idx}>✓ {r}</li>
              ))}
            </ul>
          </div>
        </div>
      ))}
    </div>
  );
}
