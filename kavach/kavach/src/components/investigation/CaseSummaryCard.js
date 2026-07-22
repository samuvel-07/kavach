import React from 'react';

export default function CaseSummaryCard({ data }) {
  return (
    <div className="case-summary-card">
      <div className="summary-grid">
        <div className="summary-item">
          <span className="summary-label">Crime No</span>
          <span className="summary-value highlight">{data.crimeNumber}</span>
        </div>
        <div className="summary-item">
          <span className="summary-label">FIR Date</span>
          <span className="summary-value">{data.firDate}</span>
        </div>
        <div className="summary-item">
          <span className="summary-label">Police Station</span>
          <span className="summary-value">{data.policeStation}</span>
        </div>
        <div className="summary-item">
          <span className="summary-label">Status</span>
          <span className={`summary-value status-badge status-${data.status.toLowerCase()}`}>{data.status}</span>
        </div>
        <div className="summary-item">
          <span className="summary-label">Officer</span>
          <span className="summary-value">{data.officer}</span>
        </div>
        <div className="summary-item">
          <span className="summary-label">Crime Type</span>
          <span className="summary-value">{data.crimeType}</span>
        </div>
        <div className="summary-item">
          <span className="summary-label">Priority</span>
          <span className={`summary-value priority-badge priority-${data.priority.toLowerCase()}`}>{data.priority}</span>
        </div>
      </div>
    </div>
  );
}
