import React, { useState } from 'react';

const HIDDEN = ['ROWID', 'CREATORID', 'MODIFIEDTIME', 'CREATEDTIME'];

export default function ResultsTable({ rows, rowCount }) {
  const [expanded, setExpanded] = useState(false);
  if (!rows || rows.length === 0) return null;

  const cols = Object.keys(rows[0]).filter(c => !HIDDEN.includes(c));
  const visible = expanded ? rows : rows.slice(0, 10);

  return (
    <div className="results">
      <div className="results-bar">
        <span>
          Results <span style={{ color: 'var(--text-dim)' }}>
            ({rowCount} total{rows.length < rowCount ? `, first ${rows.length} shown` : ''})
          </span>
        </span>
        {rows.length > 10 && (
          <button className="btn-expand" onClick={() => setExpanded(!expanded)}>
            {expanded ? 'Show less' : `Show all ${rows.length} rows`}
          </button>
        )}
      </div>
      <div className="tbl-wrap">
        <table className="tbl">
          <thead>
            <tr>{cols.map(c => <th key={c}>{c}</th>)}</tr>
          </thead>
          <tbody>
            {visible.map((row, i) => (
              <tr key={i}>
                {cols.map(c => (
                  <td key={c} title={String(row[c] ?? '')}>{String(row[c] ?? '')}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
