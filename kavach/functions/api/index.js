/**
 * KAVACH — api function (Catalyst Advanced I/O, Express)
 * ------------------------------------------------------
 * Routes:
 *   GET /health                 -> liveness check
 *   GET /admin/load             -> HTML page with one-click load links per table
 *   GET /admin/load/:table      -> loads that table's CSV from ./data into Data Store
 *   GET /admin/counts           -> row counts of all tables (verify after loading)
 *
 * Data loading design:
 *   - CSVs live in functions/api/data/*.csv (copied from data_generator/output)
 *   - One table per request to stay inside function execution timeouts
 *   - Inserts batched at 100 rows per SDK call
 *   - ADMIN_KEY guards the admin routes (?key=...)
 */

'use strict';

const express = require('express');
const fs = require('fs');
const path = require('path');
const catalyst = require('zcatalyst-sdk-node');

const app = express();
app.use(express.json());

const ADMIN_KEY = 'kavach2026'; // change if you like; used as ?key=kavach2026

// Only these tables exist in Data Store. Lookups are constants below.
const TABLES = [
  'District', 'Unit', 'Employee',
  'CaseMaster', 'ComplainantDetails', 'Victim', 'Accused',
  'ArrestSurrender', 'ActSectionAssociation', 'ChargesheetDetails'
];

// Integer columns per table (CSV gives strings; Data Store wants numbers)
const INT_COLS = {
  District: ['DistrictID', 'StateID', 'Active'],
  Unit: ['UnitID', 'TypeID', 'ParentUnit', 'NationalityID', 'StateID', 'DistrictID', 'Active'],
  Employee: ['EmployeeID', 'DistrictID', 'UnitID', 'RankID', 'DesignationID',
             'GenderID', 'BloodGroupID', 'PhysicallyChallenged'],
  CaseMaster: ['CaseMasterID', 'PolicePersonID', 'PoliceStationID', 'CaseCategoryID',
               'GravityOffenceID', 'CrimeMajorHeadID', 'CrimeMinorHeadID',
               'CaseStatusID', 'CourtID'],
  ComplainantDetails: ['ComplainantID', 'CaseMasterID', 'AgeYear', 'OccupationID',
                       'ReligionID', 'CasteID', 'GenderID'],
  Victim: ['VictimMasterID', 'CaseMasterID', 'AgeYear'],
  Accused: ['AccusedMasterID', 'CaseMasterID', 'AgeYear'],
  ArrestSurrender: ['ArrestSurrenderID', 'CaseMasterID', 'ArrestSurrenderTypeID',
                    'ArrestSurrenderStateId', 'ArrestSurrenderDistrictId',
                    'PoliceStationID', 'IOID', 'CourtID', 'AccusedMasterID',
                    'IsAccused', 'IsComplainantAccused'],
  ActSectionAssociation: ['CaseMasterID', 'ActOrderID', 'SectionOrderID'],
  ChargesheetDetails: ['CSID', 'CaseMasterID', 'PolicePersonID']
};

const FLOAT_COLS = { CaseMaster: ['latitude', 'longitude'] };

// ---- Lookup constants (replaces tiny Data Store tables; also feeds NL->SQL prompt) ----
const LOOKUPS = {
  CaseCategory: { 1: 'FIR', 2: 'UDR', 3: 'PAR', 4: 'Zero FIR' },
  GravityOffence: { 1: 'Heinous', 2: 'Non-Heinous' },
  CaseStatus: { 1: 'Under Investigation', 2: 'Charge Sheeted', 3: 'Closed - False Case',
                4: 'Closed - Undetected', 5: 'Trial' },
  CrimeHead: { 1: 'Crimes Against Body', 2: 'Crimes Against Property', 3: 'Crimes Against Women',
               4: 'Economic Offences', 5: 'Cyber Crimes', 6: 'Narcotics', 7: 'Public Order' },
  CrimeSubHead: {
    1: 'Murder', 2: 'Attempt to Murder', 3: 'Grievous Hurt', 4: 'Simple Hurt',
    5: 'Robbery', 6: 'Dacoity', 7: 'House Burglary', 8: 'Theft', 9: 'Vehicle Theft',
    10: 'Chain Snatching', 11: 'Cruelty by Husband', 12: 'Molestation', 13: 'Cheating',
    14: 'Criminal Breach of Trust', 15: 'Online Financial Fraud', 16: 'Identity Theft',
    17: 'NDPS Possession', 18: 'NDPS Trafficking', 19: 'Rioting', 20: 'Unlawful Assembly'
  },
  Occupation: { 1: 'Farmer', 2: 'Government Employee', 3: 'Private Employee', 4: 'Business',
                5: 'Student', 6: 'Homemaker', 7: 'Driver', 8: 'Daily Wage Worker',
                9: 'Retired', 10: 'Unemployed' },
  cstype: { A: 'Chargesheet', B: 'False Case', C: 'Undetected' }
};

