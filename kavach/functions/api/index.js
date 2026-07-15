/**
 * KAVACH — api function (Catalyst Advanced I/O, Express)  v3
 * ----------------------------------------------------------
 * NEW in v3:
 *   POST /api/ask   -> the NL→SQL conversational engine
 *      body: { question: string, history?: [{question, sql}], language?: 'en'|'kn' }
 *      returns: { answer, sql, rows, rowCount, evidence }
 *
 * Everything from v2 (loader dashboard, clear, counts, files) is retained below.
 *
 * BEFORE FIRST USE: fill in LLM_CONFIG with your deployed QuickML endpoint
 * details (LLM Serving -> your GLM 4.7 Flash endpoint -> URL + key).
 * The callLLM() adapter assumes an OpenAI-style chat API; if your QuickML
 * sample request looks different, only callLLM() needs adjusting.
 */

'use strict';

const express = require('express');
const fs = require('fs');
const path = require('path');
const catalyst = require('zcatalyst-sdk-node');

const app = express();
app.use(express.json());

const ADMIN_KEY = 'kavach2026';

// ======================= LLM CONFIG (Zoho OAuth) =======================
const LLM_CONFIG = {
  url: 'https://api.catalyst.zoho.in/quickml/v1/project/53222000000013074/glm/chat',
  model: 'crm-di-glm47b_30b_it',
  org: '60078268134',
  clientId: process.env.ZOHO_CLIENT_ID || '1000.0UDZTKSN00B5LJTYVFG251OZDDCB3H',
  clientSecret: process.env.ZOHO_CLIENT_SECRET || '1d71ce66815123db01b8664d0dad4732c4f3543880',
  refreshToken: process.env.ZOHO_REFRESH_TOKEN || '1000.f56b197eedd11f4ac9849085144b39d8.ca4598b6fc85613a6f45c77bd1f58dda'
};

let _tok = { value: null, exp: 0 };
async function getZohoToken() {
  if (_tok.value && Date.now() < _tok.exp) return _tok.value;
  const p = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: LLM_CONFIG.clientId,
    client_secret: LLM_CONFIG.clientSecret,
    refresh_token: LLM_CONFIG.refreshToken
  });
  const r = await fetch('https://accounts.zoho.in/oauth/v2/token?' + p.toString(), { method: 'POST' });
  const d = await r.json();
  if (!d.access_token) throw new Error('OAuth refresh failed: ' + JSON.stringify(d).slice(0, 200));
  _tok = { value: d.access_token, exp: Date.now() + 50 * 60 * 1000 }; // cache ~50 min
  return _tok.value;
}

async function callLLM(systemPrompt, userPrompt, maxTokens = 800) {
  const token = await getZohoToken();
  const resp = await fetch(LLM_CONFIG.url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Zoho-oauthtoken ' + token,
      'CATALYST-ORG': LLM_CONFIG.org
    },
    body: JSON.stringify({
      model: LLM_CONFIG.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      max_tokens: maxTokens,
      temperature: 0.1,
      stream: false,
      chat_template_kwargs: { enable_thinking: false }
    })
  });
  if (!resp.ok) throw new Error(`LLM HTTP ${resp.status}: ${(await resp.text()).slice(0, 300)}`);
  const data = await resp.json();
  // GLM response can come in multiple shapes — try each
  let out = '';
  if (typeof data.response === 'string') out = data.response.trim();       // GLM direct response
  if (!out) {
    const msg = data.choices?.[0]?.message || {};
    out = (msg.content || '').trim();
    if (!out && msg.reasoning) out = msg.reasoning;          // GLM thinking-mode fallback
  }
  out = out.replace(/<think>[\s\S]*?<\/think>/gi, '').trim(); // strip inline think blocks
  if (!out) throw new Error('LLM empty response: ' + JSON.stringify(data).slice(0, 400));
  return out;
}

// ======================= DATA MODEL CONSTANTS =======================

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

// ======================= NL→SQL PROMPTS =======================

function invert(map) {
  return Object.entries(map).map(([id, name]) => `${name}=${id}`).join(', ');
}

