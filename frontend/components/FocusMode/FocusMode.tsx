// Life-to-Day (T-502, T-1202): Focus and breaks share pomodoroClock.
import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import {
    FocusSession,
    endFocus,
    startFocus,
    fetchFocusToday,
    fetchPomodoroSettings,
    DEFAULT_POMODORO,
} from '../../utils/todayService';
import {
    elapsedSeconds,
    formatClock,
    remainingSeconds,
    useClockNow,
} from '../Shared/pomodoroClock';
import { resolveDisplayLocale } from '../../utils/jalali';
import EffectLine from '../Lessons/EffectLine';
import FocusRing from './FocusRing';
import { refreshFocus } from './focusState';

interface FocusModeProps {
    session: FocusSession;
    onClose: (session: FocusSession) => void;
    onMinimize?: () => void;
    onStarted?: (session: FocusSession) => void;
}
const button =
    'min-h-[44px] rounded-lg px-4 text-sm font-medium ltd-primary disabled:opacity-50';
const quietButton =
    'min-h-[44px] rounded-lg bg-gray-100 px-4 text-sm font-medium text-gray-800 dark:bg-gray-800 dark:text-gray-200 disabled:opacity-50';

const FocusMode: React.FC<FocusModeProps> = ({
    session: initial,
    onClose,
    onMinimize,
    onStarted,
}) => {
    const { t, i18n } = useTranslation();
    const [session, setSession] = useState(initial);
    const [rest, setRest] = useState<{
        started: number;
        minutes: number;
    } | null>(null);
    const [prefs, setPrefs] = useState(DEFAULT_POMODORO);
    const [asking, setAsking] = useState(false);
    const [continued, setContinued] = useState(false);
    const [acknowledged, setAcknowledged] = useState(0);
    const [closed, setClosed] = useState<FocusSession | null>(null);
    const [note, setNote] = useState(initial.resume_note ?? '');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const primaryRef = useRef<HTMLButtonElement>(null);
    const noteRef = useRef<HTMLTextAreaElement>(null);
    const bellPlayed = useRef(false);
    const autoClosing = useRef(false);
    const now = useClockNow(!closed);
    const serverNow = now + (session.clock_offset_ms ?? 0);
    const startedAt = new Date(session.started_at).getTime();
    const planned = session.planned_minutes * 60;
    const left = remainingSeconds(startedAt, planned, serverNow);
    const elapsed = elapsedSeconds(startedAt, serverNow);
    const overtime = Math.max(0, elapsed - planned);
    const restLeft = rest
        ? remainingSeconds(rest.started, rest.minutes * 60, now)
        : 0;
    const stillHere =
        !rest &&
        !closed &&
        overtime > 15 * 60 &&
        elapsed > acknowledged &&
        document.visibilityState !== 'hidden';
    const formatter = new Intl.NumberFormat(
        resolveDisplayLocale(i18n.language),
        { useGrouping: false }
    );
    const digits = (value: string) =>
        value.replace(/\d/g, (d) => formatter.format(Number(d)));
    const bellTime = new Date(startedAt + planned * 1000).toISOString();

    useEffect(() => {
        fetchPomodoroSettings()
            .then(setPrefs)
            .catch(() => undefined);
    }, []);
    useEffect(() => {
        (asking ? noteRef : primaryRef).current?.focus();
    }, [asking]);
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && !asking && !rest && !closed) {
                e.preventDefault();
                setAsking(true);
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [asking, rest, closed]);
    useEffect(() => {
        if (left !== 0 || rest || closed || bellPlayed.current) return;
        bellPlayed.current = true;
        if (!prefs.sound) return;
        // An optional short tone, without an audio asset.
        const Audio = window.AudioContext;
        if (!Audio) return;
        const context = new Audio();
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        oscillator.frequency.value = 660;
        gain.gain.setValueAtTime(0.06, context.currentTime);
        gain.gain.exponentialRampToValueAtTime(
            0.001,
            context.currentTime + 0.15
        );
        oscillator.connect(gain);
        gain.connect(context.destination);
        oscillator.start();
        oscillator.stop(context.currentTime + 0.16);
        oscillator.onended = () => {
            void context.close();
        };
    }, [left, rest, closed, prefs.sound]);
    useEffect(() => {
        if (rest || closed || overtime <= 120 * 60 || autoClosing.current)
            return;
        autoClosing.current = true;
        endFocus(session.uid, { ended_at: bellTime })
            .then((ended) => {
                setClosed(ended);
                void refreshFocus();
            })
            .catch((err) => {
                setError(String(err));
                autoClosing.current = false;
            });
    }, [overtime, rest, closed, session.uid, bellTime]);

    const finish = async (
        interrupted: boolean,
        atBell = false,
        takeBreak = false
    ) => {
        setBusy(true);
        setError(null);
        try {
            const ended = await endFocus(session.uid, {
                interrupted,
                ...(atBell ? { ended_at: bellTime } : {}),
                ...(interrupted ? { resume_note: note } : {}),
            });
            void refreshFocus();
            if (ended.auto_closed) {
                setClosed(ended);
                return;
            }
            if (takeBreak) {
                const today = await fetchFocusToday();
                setRest({
                    started: Date.now(),
                    minutes:
                        today.completed_count > 0 &&
                        today.completed_count % prefs.long_every === 0
                            ? prefs.long_break_minutes
                            : prefs.short_break_minutes,
                });
                setAsking(false);
            } else onClose(ended);
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
        } finally {
            setBusy(false);
        }
    };
    const next = async () => {
        if (!session.task_uid) return;
        setBusy(true);
        setError(null);
        try {
            const s = await startFocus(session.task_uid);
            setSession(s);
            setRest(null);
            setContinued(false);
            setAcknowledged(0);
            setClosed(null);
            bellPlayed.current = false;
            autoClosing.current = false;
            onStarted?.(s);
            void refreshFocus();
        } catch (err) {
            setError(String(err));
        } finally {
            setBusy(false);
        }
    };
    const fraction = rest
        ? 1 - restLeft / (rest.minutes * 60)
        : continued && left === 0
          ? 1
          : left / planned;
    // Escape the transformed app canvas so Focus covers the whole viewport.
    return createPortal(
        <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="focus-mode-task"
            data-testid="focus-mode"
            className="fixed inset-0 z-[10100] flex flex-col items-center justify-center gap-5 overflow-y-auto bg-white px-4 py-8 text-center dark:bg-gray-950"
        >
            {onMinimize && !rest && !closed && (
                <button
                    className={`${quietButton} absolute end-4 top-4`}
                    onClick={onMinimize}
                >
                    {t('taskPomodoro.minimize', 'Keep working in the app')}
                </button>
            )}
            <p className="text-sm font-medium text-secondary">
                {rest
                    ? t('taskPomodoro.break', 'Break')
                    : t('focusMode.label', 'Focus')}
            </p>
            <h1
                id="focus-mode-task"
                className="max-w-2xl break-words text-2xl font-semibold sm:text-3xl"
            >
                <bdi>{session.task_name}</bdi>
            </h1>
            {!rest && !closed && (
                <EffectLine
                    taskUid={session.task_uid}
                    className="max-w-xl items-center text-gray-600 dark:text-gray-400"
                />
            )}
            {!rest && session.resume_note && (
                <p data-testid="focus-resume-note">
                    {t('focusMode.whereWasI', 'Where was I?')}{' '}
                    <bdi>{session.resume_note}</bdi>
                </p>
            )}
            {!rest && session.starter_step && (
                <p>
                    {t('focusMode.startWith', 'Start with:')}{' '}
                    <bdi>{session.starter_step}</bdi>
                </p>
            )}
            <div className="relative flex items-center justify-center">
                <FocusRing
                    fraction={fraction}
                    enter
                    bell={left === 0 && !rest && !continued && !closed}
                />
                <div
                    dir="ltr"
                    className="absolute font-mono text-5xl tabular-nums"
                    data-testid="focus-clock"
                    aria-label={t('focusMode.timeLeft', 'Time left')}
                >
                    {digits(
                        rest
                            ? formatClock(restLeft)
                            : continued && left === 0
                              ? `+${formatClock(overtime)}`
                              : formatClock(left)
                    )}
                </div>
            </div>
            {error && <p role="alert">{error}</p>}
            {closed ? (
                <>
                    <p role="status">
                        {t(
                            'taskPomodoro.autoClosed',
                            'Session closed. Time after the bell was not counted.'
                        )}
                    </p>
                    <button className={button} onClick={() => onClose(closed)}>
                        {t('pomodoro.done', 'Done')}
                    </button>
                </>
            ) : rest ? (
                <>
                    <p>
                        {t('taskPomodoro.walk', 'Stand up and walk a little.')}
                    </p>
                    {restLeft === 0 ? (
                        <button
                            className={button}
                            disabled={busy}
                            data-testid="focus-next"
                            onClick={next}
                        >
                            {t('taskPomodoro.next', 'Next interval')}
                        </button>
                    ) : (
                        <p role="status">
                            {t('taskPomodoro.resting', 'Take your time.')}
                        </p>
                    )}
                    <button
                        className={quietButton}
                        onClick={() =>
                            onClose({ ...session, ended_at: bellTime })
                        }
                    >
                        {t('pomodoro.done', 'Done')}
                    </button>
                </>
            ) : asking ? (
                <form
                    className="flex w-full max-w-md flex-col gap-3"
                    onSubmit={(e) => {
                        e.preventDefault();
                        void finish(true);
                    }}
                >
                    <label htmlFor="focus-resume-input">
                        {t(
                            'focusMode.notePrompt',
                            'Where were you? One line for when you come back.'
                        )}
                    </label>
                    <textarea
                        id="focus-resume-input"
                        ref={noteRef}
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        rows={3}
                        maxLength={2000}
                        className="rounded-lg border p-3 text-start dark:bg-gray-900"
                        data-testid="focus-note-input"
                    />
                    <div className="flex justify-center gap-2">
                        <button
                            type="button"
                            className={quietButton}
                            disabled={busy}
                            onClick={() => setAsking(false)}
                        >
                            {t('focusMode.keepGoing', 'Keep going')}
                        </button>
                        <button
                            type="submit"
                            className={button}
                            disabled={busy}
                            data-testid="focus-save-interrupt"
                        >
                            {t('focusMode.saveAndPause', 'Save and pause')}
                        </button>
                    </div>
                </form>
            ) : (
                <>
                    {stillHere && (
                        <p role="status" data-testid="focus-still-here">
                            {t('taskPomodoro.stillHere', 'Still here?')}
                        </p>
                    )}
                    {left === 0 && !continued && !stillHere && (
                        <p role="status">
                            {t('taskPomodoro.bell', 'Interval complete.')}
                        </p>
                    )}
                    <div className="flex flex-wrap justify-center gap-2">
                        <button
                            className={quietButton}
                            disabled={busy}
                            data-testid="focus-interrupt"
                            onClick={() => setAsking(true)}
                        >
                            {t('focusMode.interrupt', 'I need to stop')}
                        </button>
                        {left === 0 && (
                            <>
                                <button
                                    className={button}
                                    disabled={busy}
                                    data-testid="focus-break"
                                    onClick={() => finish(false, true, true)}
                                >
                                    {t(
                                        'taskPomodoro.takeBreak',
                                        'Take a break'
                                    )}
                                </button>
                                <button
                                    className={quietButton}
                                    data-testid="focus-continue"
                                    onClick={() => {
                                        setContinued(true);
                                        setAcknowledged(elapsed + 15 * 60);
                                    }}
                                >
                                    {t(
                                        'taskPomodoro.continue',
                                        'I’ll keep going'
                                    )}
                                </button>
                                {stillHere && (
                                    <button
                                        className={quietButton}
                                        disabled={busy}
                                        data-testid="focus-close-at-bell"
                                        onClick={() => finish(false, true)}
                                    >
                                        {t(
                                            'taskPomodoro.closeAtBell',
                                            'Close at the bell'
                                        )}
                                    </button>
                                )}
                            </>
                        )}
                        <button
                            ref={primaryRef}
                            className={button}
                            disabled={busy}
                            data-testid="focus-finish"
                            onClick={() => finish(false)}
                        >
                            {t('focusMode.finish', 'Finish session')}
                        </button>
                    </div>
                </>
            )}
        </div>,
        document.body
    );
};
export default FocusMode;