// ------------------------------- helpers -------------------------------

/** Minimal RFC-4180 CSV parser (handles quoted fields, commas, escaped quotes). */
function parseCSV(text) {
  const rows = [];
  let row = [], field = '', inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (field !== '' || row.length) { row.push(field); rows.push(row); row = []; field = ''; }
      if (c === '\r' && text[i + 1] === '\n') i++;
    } else field += c;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  const header = rows.shift();
  return rows.map(r => Object.fromEntries(header.map((h, idx) => [h, r[idx] ?? ''])));
}

function coerceRow(table, row) {
  const out = { ...row };
  (INT_COLS[table] || []).forEach(c => { if (out[c] !== '') out[c] = parseInt(out[c], 10); });
  (FLOAT_COLS[table] || []).forEach(c => { if (out[c] !== '') out[c] = parseFloat(out[c]); });
  return out;
}

function requireKey(req, res) {
  if ((req.query.key || '') !== ADMIN_KEY) {
    res.status(403).json({ error: 'forbidden — append ?key=YOUR_ADMIN_KEY' });
    return false;
  }
  return true;
}

async function zcql(catalystApp, query) {
  return catalystApp.zcql().executeZCQLQuery(query);
}

// ------------------------------- routes -------------------------------

app.get('/health', (req, res) => res.json({ ok: true, app: 'KAVACH', time: new Date().toISOString() }));

// Index page with one-click load links
app.get('/admin/load', (req, res) => {
  if (!requireKey(req, res)) return;
  const links = TABLES.map(t =>
    `<li><a href="load/${t}?key=${req.query.key}">Load ${t}</a></li>`).join('');
  res.send(`<h2>KAVACH data loader</h2>
    <p>Click each table in order (top to bottom). Each opens in this tab; press Back and do the next.</p>
    <ol>${links}</ol>
    <p><a href="counts?key=${req.query.key}">Verify row counts</a></p>`);
});

// Load one table from bundled CSV
app.get('/admin/load/:table', async (req, res) => {
  if (!requireKey(req, res)) return;
  const table = req.params.table;
  if (!TABLES.includes(table)) return res.status(400).json({ error: `unknown table ${table}` });

  const csvPath = path.join(__dirname, 'data', `${table}.csv`);
  if (!fs.existsSync(csvPath)) return res.status(404).json({ error: `${table}.csv not bundled` });

  try {
    const catalystApp = catalyst.initialize(req);
    const rows = parseCSV(fs.readFileSync(csvPath, 'utf8')).map(r => coerceRow(table, r));
    const tableRef = catalystApp.datastore().table(table);

    let inserted = 0;
    for (let i = 0; i < rows.length; i += 100) {
      await tableRef.insertRows(rows.slice(i, i + 100));
      inserted += Math.min(100, rows.length - i);
    }
    res.json({ table, inserted, of: rows.length, status: 'done' });
  } catch (err) {
    res.status(500).json({ table, error: String(err && err.message || err) });
  }
});

// Row counts for verification
app.get('/admin/counts', async (req, res) => {
  if (!requireKey(req, res)) return;
  try {
    const catalystApp = catalyst.initialize(req);
    const counts = {};
    for (const t of TABLES) {
      const r = await zcql(catalystApp, `SELECT COUNT(ROWID) FROM ${t}`);
      // ZCQL count result shape: [{ [t]: { 'COUNT(ROWID)': n } }]
      const rec = r && r[0] && r[0][t];
      counts[t] = rec ? Number(Object.values(rec)[0]) : 0;
    }
    res.json(counts);
  } catch (err) {
    res.status(500).json({ error: String(err && err.message || err) });
  }
});

// Expose lookups (frontend + NL->SQL prompt will consume this)
app.get('/api/lookups', (req, res) => res.json(LOOKUPS));

module.exports = app;
