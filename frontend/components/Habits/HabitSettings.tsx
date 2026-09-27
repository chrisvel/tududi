import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Task, HabitPeriod } from '../../entities/Task';
import { weekdayLabel } from '../../utils/habitUtils';
import { ACCENT } from '../../constants/colorPalette';
import ColorPicker from '../Shared/ColorPicker';
import { FORM } from '../../constants/formClasses';

export type HabitSettingsValues = Pick<
    Task,
    | 'habit_polarity'
    | 'habit_target_count'
    | 'habit_target_value'
    | 'habit_unit'
    | 'habit_frequency_period'
    | 'habit_schedule_days'
    | 'habit_interval_days'
    | 'habit_time_of_day'
    | 'habit_reminder_time'
    | 'habit_color'
>;

export const settingsFromHabit = (habit: Task): HabitSettingsValues => ({
    habit_polarity: habit.habit_polarity || 'build',
    habit_target_count: habit.habit_target_count || 1,
    habit_target_value: habit.habit_target_value ?? null,
    habit_unit: habit.habit_unit ?? null,
    habit_frequency_period: habit.habit_frequency_period || 'daily',
    habit_schedule_days: habit.habit_schedule_days ?? null,
    habit_interval_days: habit.habit_interval_days ?? null,
    habit_time_of_day: habit.habit_time_of_day ?? null,
    habit_reminder_time: habit.habit_reminder_time ?? null,
    habit_color: habit.habit_color ?? null,
});

interface HabitSettingsProps {
    values: HabitSettingsValues;
    firstDayOfWeek: number;
    onChange: (patch: Partial<HabitSettingsValues>) => void;
    saving?: boolean;
}

const fieldClass = FORM.input;

interface SegmentedProps<T extends string> {
    value: T;
    options: { value: T; label: string }[];
    onChange: (value: T) => void;
    label: string;
}

function Segmented<T extends string>({
    value,
    options,
    onChange,
    label,
}: SegmentedProps<T>) {
    return (
        <div
            role="radiogroup"
            aria-label={label}
            className="inline-flex p-0.5 rounded-lg bg-gray-100 dark:bg-gray-800"
        >
            {options.map((option) => (
                <button
                    key={option.value}
                    type="button"
                    role="radio"
                    aria-checked={value === option.value}
                    onClick={() => onChange(option.value)}
                    className={`px-3 py-1 text-sm rounded-md transition-colors ${
                        value === option.value
                            ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                            : 'text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
                    }`}
                >
                    {option.label}
                </button>
            ))}
        </div>
    );
}

// Number and text inputs keep a local draft and commit on blur or Enter, so
// typing "12" does not save "1" first.
const DraftInput: React.FC<{
    value: string;
    onCommit: (value: string) => void;
    type?: string;
    className?: string;
    placeholder?: string;
    ariaLabel: string;
    min?: number;
}> = ({
    value,
    onCommit,
    type = 'text',
    className,
    placeholder,
    ariaLabel,
    min,
}) => {
    const [draft, setDraft] = useState(value);
    useEffect(() => setDraft(value), [value]);
    const commit = () => {
        if (draft !== value) onCommit(draft);
    };
    return (
        <input
            type={type}
            value={draft}
            min={min}
            step={type === 'number' ? 'any' : undefined}
            inputMode={type === 'number' ? 'decimal' : undefined}
            placeholder={placeholder}
            aria-label={ariaLabel}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    commit();
                } else if (e.key === 'Escape') {
                    setDraft(value);
                }
            }}
            className={`${fieldClass} ${className || ''}`}
        />
    );
};

const Row: React.FC<{
    label: string;
    hint?: string;
    children: React.ReactNode;
}> = ({ label, hint, children }) => (
    <div className="flex flex-col gap-1.5">
        <span className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
            {label}
        </span>
        <div className="flex flex-wrap items-center gap-2">{children}</div>
        {hint && (
            <p className="text-xs text-gray-400 dark:text-gray-500">{hint}</p>
        )}
    </div>
);

