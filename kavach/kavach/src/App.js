import React, { useState, useCallback } from 'react';
import './theme.css';
import Sidebar from './Sidebar';
import ChatView from './ChatView';
import NetworkView from './NetworkView';
import MapView from './MapView';
import DashboardView from './DashboardView';

const API_BASE = process.env.NODE_ENV === 'development'
  ? 'https://kavach-60078268134.development.catalystserverless.in'
  : '';

function Toast({ text }) {
  return <div className="toast">{text}</div>;
}

function PlaceholderPage({ id }) {
  const meta = {
    audit: { icon: '📋', label: 'Query Audit Log' },
  };
  const m = meta[id] || { icon: '📦', label: id };
  return (
    <div className="placeholder">
      <div className="placeholder-icon">{m.icon}</div>
      <h3>{m.label}</h3>
      <p>Coming online — module under development.</p>
    </div>
  );
}

export default function App() {
  const [page, setPage] = useState('chat');
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [language, setLanguage] = useState('en');
  const [toast, setToast] = useState(null);

  const showToast = useCallback((text) => {
    setToast(text);
    setTimeout(() => setToast(null), 2500);
  }, []);

  const doSend = useCallback(async (text) => {
    const q = (typeof text === 'string' ? text : input).trim();
    if (!q || loading) return;
    setInput('');
    setLoading(true);

    // Build history from past assistant turns (last 6)
    const history = messages
      .filter(m => m.role === 'assistant' && m.sql)
      .slice(-6)
      .map(m => ({ question: m.question, sql: m.sql }));

    setMessages(prev => [
      ...prev,
      { role: 'user', text: q },
      { role: 'assistant', loading: true },
    ]);

    try {
      const resp = await fetch(`${API_BASE}/server/api/api/ask`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: q, history, language }),
      });
      const data = await resp.json();

      setMessages(prev => {
        const next = [...prev];
        if (!resp.ok) {
          next[next.length - 1] = {
            role: 'assistant',
            error: data.error || `Server error ${resp.status}`,
            detail: data.detail,
            traceSql: data.trace?.sql || data.trace?.rawSQL,
            question: q,
          };
        } else {
          next[next.length - 1] = {
            role: 'assistant',
            question: q,
            answer: data.answer,
            sql: data.sql,
            rows: data.rows,
            rowCount: data.rowCount,
            evidence: data.evidence,
            selfCorrected: data.trace?.selfCorrected || false,
          };
        }
        return next;
      });
    } catch (err) {
      setMessages(prev => {
        const next = [...prev];
        next[next.length - 1] = {
          role: 'assistant',
          error: 'Network error — check your connection or deployment.',
          question: q,
        };
        return next;
      });
    } finally {
      setLoading(false);
    }
  }, [input, loading, messages, language]);

  const handleRetry = useCallback((idx) => {
    const msg = messages[idx];
    if (!msg?.question) return;
    // Remove the error message
    setMessages(prev => prev.filter((_, i) => i !== idx));
    doSend(msg.question);
  }, [messages, doSend]);

  return (
    <div className="app-shell">
      <Sidebar active={page} onNav={setPage} />
      <div className="main-area">
        <div className="topbar">
          <div className="topbar-left">
            Karnataka State Police — <span>Crime Intelligence</span>
          </div>
          <div className="topbar-right">
            <button className="btn-ghost" onClick={() => showToast('PDF export arrives in v2')}>
              Export Chat (PDF)
            </button>
            <div className="user-badge">Investigator</div>
          </div>
        </div>

        {page === 'chat' ? (
          <ChatView
            messages={messages}
            input={input}
            setInput={setInput}
            onSend={doSend}
            loading={loading}
            language={language}
            setLanguage={setLanguage}
            onRetry={handleRetry}
          />
        ) : page === 'network' ? (
          <NetworkView onAskCase={(crimeNo) => {
            setPage('chat');
            setTimeout(() => doSend(`Give me a summary of case ${crimeNo}`), 100);
          }} />
        ) : page === 'map' ? (
          <MapView onAskCase={(crimeNo) => {
            setPage('chat');
            setTimeout(() => doSend(`Give me a summary of case ${crimeNo}`), 100);
          }} />
        ) : page === 'dashboard' ? (
          <DashboardView />
        ) : (
          <PlaceholderPage id={page} />
        )}
      </div>
      {toast && <Toast text={toast} />}
    </div>
  );
}
