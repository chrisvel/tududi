import React, { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CheckIcon } from '@heroicons/react/24/outline';
import {
    buildStarters,
    buildStarterPayload,
    starterCounts,
    Starter,
    StarterKey,
} from '../../utils/starters';
import { applyStarter, StarterResult } from '../../utils/onboardingService';

// The page at /welcome every account sees once, inside the normal layout:
// pick the shape of your week and get areas, goals, projects, habits and a
// few example tasks in one tap. The welcome video plays beside it. "Start
// empty" records the choice and leaves the account as it is.

export const WELCOME_VIDEO_ID = 'hkwb9EmE4XE';

interface StarterPickerProps {
    onDone: (result: StarterResult, key: StarterKey) => void;
}

const dot = (color: string) => (
    <span
        aria-hidden="true"
        className="inline-block h-2.5 w-2.5 flex-shrink-0 rounded-full"
        style={{ backgroundColor: color }}
    />
);

const StarterPicker: React.FC<StarterPickerProps> = ({ onDone }) => {
    const { t } = useTranslation();
    const starters = useMemo(() => buildStarters(t), [t]);
    const [selectedKey, setSelectedKey] = useState<StarterKey>(starters[0].key);
    const [busy, setBusy] = useState<StarterKey | 'empty' | null>(null);
    const [error, setError] = useState<string | null>(null);
    const cardRefs = useRef<(HTMLDivElement | null)[]>([]);

    const selected =
        starters.find((starter) => starter.key === selectedKey) ?? starters[0];
    const counts = starterCounts(selected);

    const submit = async (starter: Starter | null) => {
        if (busy) return;
        const key: StarterKey = starter ? starter.key : 'empty';
        setBusy(key);
        setError(null);
        try {
            const result = await applyStarter(
                starter ? buildStarterPayload(starter) : { key: 'empty' }
            );
            onDone(result, key);
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
            setBusy(null);
        }
    };

    const moveSelection = (index: number, delta: number) => {
        const next = (index + delta + starters.length) % starters.length;
        setSelectedKey(starters[next].key);
        cardRefs.current[next]?.focus();
    };

    const todayTasks = selected.areas.flatMap((area) =>
        [...area.tasks, ...area.projects.flatMap((p) => p.tasks)].filter(
            (task) => task.due === 'today'
        )
    );

    return (
        <div
            className="w-full px-4 sm:px-6 lg:px-8 pt-4 pb-10"
            aria-labelledby="starter-picker-title"
            data-testid="starter-picker"
        >
            <div className="mx-auto w-full max-w-7xl">
                <div className="grid gap-6 lg:grid-cols-3 lg:gap-x-8">
                    <header className="lg:col-span-3">
                        <p className="mb-1 text-sm font-medium text-blue-600 dark:text-blue-400">
                            {t(
                                'onboarding.starter.kicker',
                                'Welcome to tududi'
                            )}
                        </p>
                        <h1
                            id="starter-picker-title"
                            className="text-2xl font-light text-gray-900 sm:text-3xl dark:text-gray-100"
                        >
                            {t(
                                'onboarding.starter.title',
                                'Which one looks most like your week?'
                            )}
                        </h1>
                        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                            {t(
                                'onboarding.starter.subtitle',
                                'We set up the shelves. You decide what goes on them. Rename or delete anything.'
                            )}
                        </p>
                    </header>

                    <div className="flex flex-col gap-6 lg:col-span-2">
                        <div className="overflow-hidden rounded-2xl bg-gray-900 shadow-sm aspect-video">
                            <iframe
                                className="h-full w-full"
                                src={`https://www.youtube-nocookie.com/embed/${WELCOME_VIDEO_ID}?rel=0&modestbranding=1`}
                                title={t(
                                    'onboarding.starter.videoTitle',
                                    'A one minute tour of tududi'
                                )}
                                loading="lazy"
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                                allowFullScreen
                                data-testid="starter-video"
                            />
                        </div>
                        <p className="mt-2 text-xs text-gray-400 dark:text-gray-500">
                            {t(
                                'onboarding.starter.videoCaption',
                                'One minute, no sound needed.'
                            )}
                        </p>
                        <aside
                            className="hidden rounded-2xl bg-white p-5 lg:block dark:bg-gray-800"
                            data-testid="starter-preview"
                        >
                            <div className="flex items-baseline justify-between gap-3">
                                <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                                    {t(
                                        'onboarding.starter.previewTitle',
                                        "What you'll get"
                                    )}
                                </h2>
                                {selected.areas.length > 0 && (
                                    <span className="text-xs text-gray-400 dark:text-gray-500">
                                        {t(
                                            'onboarding.starter.previewCounts',
                                            '{{areas}} areas · {{projects}} projects · {{habits}} habits',
                                            counts
                                        )}
                                    </span>
                                )}
                            </div>
                            {selected.areas.length === 0 ? (
                                <p className="mt-3 text-sm text-gray-600 dark:text-gray-300">
                                    {t(
                                        'onboarding.starter.previewEmpty',
                                        'No shelves yet. Today opens with the Brain dump so the first list is yours.'
                                    )}
                                </p>
                            ) : (
                                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                                    {selected.areas.map((area) => (
                                        <div
                                            key={area.name}
                                            className="rounded-lg bg-gray-50 px-3 py-2.5 dark:bg-gray-900/60"
                                            style={{
                                                boxShadow: `inset 0 3px 0 ${area.color}`,
                                            }}
                                        >
                                            <p className="flex items-center gap-2 text-sm font-medium text-gray-900 dark:text-gray-100">
                                                {dot(area.color)}
                                                {area.name}
                                            </p>
                                            {area.goal && (
                                                <p className="mt-0.5 text-xs italic text-gray-500 dark:text-gray-400">
                                                    {area.goal.title}
                                                </p>
                                            )}
                                            {area.projects.map((project) => (
                                                <p
                                                    key={project.name}
                                                    className="mt-1 text-xs text-gray-700 dark:text-gray-300"
                                                >
                                                    ▸ {project.name}
                                                </p>
                                            ))}
                                        </div>
                                    ))}
                                </div>
                            )}
                            <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-xs">
                                <dt className="text-gray-400 dark:text-gray-500">
                                    {t(
                                        'onboarding.starter.previewHabits',
                                        'Habits'
                                    )}
                                </dt>
                                <dd className="text-gray-700 dark:text-gray-300">
                                    {selected.habits
                                        .map((h) => h.name)
                                        .join(' · ')}
                                </dd>
                                {todayTasks.length > 0 && (
                                    <>
                                        <dt className="text-gray-400 dark:text-gray-500">
                                            {t(
                                                'onboarding.starter.previewToday',
                                                'Today'
                                            )}
                                        </dt>
                                        <dd className="text-gray-700 dark:text-gray-300">
                                            {todayTasks
                                                .map((task) => task.name)
                                                .join(' · ')}
                                        </dd>
                                    </>
                                )}
                                {selected.note && (
                                    <>
                                        <dt className="text-gray-400 dark:text-gray-500">
                                            {t(
                                                'onboarding.starter.previewNote',
                                                'Note'
                                            )}
                                        </dt>
                                        <dd className="text-gray-700 dark:text-gray-300">
                                            {selected.note.title}
                                        </dd>
                                    </>
                                )}
                            </dl>
                            {selected.areas.length > 0 && (
                                <p className="mt-4 text-xs text-gray-400 dark:text-gray-500">
                                    {t(
                                        'onboarding.starter.previewExamples',
                                        'Example tasks are marked. One click on Today clears the ones you have not touched.'
                                    )}
                                </p>
                            )}
                        </aside>
                    </div>

                    <div className="flex flex-col gap-4">
                        <div
                            role="radiogroup"
                            aria-label={t(
                                'onboarding.starter.groupLabel',
                                'Starters'
                            )}
                            className="flex flex-col gap-2"
                            data-testid="starter-cards"
                        >
                            {starters.map((starter, index) => {
                                const isSelected = starter.key === selected.key;
                                const inline = starterCounts(starter);
                                return (
                                    <div
                                        key={starter.key}
                                        ref={(el) => {
                                            cardRefs.current[index] = el;
                                        }}
                                        role="radio"
                                        aria-checked={isSelected}
                                        tabIndex={isSelected ? 0 : -1}
                                        onClick={() =>
                                            setSelectedKey(starter.key)
                                        }
                                        onKeyDown={(event) => {
                                            if (
                                                event.key === 'ArrowDown' ||
                                                event.key === 'ArrowRight'
                                            ) {
                                                event.preventDefault();
                                                moveSelection(index, 1);
                                            } else if (
                                                event.key === 'ArrowUp' ||
                                                event.key === 'ArrowLeft'
                                            ) {
                                                event.preventDefault();
                                                moveSelection(index, -1);
                                            } else if (event.key === 'Enter') {
                                                event.preventDefault();
                                                submit(starter);
                                            }
                                        }}
                                        data-testid={`starter-card-${starter.key}`}
                                        className={`cursor-pointer rounded-xl px-4 py-3 outline-none transition focus-visible:ring-2 focus-visible:ring-blue-400 ${
                                            isSelected
                                                ? 'bg-blue-50 dark:bg-blue-900/30'
                                                : 'bg-white hover:bg-gray-100 dark:bg-gray-800 dark:hover:bg-gray-700/70'
                                        }`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="min-w-0 flex-1">
                                                <p className="font-medium text-gray-900 dark:text-gray-100">
                                                    {starter.name}
                                                </p>
                                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                                    {starter.who}
                                                </p>
                                            </div>
                                            <span
                                                className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full ${
                                                    isSelected
                                                        ? 'bg-blue-600 text-white dark:bg-blue-500'
                                                        : 'bg-gray-200 dark:bg-gray-700'
                                                }`}
                                            >
                                                {isSelected && (
                                                    <CheckIcon className="h-3 w-3" />
                                                )}
                                            </span>
                                        </div>
                                        {isSelected &&
                                            starter.areas.length > 0 && (
                                                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-600 lg:hidden dark:text-gray-300">
                                                    {starter.areas.map(
                                                        (area) => (
                                                            <span
                                                                key={area.name}
                                                                className="inline-flex items-center gap-1.5"
                                                            >
                                                                {dot(
                                                                    area.color
                                                                )}
                                                                {area.name}
                                                            </span>
                                                        )
                                                    )}
                                                    <span className="text-gray-400 dark:text-gray-500">
                                                        {t(
                                                            'onboarding.starter.counts',
                                                            '{{projects}} projects · {{habits}} habits · {{tasks}} example tasks',
                                                            inline
                                                        )}
                                                    </span>
                                                </div>
                                            )}
                                    </div>
                                );
                            })}
                        </div>

                        <div>
                            {error && (
                                <p
                                    className="mb-3 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-300"
                                    role="alert"
                                >
                                    {error}
                                </p>
                            )}
                            <div className="flex flex-col gap-2">
                                <button
                                    type="button"
                                    onClick={() => submit(selected)}
                                    disabled={busy !== null}
                                    data-testid="starter-submit"
                                    className="h-11 w-full rounded-lg bg-blue-600 px-6 font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-blue-500 dark:hover:bg-blue-600"
                                >
                                    {busy && busy !== 'empty'
                                        ? t(
                                              'onboarding.starter.settingUp',
                                              'Setting up...'
                                          )
                                        : t(
                                              'onboarding.starter.setUp',
                                              'Set up {{name}}',
                                              { name: selected.name }
                                          )}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => submit(null)}
                                    disabled={busy !== null}
                                    data-testid="starter-empty"
                                    className="h-11 w-full rounded-lg px-4 text-sm text-gray-500 hover:bg-gray-100 hover:text-gray-700 disabled:opacity-50 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200"
                                >
                                    {busy === 'empty'
                                        ? t(
                                              'onboarding.starter.settingUp',
                                              'Setting up...'
                                          )
                                        : t(
                                              'onboarding.starter.startEmpty',
                                              'Start empty'
                                          )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default StarterPicker;