const HabitSettings: React.FC<HabitSettingsProps> = ({
    values,
    firstDayOfWeek,
    onChange,
    saving,
}) => {
    const { t } = useTranslation();
    const quit = values.habit_polarity === 'quit';
    const measurable =
        !quit &&
        typeof values.habit_target_value === 'number' &&
        values.habit_target_value > 0;
    const period = values.habit_frequency_period || 'daily';
    const scheduleDays = values.habit_schedule_days;
    const weekOrder = Array.from(
        { length: 7 },
        (_, i) => (firstDayOfWeek + i) % 7
    );

    const toggleDay = (day: number) => {
        const current =
            scheduleDays && scheduleDays.length
                ? scheduleDays
                : [0, 1, 2, 3, 4, 5, 6];
        const next = current.includes(day)
            ? current.filter((d) => d !== day)
            : [...current, day];
        if (next.length === 0) return;
        onChange({
            habit_schedule_days: next.length === 7 ? null : next.sort(),
        });
    };

    return (
        <div className="space-y-5">
            <Row
                label={t('habits.settings.type', 'Type')}
                hint={
                    quit
                        ? t(
                              'habits.settings.quitHint',
                              'Every clean day counts. Log a slip when it happens.'
                          )
                        : undefined
                }
            >
                <Segmented
                    label={t('habits.settings.type', 'Type')}
                    value={values.habit_polarity || 'build'}
                    options={[
                        { value: 'build', label: t('habits.build', 'Build') },
                        { value: 'quit', label: t('habits.quit', 'Quit') },
                    ]}
                    onChange={(value) =>
                        onChange({
                            habit_polarity: value,
                            ...(value === 'quit'
                                ? {
                                      habit_target_value: null,
                                      habit_target_count: 1,
                                  }
                                : {}),
                        })
                    }
                />
            </Row>

            {!quit && (
                <Row label={t('habits.settings.goal', 'Goal')}>
                    <Segmented
                        label={t('habits.settings.measure', 'Measure')}
                        value={measurable ? 'amount' : 'count'}
                        options={[
                            {
                                value: 'count',
                                label: t('habits.count', 'Count'),
                            },
                            {
                                value: 'amount',
                                label: t('habits.amount', 'Amount'),
                            },
                        ]}
                        onChange={(value) =>
                            onChange(
                                value === 'amount'
                                    ? {
                                          habit_target_value:
                                              values.habit_target_value || 10,
                                          habit_unit:
                                              values.habit_unit || 'min',
                                      }
                                    : { habit_target_value: null }
                            )
                        }
                    />
                    {measurable ? (
                        <>
                            <DraftInput
                                type="number"
                                min={0}
                                className="w-24"
                                ariaLabel={t(
                                    'habits.settings.targetAmount',
                                    'Target amount'
                                )}
                                value={String(values.habit_target_value ?? '')}
                                onCommit={(v) => {
                                    const n = parseFloat(v);
                                    if (n > 0)
                                        onChange({ habit_target_value: n });
                                }}
                            />
                            <DraftInput
                                className="w-28"
                                ariaLabel={t('habits.settings.unit', 'Unit')}
                                placeholder={t(
                                    'habits.settings.unitPlaceholder',
                                    'pages, km…'
                                )}
                                value={values.habit_unit || ''}
                                onCommit={(v) =>
                                    onChange({ habit_unit: v.trim() || null })
                                }
                            />
                        </>
                    ) : (
                        <>
                            <DraftInput
                                type="number"
                                min={1}
                                className="w-20"
                                ariaLabel={t(
                                    'habits.settings.targetCount',
                                    'Times'
                                )}
                                value={String(values.habit_target_count || 1)}
                                onCommit={(v) => {
                                    const n = parseInt(v, 10);
                                    if (n >= 1)
                                        onChange({ habit_target_count: n });
                                }}
                            />
                            <span className="text-sm text-gray-500 dark:text-gray-400">
                                {t('habits.times', 'times')}
                            </span>
                        </>
                    )}
                </Row>
            )}

            <Row
                label={t('habits.settings.frequency', 'Frequency')}
                hint={
                    period === 'weekly' || period === 'monthly'
                        ? t(
                              'habits.settings.periodHint',
                              'Any days in the period count, one check-in per day.'
                          )
                        : undefined
                }
            >
                <select
                    value={period}
                    aria-label={t('habits.settings.frequency', 'Frequency')}
                    onChange={(e) => {
                        const next = e.target.value as HabitPeriod;
                        onChange({
                            habit_frequency_period: next,
                            ...(next === 'interval' &&
                            !values.habit_interval_days
                                ? { habit_interval_days: 2 }
                                : {}),
                            ...(next !== 'daily'
                                ? { habit_schedule_days: null }
                                : {}),
                        });
                    }}
                    className={FORM.select}
                >
                    <option value="daily">
                        {t('habits.freq.daily', 'Every day')}
                    </option>
                    <option value="weekly">
                        {t('habits.freq.weekly', 'Per week')}
                    </option>
                    <option value="monthly">
                        {t('habits.freq.monthly', 'Per month')}
                    </option>
                    <option value="interval">
                        {t('habits.freq.interval', 'Every few days')}
                    </option>
                </select>
                {period === 'interval' && (
                    <>
                        <span className="text-sm text-gray-500 dark:text-gray-400">
                            {t('habits.every', 'every')}
                        </span>
                        <DraftInput
                            type="number"
                            min={2}
                            className="w-20"
                            ariaLabel={t(
                                'habits.settings.intervalDays',
                                'Days'
                            )}
                            value={String(values.habit_interval_days || 2)}
                            onCommit={(v) => {
                                const n = parseInt(v, 10);
                                if (n >= 2)
                                    onChange({ habit_interval_days: n });
                            }}
                        />
                        <span className="text-sm text-gray-500 dark:text-gray-400">
                            {t('habits.unit.days', 'days')}
                        </span>
                    </>
                )}
            </Row>

            {period === 'daily' && (
                <Row
                    label={t('habits.settings.days', 'On these days')}
                    hint={t(
                        'habits.settings.daysHint',
                        'Days off never break the streak.'
                    )}
                >
                    <div className="grid grid-cols-7 gap-1 w-full">
                        {weekOrder.map((day) => {
                            const on =
                                !scheduleDays || scheduleDays.includes(day);
                            return (
                                <button
                                    key={day}
                                    type="button"
                                    aria-pressed={on}
                                    onClick={() => toggleDay(day)}
                                    className={`min-w-0 py-1 text-xs rounded-md truncate transition-colors ${
                                        on
                                            ? ACCENT.solid
                                            : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                                    }`}
                                >
                                    {weekdayLabel(day)}
                                </button>
                            );
                        })}
                    </div>
                </Row>
            )}

            <Row label={t('habits.settings.color', 'Color')}>
                <ColorPicker
                    value={values.habit_color}
                    noneLabel={t('habits.settings.defaultColor', 'Default')}
                    onChange={(color) =>
                        onChange({ habit_color: color || null })
                    }
                />
            </Row>

            <Row label={t('habits.settings.timeOfDay', 'Time of day')}>
                <select
                    value={values.habit_time_of_day || ''}
                    aria-label={t('habits.settings.timeOfDay', 'Time of day')}
                    onChange={(e) =>
                        onChange({
                            habit_time_of_day:
                                (e.target.value as Task['habit_time_of_day']) ||
                                null,
                        })
                    }
                    className={FORM.select}
                >
                    <option value="">
                        {t('habits.timeOfDay.anytime', 'Anytime')}
                    </option>
                    <option value="morning">
                        {t('habits.timeOfDay.morning', 'Morning')}
                    </option>
                    <option value="afternoon">
                        {t('habits.timeOfDay.afternoon', 'Afternoon')}
                    </option>
                    <option value="evening">
                        {t('habits.timeOfDay.evening', 'Evening')}
                    </option>
                </select>
            </Row>

            <Row
                label={t('habits.settings.reminder', 'Reminder')}
                hint={t(
                    'habits.settings.reminderHint',
                    'Sent while the habit is still open. Channels are set in Profile > Notifications.'
                )}
            >
                <DraftInput
                    type="time"
                    className="w-32"
                    ariaLabel={t('habits.settings.reminder', 'Reminder')}
                    value={values.habit_reminder_time || ''}
                    onCommit={(v) =>
                        onChange({ habit_reminder_time: v || null })
                    }
                />
                {values.habit_reminder_time && (
                    <button
                        type="button"
                        onClick={() => onChange({ habit_reminder_time: null })}
                        className="text-xs text-gray-500 hover:text-gray-800 dark:hover:text-gray-200"
                    >
                        {t('habits.settings.noReminder', 'Turn off')}
                    </button>
                )}
            </Row>

            {saving && (
                <p className="text-xs text-gray-400" aria-live="polite">
                    {t('common.saving', 'Saving...')}
                </p>
            )}
        </div>
    );
};

export default HabitSettings;
