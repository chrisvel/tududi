// LTD-PATCH(T-1203): the top bar opens the same server Focus session; no local tomato clock.
import React, { useEffect, useRef, useState } from 'react';
import useSWR from 'swr';
import { useTranslation } from 'react-i18next';
import {
    fetchCurrentFocus,
    focusKeys,
    startFocus,
    fetchPomodoroSettings,
    savePomodoroSettings,
    DEFAULT_POMODORO,
} from '../../utils/todayService';
import { fetchDailyPlan, DailyPlanItem } from '../../utils/dailyPlanService';
import { formatClock, remainingSeconds, useClockNow } from './pomodoroClock';
import { resolveDisplayLocale } from '../../utils/jalali';
import FocusRing from '../FocusMode/FocusRing';
import FocusMode from '../FocusMode/FocusMode';
import { refreshFocus, useFocusTimer } from '../FocusMode/focusState';
import { pickCurrentItem } from '../DailyPlan/planUtils';
import { getUserTimezone } from '../../utils/dateUtils';
import { minuteOfDay, isItemDone } from '../DailyPlan/planUtils';

const PomodoroTimer: React.FC<{ className?: string; enabled?: boolean }> = ({
    className = '',
    enabled = true,
}) => {
    const { t, i18n } = useTranslation();
    const { data: current, mutate } = useSWR(
        focusKeys.current,
        fetchCurrentFocus
    );
    const { session, open, show, hide } = useFocusTimer();
    const active = current && !current.ended_at ? current : null;
    const now = useClockNow(!!active);
    const [picker, setPicker] = useState(false);
    const [items, setItems] = useState<DailyPlanItem[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const [prefs, setPrefs] = useState(DEFAULT_POMODORO);
    const [notice, setNotice] = useState(false);
    const checked = useRef<string | null>(null);
    const autoChecked = useRef<string | null>(null);
    const left = active
        ? remainingSeconds(
              new Date(active.started_at).getTime(),
              active.planned_minutes * 60,
              now + (active.clock_offset_ms ?? 0)
          )
        : 0;
    const over = active
        ? Math.max(
              0,
              Math.floor(
                  (now +
                      (active.clock_offset_ms ?? 0) -
                      new Date(active.started_at).getTime()) /
                      1000
              ) -
                  active.planned_minutes * 60
          )
        : 0;
    const digits = (value: string) =>
        value.replace(/\d/g, (d) =>
            new Intl.NumberFormat(resolveDisplayLocale(i18n.language)).format(
                Number(d)
            )
        );
    useEffect(() => {
        localStorage.removeItem('tududi_pomodoro_timer');
        return () => {
            useFocusTimer.setState({ session: null, open: false });
            void mutate(null, false);
        };
    }, [mutate]);
    useEffect(() => {
        if (current?.auto_closed) {
            setNotice(true);
            hide();
            void refreshFocus();
        } else if (active && session?.uid !== active.uid) show(active);
    }, [current, active, session?.uid, show, hide]);
    useEffect(() => {
        if (!active || document.visibilityState === 'hidden') return;
        if (over > 120 * 60 && autoChecked.current !== active.uid) {
            autoChecked.current = active.uid;
            void mutate();
        } else if (over > 15 * 60 && checked.current !== active.uid) {
            checked.current = active.uid;
            show(active);
        }
    }, [active, over, mutate, show]);
    const choose = async () => {
        setPicker(!picker);
        setError(null);
        if (picker) return;
        try {
            const [plan, settings] = await Promise.all([
                fetchDailyPlan(),
                fetchPomodoroSettings(),
            ]);
            const list = (plan.plan?.items ?? []).filter(
                (i) => !isItemDone(i) && ![3, 5].includes(Number(i.task.status))
            );
            const nowItem = pickCurrentItem(
                list,
                minuteOfDay(new Date(), getUserTimezone())
            );
            setItems(
                nowItem
                    ? [
                          nowItem.item,
                          ...list.filter(
                              (i) => i.task_uid !== nowItem.item.task_uid
                          ),
                      ]
                    : list
            );
            setPrefs(settings);
        } catch (err) {
            setError(String(err));
        }
    };
    const start = async (item: DailyPlanItem) => {
        setBusy(true);
        setError(null);
        try {
            const s = await startFocus(item.task_uid);
            await mutate(s, false);
            show(s);
            setPicker(false);
        } catch (err) {
            setError(String(err));
            void mutate();
        } finally {
            setBusy(false);
        }
    };
    const savePrefs = async (value: typeof prefs) => {
        setBusy(true);
        try {
            const saved = await savePomodoroSettings(value);
            setPrefs(saved);
            void refreshFocus();
        } catch (err) {
            setError(String(err));
        } finally {
            setBusy(false);
        }
    };
    return (
        <>
            {open && session && (
                <FocusMode
                    key={session.uid}
                    session={session}
                    onMinimize={hide}
                    onStarted={(s) => {
                        show(s);
                        void mutate(s, false);
                    }}
                    onClose={() => {
                        hide();
                        void refreshFocus();
                    }}
                />
            )}
            <div className={`relative ${className}`}>
                {(enabled || active) && (
                    <button
                        type="button"
                        className="min-h-[44px] flex items-center gap-2 px-2"
                        data-testid="pomodoro-chip"
                        aria-expanded={picker}
                        onClick={() => (active ? show(active) : void choose())}
                        aria-label={t('focusMode.start', 'Focus')}
                    >
                        <FocusRing
                            fraction={
                                active
                                    ? left / (active.planned_minutes * 60)
                                    : 1
                            }
                            size={28}
                        />
                        {active ? (
                            <>
                                <span
                                    dir="ltr"
                                    className="font-mono tabular-nums"
                                >
                                    {digits(
                                        left === 0
                                            ? `+${formatClock(over)}`
                                            : formatClock(left)
                                    )}
                                </span>
                                <bdi className="max-w-[8rem] truncate">
                                    {active.task_name}
                                </bdi>
                            </>
                        ) : (
                            <span>{t('focusMode.start', 'Focus')}</span>
                        )}
                    </button>
                )}
                {notice && (
                    <p
                        role="status"
                        className="absolute end-0 top-full w-64 bg-white p-3 shadow dark:bg-gray-900"
                    >
                        {t(
                            'taskPomodoro.autoClosed',
                            'Session closed. Time after the bell was not counted.'
                        )}
                        <button
                            className="min-h-[44px] px-3"
                            onClick={() => setNotice(false)}
                        >
                            {t('pomodoro.done', 'Done')}
                        </button>
                    </p>
                )}
                {picker && (
                    <div
                        className="absolute top-full end-0 z-50 flex w-80 max-w-[90vw] flex-col gap-2 rounded-lg border bg-white p-4 shadow dark:bg-gray-900"
                        data-testid="focus-picker"
                    >
                        <p>
                            {t(
                                'taskPomodoro.chooseTask',
                                'Choose from today’s plan'
                            )}
                        </p>
                        {items.length === 0 && (
                            <p>
                                {t(
                                    'taskPomodoro.emptyPlan',
                                    'Add a task to today’s plan first.'
                                )}
                            </p>
                        )}
                        {items.map((item) => (
                            <button
                                className="min-h-[44px] text-start"
                                key={item.task_uid}
                                disabled={busy}
                                onClick={() => start(item)}
                            >
                                <bdi>{item.task.name}</bdi>
                            </button>
                        ))}
                        <details>
                            <summary className="min-h-[44px] cursor-pointer">
                                {t(
                                    'taskPomodoro.defaults',
                                    'Pomodoro preferences'
                                )}
                            </summary>
                            {(
                                [
                                    'focus_minutes',
                                    'short_break_minutes',
                                    'long_break_minutes',
                                    'long_every',
                                ] as const
                            ).map((key) => (
                                <label
                                    className="flex items-center justify-between gap-2"
                                    key={key}
                                >
                                    {t(`taskPomodoro.${key}`, key)}
                                    <input
                                        className="min-h-[44px] w-16 rounded border dark:bg-gray-800"
                                        type="number"
                                        min={key === 'long_every' ? 1 : 5}
                                        max={key === 'long_every' ? 12 : 90}
                                        step={key === 'long_every' ? 1 : 5}
                                        value={prefs[key]}
                                        disabled={busy}
                                        onChange={(e) =>
                                            setPrefs({
                                                ...prefs,
                                                [key]: Number(e.target.value),
                                            })
                                        }
                                    />
                                </label>
                            ))}
                            <label className="flex min-h-[44px] items-center gap-2">
                                <input
                                    type="checkbox"
                                    checked={prefs.sound}
                                    onChange={(e) =>
                                        setPrefs({
                                            ...prefs,
                                            sound: e.target.checked,
                                        })
                                    }
                                />
                                {t(
                                    'taskPomodoro.sound',
                                    'Short sound at the bell'
                                )}
                            </label>
                            <button
                                className="min-h-[44px] px-3 ltd-primary"
                                disabled={busy}
                                onClick={() => savePrefs(prefs)}
                            >
                                {t('common.save', 'Save')}
                            </button>
                        </details>
                        {error && <p role="alert">{error}</p>}
                    </div>
                )}
            </div>
        </>
    );
};
export default PomodoroTimer;
