import React, { useState } from 'react';
import { useCaseWorkspace } from '../../hooks/useCaseWorkspace';
import CaseSummaryCard from './CaseSummaryCard';
import TimelineTab from './TimelineTab';
import EvidenceTab from './EvidenceTab';
import AccusedTab from './AccusedTab';
import RelatedCasesTab from './RelatedCasesTab';
import OfficerNotes from './OfficerNotes';
import SuggestedActions from './SuggestedActions';
import '../../workspace.css';

const TABS = ['Timeline', 'Evidence', 'Accused', 'Victims', 'Vehicles', 'Phones', 'Locations', 'Documents', 'Related Cases', 'Officer Notes'];

export default function InvestigationWorkspace({ caseId, onClose }) {
  const { data, loading, error } = useCaseWorkspace(caseId);
  const [activeTab, setActiveTab] = useState('Timeline');

  if (loading) {
    return (
      <div className="workspace-container workspace-loading">
        <div className="workspace-shimmer" />
        <p>Loading Case Command Center for {caseId}...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="workspace-container workspace-error">
        <p>Failed to load workspace for case {caseId}.</p>
        <button className="btn-close" onClick={onClose}>Close</button>
      </div>
    );
  }

  return (
    <div className="workspace-container">
      <div className="workspace-header-bar">
        <h2>INVESTIGATION WORKSPACE</h2>
        <button className="btn-close-workspace" onClick={onClose} aria-label="Close Workspace">×</button>
      </div>

      <CaseSummaryCard data={data} />

      <div className="workspace-body">
        <div className="workspace-main">
          <div className="workspace-tabs">
            {TABS.map(tab => (
              <button 
                key={tab} 
                className={`workspace-tab ${activeTab === tab ? 'active' : ''}`}
                onClick={() => setActiveTab(tab)}
              >
                {tab}
              </button>
            ))}
          </div>

          <div className="workspace-tab-content">
            {activeTab === 'Timeline' && <TimelineTab timeline={data.timeline} />}
            {activeTab === 'Evidence' && <EvidenceTab evidence={data.evidence} />}
            {activeTab === 'Accused' && <AccusedTab accused={data.accused} />}
            {activeTab === 'Related Cases' && <RelatedCasesTab relatedCases={data.relatedCases} />}
            {activeTab === 'Officer Notes' && <OfficerNotes notes={data.notes} />}
            
            {/* Placeholders for other tabs */}
            {!['Timeline', 'Evidence', 'Accused', 'Related Cases', 'Officer Notes'].includes(activeTab) && (
              <div className="workspace-empty-state">
                <span className="empty-icon">📁</span>
                <p>No data available for {activeTab}</p>
              </div>
            )}
          </div>
        </div>

        <div className="workspace-sidebar">
          <SuggestedActions />
          <button className="btn-export-report">Export Report</button>
        </div>
      </div>
    </div>
  );
}
