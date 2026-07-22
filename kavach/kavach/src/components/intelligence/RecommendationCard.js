import React from 'react';

export default function RecommendationCard({ insight }) {
  const { title, description, icon } = insight;
  
  return (
    <div className="intel-card intel-rec-card">
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
