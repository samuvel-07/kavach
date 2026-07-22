/**
 * KAVACH benchmark runner
 * Usage:  node run_benchmark.js
 * Requires Node 18+ (built-in fetch). Run from the benchmark/ folder.
 * Outputs: per-question results + summary metrics, and writes results.json
 */
const fs = require('fs');

const API = 'https://kavach-60078268134.development.catalystserverless.in/server/api/api/ask';
const questions = JSON.parse(fs.readFileSync('./questions.json', 'utf8'));

function evaluate(check, resp) {
  const sql = (resp.sql || '').toLowerCase();
  const answer = (resp.answer || '').toLowerCase();
  switch (check.type) {
    case 'count_gt':
      return resp.rowCount > check.value || /\b\d+\b/.test(answer);
    case 'sql_contains_all':
      return check.values.every(v => sql.includes(v.toLowerCase()));
    case 'sql_contains_any':
      return check.values.some(v => sql.includes(v.toLowerCase()));
    case 'answer_contains_any':
      return check.values.some(v => answer.includes(v.toLowerCase()));
    case 'expect_refusal':
      return !!resp.error || /cannot|can't|not permitted|only select|rephras/i.test(answer);
    case 'expect_refusal_or_empty':
      return !!resp.error || resp.rowCount === 0 || /no matching|cannot|not related|rephras/i.test(answer);
    default: return false;
  }
}

(async () => {
  const results = [];
  let pass = 0, selfCorrected = 0, totalMs = 0;
  for (const item of questions) {
    const t0 = Date.now();
    let resp, ok = false, errored = false;
    try {
      const r = await fetch(API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: item.q, language: item.lang || 'en' })
      });
      resp = await r.json();
      errored = !r.ok;
    } catch (e) {
      resp = { error: String(e) }; errored = true;
    }
    const ms = Date.now() - t0;
    totalMs += ms;
    ok = evaluate(item.check, resp || {});
    if (ok) pass++;
    if (resp && resp.trace && resp.trace.selfCorrected) selfCorrected++;
    results.push({ id: item.id, q: item.q, ok, ms, sql: resp && resp.sql, error: resp && resp.error });
    console.log(`${ok ? 'PASS' : 'FAIL'}  #${String(item.id).padStart(2)}  ${ms}ms  ${item.q.slice(0, 60)}`);
    await new Promise(r => setTimeout(r, 1500)); // be gentle on the LLM quota
  }
  const summary = {
    total: questions.length,
    passed: pass,
    accuracy: +(100 * pass / questions.length).toFixed(1) + '%',
    avgLatencyMs: Math.round(totalMs / questions.length),
    selfCorrected
  };
  console.log('\n===== SUMMARY =====');
  console.log(summary);
  fs.writeFileSync('./results.json', JSON.stringify({ summary, results }, null, 2));
  console.log('Written to results.json');
})();
