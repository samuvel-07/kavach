import React, { useRef, useEffect } from 'react';
import MessageCard from './MessageCard';
import Composer from './Composer';

const SUGGESTIONS = [
  'How many robbery cases were registered in 2025?',
  'Which accused persons appear in more than one case?',
  'Show chain snatching cases in Bengaluru City',
  'List heinous cases still under investigation',
];

export default function ChatView({ messages, input, setInput, onSend, loading, language, setLanguage, onRetry }) {
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  const isEmpty = messages.length === 0;

  return (
    <div className="page-body">
      <div className="chat-scroll" ref={scrollRef} role="list" aria-label="Chat messages">
        {isEmpty ? (
          <div className="welcome">
            <div className="welcome-shield" aria-hidden="true">🛡️</div>
            <h3>KAVACH Intelligence</h3>
            <p>
              Ask questions about Karnataka Police FIR data in natural language.
              I'll translate your question into a database query, execute it, and
              return a factual answer with evidence citations.
            </p>
            <div className="welcome-hint">
              <span className="hint-icon" aria-hidden="true">💡</span>
              Try a question below or type your own
            </div>
            <div className="suggested">
              {SUGGESTIONS.map((s, i) => (
                <button
                  key={i}
                  className={`chip-suggest ${loading ? 'loading' : ''}`}
                  onClick={() => onSend(s)}
                  disabled={loading}
                  aria-label={`Ask: ${s}`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg, i) => (
            <MessageCard
              key={i}
              msg={msg}
              onRetry={msg.error ? () => onRetry(i) : undefined}
            />
          ))
        )}
      </div>
      <Composer
        value={input}
        onChange={setInput}
        onSend={() => onSend(input)}
        loading={loading}
        language={language}
        onLang={setLanguage}
      />
    </div>
  );
}
