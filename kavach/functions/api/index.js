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
               'CaseStatusID', 'CourtID', 'DistrictID'],
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
  return `You translate an investigator's question about the Karnataka Police FIR database into ONE ZCQL query (a RESTRICTED SQL dialect).

ABSOLUTE RULE: JOINs are NOT SUPPORTED. No UNION. Query exactly ONE table in the main FROM clause. Single-level subqueries in WHERE ... IN (SELECT ...) are allowed for cross-table conditions.

TABLES (query one at a time):
- CaseMaster(CaseMasterID, CrimeNo, CaseNo, CrimeRegisteredDate[DATE 'YYYY-MM-DD'], PolicePersonID, PoliceStationID, CaseCategoryID, GravityOffenceID, CrimeMajorHeadID, CrimeMinorHeadID, CaseStatusID, CourtID, IncidentFromDate, IncidentToDate, latitude, longitude, BriefFacts, DistrictID, DistrictName, PoliceStationName)
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
- ComplainantDetails.OccupationID: ${invert(LOOKUPS.Occupation)}

RULES:
1. ONE single-table SELECT. Allowed: WHERE (=,!=,<,>,<=,>=,LIKE,IN,BETWEEN,AND,OR), GROUP BY, HAVING, ORDER BY, LIMIT, COUNT, SUM, AVG, MIN, MAX, DISTINCT.
2. Dates are literal strings; NO date functions. Year 2025 = BETWEEN '2025-01-01' AND '2025-12-31'.
3. Name/text search: LIKE '%value%'.
4. Repeat offenders: SELECT Accused.AccusedName, COUNT(Accused.CaseMasterID) FROM Accused GROUP BY Accused.AccusedName HAVING COUNT(Accused.CaseMasterID) > 1
5. Cross-table conditions: use a single-level subquery — WHERE Table.CaseMasterID IN (SELECT X.CaseMasterID FROM X WHERE ...). One level only, no nested subqueries. Example: cheating cases with accused older than 40 → SELECT ... FROM CaseMaster WHERE CrimeMinorHeadID = 13 AND CaseMasterID IN (SELECT Accused.CaseMasterID FROM Accused WHERE Accused.AgeYear > 40).
6. List queries: add LIMIT 100. When listing cases, include CaseMasterID and CrimeNo.
7. Always use Table.Column notation.
8. District questions: filter with CaseMaster.DistrictName LIKE '%Mysuru%' or group with GROUP BY CaseMaster.DistrictName. Never join for location.
9. Station questions: use CaseMaster.PoliceStationName.
10. Case lookup by CrimeNo: when the user asks about a specific case number (long numeric string), use WHERE CaseMaster.CrimeNo = 'theValue'. CrimeNo is the FIR registration number. Do NOT confuse with CaseNo or CaseMasterID.
11. GenderID is TEXT 'M'/'F'/'T' in Accused and Victim (e.g. Accused.GenderID = 'F' for women). Only ComplainantDetails.GenderID is numeric (1=Male, 2=Female).
12. Officer/IO questions: GROUP BY ArrestSurrender.IOID (officer names live in Employee and can't be joined — returning IOID counts is correct; the answer stage may present IDs as 'Officer #N').
13. City name aliases: Bangalore/ಬೆಂಗಳೂರು → 'Bengaluru City'; Mysore → 'Mysuru'; Hubli → 'Hubballi City'. Always use official DistrictName spellings.
14. False cases: CaseStatusID = 3 or cstype 'B'. CaseCategoryID is FIR/UDR/PAR type — never use it for false cases.

OUTPUT: ONLY the ZCQL query. No explanation, no markdown.`;
}

