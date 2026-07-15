import React, { useState, useRef, useEffect, useCallback } from 'react';
import './index.css';

const API_BASE = '/server/api';

const NAV_ITEMS = [
  { id: 'chat', label: 'Chat', icon: '💬' },
  { id: 'network', label: 'Network', icon: '🕸️', badge: 'Soon' },
  { id: 'map', label: 'Map', icon: '🗺️', badge: 'Soon' },
  { id: 'dashboard', label: 'Dashboard', icon: '📊', badge: 'Soon' },
  { id: 'audit', label: 'Audit', icon: '📋', badge: 'Soon' },
];

const QUICK_PROMPTS = [
  'How many robbery cases were registered in 2025?',
  'Show repeat offenders with more than 2 cases',
  'List murder cases in Bengaluru City',
  'What is the chargesheet rate for cyber crimes?',
  'Find all cases involving accused named Chandru',
  'Top 5 crime types by count in 2024',
];

/* ─── SQL Toggle ─── */
function SqlSection({ sql }) {
  const [open, setOpen] = useState(false);
  if (!sql) return null;
  return (
    <div className="sql-section">
      <button className="sql-toggle" onClick={() => setOpen(!open)}>
        <span className={`sql-toggle-arrow ${open ? 'open' : ''}`}>▶</span>
        View ZCQL Query
      </button>
      {open && <div className="sql-code">{sql}</div>}
    </div>
  );
}

/* ─── Evidence Chips ─── */
function EvidenceChips({ evidence }) {
  if (!evidence || evidence.length === 0) return null;
  return (
    <div className="evidence-chips">
      <span className="evidence-label">Evidence</span>
      {evidence.slice(0, 20).map((e, i) => (
        <span key={i} className="evidence-chip" title={`Case: ${e}`}>{e}</span>
      ))}
      {evidence.length > 20 && (
        <span className="evidence-chip" style={{ opacity: 0.5 }}>+{evidence.length - 20} more</span>
      )}
    </div>
  );
}

