import React from 'react';

export default function FollowUpQuestions({ questions, onSend, disabled }) {
  const safeQuestions = (questions || []).filter(
    q => !/SELECT|FROM/i.test(q)
  );

  if (safeQuestions.length < 2) return null;
  
  return (
    <div className="intel-questions-container">
      <div className="intel-questions-header">Suggested Questions</div>
      <div className="intel-questions-list">
        {safeQuestions.map((q, i) => (
          <button key={i} className="intel-question-chip" onClick={() => onSend?.(q)} disabled={disabled}>
            {q}
          </button>
        ))}
      </div>
    </div>
  );
}