const ANSWER_SYSTEM_PROMPT = `You are KAVACH, a crime intelligence assistant for Karnataka State Police investigators.
You are given: the investigator's question, the ZCQL query that was executed, and the resulting rows (JSON).
Write a concise, factual answer for a police investigator.
Rules:
CRITICAL FIELD DISCIPLINE — follow exactly:
- The crime type is defined ONLY by CrimeMinorHeadID. Translate it using: 1=Murder, 2=Attempt to Murder, 3=Grievous Hurt, 4=Simple Hurt, 5=Robbery, 6=Dacoity, 7=House Burglary, 8=Theft, 9=Vehicle Theft, 10=Chain Snatching, 11=Cruelty by Husband, 12=Molestation, 13=Cheating, 14=Criminal Breach of Trust, 15=Online Financial Fraud, 16=Identity Theft, 17=NDPS Possession, 18=NDPS Trafficking, 19=Rioting, 20=Unlawful Assembly.
- GravityOffenceID means ONLY severity: 1=Heinous, 2=Non-Heinous. NEVER report it as a crime type or a crime name.
- CrimeMajorHeadID is a broad group, NOT the specific crime. Do not cite it as the crime.
- CaseStatusID: 1=Under Investigation, 2=Charge Sheeted, 3=Closed-False Case, 4=Closed-Undetected, 5=Trial. Never say "Active".
- When BriefFacts text is present in the row, summarize it as the factual account of what happened.
- State the crime type from CrimeMinorHeadID as authoritative even if other fields seem to suggest otherwise.
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
  trace._start = Date.now();
  try {
    const catalystApp = catalyst.initialize(req);

    // 1) Build context from recent turns so follow-ups resolve
    const historyBlock = history.slice(-4).map((h, i) =>
      `Previous Q${i + 1}: ${h.question}\nPrevious SQL${i + 1}: ${h.sql}`).join('\n');
    const userPrompt =
      (historyBlock ? `CONVERSATION SO FAR:\n${historyBlock}\n\n` : '') +
      `QUESTION: ${question}`;

    // 2–4) LLM -> SQL -> execute (with self-correction loop)
    const geo = await getGeo(catalystApp);
    let sql, rows, lastErr = null;
    for (let attempt = 0; attempt < 2; attempt++) {
      const prompt = attempt === 0 ? userPrompt :
        userPrompt + `\n\nYOUR PREVIOUS QUERY FAILED.\nPrevious query: ${trace.sql || trace.rawSQL}\nDatabase error: ${lastErr}\nWrite a corrected ZCQL query following ALL rules exactly. Output only the query.`;
      try {
        const raw = await callLLM(buildSqlPrompt(geo), prompt, 400);
        trace.rawSQL = raw;
        sql = validateSQL(extractSQL(raw));
        trace.sql = sql;
        rows = flattenRows(await zcql(catalystApp, sql));
        trace.selfCorrected = attempt > 0;
        lastErr = null;
        break;
      } catch (e) {
        lastErr = String((e && e.message) || e);
        trace['attempt' + (attempt + 1) + '_error'] = lastErr;
      }
    }
    if (lastErr) {
      return res.status(422).json({
        error: "I couldn't answer that reliably. Try rephrasing — for example, name the crime type, district, or time period explicitly.",
        detail: lastErr, trace
      });
    }
    trace.rowCount = rows.length;
    rows.forEach(r => {
      if (r.PoliceStationID != null) {
        r.DistrictName = geo.unitToDistrict[r.PoliceStationID];
        r.StationName = geo.unitNames[r.PoliceStationID];
      }
    });

    // 5) LLM -> natural-language answer grounded in rows
    const evidenceSample = rows.slice(0, 15);
    const answer = await callLLM(
      ANSWER_SYSTEM_PROMPT,
      `Language: ${language}\nQuestion: ${question}\nExecuted ZCQL: ${sql}\nRows (${rows.length} total, first ${evidenceSample.length} shown):\n${JSON.stringify(evidenceSample)}`,
      350
    );

    // 6) Evidence = case identifiers found in the rows
    const evidence = [...new Set(rows.map(r => r.CrimeNo || r.CaseMasterID).filter(Boolean))].slice(0, 50);

    // ---- computed insights (deterministic, no LLM) ----
    const insights = [];
    if (rows.length > 0) {
      // 1. Geographic concentration
      const distCount = {};
      rows.forEach(r => { if (r.DistrictName) distCount[r.DistrictName] = (distCount[r.DistrictName] || 0) + 1; });
      const topDist = Object.entries(distCount).sort((a, b) => b[1] - a[1])[0];
      if (topDist && rows.length >= 5 && topDist[1] / rows.length >= 0.4) {
        insights.push({ type: 'cluster', icon: '📍', title: 'Geographic Concentration',
          text: `${Math.round(100 * topDist[1] / rows.length)}% of these cases (${topDist[1]} of ${rows.length}) are in ${topDist[0]}.` });
      }
      // 2. Heinous share
      const heinous = rows.filter(r => Number(r.GravityOffenceID) === 1).length;
      if (rows.length >= 5 && heinous / rows.length >= 0.3) {
        insights.push({ type: 'warning', icon: '⚠️', title: 'High Severity',
          text: `${Math.round(100 * heinous / rows.length)}% of these cases are classified Heinous.` });
      }
      // 3. Time-of-day pattern (from IncidentFromDate hour)
      const hours = rows.map(r => { const d = r.IncidentFromDate; return d ? new Date(String(d).replace(' ', 'T')).getHours() : null; }).filter(h => h != null);
      if (hours.length >= 5) {
        const bands = { 'night (0-6)': 0, 'morning (6-12)': 0, 'afternoon (12-18)': 0, 'evening (18-24)': 0 };
        hours.forEach(h => { bands[h < 6 ? 'night (0-6)' : h < 12 ? 'morning (6-12)' : h < 18 ? 'afternoon (12-18)' : 'evening (18-24)']++; });
        const topBand = Object.entries(bands).sort((a, b) => b[1] - a[1])[0];
        if (topBand[1] / hours.length >= 0.5) {
          insights.push({ type: 'pattern', icon: '🕐', title: 'Time Pattern',
            text: `${Math.round(100 * topBand[1] / hours.length)}% of incidents occurred during ${topBand[0]} hours.` });
        }
      }
      // 4. Repeat-offender hint (only if accused names present in rows)
      const names = {};
      rows.forEach(r => { if (r.AccusedName) names[r.AccusedName] = (names[r.AccusedName] || 0) + 1; });
      const repeat = Object.entries(names).filter(([, c]) => c > 1).sort((a, b) => b[1] - a[1])[0];
      if (repeat) {
        insights.push({ type: 'repeat_offender', icon: '🔁', title: 'Repeat Name',
          text: `${repeat[0]} appears in ${repeat[1]} of these records — review for repeat offending.` });
      }
    }

    res.json({ answer: answer.trim(), sql, rows: evidenceSample, rowCount: rows.length, evidence, insights, trace });

    // Fire-and-forget audit log write
    try {
      let auditUser = 'unknown';
      try { const u = await catalystApp.userManagement().getCurrentUser(); auditUser = u.email_id || 'unknown'; } catch (_) {}
      catalystApp.datastore().table('AuditLog').insertRow({
        UserEmail: auditUser,
        Query: question.slice(0, 500),
        SQL: (sql || '').slice(0, 1000),
        RowCount: rows.length,
        Status: 'Success',
        ExecutionTime: `${Date.now() - (trace._start || Date.now())}ms`
      }).catch(e => console.warn('Audit write skipped:', e.message || e));
    } catch (_) { /* AuditLog table may not exist yet */ }
  } catch (err) {
    res.status(500).json({ error: String(err && err.message || err), trace });
  }
});

const INTELLIGENCE_SYSTEM_PROMPT = `You are a senior Crime Intelligence AI for the Karnataka State Police.
Given a police investigator's question, the executed ZCQL query, and a sample of the resulting database rows, analyze the data to find insights.
You must return your analysis strictly as a valid JSON object matching this schema:
{
  "insights": [
    {
      "id": "string",
      "title": "string",
      "description": "string",
      "type": "pattern" | "warning" | "recommendation" | "hotspot" | "repeat_offender",
      "severity": "low" | "medium" | "high",
      "icon": "string (emoji)"
    }
  ],
  "followUps": ["string"]
}
Rules:
- Be concise and factual.
- Look for repeat offenders (same AccusedName), hotspots (same DistrictName), or temporal/modus operandi patterns.
- Suggest only questions answerable from this database schema: counts, lists, and groupings over cases, accused, victims, arrests, chargesheets by crime type, district, station, date, status, gender, age. Never suggest questions about custody status, bail, CCTV, vehicles, phones, or any data not in the schema.
- Return ONLY the JSON object. Do not wrap in markdown or backticks.`;

app.post('/api/intelligence', async (req, res) => {
  const { question, sql, rows = [] } = req.body || {};
  if (!question || !sql) {
    return res.status(400).json({ error: 'body must include { question, sql, rows }' });
  }
  
  try {
    const userPrompt = `Question: ${question}\nSQL: ${sql}\nRows (${rows.length}):\n${JSON.stringify(rows.slice(0, 50))}`;
    
    const rawAnswer = await callLLM(INTELLIGENCE_SYSTEM_PROMPT, userPrompt, 500);
    
    let cleaned = rawAnswer.trim();
    if (cleaned.startsWith('\`\`\`json')) {
      cleaned = cleaned.substring(7);
    } else if (cleaned.startsWith('\`\`\`')) {
      cleaned = cleaned.substring(3);
    }
    if (cleaned.endsWith('\`\`\`')) {
      cleaned = cleaned.substring(0, cleaned.length - 3);
    }
    
    const data = JSON.parse(cleaned.trim());
    res.json(data);
  } catch (err) {
    console.error("Intelligence error:", err);
    res.json({ insights: [], followUps: [], error: String(err && err.message || err) });
  }
});

// ======================= NETWORK GRAPH =======================
let _network = { data: null, exp: 0 };

async function pageAll(catalystApp, table, cols) {
  const out = [];
  let lastRow = 0;
  for (let i = 0; i < 40; i++) {
    const page = await zcql(catalystApp,
      `SELECT ROWID, ${cols} FROM ${table} WHERE ROWID > ${lastRow} ORDER BY ROWID LIMIT 300`);
    if (!page || page.length === 0) break;
    page.forEach(r => out.push(r[table]));
    lastRow = page[page.length - 1][table].ROWID;
    if (page.length < 300) break;
  }
  return out;
}

app.get('/api/network', async (req, res) => {
  const minShared = parseInt(req.query.minShared || '1', 10);
  const minCases = parseInt(req.query.minCases || '2', 10);
  const showIsolated = req.query.showIsolated === 'true';
  const search = (req.query.search || '').toLowerCase();
  try {
    if (!_network.data || Date.now() > _network.exp) {
      const catalystApp = catalyst.initialize(req);
      const accused = await pageAll(catalystApp, 'Accused', 'AccusedName, AgeYear, CaseMasterID');
      const cases = await pageAll(catalystApp, 'CaseMaster',
        'CaseMasterID, CrimeNo, GravityOffenceID, CrimeMinorHeadID, DistrictName, CrimeRegisteredDate');
      const caseInfo = {};
      cases.forEach(c => { caseInfo[c.CaseMasterID] = c; });

      // group by person (name+age disambiguates common names)
      const people = {};
      accused.forEach(a => {
        const key = `${a.AccusedName}|${a.AgeYear}`;
        (people[key] = people[key] || { name: a.AccusedName, age: a.AgeYear, cases: new Set() })
          .cases.add(Number(a.CaseMasterID));
      });

      // co-occurrence edges via case -> people index
      const byCase = {};
      Object.entries(people).forEach(([key, p]) =>
        p.cases.forEach(cid => (byCase[cid] = byCase[cid] || []).push(key)));
      const edgeMap = {};
      Object.entries(byCase).forEach(([cid, keys]) => {
        for (let i = 0; i < keys.length; i++)
          for (let j = i + 1; j < keys.length; j++) {
            const ek = [keys[i], keys[j]].sort().join('~~');
            (edgeMap[ek] = edgeMap[ek] || { cases: [] }).cases.push(Number(cid));
          }
      });

      const nodes = Object.entries(people).map(([key, p]) => {
        const cs = [...p.cases];
        const heinous = cs.filter(c => caseInfo[c] && Number(caseInfo[c].GravityOffenceID) === 1).length;
        
        // build chronological cases timeline
        const nodeCases = cs
          .map(c => {
            const info = caseInfo[c];
            if (!info) return null;
            return {
              crimeNo: info.CrimeNo,
              date: info.CrimeRegisteredDate,
              typeId: info.CrimeMinorHeadID,
              district: info.DistrictName,
              heinous: Number(info.GravityOffenceID) === 1
            };
          })
          .filter(Boolean)
          .sort((a, b) => new Date(a.date) - new Date(b.date))
          .slice(0, 15);

        return {
          id: key, name: p.name, age: p.age, caseCount: cs.length,
          heinousCount: heinous,
          risk: Math.min(100, cs.length * 12 + heinous * 20),   // explainable score
          crimeNos: cs.map(c => caseInfo[c] ? caseInfo[c].CrimeNo : c).slice(0, 20),
          districts: [...new Set(cs.map(c => caseInfo[c] && caseInfo[c].DistrictName).filter(Boolean))],
          cases: nodeCases
        };
      });
      const edges = Object.entries(edgeMap).map(([ek, e]) => {
        const [a, b] = ek.split('~~');
        return { source: a, target: b, weight: e.cases.length, caseIds: e.cases };
      });
      _network = { data: { nodes, edges }, exp: Date.now() + 10 * 60 * 1000 };
    }
    const { nodes, edges } = _network.data;
    const keepEdges = edges.filter(e => e.weight >= minShared);
    const connected = new Set(keepEdges.flatMap(e => [e.source, e.target]));
    const keepNodes = nodes.filter(n => 
      connected.has(n.id) || 
      (showIsolated && n.caseCount >= minCases) || 
      (search && n.name.toLowerCase().includes(search))
    );
    const keepIds = new Set(keepNodes.map(n => n.id));
    res.json({
      nodes: keepNodes,
      edges: keepEdges.filter(e => keepIds.has(e.source) && keepIds.has(e.target)),
      totals: { people: nodes.length, links: edges.length }
    });
  } catch (err) {
    res.status(500).json({ error: String(err && err.message || err) });
  }
});

// ======================= MAP + DASHBOARD DATA =======================
let _cases = { data: null, exp: 0 };
async function getCases(catalystApp) {
  if (_cases.data && Date.now() < _cases.exp) return _cases.data;
  const rows = await pageAll(catalystApp, 'CaseMaster',
    'CaseMasterID, CrimeNo, CrimeRegisteredDate, CrimeMinorHeadID, CrimeMajorHeadID, GravityOffenceID, CaseStatusID, latitude, longitude, DistrictName, PoliceStationName, PoliceStationID');
  
  const geo = await getGeo(catalystApp);
  rows.forEach(r => {
    if (!r.DistrictName && r.PoliceStationID) {
      r.DistrictName = geo.unitToDistrict[r.PoliceStationID] || 'Unknown';
    }
  });

  _cases = { data: rows, exp: Date.now() + 10 * 60 * 1000 };
  return rows;
}

app.get('/api/map', async (req, res) => {
  try {
    const rows = await getCases(catalyst.initialize(req));
    const { crimeType, from, to } = req.query;
    let f = rows;
    if (crimeType) f = f.filter(r => String(r.CrimeMinorHeadID) === String(crimeType));
    if (from) f = f.filter(r => r.CrimeRegisteredDate >= from);
    if (to) f = f.filter(r => r.CrimeRegisteredDate <= to);
    res.json({
      points: f.map(r => ({
        id: r.CaseMasterID, crimeNo: r.CrimeNo,
        lat: Number(r.latitude), lng: Number(r.longitude),
        type: Number(r.CrimeMinorHeadID), heinous: Number(r.GravityOffenceID) === 1,
        district: r.DistrictName, date: r.CrimeRegisteredDate
      })),
      total: f.length
    });
  } catch (err) { res.status(500).json({ error: String(err && err.message || err) }); }
});

app.get('/api/stats', async (req, res) => {
  try {
    const rows = await getCases(catalyst.initialize(req));
    const byMonth = {}, byDistrict = {}, byType = {}, byStatus = {};
    rows.forEach(r => {
      const m = String(r.CrimeRegisteredDate).slice(0, 7);
      byMonth[m] = (byMonth[m] || 0) + 1;
      byDistrict[r.DistrictName] = (byDistrict[r.DistrictName] || 0) + 1;
      byType[r.CrimeMinorHeadID] = (byType[r.CrimeMinorHeadID] || 0) + 1;
      byStatus[r.CaseStatusID] = (byStatus[r.CaseStatusID] || 0) + 1;
    });
    const snatchByMonth = {};
    rows.filter(r => Number(r.CrimeMinorHeadID) === 10)
        .forEach(r => { const m = String(r.CrimeRegisteredDate).slice(0, 7); snatchByMonth[m] = (snatchByMonth[m] || 0) + 1; });
    res.json({ byMonth, byDistrict, byType, byStatus, snatchByMonth, lookups: LOOKUPS, total: rows.length });
  } catch (err) { res.status(500).json({ error: String(err && err.message || err) }); }
});

// ======================= PDF EXPORT =======================

app.post('/api/export-pdf', async (req, res) => {
  try {
    const { messages = [], title = "KAVACH Intelligence Report" } = req.body;
    let html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>${title}</title>
        <style>
          body { font-family: 'Inter', sans-serif; color: #111827; margin: 40px; }
          .header { border-bottom: 2px solid #1e3a8a; padding-bottom: 10px; margin-bottom: 30px; }
          .header h1 { margin: 0; color: #1e3a8a; font-size: 24px; }
          .header p { margin: 4px 0 0; color: #6b7280; font-size: 12px; }
          .qa-block { margin-bottom: 24px; page-break-inside: avoid; }
          .q { font-weight: bold; font-size: 14px; margin-bottom: 8px; color: #1f2937; }
          .a { font-size: 13px; color: #374151; line-height: 1.5; margin-bottom: 8px; }
          .sql-box { background: #f3f4f6; border-left: 3px solid #10b981; padding: 10px; font-family: monospace; font-size: 11px; color: #047857; margin-bottom: 8px; overflow-x: auto; white-space: pre-wrap; }
          .evidence { font-size: 11px; color: #6b7280; }
          .footer { margin-top: 40px; padding-top: 10px; border-top: 1px solid #e5e7eb; font-size: 10px; color: #9ca3af; text-align: center; }
          @media print { body { margin: 0; } }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>${title}</h1>
          <p>Generated: ${new Date().toLocaleString()}</p>
        </div>
    `;
    
    let currentQ = '';
    for (const m of messages) {
      if (m.role === 'user') {
        currentQ = m.text;
      } else if (m.role === 'assistant' && !m.error && !m.loading) {
        html += `<div class="qa-block"><div class="q">Q: ${currentQ}</div>`;
        html += `<div class="a">${m.answer || 'No text answer'}</div>`;
        if (m.sql) {
          html += `<div class="sql-box">${m.sql}</div>`;
        }
        if (m.evidence && m.evidence.length > 0) {
          html += `<div class="evidence">Evidence cases: ${m.evidence.join(', ')}</div>`;
        }
        html += `</div>`;
        currentQ = '';
      }
    }
    
    html += `
        <div class="footer">Generated by KAVACH — Karnataka State Police</div>
      </body>
      </html>
    `;

    const catalystApp = catalyst.initialize(req);
    try {
      const pdfStream = await catalystApp.smartBrowz().convertToPdf(Buffer.from(html));
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename="KAVACH-report.pdf"');
      pdfStream.pipe(res);
    } catch (smartErr) {
      console.warn("SmartBrowz failed or unavailable, returning HTML fallback:", smartErr.message);
      res.setHeader('Content-Type', 'text/html');
      res.send(html + "<script>window.print();</script>");
    }
  } catch (err) {
    res.status(500).json({ error: String(err && err.message || err) });
  }
});

