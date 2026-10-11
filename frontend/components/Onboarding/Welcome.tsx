// LTD-PATCH(T-301): Apply Life-to-Day identity and quiet shared presentation; preserve behavior.
// LTD-PATCH(T-506): the existing /welcome page becomes the three skippable first-run steps (blueprint 21.5).
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { applyStarter, StarterResult } from '../../utils/onboardingService';
import { updateProfile, updateUiSettings } from '../../utils/profileService';
import { setLocalePreferences } from '../../utils/jalali';
import { fetchAreas, createArea } from '../../utils/areasService';
import { createGoal } from '../../utils/goalsService';
import { createTask } from '../../utils/tasksService';
import {
    saveDailyPlanItems,
    startDailyPlan,
} from '../../utils/dailyPlanService';
import { saveWorkHours } from '../../utils/todayService';
import { Area } from '../../entities/Area';
import { Task } from '../../entities/Task';

// The page at /welcome every account sees once: 1) language, calendar and
// digits, 2) one goal for this season (Vision optional), 3) work hours and
// one task for today, then the Now card. Every step can be skipped, and
// "Skip setup" records the visit straight away. PWA install and
// notification permission are offered later, never here.

interface WelcomeProps {
    onDone: (result: StarterResult) => void;
}

const SUGGESTED_AREAS = [
    { key: 'health', fallback: 'Health' },
    { key: 'work', fallback: 'Work' },
    { key: 'relationships', fallback: 'Relationships' },
] as const;

const toMinute = (value: string): number | null => {
    const match = /^(\d{2}):(\d{2})$/.exec(value);
    return match ? Number(match[1]) * 60 + Number(match[2]) : null;
};

const inputClass =
    'min-h-[44px] w-full rounded-lg border border-gray-300 bg-white px-3 text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100';
const secondaryButton =
    'min-h-[44px] rounded-lg px-4 text-sm font-medium bg-gray-100 text-gray-800 hover:bg-gray-200 disabled:opacity-50 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700';
const primaryButton =
    'min-h-[44px] rounded-lg px-5 text-sm font-medium ltd-primary disabled:opacity-50';

