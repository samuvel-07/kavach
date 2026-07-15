import React, { useState } from 'react';
import EvidenceChips from './EvidenceChips';
import ResultsTable from './ResultsTable';

function SqlBlock({ sql }) {
  const [open, setOpen] = useState(false);
  if (!sql) return null;
  return (
    <div className="sql-block">
      <button className="sql-trigger" onClick={() => setOpen(!open)} aria-expanded={open} aria-label="Toggle SQL query view">
        <span className={`sql-arrow ${open ? 'open' : ''}`} aria-hidden="true">▶</span>
        View SQL
      </button>
      {open && <pre className="sql-code">{sql}</pre>}
    </div>
  );
}

function TechDetails({ detail, traceSql }) {
  const [open, setOpen] = useState(false);
  if (!detail && !traceSql) return null;
  return (
    <div className="tech-details">
      <button className="tech-toggle" onClick={() => setOpen(!open)} aria-expanded={open} aria-label="Toggle technical details">
        <span className={`sql-arrow ${open ? 'open' : ''}`} aria-hidden="true">▶</span>
        Technical details
      </button>
      {open && (
        <div className="tech-content">
          {traceSql && <div className="error-trace"><span className="trace-label">SQL attempted:</span> {traceSql}</div>}
          {detail && <div className="error-trace"><span className="trace-label">Detail:</span> {detail}</div>}
        </div>
      )}
    </div>
  );
}

export default function MessageCard({ msg, onRetry }) {
  /* User message */
  if (msg.role === 'user') {
    return (
      <div className="msg user" role="listitem">
        <div className="msg-avatar" aria-label="User">U</div>
        <div className="msg-content">
          <div className="msg-user-text">{msg.text}</div>
        </div>
      </div>
    );
  }

  /* Assistant: loading */
  if (msg.loading) {
    return (
      <div className="msg assistant" role="listitem">
        <div className="msg-avatar" aria-label="KAVACH">K</div>
        <div className="msg-content">
          <div className="card">
            <div className="thinking" aria-label="Thinking">
              <div className="think-dot" />
              <div className="think-dot" />
              <div className="think-dot" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* Assistant: error */
  if (msg.error) {
    return (
      <div className="msg assistant" role="listitem">
        <div className="msg-avatar" aria-label="KAVACH">K</div>
        <div className="msg-content">
          <div className="card error-card">
            <div className="card-body">
              <div className="error-text">⚠ {msg.error}</div>
              <TechDetails detail={msg.detail} traceSql={msg.traceSql} />
              {onRetry && (
                <button className="btn-retry" onClick={onRetry} aria-label="Retry this question">Retry</button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* Assistant: success — 4 layers */
  return (
    <div className="msg assistant" role="listitem">
      <div className="msg-avatar" aria-label="KAVACH">K</div>
      <div className="msg-content">
        <div className="card">
          <div className="card-body">
            <div className="answer-row">
              <div className="answer-text">{msg.answer}</div>
              {msg.selfCorrected && (
                <span className="badge-corrected" title="Query was auto-corrected after an initial failure">⟳ self-corrected</span>
              )}
            </div>
            <EvidenceChips evidence={msg.evidence} />
          </div>
          <SqlBlock sql={msg.sql} />
          <ResultsTable rows={msg.rows} rowCount={msg.rowCount} />
        </div>
      </div>
    </div>
  );
}
