import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    UntangleArea,
    UntangleItem,
    UntangleResult as Result,
} from '../../utils/untangleService';
import StructureGraph from './StructureGraph';

// The organized plan, in sections: what matters now, the shape of it, the
// areas with everything inside them, the people and habits and tags it
// found, and the dates. Wide on a desktop, one column on a phone.

interface UntangleResultProps {
    result: Result;
    picked: Record<string, string>;
    onPick: (question: string, option: string) => void;
    onAnswerAll: () => void;
    allAnswered: boolean;
}

const EYEBROW =
    'text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-500 dark:text-gray-400';
const CARD = 'rounded-2xl bg-white p-5 shadow-sm dark:bg-gray-800';

// A small speech bubble for the "why" next to a decision: playful, still
// quiet. `tone` picks the fill; the tail sits top-left.
const Bubble: React.FC<{
    children: React.ReactNode;
    tone?: 'light' | 'paper' | 'amber';
    className?: string;
}> = ({ children, tone = 'light', className = '' }) => {
    const fill =
        tone === 'light'
            ? 'bg-white/15 text-white before:bg-white/15'
            : tone === 'amber'
              ? 'bg-amber-100 text-amber-900 before:bg-amber-100 dark:bg-amber-900/40 dark:text-amber-100 dark:before:bg-amber-900/40'
              : 'bg-paper-deep text-gray-700 before:bg-paper-deep dark:bg-gray-700 dark:text-gray-200 dark:before:bg-gray-700';
    return (
        <span
            className={`relative inline-block rounded-2xl rounded-tl-sm px-3 py-2 text-sm leading-snug before:absolute before:-left-1 before:top-2 before:h-3 before:w-3 before:rotate-45 before:rounded-sm ${fill} ${className}`}
        >
            <span className="relative">{children}</span>
        </span>
    );
};

const kindTint: Record<UntangleItem['kind'], string> = {
    task: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
    waiting: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300',
    habit: 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300',
    someday: 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400',
};

// "30m", "1h", "1.5h": whole hours when they are whole, halves otherwise
export function loadLabel(minutes: number): string {
    if (minutes <= 0) return '';
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.round((minutes / 60) * 2) / 2;
    return `${hours}h`;
}

function dueLabel(due: string | null): string {
    if (!due) return '';
    const date = new Date(`${due}T00:00:00`);
    return date.toLocaleDateString(undefined, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
    });
}

const Section: React.FC<{
    eyebrow: string;
    title: string;
    children: React.ReactNode;
    testId?: string;
}> = ({ eyebrow, title, children, testId }) => (
    <section className="flex flex-col gap-4" data-testid={testId}>
        <div>
            <p className={EYEBROW}>{eyebrow}</p>
            <h2 className="mt-1 font-display text-2xl font-medium leading-tight tracking-tight sm:text-3xl">
                {title}
            </h2>
        </div>
        {children}
    </section>
);

const Tag: React.FC<{ name: string; count?: number }> = ({ name, count }) => (
    <span className="inline-flex items-center gap-1 rounded-full bg-paper-deep px-2.5 py-1 text-xs text-gray-700 dark:bg-gray-700 dark:text-gray-200">
        #{name}
        {count !== undefined && count > 1 && (
            <span className="tabular-nums text-gray-400 dark:text-gray-500">
                {count}
            </span>
        )}
    </span>
);