function buildSqlPrompt(geo) {
  const districtMap = Object.entries(geo.districtUnits)
    .map(([d, ids]) => `${d}: PoliceStationID IN (${ids.join(',')})`).join('\n');
  return `You translate an investigator's question about the Karnataka Police FIR database into ONE ZCQL query (a RESTRICTED SQL dialect).

ABSOLUTE RULE: JOINs are NOT SUPPORTED. Query exactly ONE table per query. No subqueries, no UNION.

TABLES (query one at a time):
- CaseMaster(CaseMasterID, CrimeNo, CaseNo, CrimeRegisteredDate[DATE 'YYYY-MM-DD'], PolicePersonID, PoliceStationID, CaseCategoryID, GravityOffenceID, CrimeMajorHeadID, CrimeMinorHeadID, CaseStatusID, CourtID, IncidentFromDate, IncidentToDate, latitude, longitude, BriefFacts)
- Accused(AccusedMasterID, CaseMasterID, AccusedName, AgeYear, GenderID, PersonID)
- Victim(VictimMasterID, CaseMasterID, VictimName, AgeYear, GenderID, VictimPolice)
- ComplainantDetails(ComplainantID, CaseMasterID, ComplainantName, AgeYear, OccupationID, GenderID)
- ArrestSurrender(ArrestSurrenderID, CaseMasterID, ArrestSurrenderTypeID, ArrestSurrenderDate, ArrestSurrenderDistrictId, PoliceStationID, IOID, AccusedMasterID)
- ActSectionAssociation(CaseMasterID, ActID, SectionID)
- ChargesheetDetails(CSID, CaseMasterID, csdate, cstype, PolicePersonID)
- Employee(EmployeeID, DistrictID, UnitID, RankID, DesignationID, FirstName)

ID MAPPINGS for WHERE clauses:
- CrimeMinorHeadID (crime type): ${invert(LOOKUPS.CrimeSubHead)}
- CrimeMajorHeadID (crime group): ${invert(LOOKUPS.CrimeHead)}
- CaseStatusID: ${invert(LOOKUPS.CaseStatus)}
- CaseCategoryID: ${invert(LOOKUPS.CaseCategory)}
- GravityOffenceID: 1=Heinous, 2=Non-Heinous
- cstype: A=Chargesheet filed, B=False Case, C=Undetected

DISTRICT → POLICE STATION IDs (use these instead of joins; district questions filter CaseMaster.PoliceStationID):
${districtMap}

RULES:
1. ONE single-table SELECT. Allowed: WHERE (=,!=,<,>,<=,>=,LIKE,IN,BETWEEN,AND,OR), GROUP BY, HAVING, ORDER BY, LIMIT, COUNT, SUM, AVG, MIN, MAX, DISTINCT.
2. Dates are literal strings; NO date functions. Year 2025 = BETWEEN '2025-01-01' AND '2025-12-31'.
3. Name/text search: LIKE '%value%'.
4. Repeat offenders: SELECT Accused.AccusedName, COUNT(Accused.CaseMasterID) FROM Accused GROUP BY Accused.AccusedName HAVING COUNT(Accused.CaseMasterID) > 1
5. If the question needs two tables (e.g. details of cases involving a person), use CaseMasterID values already present in CONVERSATION SO FAR, e.g. WHERE CaseMaster.CaseMasterID IN (101,205).
6. List queries: add LIMIT 100. When listing cases, include CaseMasterID and CrimeNo.
7. Always use Table.Column notation.

OUTPUT: ONLY the ZCQL query. No explanation, no markdown.`;
}

const ANSWER_SYSTEM_PROMPT = `You are KAVACH, a crime intelligence assistant for Karnataka State Police investigators.
You are given: the investigator's question, the ZCQL query that was executed, and the resulting rows (JSON).
Write a concise, factual answer for a police investigator.
Rules:
- Base EVERY claim strictly on the provided rows. If rows are empty, say no matching records were found.
- Cite specific cases by CrimeNo (or CaseMasterID) when present in rows.
- Use lookup translations where helpful: ${invert(LOOKUPS.CrimeSubHead)}; statuses: ${invert(LOOKUPS.CaseStatus)}; cstype A=Chargesheet,B=False Case,C=Undetected.
- Keep it under 150 words. Plain sentences, no markdown headers.
- If the language code given is 'kn', answer in Kannada.`;

// ======================= SQL GUARDRAILS =======================

const FORBIDDEN = /\b(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|TRUNCATE|GRANT|REVOKE|MERGE)\b/i;

