// Life-to-Day (T-502): the Pomodoro clock, shared with Focus mode. Time left
// is always derived from the start timestamp and the system clock, so a tab
// left in the background (iOS freezes timers) shows the right value the
// moment it is visible again. The interval only asks for a re-render.
import { useEffect, useState } from 'react';

export const elapsedSeconds = (startedAtMs: number, nowMs: number): number =>
    Math.max(0, Math.floor((nowMs - startedAtMs) / 1000));

export const remainingSeconds = (
    startedAtMs: number,
    totalSeconds: number,
    nowMs: number
): number => Math.max(0, totalSeconds - elapsedSeconds(startedAtMs, nowMs));

export const formatClock = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

// Date.now(), refreshed every second while active and whenever the page
// becomes visible again.
export const useClockNow = (active: boolean, everyMs = 1000): number => {
    const [now, setNow] = useState(() => Date.now());
    useEffect(() => {
        if (!active) return undefined;
        const tick = () => setNow(Date.now());
        tick();
        const timer = setInterval(tick, everyMs);
        document.addEventListener('visibilitychange', tick);
        return () => {
            clearInterval(timer);
            document.removeEventListener('visibilitychange', tick);
        };
    }, [active, everyMs]);
    return now;
};
