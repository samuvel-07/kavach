import React, { useState, useCallback } from 'react';
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

function SpeakButton({ text }) {
  const [speaking, setSpeaking] = useState(false);

  const speak = useCallback(() => {
    if (!('speechSynthesis' in window)) return;

    if (speaking) {
      window.speechSynthesis.cancel();
      setSpeaking(false);
      return;
    }

    const utterance = new SpeechSynthesisUtterance(text);
    // Detect if text is mostly Kannada Unicode range
    const knChars = (text.match(/[\u0C80-\u0CFF]/g) || []).length;
    utterance.lang = knChars > text.length * 0.15 ? 'kn-IN' : 'en-IN';
    utterance.rate = 0.95;
    utterance.pitch = 1;

    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);

    setSpeaking(true);
    window.speechSynthesis.speak(utterance);
  }, [text, speaking]);

  if (!('speechSynthesis' in window)) return null;

  return (
    <button
      className={`speak-btn ${speaking ? 'speaking' : ''}`}
      onClick={speak}
      title={speaking ? 'Stop speaking' : 'Read aloud'}
      aria-label={speaking ? 'Stop reading' : 'Read answer aloud'}
    >
      {speaking ? (
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
          <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
          <path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>
        </svg>
      )}
    </button>
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
              <div className="answer-actions">
                {msg.selfCorrected && (
                  <span className="badge-corrected" title="Query was auto-corrected after an initial failure">⟳ self-corrected</span>
                )}
                <SpeakButton text={msg.answer} />
              </div>
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
