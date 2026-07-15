/**
 * KAVACH — api function (Catalyst Advanced I/O, Express)  v2
 * ----------------------------------------------------------
 * Routes:
 *   GET /health                  -> liveness check
 *   GET /admin/load              -> live status dashboard (expected vs actual counts + safe action links)
 *   GET /admin/load/:table       -> loads CSV; REFUSES if table already has rows (no more duplicates)
 *   GET /admin/clear/:table      -> deletes all rows from that table (batched), then reload becomes available
 *   GET /admin/counts            -> raw counts JSON
 *   GET /admin/files             -> lists CSVs actually bundled in the deployment (diagnoses missing files)
 *   GET /api/lookups             -> lookup constants
 */

'use strict';

const express = require('express');
const fs = require('fs');
const path = require('path');
const catalyst = require('zcatalyst-sdk-node');

const app = express();
app.use(express.json());

const ADMIN_KEY = 'kavach2026';

const EXPECTED = {
  District: 31, Unit: 124, Employee: 1014, CaseMaster: 3000,
  ComplainantDetails: 3000, Victim: 3580, Accused: 4517,
  ArrestSurrender: 2019, ActSectionAssociation: 3545, ChargesheetDetails: 1876
};
const TABLES = Object.keys(EXPECTED);

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

async function tableCount(catalystApp, t) {
  const r = await zcql(catalystApp, `SELECT COUNT(ROWID) FROM ${t}`);
  const rec = r && r[0] && r[0][t];
  return rec ? Number(Object.values(rec)[0]) : 0;
}

// ------------------------------- routes -------------------------------

app.get('/health', (req, res) => res.json({ ok: true, app: 'KAVACH', time: new Date().toISOString() }));

// Status dashboard with safe, state-aware action links
app.get('/admin/load', async (req, res) => {
  if (!requireKey(req, res)) return;
  try {
    const catalystApp = catalyst.initialize(req);
    const k = req.query.key;
    let html = `<h2>KAVACH data loader — status</h2>
      <table border="1" cellpadding="6" style="border-collapse:collapse">
      <tr><th>Table</th><th>Expected</th><th>Actual</th><th>Status</th><th>Action</th></tr>`;
    for (const t of TABLES) {
      const actual = await tableCount(catalystApp, t);
      const exp = EXPECTED[t];
      let status, action;
      if (actual === exp) { status = '✅ OK'; action = '—'; }
      else if (actual === 0) { status = '⬜ empty'; action = `<a href="load/${t}?key=${k}">Load</a>`; }
      else { status = `⚠️ MISMATCH`; action = `<a href="clear/${t}?key=${k}">Clear (then reload)</a>`; }
      html += `<tr><td>${t}</td><td>${exp}</td><td>${actual}</td><td>${status}</td><td>${action}</td></tr>`;
    }
    html += `</table>
      <p>Rule: a table can only be Loaded when empty — duplicates are impossible now.</p>
      <p><a href="files?key=${k}">Check bundled CSV files</a> | <a href="counts?key=${k}">Raw counts JSON</a></p>
      <p>Refresh this page after each action.</p>`;
    res.send(html);
  } catch (err) {
    res.status(500).json({ error: String(err && err.message || err) });
  }
});

// Load one table — refuses if not empty
app.get('/admin/load/:table', async (req, res) => {
  if (!requireKey(req, res)) return;
  const table = req.params.table;
  if (!TABLES.includes(table)) return res.status(400).json({ error: `unknown table ${table}` });

  const csvPath = path.join(__dirname, 'data', `${table}.csv`);
  if (!fs.existsSync(csvPath)) {
    return res.status(404).json({ error: `${table}.csv is NOT bundled in the deployment`, hint: 'check /admin/files' });
  }

  try {
    const catalystApp = catalyst.initialize(req);
    const existing = await tableCount(catalystApp, table);
    if (existing > 0) {
      return res.status(409).json({
        table, existing,
        error: 'Table already has rows — load refused to prevent duplicates. Use /admin/clear/' + table + ' first.'
      });
    }
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

// Clear all rows from one table (batched deletes; safe to re-run until 0)
app.get('/admin/clear/:table', async (req, res) => {
  if (!requireKey(req, res)) return;
  const table = req.params.table;
  if (!TABLES.includes(table)) return res.status(400).json({ error: `unknown table ${table}` });
  try {
    const catalystApp = catalyst.initialize(req);
    const tableRef = catalystApp.datastore().table(table);
    let deleted = 0;
    for (let round = 0; round < 60; round++) {
      const page = await zcql(catalystApp, `SELECT ROWID FROM ${table} LIMIT 200`);
      if (!page || page.length === 0) break;
      const ids = page.map(r => r[table].ROWID);
      try {
        await tableRef.deleteRows(ids);              // bulk delete if SDK supports it
      } catch (_) {
        await Promise.all(ids.map(id => tableRef.deleteRow(id)));  // fallback: row by row
      }
      deleted += ids.length;
    }
    const remaining = await tableCount(catalystApp, table);
    res.json({ table, deleted, remaining, status: remaining === 0 ? 'cleared — now Load it' : 'partial — run clear again' });
  } catch (err) {
    res.status(500).json({ table, error: String(err && err.message || err) });
  }
});

app.get('/admin/counts', async (req, res) => {
  if (!requireKey(req, res)) return;
  try {
    const catalystApp = catalyst.initialize(req);
    const counts = {};
    for (const t of TABLES) counts[t] = await tableCount(catalystApp, t);
    res.json(counts);
  } catch (err) {
    res.status(500).json({ error: String(err && err.message || err) });
  }
});

// List CSVs actually shipped in this deployment — diagnoses the Victim mystery
app.get('/admin/files', (req, res) => {
  if (!requireKey(req, res)) return;
  const dir = path.join(__dirname, 'data');
  if (!fs.existsSync(dir)) return res.json({ dataDir: false, files: [] });
  const files = fs.readdirSync(dir).map(f => ({
    name: f, bytes: fs.statSync(path.join(dir, f)).size
  }));
  res.json({ dataDir: true, files, missing: TABLES.filter(t => !files.some(f => f.name === `${t}.csv`)) });
});

app.get('/api/lookups', (req, res) => res.json(LOOKUPS));

module.exports = app;
