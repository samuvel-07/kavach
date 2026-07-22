import React, { useState, useCallback, useEffect } from 'react';
import './theme.css';
import Sidebar from './Sidebar';
import ChatView from './ChatView';
import NetworkView from './NetworkView';
import MapView from './MapView';
import DashboardView from './DashboardView';
import AuditView from './AuditView';

const API_BASE = process.env.NODE_ENV === 'development'
  ? 'https://kavach-60078268134.development.catalystserverless.in'
  : '';

function Toast({ text }) {
  return <div className="toast">{text}</div>;
}

function LoginGate() {
  return (
    <div className="login-gate">
      <div className="login-card">
        <div className="login-brand">
          <h1>KAVACH</h1>
          <p>Crime Intelligence Platform</p>
        </div>
        <div className="login-body">
          <div className="login-shield" aria-hidden="true">🛡️</div>
          <h2>Authorized Access Only</h2>
          <p>Karnataka State Police — Crime Intelligence System</p>
          <p className="login-sub">This system is restricted to authorized law enforcement personnel. Please sign in with your department credentials.</p>
          <a href="/__catalyst/auth/login" className="login-btn">
            Sign in with Zoho
          </a>
          <div className="login-footer">
            Protected by Zoho Catalyst Authentication
          </div>
        </div>
      </div>
    </div>
  );
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
  const [authState, setAuthState] = useState('loading'); // 'loading' | 'authenticated' | 'unauthenticated'
  const [user, setUser] = useState(null); // { email, name, role, pages }
  const [page, setPage] = useState('chat');
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [language, setLanguage] = useState('en');
  const [toast, setToast] = useState(null);
  const [boardData, setBoardData] = useState(null);
  const [boardLoading, setBoardLoading] = useState(false);

  // Auth check on mount
  useEffect(() => {
    (async () => {
      try {
        const resp = await fetch(`${API_BASE}/server/api/api/me`);
        if (resp.ok) {
          const data = await resp.json();
          setUser(data);
          setAuthState('authenticated');
        } else {
          setAuthState('unauthenticated');
        }
      } catch (_) {
        setAuthState('unauthenticated');
      }
    })();
  }, []);

  const showToast = useCallback((text) => {
    setToast(text);
    setTimeout(() => setToast(null), 2500);
  }, []);

  // Role-based nav gating
  const handleNav = useCallback((id) => {
    if (user && user.pages && !user.pages.includes(id)) {
      showToast(`${id.charAt(0).toUpperCase() + id.slice(1)} requires Supervisor access`);
      return;
    }
    setPage(id);
  }, [user, showToast]);

  // Fetch board data from chat context
  const fetchBoard = useCallback(async (evidence, rows) => {
    const crimeNos = evidence || [];
    // Extract accused names from rows if present
    const accusedNames = [...new Set(
      (rows || []).map(r => r.AccusedName).filter(Boolean)
    )].slice(0, 20);

    if (crimeNos.length === 0 && accusedNames.length === 0) return;

    setBoardLoading(true);
    try {
      const resp = await fetch(`${API_BASE}/server/api/api/board`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ crimeNos, accusedNames }),
      });
      if (resp.ok) {
        const data = await resp.json();
        setBoardData(data);
      }
    } catch (_) {
      // Board fetch failed silently — the graph mode is still available
    } finally {
      setBoardLoading(false);
    }
  }, []);

  const doSend = useCallback(async (text) => {
    const q = (typeof text === 'string' ? text : input).trim();
    if (!q || loading) return;
    setInput('');
    setLoading(true);

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
            insights: data.insights,
            selfCorrected: data.trace?.selfCorrected || false,
          };
          // Fire board fetch with chat context
          fetchBoard(data.evidence, data.rows);
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
  }, [input, loading, messages, language, fetchBoard]);

  const handleRetry = useCallback((idx) => {
    const msg = messages[idx];
    if (!msg?.question) return;
    setMessages(prev => prev.filter((_, i) => i !== idx));
    doSend(msg.question);
  }, [messages, doSend]);

  const doExport = async () => {
    if (messages.length === 0) {
      showToast('No chat history to export');
      return;
    }
    showToast('Generating report...');
    try {
      const resp = await fetch(`${API_BASE}/server/api/api/export-pdf`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages, title: 'KAVACH Report' })
      });
      const ct = resp.headers.get('content-type') || '';
      if (ct.includes('application/pdf')) {
        const blob = await resp.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'KAVACH-report.pdf';
        a.click();
        window.URL.revokeObjectURL(url);
      } else {
        const html = await resp.text();
        const win = window.open('', '_blank');
        win.document.write(html);
        win.document.close();
      }
    } catch (err) {
      showToast('Export failed');
    }
  };

  // Loading spinner while checking auth
  if (authState === 'loading') {
    return (
      <div className="login-gate">
        <div className="login-card">
          <div className="login-brand">
            <h1>KAVACH</h1>
            <p>Crime Intelligence Platform</p>
          </div>
          <div className="login-body">
            <div className="thinking" aria-label="Authenticating">
              <div className="think-dot" /><div className="think-dot" /><div className="think-dot" />
            </div>
            <p>Verifying credentials…</p>
          </div>
        </div>
      </div>
    );
  }

  // Login gate for unauthenticated users
  if (authState === 'unauthenticated') {
    return <LoginGate />;
  }

  const roleBadge = user?.role === 'supervisor' ? 'Supervisor' : 'Investigator';

  return (
    <div className="app-shell">
      <Sidebar active={page} onNav={handleNav} allowedPages={user?.pages} />
      <div className="main-area">
        <div className="topbar">
          <div className="topbar-left">
            Karnataka State Police — <span>Crime Intelligence</span>
          </div>
          <div className="topbar-right">
            <button className="btn-ghost" onClick={doExport}>
              Export Chat (PDF)
            </button>
            <div className="user-badge" title={user?.email || ''}>
              <span className={`role-dot ${user?.role === 'supervisor' ? 'role-super' : ''}`} />
              {user?.name || roleBadge}
            </div>
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
          <NetworkView 
            boardData={boardData}
            boardLoading={boardLoading}
            onAskCase={(crimeNo) => {
              setPage('chat');
              setTimeout(() => doSend(`Show all details of the case with CrimeNo ${crimeNo}`), 100);
            }} 
          />
        ) : page === 'map' ? (
          <MapView onAskCase={(crimeNo) => {
            setPage('chat');
            setTimeout(() => doSend(`Show all details of the case with CrimeNo ${crimeNo}`), 100);
          }} />
        ) : page === 'dashboard' ? (
          <DashboardView />
        ) : page === 'audit' ? (
          <AuditView />
        ) : (
          <PlaceholderPage id={page} />
        )}
      </div>
      {toast && <Toast text={toast} />}
    </div>
  );
}
