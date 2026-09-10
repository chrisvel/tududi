import { useEffect, useState } from 'react';

const QUERY = '(prefers-reduced-motion: reduce)';

const getInitial = (): boolean => {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    return window.matchMedia(QUERY).matches;
};

// Tracks the user's "reduce motion" OS setting so animated UI can fall back to
// an instant show/hide.
export const useReducedMotion = (): boolean => {
    const [reduced, setReduced] = useState<boolean>(getInitial);

    useEffect(() => {
        if (typeof window === 'undefined' || !window.matchMedia) return;
        const mql = window.matchMedia(QUERY);
        const handler = (e: MediaQueryListEvent) => setReduced(e.matches);

        if (mql.addEventListener) {
            mql.addEventListener('change', handler);
            return () => mql.removeEventListener('change', handler);
        }
        // Safari < 14
        mql.addListener(handler);
        return () => mql.removeListener(handler);
    }, []);

    return reduced;
};

export default useReducedMotion;
