import { useEffect, useState } from 'react';

// Steps through `count` messages every `intervalMs` while `active`, starting
// from the first each time it turns on, and counts the seconds elapsed.
// Used to show that a slow request (an AI call) is still working.
export const useRotatingMessage = (
    active: boolean,
    count: number,
    intervalMs = 2800
): { index: number; seconds: number } => {
    const [index, setIndex] = useState(0);
    const [seconds, setSeconds] = useState(0);

    useEffect(() => {
        if (!active || count === 0) return;
        setIndex(0);
        setSeconds(0);
        const started = Date.now();
        const rotate = setInterval(
            () => setIndex((i) => (i + 1) % count),
            intervalMs
        );
        const tick = setInterval(
            () => setSeconds(Math.floor((Date.now() - started) / 1000)),
            1000
        );
        return () => {
            clearInterval(rotate);
            clearInterval(tick);
        };
    }, [active, count, intervalMs]);

    return { index, seconds };
};