function validateSQL(sql) {
  let s = sql.trim().replace(/;+\s*$/, '');
  s = s.replace(/COUNT\(\s*\*\s*\)/gi, 'COUNT(ROWID)');  // ZCQL doesn't support COUNT(*)
  if (!/^SELECT\b/i.test(s)) throw new Error('Only SELECT queries are permitted');
  if (FORBIDDEN.test(s)) throw new Error('Query contains a forbidden operation');
  if (/\bJOIN\b/i.test(s)) throw new Error('JOINs are not supported — single-table query required');
  if (s.includes(';')) throw new Error('Multiple statements are not allowed');
  // whitelist any table mentioned after FROM
  const refs = [...s.matchAll(/\bFROM\s+([A-Za-z_]+)/gi)].map(m => m[1]);
  for (const t of refs) {
    if (!TABLES.includes(t)) throw new Error(`Table not allowed: ${t}`);
  }
  // enforce a LIMIT on non-aggregate queries
  const isAggregate = /\b(COUNT|SUM|AVG|MIN|MAX)\s*\(/i.test(s) || /\bGROUP BY\b/i.test(s);
  if (!isAggregate && !/\bLIMIT\s+\d+/i.test(s)) return s + ' LIMIT 100';
  return s;
}

/** ZCQL returns rows as [{Table:{col:val}, Table2:{...}}] — flatten for the client. */
function flattenRows(raw) {
  return (raw || []).map(r => {
    const flat = {};
    for (const [tbl, cols] of Object.entries(r)) {
      if (cols && typeof cols === 'object') {
        for (const [c, v] of Object.entries(cols)) {
          flat[c in flat ? `${tbl}.${c}` : c] = v;
        }
      } else flat[tbl] = cols;
    }
    return flat;
  });
}

function extractSQL(llmText) {
  // strip accidental fences/labels despite instructions
  let s = llmText.trim();
  const fence = s.match(/```(?:sql)?\s*([\s\S]*?)```/i);
  if (fence) s = fence[1].trim();
  const idx = s.toUpperCase().indexOf('SELECT');
  if (idx > 0) s = s.slice(idx);
  return s;
}

// ======================= helpers (shared) =======================

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

let _geo = null;
async function getGeo(catalystApp) {
  if (_geo) return _geo;
  const dists = await zcql(catalystApp, 'SELECT DistrictID, DistrictName FROM District LIMIT 100');
  const units = await zcql(catalystApp, 'SELECT UnitID, UnitName, DistrictID FROM Unit LIMIT 300');
  const dName = {};
  dists.forEach(r => { dName[r.District.DistrictID] = r.District.DistrictName; });
  const districtUnits = {}, unitToDistrict = {}, unitNames = {};
  units.forEach(r => {
    const u = r.Unit, dn = dName[u.DistrictID] || ('District ' + u.DistrictID);
    (districtUnits[dn] = districtUnits[dn] || []).push(u.UnitID);
    unitToDistrict[u.UnitID] = dn;
    unitNames[u.UnitID] = u.UnitName;
  });
  _geo = { districtUnits, unitToDistrict, unitNames };
  return _geo;
}

// ======================= THE ENGINE =======================

app.post('/api/ask', async (req, res) => {
  const { question, history = [], language = 'en' } = req.body || {};
  if (!question || typeof question !== 'string') {
    return res.status(400).json({ error: 'body must include { question }' });
  }
  const trace = {};
  try {
    const catalystApp = catalyst.initialize(req);

    // 1) Build context from recent turns so follow-ups resolve
    const historyBlock = history.slice(-4).map((h, i) =>
      `Previous Q${i + 1}: ${h.question}\nPrevious SQL${i + 1}: ${h.sql}`).join('\n');
    const userPrompt =
      (historyBlock ? `CONVERSATION SO FAR:\n${historyBlock}\n\n` : '') +
      `QUESTION: ${question}`;

    // 2) LLM -> SQL
    const geo = await getGeo(catalystApp);
    const rawSQL = await callLLM(buildSqlPrompt(geo), userPrompt, 400);
    trace.rawSQL = rawSQL;

    // 3) Guardrails
    const sql = validateSQL(extractSQL(rawSQL));
    trace.sql = sql;

    // 4) Execute on Data Store
    const rows = flattenRows(await zcql(catalystApp, sql));
    trace.rowCount = rows.length;
    rows.forEach(r => {
      if (r.PoliceStationID != null) {
        r.DistrictName = geo.unitToDistrict[r.PoliceStationID];
        r.StationName = geo.unitNames[r.PoliceStationID];
      }
    });

    // 5) LLM -> natural-language answer grounded in rows
    const evidenceSample = rows.slice(0, 30);
    const answer = await callLLM(
      ANSWER_SYSTEM_PROMPT,
      `Language: ${language}\nQuestion: ${question}\nExecuted ZCQL: ${sql}\nRows (${rows.length} total, first ${evidenceSample.length} shown):\n${JSON.stringify(evidenceSample)}`,
      500
    );

    // 6) Evidence = case identifiers found in the rows
    const evidence = [...new Set(rows.map(r => r.CrimeNo || r.CaseMasterID).filter(Boolean))].slice(0, 50);

    res.json({ answer: answer.trim(), sql, rows: evidenceSample, rowCount: rows.length, evidence });
  } catch (err) {
    res.status(500).json({ error: String(err && err.message || err), trace });
  }
});

// ======================= v2 ADMIN ROUTES (unchanged) =======================

app.get('/health', (req, res) => res.json({ ok: true, app: 'KAVACH', version: 3, time: new Date().toISOString() }));

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
      <p><a href="files?key=${k}">Check bundled CSV files</a> | <a href="counts?key=${k}">Raw counts JSON</a></p>`;
    res.send(html);
  } catch (err) {
    res.status(500).json({ error: String(err && err.message || err) });
  }
});

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
      return res.status(409).json({ table, existing, error: 'Table already has rows — use /admin/clear/' + table + ' first.' });
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
      try { await tableRef.deleteRows(ids); }
      catch (_) { await Promise.all(ids.map(id => tableRef.deleteRow(id))); }
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

app.get('/admin/files', (req, res) => {
  if (!requireKey(req, res)) return;
  const dir = path.join(__dirname, 'data');
  if (!fs.existsSync(dir)) return res.json({ dataDir: false, files: [] });
  const files = fs.readdirSync(dir).map(f => ({ name: f, bytes: fs.statSync(path.join(dir, f)).size }));
  res.json({ dataDir: true, files, missing: TABLES.filter(t => !files.some(f => f.name === `${t}.csv`)) });
});

app.get('/api/lookups', (req, res) => res.json(LOOKUPS));

module.exports = app;
