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

// One shared rendering clock. Hidden pages have no ticking interval; every
// subscriber reads the timestamp again on visibilitychange.
const listeners = new Set<(now: number) => void>();
let timer: ReturnType<typeof setInterval> | undefined;
const tick = () => listeners.forEach((listener) => listener(Date.now()));
const syncClock = () => {
    if (timer) clearInterval(timer);
    timer = undefined;
    tick();
    if (listeners.size && document.visibilityState !== 'hidden')
        timer = setInterval(tick, 1000);
};
export const useClockNow = (active: boolean): number => {
    const [now, setNow] = useState(() => Date.now());
    useEffect(() => {
        if (!active) return undefined;
        listeners.add(setNow);
        if (listeners.size === 1)
            document.addEventListener('visibilitychange', syncClock);
        syncClock();
        return () => {
            listeners.delete(setNow);
            if (!listeners.size) {
                if (timer) clearInterval(timer);
                timer = undefined;
                document.removeEventListener('visibilitychange', syncClock);
            }
        };
    }, [active]);
    return now;
};
