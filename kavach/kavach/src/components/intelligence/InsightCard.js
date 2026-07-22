import React from 'react';

export default function InsightCard({ insight }) {
  const { title, description, icon, severity } = insight;
  
  return (
    <div className={`intel-card intel-severity-${severity}`}>
      <div className="intel-card-header">
        <div className="intel-card-title-wrap">
          <span className="intel-icon">{icon}</span>
          <span className="intel-title">{title}</span>
        </div>
      </div>
      <div className="intel-card-body">
        <p className="intel-desc">{description}</p>
      </div>
    </div>
  );
}
