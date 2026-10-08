import React, { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
    CheckCircleIcon,
    CheckIcon,
    XMarkIcon,
} from '@heroicons/react/24/outline';
import { Task } from '../../entities/Task';
import { Project } from '../../entities/Project';
import {
    analyzeInboxText,
    applyAnalysisToTask,
    InboxAnalysis,
} from '../../utils/inboxService';
import { createTask } from '../../utils/tasksService';
import { createProject } from '../../utils/projectsService';
import {
    fetchDailyPlan,
    carryOverTasks,
    startDailyPlan,
} from '../../utils/dailyPlanService';
import { completeOnboarding } from '../../utils/onboardingService';

// A modal over the app: the welcome a new account sees once on Today, and
// the brain dump reachable from the navbar menu. One box to empty the
// week's thoughts into, one line per thing, then one button that turns the
// lines into tasks and adds them to today's plan (keeping whatever is
// already planned). Tags, +projects and dates parse exactly as they do in
// the Add box. Lines with a date on another day become tasks but stay off
// today's plan. Closing it on the first visit counts as skipping.

export const DAILY_PLAN_CHANGED_EVENT = 'dailyPlanChanged';

interface Line {
    id: number;
    text: string;
    analysis: InboxAnalysis | null;
    createdUid: string | null;
}

interface FirstPlanProps {
    open: boolean;
    firstVisit: boolean;
    onClose: () => void;
    onComplete: (onboardedAt: string) => void;
}

const MAX_LINES = 30;

const chipClass =
    'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium';

const formatDay = (iso: string, language: string): string => {
    const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
    const date = new Date(y, m - 1, d);
    return new Intl.DateTimeFormat(language, {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
    }).format(date);
};

