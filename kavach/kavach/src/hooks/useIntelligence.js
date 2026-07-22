import { useState, useEffect } from 'react';
import { generateIntelligence } from '../services/intelligenceService';

export function useIntelligence(msg) {
  const [insights, setInsights] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    
    // Only generate intelligence for successful assistant messages with rows
    if (!msg || msg.error || msg.role !== 'assistant' || !msg.rows || msg.rows.length === 0) {
      setLoading(false);
      setInsights([]);
      setQuestions([]);
      return;
    }

    generateIntelligence(msg)
      .then((data) => {
        if (isMounted) {
          setInsights(data.insights);
          setQuestions(data.questions);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (isMounted) {
          setError(err);
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [msg]);

  return { insights, questions, loading, error };
}
