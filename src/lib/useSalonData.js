import { useEffect, useState } from 'react';
import { api, logError } from './api';

/** Services, opening hours and closed days, loaded once per page. */
export default function useSalonData() {
  const [state, setState] = useState({ services: null, hours: [], blocked: new Set(), error: null });

  useEffect(() => {
    let alive = true;
    Promise.all([api.getServices(), api.getHours(), api.getBlocked()])
      .then(([services, hours, blocked]) => {
        if (alive) setState({ services, hours, blocked: new Set(blocked.map((b) => b.day)), error: null });
      })
      .catch((error) => {
        logError(error);
        if (alive) setState((s) => ({ ...s, services: [], error }));
      });
    return () => {
      alive = false;
    };
  }, []);

  return state;
}
