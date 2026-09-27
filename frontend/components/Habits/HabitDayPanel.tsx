import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    TrashIcon,
    PlusIcon,
    ForwardIcon,
    NoSymbolIcon,
    CheckIcon,
} from '@heroicons/react/24/outline';
import { Task } from '../../entities/Task';
import { ACCENT } from '../../constants/colorPalette';
import { HabitCompletion } from '../../utils/habitsService';
import {
    DayTotals,
    formatAmount,
    habitGoal,
    isMeasurableHabit,
    isQuitHabit,
    isScheduledOn,
} from '../../utils/habitUtils';
import { FORM } from '../../constants/formClasses';

interface HabitDayPanelProps {
    habit: Task;
    date: Date;
    totals?: DayTotals;
    onCheckIn: (options: { value?: number; note?: string }) => Promise<void>;
    onSkip: () => Promise<void>;
    onDelete: (entry: HabitCompletion) => Promise<void>;
    onUpdateNote: (entry: HabitCompletion, note: string) => Promise<void>;
}

const NoteField: React.FC<{
    entry: HabitCompletion;
    onSave: (note: string) => Promise<void>;
}> = ({ entry, onSave }) => {
    const { t } = useTranslation();
    const [draft, setDraft] = useState(entry.note || '');
    useEffect(() => setDraft(entry.note || ''), [entry.note]);
    return (
        <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={() => {
                if (draft !== (entry.note || '')) onSave(draft);
            }}
            onKeyDown={(e) => {
                if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
            }}
            placeholder={t('habits.addNote', 'Add a note')}
            aria-label={t('habits.note', 'Note')}
            className="flex-1 min-w-0 bg-transparent text-sm text-gray-700 dark:text-gray-200 placeholder-gray-400 focus:outline-none focus:bg-gray-100 dark:focus:bg-gray-800 rounded px-1.5 py-0.5"
        />
    );
};