const AreaCard: React.FC<{ area: UntangleArea }> = ({ area }) => {
    const { t } = useTranslation();
    const kindLabel = (item: UntangleItem) => {
        switch (item.kind) {
            case 'waiting':
                return item.person
                    ? t('untangle.kind.waitingFor', 'waiting for {{name}}', {
                          name: item.person,
                      })
                    : t('untangle.kind.waiting', 'waiting');
            case 'habit':
                return t('untangle.kind.habit', 'habit, {{n}}x {{period}}', {
                    n: item.habit_times || 1,
                    period: item.habit_period || 'weekly',
                });
            case 'someday':
                return t('untangle.kind.someday', 'someday');
            default:
                return null;
        }
    };

    const extras = (entry: {
        tags: string[];
        person: string | null;
        due: string | null;
    }) => (
        <span className="flex shrink-0 items-center gap-1.5">
            {entry.tags.map((tag) => (
                <Tag key={tag} name={tag} />
            ))}
            {entry.due && (
                <span className="text-xs tabular-nums text-gray-500 dark:text-gray-400">
                    {dueLabel(entry.due)}
                </span>
            )}
        </span>
    );

    return (
        <div className={CARD} data-testid="untangle-area">
            <p className={EYEBROW}>{area.name}</p>
            {area.goal && (
                <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                    <span className="font-medium text-ink dark:text-gray-100">
                        {t('untangle.goal', 'Goal')}: {area.goal.title}
                    </span>
                </p>
            )}
            {area.goal && area.goal.why && (
                <div className="mt-2">
                    <Bubble tone="paper">{area.goal.why}</Bubble>
                </div>
            )}
            <ul className="mt-3 flex flex-col gap-2">
                {area.projects.map((project) => (
                    <li
                        key={project.name}
                        className="rounded-xl bg-paper p-3 dark:bg-gray-900/60"
                    >
                        <div className="flex items-center justify-between gap-2">
                            <span className="font-medium">{project.name}</span>
                            <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[11px] text-brand-700 dark:bg-brand-900/40 dark:text-brand-200">
                                {t('untangle.project', 'project')}
                            </span>
                        </div>
                        <ul className="mt-2 flex flex-col gap-1">
                            {project.tasks.map((task) => (
                                <li
                                    key={task.title}
                                    className="flex items-center justify-between gap-2 text-sm text-gray-700 dark:text-gray-300"
                                >
                                    <span className="min-w-0 break-words">
                                        {task.title}
                                        {task.person && (
                                            <span className="text-gray-500 dark:text-gray-400">
                                                {' '}
                                                · {task.person}
                                            </span>
                                        )}
                                    </span>
                                    {extras(task)}
                                </li>
                            ))}
                        </ul>
                    </li>
                ))}
                {area.items.map((item) => (
                    <li
                        key={`${item.kind}-${item.title}`}
                        className="flex items-center justify-between gap-2 px-1 text-sm"
                    >
                        <span className="flex min-w-0 flex-wrap items-center gap-2">
                            <span
                                className={
                                    item.kind === 'someday'
                                        ? 'text-gray-500 dark:text-gray-400'
                                        : ''
                                }
                            >
                                {item.title}
                            </span>
                            {kindLabel(item) && (
                                <span
                                    className={`rounded-full px-2 py-0.5 text-[11px] ${kindTint[item.kind]}`}
                                >
                                    {kindLabel(item)}
                                </span>
                            )}
                            {item.kind !== 'waiting' && item.person && (
                                <span className="text-xs text-gray-500 dark:text-gray-400">
                                    · {item.person}
                                </span>
                            )}
                        </span>
                        {extras(item)}
                    </li>
                ))}
            </ul>
        </div>
    );
};

