import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Project } from '../../entities/Project';

interface ActiveRow {
    project: Project;
    areaName: string;
    areaColor: string;
    pct: number;
    done: number;
    total: number;
    daysLeft: number | null;
    risk: 'red' | 'amber' | 'green' | null;
}

interface Props {
    projects: Project[];
}

const TODAY = (() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
})();

const FALLBACK_COLOR = '#6b7280';

const RISK_BADGE: Record<'red' | 'amber' | 'green', string> = {
    red: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400',
    amber: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400',
    green: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400',
};

function generateSummary(rows: ActiveRow[]): string {
    const urgent = rows.filter(
        (r) => r.daysLeft !== null && r.daysLeft <= 30 && r.pct < 40
    );
    if (urgent.length === 0) return '';

    const sentences = urgent.map((r) => {
        const isCritical = r.pct < 20 && r.daysLeft !== null && r.daysLeft < 14;
        if (isCritical) {
            return `${r.project.name} is critically behind: only ${r.pct}% done with ${r.daysLeft} day${r.daysLeft !== 1 ? 's' : ''} left`;
        }
        return `${r.project.name} needs attention: ${r.pct}% done with ${r.daysLeft} day${r.daysLeft !== 1 ? 's' : ''} to go`;
    });

    return sentences.join('. ') + '.';
}

const ActiveProjectsSection: React.FC<Props> = ({ projects }) => {
    const navigate = useNavigate();

    const rows = useMemo<ActiveRow[]>(() => {
        return projects
            .filter(
                (p) =>
                    (p.task_status?.in_progress ?? 0) > 0 ||
                    p.status === 'in_progress'
            )
            .map((p) => {
                const areaObj = (p as any).Area ?? p.area;
                const areaName: string = areaObj?.name ?? '';
                const areaColor: string = areaObj?.color ?? FALLBACK_COLOR;
                const pct = p.completion_percentage ?? 0;
                const done = p.task_status?.done ?? 0;
                const total = p.task_status?.total ?? 0;

                let daysLeft: number | null = null;
                let risk: 'red' | 'amber' | 'green' | null = null;

                if (p.due_date_at) {
                    const due = new Date(p.due_date_at);
                    due.setHours(0, 0, 0, 0);
                    daysLeft = Math.ceil(
                        (due.getTime() - TODAY.getTime()) / 86400000
                    );
                    if (daysLeft <= 14) risk = 'red';
                    else if (daysLeft <= 45) risk = 'amber';
                    else risk = 'green';
                }

                return { project: p, areaName, areaColor, pct, done, total, daysLeft, risk };
            })
            .sort((a, b) => {
                if (a.daysLeft === null && b.daysLeft === null) return 0;
                if (a.daysLeft === null) return 1;
                if (b.daysLeft === null) return -1;
                return a.daysLeft - b.daysLeft;
            });
    }, [projects]);

    const summary = useMemo(() => generateSummary(rows), [rows]);

    if (rows.length === 0) return null;

    return (
        <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-xl p-4 mb-4 shadow-sm">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-3">
                Active Projects
            </h3>

            <div className="space-y-3">
                {rows.map(
                    ({ project, areaName, areaColor, pct, done, total, daysLeft, risk }) => (
                        <div
                            key={project.id}
                            className="group cursor-pointer"
                            onClick={() => navigate(`/project/${project.uid}`)}
                        >
                            <div className="flex items-center justify-between mb-1">
                                <div className="flex items-baseline gap-2 min-w-0">
                                    <span className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate group-hover:text-blue-500 transition-colors">
                                        {project.name}
                                    </span>
                                    {areaName && (
                                        <span className="text-[10px] text-gray-400 dark:text-gray-600 flex-shrink-0">
                                            {areaName}
                                        </span>
                                    )}
                                </div>
                                <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                                    <span className="text-xs text-gray-500 dark:text-gray-400">
                                        {done}/{total}
                                    </span>
                                    {risk && daysLeft !== null && (
                                        <span
                                            className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${RISK_BADGE[risk]}`}
                                        >
                                            {daysLeft <= 0
                                                ? 'overdue'
                                                : `${daysLeft}d`}
                                        </span>
                                    )}
                                </div>
                            </div>
                            <div className="w-full h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                                <div
                                    className="h-full rounded-full transition-all duration-500"
                                    style={{
                                        width: `${pct}%`,
                                        backgroundColor: areaColor,
                                    }}
                                />
                            </div>
                        </div>
                    )
                )}
            </div>

            {summary && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-3 leading-relaxed italic border-t border-gray-100 dark:border-gray-800 pt-3">
                    {summary}
                </p>
            )}
        </div>
    );
};

export default ActiveProjectsSection;