// ======================= AUDIT LOGS =======================

app.get('/api/audit', async (req, res) => {
  try {
    const catalystApp = catalyst.initialize(req);
    const raw = await zcql(catalystApp, 'SELECT ROWID, UserEmail, Query, SQL, RowCount, Status, ExecutionTime, CREATEDTIME FROM AuditLog ORDER BY ROWID DESC LIMIT 100');
    const logs = (raw || []).map(r => {
      const a = r.AuditLog || r;
      return {
        timestamp: a.CREATEDTIME || '',
        user: a.UserEmail || 'unknown',
        query: a.Query || '',
        sql: a.SQL || '',
        rowCount: a.RowCount,
        status: a.Status || 'Success',
        executionTime: a.ExecutionTime || ''
      };
    });
    res.json({ logs });
  } catch (err) {
    // If AuditLog table doesn't exist, return empty gracefully
    const msg = String(err && err.message || err);
    if (msg.includes('Table') || msg.includes('not exist') || msg.includes('AuditLog')) {
      res.json({ logs: [], note: 'AuditLog table not yet created in Catalyst Data Store. Create it with columns: UserEmail, Query, SQL, RowCount, Status, ExecutionTime.' });
    } else {
      res.status(500).json({ error: msg });
    }
  }
});

// ======================= AUTH / RBAC =======================

app.get('/api/me', async (req, res) => {
  try {
    const catalystApp = catalyst.initialize(req);
    let user;
    try {
      user = await catalystApp.userManagement().getCurrentUser();
    } catch (authErr) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    let roleName = (user.role_details && user.role_details.role_name) || user.role_name || 'App User';
    
    // Hardcode supervisors for the demo
    const email = (user.email_id || '').toLowerCase();
    if (email === 'samuvelgodsan@gmail.com' || email === 'samctech01@gmail.com') {
      roleName = 'Supervisor';
    }

    const isSupervisor = /supervisor/i.test(roleName);
    res.json({
      email: user.email_id,
      name: [user.first_name, user.last_name].filter(Boolean).join(' ') || email.split('@')[0],
      role: roleName,
      pages: isSupervisor
        ? ['chat', 'network', 'map', 'dashboard', 'audit']
        : ['chat', 'network', 'map']
    });
  } catch (err) {
    res.status(500).json({ error: String(err && err.message || err) });
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
