import React, { useState } from 'react';

const HIDDEN = ['ROWID', 'CREATORID', 'MODIFIEDTIME', 'CREATEDTIME'];

const LOOKUPS = {
  CrimeMinorHeadID: {
    1: 'Murder', 2: 'Attempt to Murder', 3: 'Grievous Hurt', 4: 'Simple Hurt',
    5: 'Robbery', 6: 'Dacoity', 7: 'House Burglary', 8: 'Theft', 9: 'Vehicle Theft',
    10: 'Chain Snatching', 11: 'Cruelty by Husband', 12: 'Molestation', 13: 'Cheating',
    14: 'Criminal Breach of Trust', 15: 'Online Financial Fraud', 16: 'Identity Theft',
    17: 'NDPS Possession', 18: 'NDPS Trafficking', 19: 'Rioting', 20: 'Unlawful Assembly'
  },
  CrimeMajorHeadID: {
    1: 'Crimes Against Body', 2: 'Crimes Against Property', 3: 'Crimes Against Women',
    4: 'Economic Offences', 5: 'Cyber Crimes', 6: 'Narcotics', 7: 'Public Order'
  },
  GravityOffenceID: { 1: 'Heinous', 2: 'Non-Heinous' },
  CaseStatusID: {
    1: 'Under Investigation', 2: 'Charge Sheeted', 3: 'Closed - False Case',
    4: 'Closed - Undetected', 5: 'Trial'
  },
  CaseCategoryID: { 1: 'FIR', 2: 'UDR', 3: 'PAR', 4: 'Zero FIR' }
};

const COL_NAMES = {
  CrimeMinorHeadID: 'Crime Type',
  CrimeMajorHeadID: 'Crime Group',
  GravityOffenceID: 'Severity',
  CaseStatusID: 'Status',
  CaseCategoryID: 'Category'
};

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
            <tr>{cols.map(c => <th key={c}>{COL_NAMES[c] || c}</th>)}</tr>
          </thead>
          <tbody>
            {visible.map((row, i) => (
              <tr key={i}>
                {cols.map(c => {
                  let val = String(row[c] ?? '');
                  if (LOOKUPS[c] && LOOKUPS[c][val]) {
                    val = `${val} — ${LOOKUPS[c][val]}`;
                  }
                  return <td key={c} title={val}>{val}</td>;
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