/* ─── Results Table ─── */
function ResultsTable({ rows, rowCount }) {
  const [showAll, setShowAll] = useState(false);
  if (!rows || rows.length === 0) return null;

  const cols = Object.keys(rows[0]).filter(c => c !== 'ROWID' && c !== 'CREATORID' && c !== 'MODIFIEDTIME' && c !== 'CREATEDTIME');
  const display = showAll ? rows : rows.slice(0, 10);

  return (
    <div className="results-section">
      <div className="results-header">
        <span>Results <span className="results-count">({rowCount} total{rows.length < rowCount ? `, showing ${rows.length}` : ''})</span></span>
        {rows.length > 10 && (
          <button className="show-all-btn" onClick={() => setShowAll(!showAll)}>
            {showAll ? 'Show less' : `Show all ${rows.length}`}
          </button>
        )}
      </div>
      <div className="results-table-wrap">
        <table className="results-table">
          <thead>
            <tr>{cols.map(c => <th key={c}>{c}</th>)}</tr>
          </thead>
          <tbody>
            {display.map((row, i) => (
              <tr key={i}>{cols.map(c => <td key={c} title={String(row[c] ?? '')}>{String(row[c] ?? '')}</td>)}</tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ─── Message Component ─── */
function Message({ msg }) {
  if (msg.role === 'user') {
    return (
      <div className="message user">
        <div className="message-avatar">U</div>
        <div className="message-body">
          <div className="message-text">{msg.text}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="message assistant">
      <div className="message-avatar">K</div>
      <div className="message-body">
        <div className="answer-block">
          {msg.loading ? (
            <div className="typing-indicator">
              <div className="typing-dot" />
              <div className="typing-dot" />
              <div className="typing-dot" />
            </div>
          ) : msg.error ? (
            <div className="answer-text" style={{ color: 'var(--error)' }}>
              ⚠ {msg.error}
            </div>
          ) : (
            <>
              <div className="answer-text">{msg.answer}</div>
              <SqlSection sql={msg.sql} />
              <EvidenceChips evidence={msg.evidence} />
              <ResultsTable rows={msg.rows} rowCount={msg.rowCount} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Main App ─── */
function App() {
  const [activeNav, setActiveNav] = useState('chat');
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [language, setLanguage] = useState('en');
  const chatRef = useRef(null);
  const textareaRef = useRef(null);

  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }
  }, [messages]);

  const autoResize = useCallback(() => {
    const ta = textareaRef.current;
    if (ta) {
      ta.style.height = 'auto';
      ta.style.height = Math.min(ta.scrollHeight, 120) + 'px';
    }
  }, []);

  const sendMessage = async (text) => {
    if (!text.trim() || loading) return;
    const question = text.trim();
    setInput('');
    setLoading(true);

    // Build history from previous exchanges
    const history = messages
      .filter(m => m.role === 'assistant' && m.sql)
      .slice(-4)
      .map(m => ({ question: m.question, sql: m.sql }));

    // Add user message
    setMessages(prev => [...prev, { role: 'user', text: question }]);

    // Add loading placeholder
    setMessages(prev => [...prev, { role: 'assistant', loading: true }]);

    try {
      const resp = await fetch(`${API_BASE}/api/ask`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, history, language }),
      });

      const data = await resp.json();

      if (!resp.ok) {
        setMessages(prev => {
          const next = [...prev];
          next[next.length - 1] = {
            role: 'assistant',
            error: data.error || `Server error (${resp.status})`,
            sql: data.trace?.sql,
          };
          return next;
        });
      } else {
        setMessages(prev => {
          const next = [...prev];
          next[next.length - 1] = {
            role: 'assistant',
            question,
            answer: data.answer,
            sql: data.sql,
            rows: data.rows,
            rowCount: data.rowCount,
            evidence: data.evidence,
          };
          return next;
        });
      }
    } catch (err) {
      setMessages(prev => {
        const next = [...prev];
        next[next.length - 1] = {
          role: 'assistant',
          error: 'Network error — check your connection or deployment.',
        };
        return next;
      });
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const renderPage = () => {
    if (activeNav !== 'chat') {
      const item = NAV_ITEMS.find(n => n.id === activeNav);
      return (
        <div className="main-content">
          <div className="main-header"><h2>{item?.label}</h2></div>
          <div className="placeholder-page">
            <div className="icon">{item?.icon}</div>
            <h3>{item?.label}</h3>
            <p>This module is under development.</p>
          </div>
        </div>
      );
    }

    return (
      <div className="main-content">
        <div className="main-header">
          <h2>Crime Intelligence Chat</h2>
          <div className="header-actions">
            <button
              className={`lang-toggle ${language === 'en' ? 'active' : ''}`}
              onClick={() => setLanguage('en')}
            >EN</button>
            <button
              className={`lang-toggle ${language === 'kn' ? 'active' : ''}`}
              onClick={() => setLanguage('kn')}
            >ಕನ್ನಡ</button>
          </div>
        </div>

        <div className="chat-area" ref={chatRef}>
          {messages.length === 0 ? (
            <div className="chat-welcome">
              <div className="welcome-icon">🛡️</div>
              <h3>KAVACH Intelligence</h3>
              <p>
                Ask questions about Karnataka Police FIR data in natural language.
                I'll translate your question to a database query, execute it, and
                give you a factual answer with evidence.
              </p>
              <div className="quick-prompts">
                {QUICK_PROMPTS.map((p, i) => (
                  <button
                    key={i}
                    className="quick-prompt"
                    onClick={() => sendMessage(p)}
                  >{p}</button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((msg, i) => <Message key={i} msg={msg} />)
          )}
        </div>

        <div className="input-bar">
          <div className="input-wrapper">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => { setInput(e.target.value); autoResize(); }}
              onKeyDown={handleKeyDown}
              placeholder="Ask about FIR data... (e.g., 'Show robbery cases in Mysuru')"
              rows={1}
              disabled={loading}
            />
            <button
              className="send-btn"
              onClick={() => sendMessage(input)}
              disabled={!input.trim() || loading}
              title="Send"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="sidebar-logo">
          <h1>KAVACH</h1>
          <p>Crime Intelligence</p>
        </div>
        <nav className="sidebar-nav">
          {NAV_ITEMS.map(item => (
            <div
              key={item.id}
              className={`nav-item ${activeNav === item.id ? 'active' : ''}`}
              onClick={() => setActiveNav(item.id)}
            >
              <span className="nav-icon">{item.icon}</span>
              {item.label}
              {item.badge && <span className="nav-badge">{item.badge}</span>}
            </div>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div className="sidebar-status">
            <span className="status-dot" />
            <span>Engine Online</span>
          </div>
        </div>
      </aside>
      {renderPage()}
    </div>
  );
}

export default App;
