import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { getApiPath } from '../../config/paths';
import { Project } from '../../entities/Project';
import { Task } from '../../entities/Task';

export type OverdueBucket = 'week' | 'last-week' | 'older';

interface LifeRadarProps {
    projects: Project[];
    tasksInProgress: Task[];
    tasksOverdue: Task[];
    selectedBucket: OverdueBucket | null;
    onBucketSelect: (b: OverdueBucket | null) => void;
}

// ─── Shared helpers ───────────────────────────────────────────────────────

function floorDays(ms: number) {
    return Math.floor(ms / 86400000);
}

function startOfDay(d: Date): Date {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x;
}

const NOW = startOfDay(new Date());

// ─── Widget 1 · Focus Distribution ───────────────────────────────────────

const UNCATEGORISED = '#6b7280';

function FocusBar({
    projects,
    tasksInProgress,
}: {
    projects: Project[];
    tasksInProgress: Task[];
}) {
    const segments = useMemo(() => {
        const projectMap = new Map<number, Project>(
            projects.map((p) => [p.id!, p])
        );
        const areaMap = new Map<string, { color: string; count: number }>();

        tasksInProgress.forEach((t) => {
            let name = 'Uncategorised';
            let color = UNCATEGORISED;
            if (t.project_id) {
                const proj = projectMap.get(t.project_id);
                const area = (proj as any)?.Area ?? proj?.area;
                if (area?.name) {
                    name = area.name;
                    color = area.color ?? UNCATEGORISED;
                }
            }
            const existing = areaMap.get(name);
            if (existing) existing.count++;
            else areaMap.set(name, { color, count: 1 });
        });

        const total = tasksInProgress.length || 1;
        return Array.from(areaMap.entries())
            .map(([name, { color, count }]) => ({
                name,
                color,
                count,
                pct: (count / total) * 100,
            }))
            .sort((a, b) => b.count - a.count);
    }, [projects, tasksInProgress]);

    if (segments.length === 0) {
        return (
            <p className="text-xs text-gray-400 dark:text-gray-600 mb-3">
                No in-progress tasks.
            </p>
        );
    }

    return (
        <div className="mb-4">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-1.5">
                Focus Distribution
            </p>
            <div className="flex h-1.5 rounded-full overflow-hidden gap-px mb-2">
                {segments.map((s) => (
                    <div
                        key={s.name}
                        style={{ width: `${s.pct}%`, backgroundColor: s.color }}
                        className="h-full"
                        title={`${s.name}: ${s.count}`}
                    />
                ))}
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-0.5">
                {segments.map((s) => (
                    <div key={s.name} className="flex items-center gap-1.5">
                        <div
                            className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                            style={{ backgroundColor: s.color }}
                        />
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                            {s.name}
                        </span>
                        <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                            {s.count}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
}

// ─── Widget 2 · Deadline Danger ───────────────────────────────────────────

type Risk = 'red' | 'amber' | 'green';

const RISK_STYLES: Record<Risk, string> = {
    red: 'text-red-600 dark:text-red-400',
    amber: 'text-amber-500 dark:text-amber-400',
    green: 'text-emerald-600 dark:text-emerald-400',
};

const RISK_DOT: Record<Risk, string> = {
    red: '●',
    amber: '◐',
    green: '○',
};

function riskFor(neededPerDay: number): Risk {
    if (neededPerDay > 3) return 'red';
    if (neededPerDay >= 1) return 'amber';
    return 'green';
}

function DeadlineDanger({ projects }: { projects: Project[] }) {
    const navigate = useNavigate();

    const rows = useMemo(() => {
        return projects
            .filter((p) => p.due_date_at)
            .map((p) => {
                const due = startOfDay(new Date(p.due_date_at!));
                const daysLeft = floorDays(due.getTime() - NOW.getTime());
                const pct = p.completion_percentage ?? 0;
                const needed =
                    daysLeft > 0 ? (100 - pct) / daysLeft : daysLeft < 0 ? 999 : 999;
                const area =
                    (p as any).Area ?? p.area;
                return {
                    p,
                    daysLeft,
                    pct,
                    risk: riskFor(needed),
                    areaName: area?.name ?? '',
                };
            })
            .filter((r) => r.daysLeft <= 60)
            .sort((a, b) => a.daysLeft - b.daysLeft);
    }, [projects]);

    return (
        <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-1.5">
                Deadline Danger
            </p>
            {rows.length === 0 ? (
                <p className="text-xs text-gray-400 dark:text-gray-600">
                    No deadlines in the next 60 days.
                </p>
            ) : (
                <div className="space-y-1.5">
                    {rows.slice(0, 5).map(({ p, daysLeft, pct, risk, areaName }) => (
                        <div
                            key={p.id}
                            className="flex items-center gap-2 cursor-pointer group"
                            onClick={() => navigate(`/project/${p.uid}`)}
                        >
                            <span
                                className={`text-xs w-3 flex-shrink-0 ${RISK_STYLES[risk]}`}
                                title={risk}
                            >
                                {RISK_DOT[risk]}
                            </span>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-baseline gap-1.5">
                                    <span className="text-xs text-gray-700 dark:text-gray-300 truncate group-hover:text-blue-500 transition-colors">
                                        {p.name}
                                    </span>
                                    {areaName && (
                                        <span className="text-[10px] text-gray-400 dark:text-gray-600 flex-shrink-0">
                                            {areaName}
                                        </span>
                                    )}
                                </div>
                                <div className="w-full h-0.5 bg-gray-100 dark:bg-gray-800 rounded-full mt-0.5">
                                    <div
                                        className="h-0.5 bg-blue-500 rounded-full"
                                        style={{ width: `${pct}%` }}
                                    />
                                </div>
                            </div>
                            <span className="text-[10px] text-gray-400 dark:text-gray-500 flex-shrink-0 w-7 text-right">
                                {daysLeft < 0
                                    ? `${Math.abs(daysLeft)}d ago`
                                    : `${daysLeft}d`}
                            </span>
                        </div>
                    ))}
                    {rows.length > 5 && (
                        <p className="text-[10px] text-gray-400 dark:text-gray-600">
                            +{rows.length - 5} more
                        </p>
                    )}
                </div>
            )}
        </div>
    );
}

// ─── Widget 3 · Waiting-For Age ───────────────────────────────────────────

function ageBadgeClass(days: number): string {
    if (days > 14)
        return 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400';
    if (days >= 7)
        return 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400';
    return 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400';
}

function WaitingForAge({
    tasks,
    projects,
}: {
    tasks: Task[];
    projects: Project[];
}) {
    const { t: translate } = useTranslation();
    const navigate = useNavigate();

    const rows = useMemo(() => {
        const projectMap = new Map<number, Project>(
            projects.map((p) => [p.id!, p])
        );
        return tasks
            .map((t) => ({
                t,
                ageDays: t.created_at
                    ? floorDays(NOW.getTime() - startOfDay(new Date(t.created_at)).getTime())
                    : 0,
                projectName: t.project_id
                    ? (projectMap.get(t.project_id)?.name ?? '')
                    : '',
            }))
            .sort((a, b) => b.ageDays - a.ageDays);
    }, [tasks, projects]);

    return (
        <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-1.5">
                Waiting For
            </p>
            {rows.length === 0 ? (
                <p className="text-xs text-gray-400 dark:text-gray-600">
                    No waiting-for tasks.
                </p>
            ) : (
                <div className="space-y-1.5">
                    {rows.slice(0, 5).map(({ t, ageDays, projectName }) => (
                        <div key={t.id} className="flex items-center gap-1.5">
                            <div className="flex-1 min-w-0">
                                <span className="text-xs text-gray-700 dark:text-gray-300 truncate block leading-tight">
                                    {t.name}
                                </span>
                                {projectName && (
                                    <span className="text-[10px] text-gray-400 dark:text-gray-600 truncate block">
                                        {projectName}
                                    </span>
                                )}
                            </div>
                            <span
                                className={`text-[10px] px-1.5 py-0.5 rounded-full flex-shrink-0 ${ageBadgeClass(ageDays)}`}
                            >
                                {ageDays}d
                            </span>
                            <button
                                onClick={() => navigate(`/task/${t.uid}`)}
                                className="text-[10px] text-blue-500 hover:text-blue-600 dark:text-blue-400 flex-shrink-0 leading-none"
                                title={translate('tasks.chaseUp')}
                            >
                                ↗
                            </button>
                        </div>
                    ))}
                    {rows.length > 5 && (
                        <p className="text-[10px] text-gray-400 dark:text-gray-600">
                            +{rows.length - 5} more
                        </p>
                    )}
                </div>
            )}
        </div>
    );
}

// ─── Widget 4 · Overdue Age Breakdown ────────────────────────────────────

const BUCKETS: Array<{
    key: OverdueBucket;
    label: string;
    barColor: string;
    activeText: string;
}> = [
    {
        key: 'week',
        label: 'This week',
        barColor: 'bg-yellow-400',
        activeText: 'text-yellow-600 dark:text-yellow-400',
    },
    {
        key: 'last-week',
        label: 'Last week',
        barColor: 'bg-orange-400',
        activeText: 'text-orange-600 dark:text-orange-400',
    },
    {
        key: 'older',
        label: 'Older',
        barColor: 'bg-red-500',
        activeText: 'text-red-600 dark:text-red-400',
    },
];

function OverdueBuckets({
    tasksOverdue,
    selectedBucket,
    onBucketSelect,
}: {
    tasksOverdue: Task[];
    selectedBucket: OverdueBucket | null;
    onBucketSelect: (b: OverdueBucket | null) => void;
}) {
    const counts = useMemo(() => {
        const result: Record<OverdueBucket, number> = {
            week: 0,
            'last-week': 0,
            older: 0,
        };
        tasksOverdue.forEach((t) => {
            if (!t.due_date) return;
            const d = floorDays(
                NOW.getTime() - startOfDay(new Date(t.due_date)).getTime()
            );
            if (d <= 7) result.week++;
            else if (d <= 14) result['last-week']++;
            else result.older++;
        });
        return result;
    }, [tasksOverdue]);

    const max = Math.max(...Object.values(counts), 1);

    return (
        <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-1.5">
                Overdue Age
            </p>
            <div className="space-y-1.5">
                {BUCKETS.map(({ key, label, barColor, activeText }) => {
                    const count = counts[key];
                    const isSelected = selectedBucket === key;
                    return (
                        <div
                            key={key}
                            role="button"
                            onClick={() =>
                                onBucketSelect(isSelected ? null : key)
                            }
                            className={`flex items-center gap-2 rounded px-1 py-0.5 cursor-pointer transition-colors select-none ${
                                isSelected
                                    ? 'bg-gray-100 dark:bg-gray-800'
                                    : 'hover:bg-gray-50 dark:hover:bg-gray-800/50'
                            }`}
                        >
                            <span className="text-[10px] text-gray-500 dark:text-gray-400 w-14 flex-shrink-0">
                                {label}
                            </span>
                            <div className="flex-1 h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                                <div
                                    className={`h-full rounded-full ${barColor} transition-all duration-300`}
                                    style={{ width: `${(count / max) * 100}%` }}
                                />
                            </div>
                            <span
                                className={`text-xs font-semibold w-5 text-right flex-shrink-0 ${count > 0 ? activeText : 'text-gray-400 dark:text-gray-600'}`}
                            >
                                {count}
                            </span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

// ─── Main Component ───────────────────────────────────────────────────────

const LifeRadar: React.FC<LifeRadarProps> = ({
    projects,
    tasksInProgress,
    tasksOverdue,
    selectedBucket,
    onBucketSelect,
}) => {
    const [waitingForTasks, setWaitingForTasks] = useState<Task[]>([]);

    useEffect(() => {
        fetch(getApiPath('tasks?tag=waiting-for&limit=100'), {
            credentials: 'include',
        })
            .then((r) => (r.ok ? r.json() : { tasks: [] }))
            .then((data: { tasks?: Task[] }) =>
                setWaitingForTasks(data.tasks ?? [])
            )
            .catch(() => setWaitingForTasks([]));
    }, []);

    return (
        <div className="mb-5 rounded-xl bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 shadow-sm p-4">
            <FocusBar projects={projects} tasksInProgress={tasksInProgress} />
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 pt-3 border-t border-gray-100 dark:border-gray-800">
                <div className="lg:col-span-2">
                    <DeadlineDanger projects={projects} />
                </div>
                <div>
                    <WaitingForAge
                        tasks={waitingForTasks}
                        projects={projects}
                    />
                </div>
                <div>
                    <OverdueBuckets
                        tasksOverdue={tasksOverdue}
                        selectedBucket={selectedBucket}
                        onBucketSelect={onBucketSelect}
                    />
                </div>
            </div>
        </div>
    );
};

export default LifeRadar;
