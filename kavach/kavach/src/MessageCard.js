import React, { useState } from 'react';
import EvidenceChips from './EvidenceChips';
import ResultsTable from './ResultsTable';

function SqlBlock({ sql }) {
  const [open, setOpen] = useState(false);
  if (!sql) return null;
  return (
    <div className="sql-block">
      <button className="sql-trigger" onClick={() => setOpen(!open)}>
        <span className={`sql-arrow ${open ? 'open' : ''}`}>▶</span>
        View SQL
      </button>
      {open && <div className="sql-code">{sql}</div>}
    </div>
  );
}

export default function MessageCard({ msg, onRetry }) {
  /* User message */
  if (msg.role === 'user') {
    return (
      <div className="msg user">
        <div className="msg-avatar">U</div>
        <div className="msg-content">
          <div className="msg-user-text">{msg.text}</div>
        </div>
      </div>
    );
  }

  /* Assistant: loading */
  if (msg.loading) {
    return (
      <div className="msg assistant">
        <div className="msg-avatar">K</div>
        <div className="msg-content">
          <div className="card">
            <div className="thinking">
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
      <div className="msg assistant">
        <div className="msg-avatar">K</div>
        <div className="msg-content">
          <div className="card error-card">
            <div className="card-body">
              <div className="error-text">⚠ {msg.error}</div>
              {msg.traceSql && (
                <div className="error-trace">SQL attempted: {msg.traceSql}</div>
              )}
              {onRetry && (
                <button className="btn-retry" onClick={onRetry}>Retry</button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* Assistant: success — 4 layers */
  return (
    <div className="msg assistant">
      <div className="msg-avatar">K</div>
      <div className="msg-content">
        <div className="card">
          <div className="card-body">
            <div className="answer-text">{msg.answer}</div>
            <EvidenceChips evidence={msg.evidence} />
          </div>
          <SqlBlock sql={msg.sql} />
          <ResultsTable rows={msg.rows} rowCount={msg.rowCount} />
        </div>
      </div>
    </div>
  );
}
