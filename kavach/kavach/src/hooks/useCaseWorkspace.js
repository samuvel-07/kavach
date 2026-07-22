import { useState, useEffect } from 'react';
import { fetchWorkspaceData } from '../services/workspaceService';

export function useCaseWorkspace(caseId) {
  const [workspaceData, setWorkspaceData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!caseId) {
      setWorkspaceData(null);
      return;
    }

    let isMounted = true;
    setLoading(true);
    setError(null);

    fetchWorkspaceData(caseId)
      .then(data => {
        if (isMounted) {
          setWorkspaceData(data);
          setLoading(false);
        }
      })
      .catch(err => {
        if (isMounted) {
          setError(err);
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [caseId]);

  return { data: workspaceData, loading, error };
}