const FirstPlan: React.FC<FirstPlanProps> = ({
    open,
    firstVisit,
    onClose,
    onComplete,
}) => {
    const { t, i18n } = useTranslation();
    const navigate = useNavigate();
    const location = useLocation();
    const [lines, setLines] = useState<Line[]>([]);
    const [draft, setDraft] = useState('');
    const [busy, setBusy] = useState(false);
    const [skipping, setSkipping] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const nextId = useRef(1);

    useEffect(() => {
        if (open) inputRef.current?.focus();
    }, [open]);

    const prompts = [
        t('onboarding.promptWork', 'Something from work'),
        t('onboarding.promptHome', 'Something at home'),
        t('onboarding.promptPutOff', 'The thing you keep putting off'),
    ];

    const addLine = () => {
        const text = draft.trim();
        if (!text || lines.length >= MAX_LINES) return;
        const id = nextId.current++;
        setLines((prev) => [
            ...prev,
            { id, text, analysis: null, createdUid: null },
        ]);
        setDraft('');
        analyzeInboxText(text)
            .then((analysis) =>
                setLines((prev) =>
                    prev.map((line) =>
                        line.id === id ? { ...line, analysis } : line
                    )
                )
            )
            .catch(() => undefined);
    };

    const removeLine = (id: number) =>
        setLines((prev) => prev.filter((line) => line.id !== id));

    const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            addLine();
        }
    };

    const finish = async () => {
        if (firstVisit) {
            const { onboarded_at } = await completeOnboarding();
            onComplete(onboarded_at);
        }
        onClose();
    };

    // Closing the modal on the first visit is the same as skipping: the
    // screen has been seen and will not come back on its own.
    const dismiss = async () => {
        if (busy || skipping) return;
        setSkipping(true);
        setError(null);
        try {
            await finish();
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
        } finally {
            setSkipping(false);
        }
    };

    useEffect(() => {
        if (!open) return;
        const onKey = (event: KeyboardEvent) => {
            if (event.key === 'Escape') dismiss();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [open, busy, skipping, firstVisit]);

    // Lines that were already turned into tasks keep their uid, so a retry
    // after an error never makes the same task twice.
    const planDay = async () => {
        if (busy || skipping || lines.length === 0) return;
        setBusy(true);
        setError(null);
        try {
            const { date } = await fetchDailyPlan();
            const projects = new Map<string, Project>();
            const planned: string[] = [];
            const current = [...lines];

            for (const line of current) {
                let uid = line.createdUid;
                let analysis = line.analysis;
                if (!uid) {
                    if (!analysis) {
                        analysis = await analyzeInboxText(line.text).catch(
                            () => null
                        );
                    }
                    let task = {
                        name: analysis?.cleaned_content?.trim() || line.text,
                    } as Task;
                    task = applyAnalysisToTask(task, analysis);
                    if (analysis?.parsed_tags?.length) {
                        task.tags = analysis.parsed_tags.map((name) => ({
                            name,
                        }));
                    }
                    const projectName = analysis?.parsed_projects?.[0];
                    if (projectName) {
                        const key = projectName.toLowerCase();
                        let project = projects.get(key);
                        if (!project) {
                            project = await createProject({
                                name: projectName,
                                status: 'planned',
                            });
                            projects.set(key, project);
                        }
                        task.project_uid = project.uid;
                    }
                    const created = await createTask(task);
                    uid = created.uid || null;
                    setLines((prev) =>
                        prev.map((l) =>
                            l.id === line.id
                                ? { ...l, createdUid: uid, analysis }
                                : l
                        )
                    );
                }
                const due = analysis?.parsed_due_date?.slice(0, 10) || null;
                if (uid && (!due || due === date)) planned.push(uid);
            }

            if (planned.length > 0) {
                await carryOverTasks(date, planned);
                await startDailyPlan(date);
            }
            window.dispatchEvent(new CustomEvent(DAILY_PLAN_CHANGED_EVENT));
            await finish();
            if (location.pathname !== '/today') navigate('/today');
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
        } finally {
            setBusy(false);
        }
    };

    if (!open) return null;

    const count = lines.length;
    const locked = busy || skipping;

    return (
        <div
            className="fixed inset-0 z-50 flex items-start sm:items-center justify-center bg-black/30 backdrop-blur-sm px-4 py-6 sm:py-10 overflow-y-auto"
            onClick={dismiss}
            data-testid="first-plan-backdrop"
        >
            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="first-plan-title"
                className="w-full max-w-xl bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-6 sm:p-8 my-auto"
                onClick={(event) => event.stopPropagation()}
            >
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <p className="text-sm font-medium text-blue-600 dark:text-blue-400 mb-1">
                            {firstVisit
                                ? t('onboarding.kicker', 'Welcome to tududi')
                                : t('onboarding.kickerAgain', 'Brain dump')}
                        </p>
                        <h1
                            id="first-plan-title"
                            className="text-2xl sm:text-3xl font-light text-gray-900 dark:text-gray-100"
                        >
                            {t(
                                'onboarding.title',
                                "What's on your plate this week?"
                            )}
                        </h1>
                    </div>
                    <button
                        type="button"
                        onClick={dismiss}
                        disabled={locked}
                        aria-label={t('common.close', 'Close')}
                        data-testid="first-plan-close"
                        className="flex-shrink-0 rounded-md p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 dark:hover:text-gray-200"
                    >
                        <XMarkIcon className="h-5 w-5" />
                    </button>
                </div>
                <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                    {t(
                        'onboarding.subtitle',
                        'One thing per line, press Enter after each. No sorting yet, that comes later.'
                    )}
                </p>

                <div className="mt-6">
                    <input
                        ref={inputRef}
                        type="text"
                        value={draft}
                        onChange={(event) => setDraft(event.target.value)}
                        onKeyDown={handleKeyDown}
                        disabled={locked}
                        placeholder={
                            count < prompts.length
                                ? prompts[count]
                                : t(
                                      'onboarding.placeholderMore',
                                      'Anything else?'
                                  )
                        }
                        aria-label={t(
                            'onboarding.inputLabel',
                            'Something on your plate'
                        )}
                        data-testid="first-plan-input"
                        className="w-full rounded-xl bg-gray-50 dark:bg-gray-900/60 px-4 py-3 text-lg text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:opacity-60"
                    />
                    <p className="mt-2 text-xs text-gray-400 dark:text-gray-500">
                        {t(
                            'onboarding.hintSyntax',
                            'Try "Call the dentist tomorrow #home" or "Draft the budget +Q4 planning".'
                        )}
                    </p>
                </div>

                {lines.length > 0 && (
                    <ul
                        className="mt-5 space-y-2 max-h-64 overflow-y-auto"
                        data-testid="first-plan-lines"
                    >
                        {lines.map((line) => {
                            const due = line.analysis?.parsed_due_date;
                            const tags = line.analysis?.parsed_tags || [];
                            const project = line.analysis?.parsed_projects?.[0];
                            const title =
                                line.analysis?.cleaned_content?.trim() ||
                                line.text;
                            return (
                                <li
                                    key={line.id}
                                    className="flex items-start gap-3 rounded-lg bg-gray-50 dark:bg-gray-900/60 px-4 py-2.5"
                                >
                                    <CheckCircleIcon className="h-5 w-5 mt-0.5 flex-shrink-0 text-gray-300 dark:text-gray-600" />
                                    <div className="flex-1 min-w-0">
                                        <p className="text-gray-900 dark:text-gray-100 break-words">
                                            {title}
                                        </p>
                                        {(due ||
                                            tags.length > 0 ||
                                            project) && (
                                            <div className="mt-1 flex flex-wrap gap-1.5">
                                                {due && (
                                                    <span
                                                        className={`${chipClass} bg-amber-50 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300`}
                                                    >
                                                        {formatDay(
                                                            due,
                                                            i18n.language
                                                        )}
                                                    </span>
                                                )}
                                                {project && (
                                                    <span
                                                        className={`${chipClass} bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300`}
                                                    >
                                                        {project}
                                                    </span>
                                                )}
                                                {tags.map((tag) => (
                                                    <span
                                                        key={tag}
                                                        className={`${chipClass} bg-gray-200/70 text-gray-600 dark:bg-gray-700 dark:text-gray-300`}
                                                    >
                                                        #{tag}
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => removeLine(line.id)}
                                        disabled={locked}
                                        aria-label={t(
                                            'common.remove',
                                            'Remove'
                                        )}
                                        className="flex-shrink-0 rounded-md p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-200/70 dark:hover:bg-gray-700 dark:hover:text-gray-200"
                                    >
                                        <XMarkIcon className="h-4 w-4" />
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                )}

                <ol
                    className="mt-5 space-y-1.5"
                    data-testid="first-plan-prompts"
                >
                    {prompts.map((prompt, index) => {
                        const done = count > index;
                        return (
                            <li
                                key={prompt}
                                className={`flex items-center gap-2 text-sm ${
                                    done
                                        ? 'text-emerald-600 dark:text-emerald-400'
                                        : 'text-gray-500 dark:text-gray-400'
                                }`}
                            >
                                <span
                                    className={`flex h-5 w-5 items-center justify-center rounded-full text-xs ${
                                        done
                                            ? 'bg-emerald-100 dark:bg-emerald-900/40'
                                            : 'bg-gray-200 dark:bg-gray-700'
                                    }`}
                                >
                                    {done ? (
                                        <CheckIcon className="h-3 w-3" />
                                    ) : (
                                        index + 1
                                    )}
                                </span>
                                {prompt}
                            </li>
                        );
                    })}
                </ol>

                {error && (
                    <p
                        className="mt-5 rounded-lg bg-red-50 dark:bg-red-900/20 px-4 py-3 text-sm text-red-700 dark:text-red-300"
                        role="alert"
                    >
                        {error}
                    </p>
                )}

                <div className="mt-6 flex flex-col sm:flex-row sm:items-center gap-3">
                    <button
                        type="button"
                        onClick={planDay}
                        disabled={count === 0 || locked}
                        data-testid="first-plan-submit"
                        className="h-11 px-6 rounded-lg bg-blue-600 text-white font-medium shadow-sm hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                    >
                        {busy
                            ? t('onboarding.planning', 'Planning your day...')
                            : t('onboarding.planMyDay', 'Plan my day')}
                    </button>
                    <button
                        type="button"
                        onClick={dismiss}
                        disabled={locked}
                        data-testid="first-plan-skip"
                        className="h-11 px-4 rounded-lg text-sm text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-700 disabled:opacity-50"
                    >
                        {firstVisit
                            ? t('onboarding.skip', 'Skip for now')
                            : t('onboarding.back', 'Close')}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default FirstPlan;
