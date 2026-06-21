import React, { useMemo } from 'react';
import { Project } from '../../entities/Project';

interface AreaEntry {
    name: string;
    color: string;
    inProgress: number;
    share: number;
}

interface Props {
    projects: Project[];
}

const FALLBACK_COLORS = [
    '#3b82f6',
    '#10b981',
    '#f59e0b',
    '#ef4444',
    '#8b5cf6',
    '#06b6d4',
    '#f97316',
    '#84cc16',
];

const AreaBalanceBar: React.FC<Props> = ({ projects }) => {
    const areas = useMemo<AreaEntry[]>(() => {
        const map = new Map<string, { color: string | null; count: number }>();

        projects.forEach((project) => {
            const areaObj = (project as any).Area || project.area;
            const name = areaObj?.name;
            if (!name) return;

            const count = project.task_status?.in_progress ?? 0;
            const existing = map.get(name);
            if (existing) {
                existing.count += count;
            } else {
                map.set(name, { color: areaObj?.color ?? null, count });
            }
        });

        const total = Array.from(map.values()).reduce(
            (sum, a) => sum + a.count,
            0
        );
        if (total === 0) return [];

        return Array.from(map.entries())
            .filter(([, a]) => a.count > 0)
            .sort(([, a], [, b]) => b.count - a.count)
            .map(([name, a], i) => ({
                name,
                color: a.color ?? FALLBACK_COLORS[i % FALLBACK_COLORS.length],
                inProgress: a.count,
                share: (a.count / total) * 100,
            }));
    }, [projects]);

    if (areas.length === 0) return null;

    return (
        <div className="mb-4">
            <div className="flex h-1 rounded-full overflow-hidden gap-px mb-2.5">
                {areas.map((area) => (
                    <div
                        key={area.name}
                        style={{
                            width: `${area.share}%`,
                            backgroundColor: area.color,
                        }}
                        className="h-full transition-all duration-300"
                        title={`${area.name}: ${area.inProgress} in progress`}
                    />
                ))}
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1">
                {areas.map((area) => (
                    <div
                        key={area.name}
                        className="flex items-center gap-1.5 min-w-0"
                    >
                        <div
                            className="w-2 h-2 rounded-full flex-shrink-0"
                            style={{ backgroundColor: area.color }}
                        />
                        <span className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-[120px]">
                            {area.name}
                        </span>
                        <span className="text-xs font-medium text-gray-700 dark:text-gray-300 flex-shrink-0">
                            {area.inProgress}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default AreaBalanceBar;