const HabitDayPanel: React.FC<HabitDayPanelProps> = ({
    habit,
    date,
    totals,
    onCheckIn,
    onSkip,
    onDelete,
    onUpdateNote,
}) => {
    const { t } = useTranslation();
    const [amount, setAmount] = useState('');
    const [note, setNote] = useState('');
    const [busy, setBusy] = useState(false);
    const quit = isQuitHabit(habit);
    const measurable = isMeasurableHabit(habit);
    const goal = habitGoal(habit);
    const entries = totals?.entries || [];
    const checkIns = entries.filter((e) => !e.skipped);
    const skipped = totals?.skipped && checkIns.length === 0;
    const daily = (habit.habit_frequency_period || 'daily') === 'daily';
    const multiple = measurable || (daily && goal > 1);
    const canAdd = quit
        ? checkIns.length === 0
        : multiple
          ? measurable || checkIns.length < goal
          : checkIns.length === 0;

    useEffect(() => {
        setAmount('');
        setNote('');
    }, [date]);

    const guard = async (fn: () => Promise<void>) => {
        if (busy) return;
        setBusy(true);
        try {
            await fn();
        } finally {
            setBusy(false);
        }
    };

    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        const value = parseFloat(amount);
        if (measurable && !(value > 0)) return;
        guard(async () => {
            await onCheckIn({
                value: measurable ? value : undefined,
                note: note.trim() || undefined,
            });
            setAmount('');
            setNote('');
        });
    };

    const heading = date.toLocaleDateString(undefined, {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric',
    });

    let status: string;
    if (quit) {
        status = checkIns.length
            ? t('habits.day.slipped', 'Slipped this day')
            : t('habits.day.clean', 'Clean');
    } else if (skipped) {
        status = t('habits.day.skipped', 'Skipped, the streak is kept');
    } else if (!isScheduledOn(habit, date)) {
        status = t('habits.day.off', 'Not a scheduled day');
    } else if (daily) {
        status = `${formatAmount(totals?.progress || 0)} / ${formatAmount(goal)}${measurable && habit.habit_unit ? ` ${habit.habit_unit}` : ''}`;
    } else {
        status = checkIns.length
            ? t('habits.day.checkedIn', 'Checked in')
            : t('habits.day.none', 'No check-in');
    }

    return (
        <div className="rounded-xl bg-gray-50 dark:bg-gray-800/60 p-4">
            <div className="flex items-baseline justify-between gap-2 mb-3">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                    {heading}
                </h3>
                <span className="text-xs text-gray-500 dark:text-gray-400 tabular-nums">
                    {status}
                </span>
            </div>

            {entries.length > 0 && (
                <ul className="mb-3 space-y-1">
                    {entries.map((entry) => (
                        <li
                            key={entry.id}
                            className="flex items-center gap-2 text-sm"
                        >
                            <span
                                className={`shrink-0 w-5 h-5 rounded-full flex items-center justify-center ${
                                    entry.skipped
                                        ? 'bg-sky-100 dark:bg-sky-900 text-sky-600 dark:text-sky-300'
                                        : quit
                                          ? 'bg-red-100 dark:bg-red-900/60 text-red-500'
                                          : `${ACCENT.softBg} ${ACCENT.text}`
                                }`}
                            >
                                {entry.skipped ? (
                                    <ForwardIcon className="h-3 w-3" />
                                ) : quit ? (
                                    <NoSymbolIcon className="h-3 w-3" />
                                ) : (
                                    <CheckIcon className="h-3 w-3" />
                                )}
                            </span>
                            {measurable && !entry.skipped && (
                                <span className="shrink-0 tabular-nums text-gray-700 dark:text-gray-200">
                                    {formatAmount(Number(entry.value) || 0)}
                                    {habit.habit_unit
                                        ? ` ${habit.habit_unit}`
                                        : ''}
                                </span>
                            )}
                            <NoteField
                                entry={entry}
                                onSave={(value) => onUpdateNote(entry, value)}
                            />
                            <button
                                type="button"
                                onClick={() => guard(() => onDelete(entry))}
                                className="shrink-0 p-1 rounded text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40"
                                title={t('habits.removeEntry', 'Remove')}
                                aria-label={t('habits.removeEntry', 'Remove')}
                            >
                                <TrashIcon className="h-4 w-4" />
                            </button>
                        </li>
                    ))}
                </ul>
            )}

            <form
                onSubmit={submit}
                className="flex flex-wrap items-center gap-2"
            >
                {canAdd && (
                    <>
                        {measurable && (
                            <input
                                type="number"
                                inputMode="decimal"
                                min="0"
                                step="any"
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                                placeholder={
                                    habit.habit_unit ||
                                    t('habits.amount', 'Amount')
                                }
                                aria-label={t('habits.amount', 'Amount')}
                                className={`${FORM.input} w-24`}
                            />
                        )}
                        <input
                            type="text"
                            value={note}
                            onChange={(e) => setNote(e.target.value)}
                            placeholder={t(
                                'habits.optionalNote',
                                'Note (optional)'
                            )}
                            aria-label={t('habits.note', 'Note')}
                            className={`${FORM.input} flex-1 min-w-[8rem]`}
                        />
                        <button
                            type="submit"
                            disabled={
                                busy ||
                                (measurable && !(parseFloat(amount) > 0))
                            }
                            className={`flex items-center gap-1 px-3 py-1.5 text-sm rounded-lg text-white disabled:opacity-40 ${
                                quit
                                    ? 'bg-red-500 hover:bg-red-600'
                                    : ACCENT.solid
                            }`}
                        >
                            {quit ? (
                                <NoSymbolIcon className="h-4 w-4" />
                            ) : (
                                <PlusIcon className="h-4 w-4" />
                            )}
                            {quit
                                ? t('habits.confirmSlip', 'Log slip')
                                : t('habits.checkIn', 'Check in')}
                        </button>
                    </>
                )}
                {!quit && !skipped && checkIns.length === 0 && (
                    <button
                        type="button"
                        onClick={() => guard(onSkip)}
                        disabled={busy}
                        className="flex items-center gap-1 px-3 py-1.5 text-sm rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
                        title={t(
                            'habits.skipHint',
                            'Rest day, sick or travelling: keeps the streak'
                        )}
                    >
                        <ForwardIcon className="h-4 w-4" />
                        {t('habits.skipDay', 'Skip day')}
                    </button>
                )}
            </form>
        </div>
    );
};

export default HabitDayPanel;
