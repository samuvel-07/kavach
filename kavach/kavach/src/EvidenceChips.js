import React from 'react';

export default function EvidenceChips({ evidence, onSelect }) {
  if (!evidence || evidence.length === 0) return null;
  const show = evidence.slice(0, 10);
  const more = evidence.length - show.length;
  return (
    <div className="evidence">
      <span className="evidence-lbl">Evidence (Click to investigate)</span>
      {show.map((e, i) => (
        <button key={i} className="ev-chip btn-ev" title={`Investigate Case: ${e}`} onClick={() => onSelect?.(e)}>
          {e}
        </button>
      ))}
      {more > 0 && <span className="ev-more">+{more} more</span>}
    </div>
  );
}