const UntangleResult: React.FC<UntangleResultProps> = ({
    result,
    picked,
    onPick,
    onAnswerAll,
    allAnswered,
}) => {
    const { t } = useTranslation();
    const { questions } = result;

    const habits = result.areas.flatMap((a) =>
        a.items
            .filter((i) => i.kind === 'habit')
            .map((i) => ({ ...i, area: a.name }))
    );
    const tagCounts = new Map<string, number>();
    const dated: { title: string; due: string; area: string }[] = [];
    for (const area of result.areas) {
        const all = [
            ...area.projects.flatMap((p) => p.tasks),
            ...area.items.filter((i) => i.kind !== 'someday'),
        ];
        for (const entry of all) {
            for (const tag of entry.tags) {
                tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
            }
            if (entry.due) {
                dated.push({
                    title: entry.title,
                    due: entry.due,
                    area: area.name,
                });
            }
        }
    }
    const tags = [...tagCounts.entries()].sort((a, b) => b[1] - a[1]);
    dated.sort((a, b) => a.due.localeCompare(b.due));
    const maxMinutes = Math.max(60, ...result.week.map((d) => d.minutes));

    // The brief: what to do after the first thing, in order. Dated work
    // within the week first, then whatever other people are holding.
    const [showQuestions, setShowQuestions] = useState(false);
    const lastDay = result.week[result.week.length - 1]?.date || '';
    const first = result.today.title.toLowerCase();
    const waitingItems = result.areas.flatMap((a) =>
        a.items.filter((i) => i.kind === 'waiting')
    );
    const nextUp: { title: string; label: string }[] = [];
    for (const d of dated) {
        if (nextUp.length >= 4) break;
        if (d.title.toLowerCase() === first) continue;
        if (lastDay && d.due > lastDay) continue;
        nextUp.push({ title: d.title, label: dueLabel(d.due) });
    }
    for (const w of waitingItems) {
        if (nextUp.length >= 4) break;
        if (w.title.toLowerCase() === first) continue;
        if (nextUp.some((n) => n.title === w.title)) continue;
        nextUp.push({
            title: w.title,
            label: w.person
                ? t('untangle.kind.waitingFor', 'waiting for {{name}}', {
                      name: w.person,
                  })
                : t('untangle.kind.waiting', 'waiting'),
        });
    }
    const waitingOn = result.people.filter((p) => p.waiting > 0);
    const counts = {
        lines: result.areas.reduce(
            (n, a) =>
                n +
                a.items.length +
                a.projects.reduce((m, p) => m + p.tasks.length, 0),
            0
        ),
        areas: result.areas.length,
        projects: result.areas.reduce((n, a) => n + a.projects.length, 0),
        habits: habits.length,
        people: result.people.length,
    };

    return (
        <div className="flex flex-col gap-10" data-testid="untangle-result">
            {/* The five-second brief: what to do, in reading order */}
            <section
                className="rounded-3xl bg-brand-400 p-6 text-white shadow-sm sm:p-8"
                data-testid="untangle-brief"
            >
                {result.today.title && (
                    <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-100">
                            {t('untangle.today', 'Today')}
                        </p>
                        <p className="mt-1 font-display text-3xl font-medium leading-tight [text-wrap:balance] sm:text-4xl">
                            {result.today.title}
                        </p>
                        {result.today.reason && (
                            <div className="mt-3">
                                <Bubble>{result.today.reason}</Bubble>
                            </div>
                        )}
                    </div>
                )}

                <p className="mt-6 text-sm text-brand-100">
                    {t(
                        'untangle.brief.summary',
                        '{{lines}} things, filed into {{areas}} areas, {{projects}} projects, {{habits}} habits and {{people}} people.',
                        {
                            lines: counts.lines,
                            areas: counts.areas,
                            projects: counts.projects,
                            habits: counts.habits,
                            people: counts.people,
                        }
                    )}
                </p>

                <div className="mt-5 grid gap-6 sm:grid-cols-2">
                    <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-100">
                            {t('untangle.brief.then', 'Then, this week')}
                        </p>
                        {nextUp.length === 0 ? (
                            <p className="mt-2 text-sm text-brand-50">
                                {t(
                                    'untangle.brief.nothingDated',
                                    'Nothing else has a date. Pick what matters when you keep it.'
                                )}
                            </p>
                        ) : (
                            <ol className="mt-2 flex flex-col gap-2">
                                {nextUp.map((n, i) => (
                                    <li
                                        key={`${n.title}-${i}`}
                                        className="flex items-baseline gap-3 text-sm"
                                    >
                                        <span className="w-4 shrink-0 text-right tabular-nums text-brand-100">
                                            {i + 2}
                                        </span>
                                        <span className="min-w-0 flex-1 leading-snug">
                                            {n.title}
                                        </span>
                                        <span className="shrink-0 rounded-full bg-white/20 px-2 py-0.5 text-[11px] tabular-nums text-white">
                                            {n.label}
                                        </span>
                                    </li>
                                ))}
                            </ol>
                        )}
                    </div>
                    <div className="flex flex-col gap-4">
                        {waitingOn.length > 0 && (
                            <div>
                                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-100">
                                    {t('untangle.brief.waiting', 'Waiting on')}
                                </p>
                                <div className="mt-2 flex flex-wrap gap-1.5">
                                    {waitingOn.map((w) => (
                                        <span
                                            key={w.name}
                                            className="rounded-full bg-white/20 px-2.5 py-1 text-xs text-white"
                                        >
                                            {w.name}
                                            <span className="text-brand-100">
                                                {' '}
                                                · {w.items[0]}
                                            </span>
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}
                        {result.drop.length > 0 && (
                            <div>
                                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-100">
                                    {t('untangle.brief.wait', 'Can wait')}
                                </p>
                                <p className="mt-2 text-sm text-brand-50">
                                    {result.drop
                                        .map((d) => d.title)
                                        .join(' · ')}
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            </section>

            <Section
                eyebrow={t('untangle.sections.shapeEyebrow', 'The shape of it')}
                title={t(
                    'untangle.sections.shapeTitle',
                    'Your list as areas, goals, projects and tasks'
                )}
                testId="untangle-section-shape"
            >
                <div className={CARD}>
                    <StructureGraph areas={result.areas} />
                </div>
            </Section>

            <div className="grid gap-4 md:grid-cols-2">
                {result.drop.length > 0 && (
                    <div className="rounded-2xl bg-amber-50 p-5 dark:bg-amber-900/20">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-amber-700 dark:text-amber-300">
                            {t('untangle.drop', 'Drop for now')}
                        </p>
                        <ul className="mt-2 flex flex-col gap-1.5">
                            {result.drop.map((d) => (
                                <li
                                    key={d.title}
                                    className="flex flex-col gap-1.5 text-sm text-amber-900 dark:text-amber-100"
                                >
                                    <span className="font-medium">
                                        {d.title}
                                    </span>
                                    {d.reason && (
                                        <Bubble tone="amber" className="ml-2">
                                            {d.reason}
                                        </Bubble>
                                    )}
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
                {result.tips.length > 0 && (
                    <div className={CARD} data-testid="untangle-tips">
                        <p className={EYEBROW}>{t('untangle.tips', 'Tips')}</p>
                        <ul className="mt-2 flex flex-col gap-2">
                            {result.tips.map((tip) => (
                                <li key={tip} className="flex">
                                    <Bubble tone="paper">{tip}</Bubble>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
            </div>

            <Section
                eyebrow={t('untangle.sections.areasEyebrow', 'Areas')}
                title={t(
                    'untangle.sections.areasTitle',
                    'Everything, filed where it belongs'
                )}
                testId="untangle-section-areas"
            >
                <div className="grid gap-4 md:grid-cols-2">
                    {result.areas.map((area) => (
                        <AreaCard key={area.name} area={area} />
                    ))}
                </div>
            </Section>

            <div className="grid gap-4 md:grid-cols-3">
                <div className={CARD} data-testid="untangle-people">
                    <p className={EYEBROW}>{t('untangle.people', 'People')}</p>
                    {result.people.length === 0 ? (
                        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                            {t(
                                'untangle.noPeople',
                                'Nobody else is in this list.'
                            )}
                        </p>
                    ) : (
                        <ul className="mt-2 flex flex-col gap-2">
                            {result.people.map((person) => (
                                <li
                                    key={person.name}
                                    className="flex items-center justify-between gap-2 text-sm"
                                >
                                    <span className="flex items-center gap-2">
                                        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-50 text-xs font-semibold text-brand-700 dark:bg-brand-900/40 dark:text-brand-200">
                                            {person.name
                                                .slice(0, 1)
                                                .toUpperCase()}
                                        </span>
                                        <span className="font-medium">
                                            {person.name}
                                        </span>
                                    </span>
                                    <span className="text-xs text-gray-500 dark:text-gray-400">
                                        {person.waiting > 0
                                            ? t(
                                                  'untangle.waitingOn',
                                                  'waiting on them'
                                              )
                                            : person.items.length === 1
                                              ? t(
                                                    'untangle.personItem',
                                                    '1 item'
                                                )
                                              : t(
                                                    'untangle.personItems',
                                                    '{{count}} items',
                                                    {
                                                        count: person.items
                                                            .length,
                                                    }
                                                )}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
                <div className={CARD} data-testid="untangle-habits">
                    <p className={EYEBROW}>{t('untangle.habits', 'Habits')}</p>
                    {habits.length === 0 ? (
                        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                            {t(
                                'untangle.noHabits',
                                'Nothing repeats yet. Add one later.'
                            )}
                        </p>
                    ) : (
                        <ul className="mt-2 flex flex-col gap-2">
                            {habits.map((h) => (
                                <li
                                    key={h.title}
                                    className="flex items-center justify-between gap-2 text-sm"
                                >
                                    <span className="font-medium">
                                        {h.title}
                                    </span>
                                    <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[11px] text-violet-700 dark:bg-violet-900/40 dark:text-violet-300">
                                        {t(
                                            'untangle.habitShort',
                                            '{{n}}x {{period}}',
                                            {
                                                n: h.habit_times || 1,
                                                period:
                                                    h.habit_period || 'weekly',
                                            }
                                        )}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
                <div className={CARD} data-testid="untangle-tags">
                    <p className={EYEBROW}>{t('untangle.tags', 'Tags')}</p>
                    {tags.length === 0 ? (
                        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                            {t(
                                'untangle.noTags',
                                'No tags needed for this list.'
                            )}
                        </p>
                    ) : (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                            {tags.map(([name, count]) => (
                                <Tag key={name} name={name} count={count} />
                            ))}
                        </div>
                    )}
                </div>
            </div>

            <Section
                eyebrow={t('untangle.sections.datesEyebrow', 'Dates')}
                title={t('untangle.sections.datesTitle', 'The next seven days')}
                testId="untangle-section-dates"
            >
                <div className="grid gap-4 md:grid-cols-5">
                    <div className={`${CARD} md:col-span-3`}>
                        <p className={EYEBROW}>
                            {t('untangle.week', 'Your week')}
                        </p>
                        <div className="mt-3 grid grid-cols-7 gap-2">
                            {result.week.map((day) => (
                                <div
                                    key={day.date}
                                    className="flex flex-col items-center gap-1"
                                    title={day.titles.join(', ')}
                                >
                                    <div className="flex h-24 w-full items-end">
                                        <div
                                            className="w-full rounded-md bg-brand/85 dark:bg-brand-300/85"
                                            style={{
                                                height: `${Math.max(
                                                    4,
                                                    (day.minutes / maxMinutes) *
                                                        100
                                                )}%`,
                                            }}
                                        />
                                    </div>
                                    <span className="text-[11px] text-gray-500 dark:text-gray-400">
                                        {day.weekday}
                                    </span>
                                    <span className="text-[11px] font-medium tabular-nums text-gray-500 dark:text-gray-400">
                                        {loadLabel(day.minutes)}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className={`${CARD} md:col-span-2`}>
                        <p className={EYEBROW}>
                            {t('untangle.comingUp', 'Coming up')}
                        </p>
                        {dated.length === 0 ? (
                            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                                {t(
                                    'untangle.noDates',
                                    'Nothing has a date yet.'
                                )}
                            </p>
                        ) : (
                            <ul className="mt-2 flex flex-col gap-1.5">
                                {dated.slice(0, 8).map((d) => (
                                    <li
                                        key={`${d.due}-${d.title}`}
                                        className="flex items-baseline justify-between gap-3 text-sm"
                                    >
                                        <span className="min-w-0 break-words">
                                            {d.title}
                                        </span>
                                        <span className="shrink-0 text-xs tabular-nums text-gray-500 dark:text-gray-400">
                                            {dueLabel(d.due)}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                </div>
            </Section>

            {questions.length > 0 && !showQuestions && (
                <div className="flex justify-center">
                    <button
                        type="button"
                        onClick={() => setShowQuestions(true)}
                        className="rounded-xl bg-white px-5 py-3 text-sm font-semibold text-ink shadow-sm hover:bg-brand-50 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700"
                        data-testid="untangle-refine"
                    >
                        {t('untangle.refine', 'Refine with more questions')}
                    </button>
                </div>
            )}

            {questions.length > 0 && showQuestions && (
                <div className={CARD} data-testid="untangle-questions">
                    <p className={EYEBROW}>
                        {questions.length === 1
                            ? t('untangle.oneQuestion', 'One question')
                            : t('untangle.fewQuestions', 'A few questions')}
                    </p>
                    <div className="mt-2 grid gap-4 md:grid-cols-2">
                        {questions.map((q) => (
                            <div key={q.text}>
                                <p className="font-display text-lg font-medium leading-snug">
                                    {q.text}
                                </p>
                                <div className="mt-2 flex flex-wrap gap-2">
                                    {q.options.map((o) => {
                                        const on = picked[q.text] === o;
                                        return (
                                            <button
                                                key={o}
                                                type="button"
                                                aria-pressed={on}
                                                onClick={() =>
                                                    onPick(q.text, o)
                                                }
                                                className={`rounded-lg px-3 py-2 text-sm ${
                                                    on
                                                        ? 'bg-brand text-white'
                                                        : 'bg-brand-50 text-brand-700 hover:bg-brand-100 dark:bg-brand-900/40 dark:text-brand-200 dark:hover:bg-brand-900/60'
                                                }`}
                                            >
                                                {o}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}
                    </div>
                    <button
                        type="button"
                        onClick={onAnswerAll}
                        disabled={!allAnswered}
                        className="mt-4 h-11 w-full rounded-xl bg-ink text-sm font-semibold text-white hover:bg-gray-800 disabled:opacity-40 dark:bg-gray-100 dark:text-ink dark:hover:bg-white md:w-auto md:px-6"
                        data-testid="untangle-answer"
                    >
                        {t('untangle.updatePlan', 'Update the plan')}
                    </button>
                </div>
            )}
        </div>
    );
};

export default UntangleResult;
