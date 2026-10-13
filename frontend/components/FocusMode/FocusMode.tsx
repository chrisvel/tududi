// Life-to-Day (T-502): full-screen, single-task Focus. The clock is the
// Pomodoro clock (pomodoroClock): time comes from started_at and the system
// clock, so it is right again the moment a backgrounded tab returns.
// T-1103: one path line and at most one lesson line under the task.
import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FocusSession, endFocus } from '../../utils/todayService';
import {
    elapsedSeconds,
    formatClock,
    remainingSeconds,
    useClockNow,
} from '../Shared/pomodoroClock';
import { resolveDisplayLocale } from '../../utils/jalali';
import EffectLine from '../Lessons/EffectLine';

interface FocusModeProps {
    session: FocusSession;
    onClose: (session: FocusSession) => void;
}

const FocusMode: React.FC<FocusModeProps> = ({ session, onClose }) => {
    const { t, i18n } = useTranslation();
    const now = useClockNow(true);
    const [asking, setAsking] = useState(false);
    const [note, setNote] = useState(session.resume_note ?? '');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const primaryRef = useRef<HTMLButtonElement>(null);
    const noteRef = useRef<HTMLTextAreaElement>(null);

    const startedAt = new Date(session.started_at).getTime();
    const left = remainingSeconds(startedAt, session.planned_minutes * 60, now);
    const elapsed = elapsedSeconds(startedAt, now);
    // Persian digits for fa unless the user chose Latin digits.
    const digitFormat = new Intl.NumberFormat(
        resolveDisplayLocale(i18n.language),
        { useGrouping: false }
    );
    const digits = (value: string) =>
        value.replace(/\d/g, (d) => digitFormat.format(Number(d)));

    useEffect(() => {
        (asking ? noteRef : primaryRef).current?.focus();
    }, [asking]);

    useEffect(() => {
        const onKey = (event: KeyboardEvent) => {
            if (event.key === 'Escape' && !asking) {
                event.preventDefault();
                setAsking(true);
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [asking]);

    const finish = async (interrupted: boolean) => {
        setBusy(true);
        setError(null);
        try {
            onClose(
                await endFocus(session.uid, {
                    interrupted,
                    ...(interrupted ? { resume_note: note } : {}),
                })
            );
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
            setBusy(false);
        }
    };

    return (
        <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="focus-mode-task"
            data-testid="focus-mode"
            className="fixed inset-0 z-[10100] flex flex-col items-center justify-center gap-6 overflow-y-auto bg-white px-4 py-8 text-center dark:bg-gray-950"
        >
            <p className="text-sm font-medium text-secondary">
                {t('focusMode.label', 'Focus')}
            </p>
            <h1
                id="focus-mode-task"
                className="max-w-2xl break-words text-2xl font-semibold text-gray-900 sm:text-3xl dark:text-gray-100"
            >
                <bdi>{session.task_name}</bdi>
            </h1>
            <EffectLine
                taskUid={session.task_uid}
                className="max-w-xl items-center text-gray-600 dark:text-gray-400"
            />
            {session.resume_note && (
                <p
                    className="max-w-xl text-gray-700 dark:text-gray-300"
                    data-testid="focus-resume-note"
                >
                    {t('focusMode.whereWasI', 'Where was I?')}{' '}
                    <bdi>{session.resume_note}</bdi>
                </p>
            )}
            {session.starter_step && (
                <p className="max-w-xl text-gray-600 dark:text-gray-400">
                    {t('focusMode.startWith', 'Start with:')}{' '}
                    <bdi>{session.starter_step}</bdi>
                </p>
            )}
            <div
                className="font-mono text-6xl tabular-nums text-gray-900 dark:text-gray-100"
                data-testid="focus-clock"
                aria-label={t('focusMode.timeLeft', 'Time left')}
            >
                {digits(formatClock(left))}
            </div>
            {left === 0 && (
                <p role="status" className="text-gray-700 dark:text-gray-300">
                    {t(
                        'focusMode.timeUp',
                        'Time is up. Finish, or keep going if it helps.'
                    )}
                </p>
            )}
            <p className="sr-only" aria-live="polite">
                {Math.floor(elapsed / 60) % 5 === 0 && elapsed % 60 === 0
                    ? t('focusMode.minutesIn', '{{count}} minutes in', {
                          count: Math.floor(elapsed / 60),
                      })
                    : ''}
            </p>

            {error && (
                <p role="alert" className="text-red-700 dark:text-red-300">
                    {error}
                </p>
            )}

            {asking ? (
                <form
                    className="flex w-full max-w-md flex-col gap-3"
                    onSubmit={(event) => {
                        event.preventDefault();
                        finish(true);
                    }}
                >
                    <label
                        htmlFor="focus-resume-input"
                        className="text-start text-sm font-medium text-gray-700 dark:text-gray-300"
                    >
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
                        className="rounded-lg border border-gray-300 bg-white p-3 text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                        data-testid="focus-note-input"
                    />
                    <div className="flex flex-wrap justify-center gap-2">
                        <button
                            type="button"
                            onClick={() => setAsking(false)}
                            disabled={busy}
                            className="min-h-[44px] rounded-lg bg-gray-100 px-4 text-sm font-medium text-gray-800 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-200"
                        >
                            {t('focusMode.keepGoing', 'Keep going')}
                        </button>
                        <button
                            type="submit"
                            disabled={busy}
                            className="min-h-[44px] rounded-lg px-4 text-sm font-medium ltd-primary disabled:opacity-50"
                            data-testid="focus-save-interrupt"
                        >
                            {t('focusMode.saveAndPause', 'Save and pause')}
                        </button>
                    </div>
                </form>
            ) : (
                <div className="flex flex-wrap justify-center gap-2">
                    <button
                        type="button"
                        onClick={() => setAsking(true)}
                        disabled={busy}
                        className="min-h-[44px] rounded-lg bg-gray-100 px-4 text-sm font-medium text-gray-800 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-200"
                        data-testid="focus-interrupt"
                    >
                        {t('focusMode.interrupt', 'I need to stop')}
                    </button>
                    <button
                        ref={primaryRef}
                        type="button"
                        onClick={() => finish(false)}
                        disabled={busy}
                        className="min-h-[44px] rounded-lg px-4 text-sm font-medium ltd-primary disabled:opacity-50"
                        data-testid="focus-finish"
                    >
                        {t('focusMode.finish', 'Finish session')}
                    </button>
                </div>
            )}
        </div>
    );
};

export default FocusMode;
