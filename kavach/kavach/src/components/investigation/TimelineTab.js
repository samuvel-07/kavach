import React from 'react';

export default function TimelineTab({ timeline }) {
  if (!timeline || timeline.length === 0) {
    return <div className="workspace-empty-state">No timeline events found.</div>;
  }

  return (
    <div className="timeline-container">
      {timeline.map((item, i) => (
        <div key={i} className="timeline-event fade-in-up" style={{ animationDelay: `${i * 0.1}s` }}>
          <div className="timeline-dot"></div>
          <div className="timeline-content">
            <div className="timeline-date">{item.date}</div>
            <div className="timeline-title">{item.event}</div>
            {item.details && <div className="timeline-details">{item.details}</div>}
          </div>
        </div>
      ))}
    </div>
  );
}
