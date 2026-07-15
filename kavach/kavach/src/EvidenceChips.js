import React from 'react';

export default function EvidenceChips({ evidence }) {
  if (!evidence || evidence.length === 0) return null;
  const show = evidence.slice(0, 10);
  const more = evidence.length - show.length;
  return (
    <div className="evidence">
      <span className="evidence-lbl">Evidence</span>
      {show.map((e, i) => (
        <span key={i} className="ev-chip" title={`Case: ${e}`}>{e}</span>
      ))}
      {more > 0 && <span className="ev-more">+{more} more</span>}
    </div>
  );
}
