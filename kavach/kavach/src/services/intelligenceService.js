/**
 * Heuristics-based mock service for generating AI Intelligence insights
 * based on the SQL query and the retrieved rows.
 */

/**
 * Generate intelligence insights from message data.
 * @param {Object} msg - The message object containing answer, rows, sql, etc.
 * @returns {Promise<{insights: import('../types/intelligence').IntelligenceInsight[], questions: string[]}>}
 */
const API_BASE = process.env.NODE_ENV === 'development'
  ? 'https://kavach-60078268134.development.catalystserverless.in'
  : '';

export async function generateIntelligence(msg) {
  const rows = msg.rows || [];
  const sql = msg.sql || '';
  const question = msg.question || msg.answer || 'Query';

  if (rows.length === 0) {
    return { insights: [], questions: [] };
  }

  try {
    const resp = await fetch(`${API_BASE}/server/api/api/intelligence`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question, sql, rows })
    });
    
    if (!resp.ok) {
      throw new Error(`Intelligence API failed: ${resp.status}`);
    }
    
    const data = await resp.json();
    return {
      insights: data.insights || [],
      questions: data.followUps || []
    };
  } catch (err) {
    console.error("Failed to generate intelligence:", err);
    return { insights: [], questions: [] };
  }
}
