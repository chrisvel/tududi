import React, { useMemo, useRef, useState } from 'react';
import { Project } from '../../entities/Project';

interface Props {
    projects: Project[];
}

const FALLBACK_COLOR = '#6b7280';

interface TooltipState {
    x: number;
    y: number;
    name: string;
    daysLeft: number;
    completionPct: number;
}

function badgeClass(daysLeft: number): string {
    if (daysLeft <= 14) return 'text-red-500 dark:text-red-400';
    if (daysLeft <= 45) return 'text-amber-500 dark:text-amber-400';
    return 'text-green-500 dark:text-green-400';
}

const ProjectRunway: React.FC<Props> = ({ projects }) => {
    const wrapperRef = useRef<HTMLDivElement>(null);
    const [tooltip, setTooltip] = useState<TooltipState | null>(null);

    const today = useMemo(() => {
        const d = new Date();
        d.setHours(0, 0, 0, 0);
        return d;
    }, []);

    const rows = useMemo(() => {
        return projects
            .filter(
                (p) =>
                    p.due_date_at &&
                    p.status !== 'done' &&
                    p.status !== 'cancelled'
            )
            .map((p) => {
                const due = new Date(p.due_date_at!);
                due.setHours(0, 0, 0, 0);
                const daysLeft = Math.round(
                    (due.getTime() - today.getTime()) / 86400000
                );
                const areaObj = (p as any).Area ?? p.area;
                return {
                    key: String(p.id ?? p.uid ?? p.name),
                    name: p.name,
                    daysLeft,
                    completionPct: p.completion_percentage ?? 0,
                    color: areaObj?.color ?? FALLBACK_COLOR,
                };
            })
            .sort((a, b) => a.daysLeft - b.daysLeft);
    }, [projects, today]);

    const maxDays = useMemo(
        () => Math.max(...rows.map((r) => r.daysLeft), 1),
        [rows]
    );

    const handleMouseMove = (e: React.MouseEvent, row: (typeof rows)[0]) => {
        const rect = wrapperRef.current?.getBoundingClientRect();
        if (!rect) return;
        setTooltip({
            x: e.clientX - rect.left,
            y: e.clientY - rect.top,
            name: row.name,
            daysLeft: row.daysLeft,
            completionPct: row.completionPct,
        });
    };

    if (rows.length === 0) return null;

    return (
        <div ref={wrapperRef} className="relative flex flex-col h-full">
            <div className="flex-1 min-h-0 overflow-y-auto space-y-1.5">
                {rows.map((row) => {
                    const barPct = Math.min(
                        100,
                        Math.max(0, (Math.max(0, row.daysLeft) / maxDays) * 100)
                    );
                    return (
                        <div
                            key={row.key}
                            className="flex items-center gap-2"
                            onMouseMove={(e) => handleMouseMove(e, row)}
                            onMouseLeave={() => setTooltip(null)}
                        >
                            {/* Name */}
                            <div
                                className="flex-shrink-0 text-xs text-gray-700 dark:text-gray-300 truncate"
                                style={{ width: 112 }}
                                title={row.name}
                            >
                                {row.name}
                            </div>

                            {/* Bar track */}
                            <div className="flex-1 relative h-4">
                                {/* Today line at left edge */}
                                <div className="absolute left-0 inset-y-0 w-px bg-gray-300 dark:bg-gray-600 z-10" />
                                {/* Project bar: width = time remaining / max time */}
                                <div
                                    className="absolute inset-y-0 left-0 rounded-sm overflow-hidden bg-gray-200 dark:bg-gray-700"
                                    style={{ width: `${barPct}%` }}
                                >
                                    {/* Completion fill */}
                                    <div
                                        className="absolute inset-y-0 left-0 rounded-sm"
                                        style={{
                                            width: `${row.completionPct}%`,
                                            backgroundColor: row.color,
                                            opacity: 0.85,
                                        }}
                                    />
                                </div>
                            </div>

                            {/* Days badge */}
                            <div
                                className={`flex-shrink-0 text-right text-[10px] font-semibold tabular-nums ${badgeClass(row.daysLeft)}`}
                                style={{ width: 32 }}
                            >
                                {row.daysLeft <= 0
                                    ? 'OVR'
                                    : `${row.daysLeft}d`}
                            </div>
                        </div>
                    );
                })}
            </div>

            {tooltip && (
                <div
                    className="absolute z-50 pointer-events-none bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg px-3 py-2 text-xs whitespace-nowrap"
                    style={{
                        left: tooltip.x + 10,
                        top: tooltip.y,
                        transform: 'translateY(calc(-100% - 6px))',
                    }}
                >
                    <div className="font-medium text-gray-800 dark:text-gray-200">
                        {tooltip.name}
                    </div>
                    <div className="text-gray-500 dark:text-gray-400">
                        {tooltip.completionPct}% done
                        {' · '}
                        {tooltip.daysLeft <= 0
                            ? `${Math.abs(tooltip.daysLeft)}d overdue`
                            : `${tooltip.daysLeft}d left`}
                    </div>
                </div>
            )}
        </div>
    );
};

export default ProjectRunway;