const Welcome: React.FC<WelcomeProps> = ({ onDone }) => {
    const { t, i18n } = useTranslation();
    const [step, setStep] = useState(1);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [language, setLanguage] = useState<'fa' | 'en'>('fa');
    const [calendar, setCalendar] = useState<'persian' | 'gregorian'>(
        'persian'
    );
    const [latinDigits, setLatinDigits] = useState(false);

    const [areas, setAreas] = useState<Area[] | null>(null);
    const [areaChoice, setAreaChoice] = useState('');
    const [goalTitle, setGoalTitle] = useState('');
    const [vision, setVision] = useState('');

    const [workStart, setWorkStart] = useState('09:00');
    const [workEnd, setWorkEnd] = useState('17:00');
    const [taskName, setTaskName] = useState('');

    useEffect(() => {
        fetchAreas()
            .then(setAreas)
            .catch(() => setAreas([]));
    }, []);

    const run = async (action: () => Promise<void>) => {
        if (busy) return;
        setBusy(true);
        setError(null);
        try {
            await action();
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
        } finally {
            setBusy(false);
        }
    };

    const finish = async () => onDone(await applyStarter({ key: 'empty' }));

    const saveLanguage = () =>
        run(async () => {
            const locale = { calendarSystem: calendar, latinDigits };
            setLocalePreferences(locale);
            await updateUiSettings({ locale });
            await updateProfile({ language });
            if (!i18n.language?.startsWith(language)) {
                await i18n.changeLanguage(language);
                document.documentElement.lang = language;
                window.forceLanguageReload?.(language);
            }
            setStep(2);
        });

    const saveGoal = () =>
        run(async () => {
            const title = goalTitle.trim();
            if (title) {
                let areaId: number | undefined;
                if (areaChoice.startsWith('new:')) {
                    areaId = (await createArea({ name: areaChoice.slice(4) }))
                        .id;
                } else if (areaChoice) {
                    areaId = Number(areaChoice);
                }
                const visionGoal = vision.trim()
                    ? (
                          await createGoal({
                              title: vision.trim(),
                              horizon: 'vision',
                          } as Parameters<typeof createGoal>[0])
                      ).goal
                    : null;
                await createGoal({
                    title,
                    horizon: 'season',
                    ...(areaId ? { area_id: areaId } : {}),
                    ...(visionGoal ? { parent_goal_uid: visionGoal.uid } : {}),
                } as Parameters<typeof createGoal>[0]);
            }
            setStep(3);
        });

    const saveDay = () =>
        run(async () => {
            const start = toMinute(workStart);
            const end = toMinute(workEnd);
            if (start !== null && end !== null && start < end) {
                await saveWorkHours({
                    start: start - (start % 15),
                    end: end - (end % 15),
                });
            }
            const name = taskName.trim();
            if (name) {
                const task = await createTask({ name } as Task);
                if (task.uid) {
                    await saveDailyPlanItems('today', [
                        {
                            task_uid: task.uid,
                            start_minute: null,
                            duration_minutes: 30,
                        },
                    ]);
                    await startDailyPlan('today');
                }
            }
            await finish();
        });

    const skipAll = () => run(finish);

    const areaOptions =
        areas && areas.length > 0
            ? areas.map((area) => ({
                  value: String(area.id),
                  label: area.name,
              }))
            : SUGGESTED_AREAS.map((area) => {
                  const label = t(
                      `onboarding.steps.areas.${area.key}`,
                      area.fallback
                  );
                  return { value: `new:${label}`, label };
              });

    return (
        <div
            className="flex w-full min-h-[calc(100vh-7rem)] items-center justify-center px-4 py-8 sm:px-6 lg:px-8"
            data-testid="welcome-page"
        >
            <section
                className="flex w-full max-w-xl flex-col gap-5"
                aria-labelledby="welcome-title"
            >
                <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium text-secondary">
                        {t('onboarding.steps.progress', 'Step {{step}} of 3', {
                            step,
                        })}
                    </p>
                    <button
                        type="button"
                        onClick={skipAll}
                        disabled={busy}
                        data-testid="welcome-start"
                        className="min-h-[44px] rounded-lg px-3 text-sm font-medium text-gray-600 hover:bg-gray-100 disabled:opacity-50 dark:text-gray-400 dark:hover:bg-gray-800"
                    >
                        {t('onboarding.steps.skipSetup', 'Skip setup')}
                    </button>
                </div>

                {step === 1 && (
                    <form
                        className="flex flex-col gap-4"
                        data-testid="welcome-step-1"
                        onSubmit={(e) => {
                            e.preventDefault();
                            saveLanguage();
                        }}
                    >
                        <h1
                            id="welcome-title"
                            className="text-2xl font-light text-gray-900 dark:text-gray-100"
                        >
                            {t(
                                'onboarding.steps.languageTitle',
                                'Language, calendar and digits'
                            )}
                        </h1>
                        <label className="flex flex-col gap-1 text-sm text-gray-700 dark:text-gray-300">
                            {t('onboarding.steps.language', 'Language')}
                            <select
                                className={inputClass}
                                value={language}
                                onChange={(e) =>
                                    setLanguage(e.target.value as 'fa' | 'en')
                                }
                                data-testid="welcome-language"
                            >
                                <option value="fa">فارسی</option>
                                <option value="en">English</option>
                            </select>
                        </label>
                        <label className="flex flex-col gap-1 text-sm text-gray-700 dark:text-gray-300">
                            {t('onboarding.steps.calendar', 'Calendar')}
                            <select
                                className={inputClass}
                                value={calendar}
                                onChange={(e) =>
                                    setCalendar(
                                        e.target.value as
                                            'persian' | 'gregorian'
                                    )
                                }
                                data-testid="welcome-calendar"
                            >
                                <option value="persian">
                                    {t(
                                        'profile.calendarPersian',
                                        'Persian (Jalali)'
                                    )}
                                </option>
                                <option value="gregorian">
                                    {t(
                                        'profile.calendarGregorian',
                                        'Gregorian'
                                    )}
                                </option>
                            </select>
                        </label>
                        <label className="flex min-h-[44px] items-center gap-3 text-sm text-gray-700 dark:text-gray-300">
                            <input
                                type="checkbox"
                                className="h-5 w-5"
                                checked={!latinDigits}
                                onChange={(e) =>
                                    setLatinDigits(!e.target.checked)
                                }
                                data-testid="welcome-persian-digits"
                            />
                            {t(
                                'onboarding.steps.persianDigits',
                                'Persian digits (۱۲۳)'
                            )}
                        </label>
                        <StepActions
                            busy={busy}
                            onSkip={() => setStep(2)}
                            nextLabel={t('onboarding.steps.next', 'Next')}
                            skipLabel={t('onboarding.steps.skip', 'Skip')}
                            testId="welcome-next-1"
                        />
                    </form>
                )}

                {step === 2 && (
                    <form
                        className="flex flex-col gap-4"
                        data-testid="welcome-step-2"
                        onSubmit={(e) => {
                            e.preventDefault();
                            saveGoal();
                        }}
                    >
                        <h1
                            id="welcome-title"
                            className="text-2xl font-light text-gray-900 dark:text-gray-100"
                        >
                            {t(
                                'onboarding.steps.goalTitle',
                                'One goal for this season'
                            )}
                        </h1>
                        <label className="flex flex-col gap-1 text-sm text-gray-700 dark:text-gray-300">
                            {t('onboarding.steps.goal', 'Season goal')}
                            <input
                                className={inputClass}
                                value={goalTitle}
                                onChange={(e) => setGoalTitle(e.target.value)}
                                maxLength={255}
                                data-testid="welcome-goal"
                            />
                        </label>
                        <fieldset className="flex flex-col gap-2">
                            <legend className="mb-1 text-sm text-gray-700 dark:text-gray-300">
                                {areas && areas.length === 0
                                    ? t(
                                          'onboarding.steps.suggestedAreas',
                                          'Which part of life is it for? (optional)'
                                      )
                                    : t(
                                          'onboarding.steps.area',
                                          'Area (optional)'
                                      )}
                            </legend>
                            <div className="flex flex-wrap gap-2">
                                {areaOptions.map((option) => (
                                    <button
                                        key={option.value}
                                        type="button"
                                        aria-pressed={
                                            areaChoice === option.value
                                        }
                                        onClick={() =>
                                            setAreaChoice(
                                                areaChoice === option.value
                                                    ? ''
                                                    : option.value
                                            )
                                        }
                                        className={`min-h-[44px] rounded-lg border px-3 text-sm ${
                                            areaChoice === option.value
                                                ? 'border-secondary bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-gray-100'
                                                : 'border-gray-300 text-gray-700 dark:border-gray-600 dark:text-gray-300'
                                        }`}
                                        data-testid="welcome-area-option"
                                    >
                                        <bdi>{option.label}</bdi>
                                    </button>
                                ))}
                            </div>
                        </fieldset>
                        <label className="flex flex-col gap-1 text-sm text-gray-700 dark:text-gray-300">
                            {t(
                                'onboarding.steps.vision',
                                'Vision, the bigger picture (optional)'
                            )}
                            <input
                                className={inputClass}
                                value={vision}
                                onChange={(e) => setVision(e.target.value)}
                                maxLength={255}
                                data-testid="welcome-vision"
                            />
                        </label>
                        <StepActions
                            busy={busy}
                            onSkip={() => setStep(3)}
                            nextLabel={t('onboarding.steps.next', 'Next')}
                            skipLabel={t('onboarding.steps.skip', 'Skip')}
                            testId="welcome-next-2"
                        />
                    </form>
                )}

                {step === 3 && (
                    <form
                        className="flex flex-col gap-4"
                        data-testid="welcome-step-3"
                        onSubmit={(e) => {
                            e.preventDefault();
                            saveDay();
                        }}
                    >
                        <h1
                            id="welcome-title"
                            className="text-2xl font-light text-gray-900 dark:text-gray-100"
                        >
                            {t('onboarding.steps.dayTitle', 'Your first day')}
                        </h1>
                        <div className="grid grid-cols-2 gap-3">
                            <label className="flex flex-col gap-1 text-sm text-gray-700 dark:text-gray-300">
                                {t('onboarding.steps.workStart', 'Work starts')}
                                <input
                                    type="time"
                                    step={900}
                                    className={inputClass}
                                    value={workStart}
                                    onChange={(e) =>
                                        setWorkStart(e.target.value)
                                    }
                                    data-testid="welcome-work-start"
                                />
                            </label>
                            <label className="flex flex-col gap-1 text-sm text-gray-700 dark:text-gray-300">
                                {t('onboarding.steps.workEnd', 'Work ends')}
                                <input
                                    type="time"
                                    step={900}
                                    className={inputClass}
                                    value={workEnd}
                                    onChange={(e) => setWorkEnd(e.target.value)}
                                    data-testid="welcome-work-end"
                                />
                            </label>
                        </div>
                        <label className="flex flex-col gap-1 text-sm text-gray-700 dark:text-gray-300">
                            {t(
                                'onboarding.steps.task',
                                'One thing to do today'
                            )}
                            <input
                                className={inputClass}
                                value={taskName}
                                onChange={(e) => setTaskName(e.target.value)}
                                maxLength={255}
                                data-testid="welcome-task"
                            />
                        </label>
                        <StepActions
                            busy={busy}
                            onSkip={skipAll}
                            nextLabel={t(
                                'onboarding.steps.finish',
                                'Show me Now'
                            )}
                            skipLabel={t('onboarding.steps.skip', 'Skip')}
                            testId="welcome-finish"
                        />
                    </form>
                )}

                {error && (
                    <p
                        className="w-full rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-300"
                        role="alert"
                    >
                        {error}
                    </p>
                )}
            </section>
        </div>
    );
};

const StepActions: React.FC<{
    busy: boolean;
    onSkip: () => void;
    nextLabel: string;
    skipLabel: string;
    testId: string;
}> = ({ busy, onSkip, nextLabel, skipLabel, testId }) => (
    <div className="flex flex-wrap justify-end gap-2">
        <button
            type="button"
            onClick={onSkip}
            disabled={busy}
            className={secondaryButton}
        >
            {skipLabel}
        </button>
        <button
            type="submit"
            disabled={busy}
            className={primaryButton}
            data-testid={testId}
        >
            {nextLabel}
        </button>
    </div>
);

export default Welcome;
