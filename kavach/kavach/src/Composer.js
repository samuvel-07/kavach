import React, { useRef, useCallback, useState, useEffect } from 'react';

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

export default function Composer({ value, onChange, onSend, loading, language, onLang }) {
  const taRef = useRef(null);
  const [listening, setListening] = useState(false);
  const recogRef = useRef(null);

  const resize = useCallback(() => {
    const el = taRef.current;
    if (el) { el.style.height = 'auto'; el.style.height = Math.min(el.scrollHeight, 120) + 'px'; }
  }, []);

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSend(); }
  };

  // Clean up recognition on unmount
  useEffect(() => {
    return () => {
      if (recogRef.current) {
        try { recogRef.current.abort(); } catch (_) {}
      }
    };
  }, []);

  const toggleMic = () => {
    if (!SpeechRecognition) {
      alert('Voice input is not supported in this browser. Try Chrome.');
      return;
    }

    if (listening) {
      // Stop
      if (recogRef.current) recogRef.current.stop();
      setListening(false);
      return;
    }

    const recog = new SpeechRecognition();
    recog.lang = language === 'kn' ? 'kn-IN' : 'en-IN';
    recog.interimResults = true;
    recog.continuous = false;
    recog.maxAlternatives = 1;
    recogRef.current = recog;

    let finalText = '';

    recog.onresult = (e) => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) {
          finalText += t;
        } else {
          interim += t;
        }
      }
      // Show interim in the composer
      onChange(finalText + interim);
      resize();
    };

    recog.onend = () => {
      setListening(false);
      if (finalText.trim()) {
        onChange(finalText.trim());
        resize();
      }
    };

    recog.onerror = (e) => {
      console.warn('Speech recognition error:', e.error);
      setListening(false);
      if (e.error === 'not-allowed') {
        alert('Microphone access denied. Please allow microphone access in your browser settings.');
      }
    };

    setListening(true);
    recog.start();
  };

  return (
    <div className="composer">
      <div className="composer-box">
        <textarea
          ref={taRef}
          value={value}
          onChange={(e) => { onChange(e.target.value); resize(); }}
          onKeyDown={handleKey}
          placeholder={listening ? (language === 'kn' ? 'ಮಾತನಾಡಿ…' : 'Speak now…') : 'Ask about FIR data…'}
          rows={1}
          disabled={loading}
          aria-label="Question input"
        />
        <div className="composer-actions">
          <button
            className={`lang-btn ${language === 'en' ? 'on' : ''}`}
            onClick={() => onLang('en')}
            aria-label="Switch to English"
          >EN</button>
          <button
            className={`lang-btn ${language === 'kn' ? 'on' : ''}`}
            onClick={() => onLang('kn')}
            aria-label="Switch to Kannada"
          >ಕನ್ನಡ</button>

          <button
            className={`mic-btn ${listening ? 'mic-on' : ''}`}
            onClick={toggleMic}
            disabled={loading}
            title={listening ? 'Stop listening' : `Voice input (${language === 'kn' ? 'Kannada' : 'English'})`}
            aria-label={listening ? 'Stop voice input' : 'Start voice input'}
          >
            {listening ? (
              <span className="mic-pulse" aria-hidden="true">●</span>
            ) : (
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
                <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                <line x1="12" y1="19" x2="12" y2="23"/>
                <line x1="8" y1="23" x2="16" y2="23"/>
              </svg>
            )}
          </button>

          <button
            className="send-btn"
            onClick={onSend}
            disabled={!value.trim() || loading}
            title="Send"
            aria-label="Send message"
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
