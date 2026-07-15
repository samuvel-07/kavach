import React, { useRef, useCallback } from 'react';

export default function Composer({ value, onChange, onSend, loading, language, onLang }) {
  const taRef = useRef(null);

  const resize = useCallback(() => {
    const el = taRef.current;
    if (el) { el.style.height = 'auto'; el.style.height = Math.min(el.scrollHeight, 120) + 'px'; }
  }, []);

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSend(); }
  };

  return (
    <div className="composer">
      <div className="composer-box">
        <textarea
          ref={taRef}
          value={value}
          onChange={(e) => { onChange(e.target.value); resize(); }}
          onKeyDown={handleKey}
          placeholder="Ask about FIR data…"
          rows={1}
          disabled={loading}
        />
        <div className="composer-actions">
          <button
            className={`lang-btn ${language === 'en' ? 'on' : ''}`}
            onClick={() => onLang('en')}
          >EN</button>
          <button
            className={`lang-btn ${language === 'kn' ? 'on' : ''}`}
            onClick={() => onLang('kn')}
          >ಕನ್ನಡ</button>

          <button className="mic-btn" title="Voice coming soon" disabled>
            🎙
          </button>

          <button
            className="send-btn"
            onClick={onSend}
            disabled={!value.trim() || loading}
            title="Send"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
