import React, { useState, useEffect } from 'react';

const API_BASE = process.env.NODE_ENV === 'development'
  ? 'https://kavach-60078268134.development.catalystserverless.in'
  : '';

export default function AuditView() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [note, setNote] = useState(null);

  useEffect(() => {
    fetch(`${API_BASE}/server/api/api/audit`)
      .then(res => res.json())
      .then(data => {
        setLogs(data.logs || []);
        if (data.note) setNote(data.note);
        setLoading(false);
      })
      .catch(err => {
        setError(err.toString());
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="page-body" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="thinking"><div className="think-dot" /><div className="think-dot" /><div className="think-dot" /></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page-body" style={{ padding: '40px', color: '#f87171' }}>
        <h3>Error loading audit logs</h3>
        <p>{error}</p>
      </div>
    );
  }

  return (
    <div className="page-body" style={{ padding: '24px', overflowY: 'auto' }}>
      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ margin: '0 0 8px 0', color: '#f8fafc', fontSize: '20px' }}>System Audit Log</h2>
        <p style={{ margin: 0, color: '#94a3b8', fontSize: '13px' }}>
          Immutable record of all AI and database queries executed by authorized personnel.
        </p>
      </div>

      {note && (
        <div style={{
          background: 'rgba(245, 166, 35, 0.1)',
          border: '1px solid rgba(245, 166, 35, 0.25)',
          borderRadius: '8px',
          padding: '12px 16px',
          marginBottom: '16px',
          fontSize: '13px',
          color: '#f5a623',
          lineHeight: '1.6'
        }}>
          <strong>⚠ Note:</strong> {note}
        </div>
      )}

      <div style={{ background: 'rgba(30, 41, 59, 0.5)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', minWidth: '700px' }}>
            <thead>
              <tr style={{ background: '#1e293b', textAlign: 'left', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                <th style={{ padding: '12px 16px', color: '#94a3b8', fontWeight: 600, whiteSpace: 'nowrap' }}>Timestamp</th>
                <th style={{ padding: '12px 16px', color: '#94a3b8', fontWeight: 600, whiteSpace: 'nowrap' }}>User</th>
                <th style={{ padding: '12px 16px', color: '#94a3b8', fontWeight: 600, whiteSpace: 'nowrap' }}>Action / Query</th>
                <th style={{ padding: '12px 16px', color: '#94a3b8', fontWeight: 600, whiteSpace: 'nowrap' }}>Status</th>
                <th style={{ padding: '12px 16px', color: '#94a3b8', fontWeight: 600, whiteSpace: 'nowrap' }}>Rows</th>
                <th style={{ padding: '12px 16px', color: '#94a3b8', fontWeight: 600, whiteSpace: 'nowrap' }}>Execution Time</th>
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 ? (
                <tr>
                  <td colSpan="6" style={{ padding: '40px 24px', textAlign: 'center', color: '#64748b' }}>
                    <div style={{ fontSize: '32px', marginBottom: '12px', opacity: 0.4 }}>📋</div>
                    <div style={{ marginBottom: '8px', fontSize: '14px', color: '#94a3b8' }}>No audit logs found.</div>
                    <div style={{ fontSize: '12px' }}>Audit logs are automatically generated when you ask questions in Chat.</div>
                  </td>
                </tr>
              ) : (
                logs.map((log, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', backgroundColor: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)' }}>
                    <td style={{ padding: '12px 16px', color: '#cbd5e1', whiteSpace: 'nowrap', fontSize: '12px' }}>{log.timestamp}</td>
                    <td style={{ padding: '12px 16px', color: '#38bdf8', whiteSpace: 'nowrap' }}>{log.user}</td>
                    <td style={{ padding: '12px 16px', color: '#f1f5f9', maxWidth: '350px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={log.query}>
                      {log.query}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ 
                        padding: '2px 8px', 
                        borderRadius: '12px', 
                        fontSize: '11px', 
                        fontWeight: 600,
                        background: log.status === 'Success' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                        color: log.status === 'Success' ? '#34d399' : '#f87171'
                      }}>
                        {log.status}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', color: '#cbd5e1', textAlign: 'center' }}>{log.rowCount ?? '—'}</td>
                    <td style={{ padding: '12px 16px', color: '#cbd5e1', whiteSpace: 'nowrap' }}>{log.executionTime}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
