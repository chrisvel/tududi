import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    CheckCircleIcon,
    PlusIcon,
    NoSymbolIcon,
} from '@heroicons/react/24/outline';
import { CheckCircleIcon as CheckCircleSolid } from '@heroicons/react/24/solid';
import { Task } from '../../entities/Task';
import { ACCENT } from '../../constants/colorPalette';
import {
    isHabitCompletedInPeriod,
    isMeasurableHabit,
    isQuitHabit,
} from '../../utils/habitUtils';
import { FORM } from '../../constants/formClasses';

interface HabitCheckInProps {
    habit: Task;
    onCheckIn: (options?: { value?: number }) => Promise<void> | void;
    size?: 'sm' | 'lg';
}

// One control for every habit type: a tick for simple habits, +1 for
// multi-count goals, an amount field for measurable habits and a confirmed
// "slipped" for quit habits.
const HabitCheckIn: React.FC<HabitCheckInProps> = ({
    habit,
    onCheckIn,
    size = 'sm',
}) => {
    const { t } = useTranslation();
    const [open, setOpen] = useState(false);
    const [amount, setAmount] = useState('');
    const [busy, setBusy] = useState(false);
    const inputRef = useRef<HTMLInputElement | null>(null);
    const containerRef = useRef<HTMLDivElement | null>(null);

    const quit = isQuitHabit(habit);
    const measurable = isMeasurableHabit(habit);
    const multiple = habit.habit_progress?.multiple_per_day ?? false;
    // Weekly "3×" habits count distinct days, so today can be done while
    // the week is not.
    const done =
        isHabitCompletedInPeriod(habit) ||
        (!multiple && (habit.habit_progress?.today_check_ins ?? 0) > 0);
    const slippedToday =
        quit && habit.habit_progress ? !habit.habit_progress.met : false;

    useEffect(() => {
        if (open && inputRef.current) inputRef.current.focus();
    }, [open]);

    useEffect(() => {
        if (!open) return;
        const close = (e: MouseEvent) => {
            if (!containerRef.current?.contains(e.target as Node)) {
                setOpen(false);
            }
        };
        document.addEventListener('mousedown', close);
        return () => document.removeEventListener('mousedown', close);
    }, [open]);

    const run = async (options?: { value?: number }) => {
        if (busy) return;
        setBusy(true);
        try {
            await onCheckIn(options);
            setOpen(false);
            setAmount('');
        } finally {
            setBusy(false);
        }
    };

    const stop = (e: React.SyntheticEvent) => e.stopPropagation();
    const lg = size === 'lg';

    if (quit) {
        return (
            <div ref={containerRef} className="relative" onClick={stop}>
                {open ? (
                    <div className="flex items-center gap-1">
                        <button
                            type="button"
                            disabled={busy}
                            onClick={() => run()}
                            className="px-2.5 py-1 text-xs rounded-lg bg-red-500 text-white hover:bg-red-600"
                        >
                            {t('habits.confirmSlip', 'Log slip')}
                        </button>
                        <button
                            type="button"
                            onClick={() => setOpen(false)}
                            className="px-2 py-1 text-xs rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700"
                        >
                            {t('common.cancel', 'Cancel')}
                        </button>
                    </div>
                ) : (
                    <button
                        type="button"
                        onClick={() => setOpen(true)}
                        disabled={slippedToday}
                        className={`flex items-center gap-1.5 rounded-lg transition-colors ${
                            lg ? 'px-4 py-2 text-sm' : 'px-2 py-1 text-xs'
                        } ${
                            slippedToday
                                ? 'bg-red-50 dark:bg-red-950/40 text-red-500 cursor-default'
                                : 'text-gray-500 dark:text-gray-400 hover:bg-red-50 dark:hover:bg-red-950/40 hover:text-red-500'
                        }`}
                        title={t(
                            'habits.slipHint',
                            'Record that you did it today'
                        )}
                    >
                        <NoSymbolIcon className={lg ? 'h-5 w-5' : 'h-4 w-4'} />
                        {slippedToday
                            ? t('habits.slippedToday', 'Slipped today')
                            : t('habits.slipped', 'Slipped')}
                    </button>
                )}
            </div>
        );
    }

    if (measurable) {
        return (
            <div ref={containerRef} className="relative" onClick={stop}>
                {open ? (
                    <form
                        className="flex items-center gap-1"
                        onSubmit={(e) => {
                            e.preventDefault();
                            const value = parseFloat(amount);
                            if (value > 0) run({ value });
                        }}
                    >
                        <input
                            ref={inputRef}
                            type="number"
                            inputMode="decimal"
                            min="0"
                            step="any"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Escape') setOpen(false);
                            }}
                            className={`${FORM.input} w-20`}
                            placeholder={habit.habit_unit || '0'}
                            aria-label={t('habits.amount', 'Amount')}
                        />
                        <button
                            type="submit"
                            disabled={busy || !(parseFloat(amount) > 0)}
                            className="px-2.5 py-1 text-xs rounded-lg ${ACCENT.solid} disabled:opacity-40"
                        >
                            {t('habits.add', 'Add')}
                        </button>
                    </form>
                ) : (
                    <button
                        type="button"
                        onClick={() => setOpen(true)}
                        className={`flex items-center gap-1 rounded-lg transition-colors ${
                            lg ? 'px-4 py-2 text-sm' : 'px-2 py-1 text-xs'
                        } ${
                            done
                                ? `${ACCENT.softBg} ${ACCENT.text}`
                                : `${ACCENT.softerBg} ${ACCENT.text} ${ACCENT.hoverSoftBg}`
                        }`}
                        title={t('habits.logAmount', 'Log an amount')}
                    >
                        <PlusIcon className={lg ? 'h-5 w-5' : 'h-4 w-4'} />
                        {habit.habit_unit || t('habits.log', 'Log')}
                    </button>
                )}
            </div>
        );
    }

    if (multiple && !done) {
        return (
            <button
                type="button"
                onClick={(e) => {
                    stop(e);
                    run();
                }}
                disabled={busy}
                className={`flex items-center gap-1 rounded-lg ${ACCENT.softerBg} ${ACCENT.text} ${ACCENT.hoverSoftBg} transition-colors ${
                    lg ? 'px-4 py-2 text-sm' : 'px-2 py-1 text-xs'
                }`}
                title={t('habits.checkInOnce', 'Check in once')}
            >
                <PlusIcon className={lg ? 'h-5 w-5' : 'h-4 w-4'} />1
            </button>
        );
    }

    return (
        <button
            type="button"
            onClick={(e) => {
                stop(e);
                if (!done) run();
            }}
            disabled={busy}
            className={`shrink-0 p-1 rounded-full transition-colors ${
                done
                    ? `${ACCENT.text} cursor-default`
                    : `${ACCENT.text} opacity-60 hover:opacity-100 ${ACCENT.hoverSoftBg}`
            }`}
            title={
                done
                    ? t('habits.doneForPeriod', 'Done for now')
                    : t('habits.complete', 'Complete habit')
            }
        >
            {done ? (
                <CheckCircleSolid className={lg ? 'w-8 h-8' : 'w-6 h-6'} />
            ) : (
                <CheckCircleIcon className={lg ? 'w-8 h-8' : 'w-6 h-6'} />
            )}
        </button>
    );
};

export default HabitCheckIn;
