import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Project } from '../../entities/Project';
import { Area } from '../../entities/Area';
import { fetchAreas } from '../../utils/areasService';

interface AreaStats {
    name: string;
    color: string;
    areaId: number | null;
    total: number;
    done: number;
    inProgress: number;
    share: number;
}

interface Props {
    projects: Project[];
}

const FALLBACK_COLOR = '#6b7280';

function formatList(names: string[]): string {
    if (names.length === 0) return '';
    if (names.length === 1) return names[0];
    return names.slice(0, -1).join(', ') + ' and ' + names[names.length - 1];
}

function generateConclusion(areas: AreaStats[]): string {
    if (areas.length === 0) return '';
    const totalAll = areas.reduce((s, a) => s + a.total, 0);
    if (totalAll === 0) return '';

    const sorted = [...areas].sort((a, b) => b.total - a.total);

    const heavyAreas: AreaStats[] = [];
    let heavySum = 0;
    for (const a of sorted) {
        if (heavySum / totalAll < 0.45 || heavyAreas.length === 0) {
            heavyAreas.push(a);
            heavySum += a.total;
            if (heavySum / totalAll >= 0.4 && heavyAreas.length >= 2) break;
        }
    }
    const heavyPct = Math.round((heavySum / totalAll) * 100);

    const lightAreas = sorted.filter(
        (a) => (a.total / totalAll) * 100 < 12 && !heavyAreas.includes(a)
    );
    const lightSum = lightAreas.reduce((s, a) => s + a.total, 0);
    const lightPct = Math.round((lightSum / totalAll) * 100);

    let text = '';
    if (heavyAreas.length >= 2) {
        text += `${formatList(heavyAreas.map((a) => a.name))} hold ${heavyPct}% of your work.`;
    } else if (heavyAreas.length === 1) {
        text += `${heavyAreas[0].name} holds ${heavyPct}% of your work.`;
    }

    if (lightAreas.length > 0 && lightPct > 0) {
        text += ` ${formatList(lightAreas.map((a) => a.name))} ${lightAreas.length === 1 ? 'has' : 'together have'} only ${lightPct}%.`;
    }

    return text;
}

const LifeBalance: React.FC<Props> = ({ projects }) => {
    const navigate = useNavigate();
    const [areaMetaMap, setAreaMetaMap] = useState<Map<string, { color: string; id: number }>>(new Map());

    useEffect(() => {
        fetchAreas()
            .then((fetched: Area[]) => {
                const map = new Map<string, { color: string; id: number }>();
                fetched.forEach((a) => {
                    if (a.name && a.id != null) {
                        map.set(a.name, { color: a.color ?? FALLBACK_COLOR, id: a.id });
                    }
                });
                setAreaMetaMap(map);
            })
            .catch(() => {});
    }, []);

    const areas = useMemo<AreaStats[]>(() => {
        const map = new Map<string, { color: string; areaId: number | null; total: number; done: number; inProgress: number }>();

        projects.forEach((p) => {
            const areaObj = (p as any).Area ?? p.area;
            const name = areaObj?.name ?? 'No Area';
            const meta = areaMetaMap.get(name);
            const color: string = meta?.color ?? areaObj?.color ?? FALLBACK_COLOR;
            const areaId: number | null = meta?.id ?? areaObj?.id ?? null;
            const total = p.task_status?.total ?? 0;
            const done = p.task_status?.done ?? 0;
            const inProgress = p.task_status?.in_progress ?? 0;
            const existing = map.get(name);
            if (existing) {
                existing.total += total;
                existing.done += done;
                existing.inProgress += inProgress;
            } else {
                map.set(name, { color, areaId, total, done, inProgress });
            }
        });

        const totalAll = Array.from(map.values()).reduce((s, a) => s + a.total, 0);

        return Array.from(map.entries())
            .filter(([, a]) => a.total > 0)
            .map(([name, { color, areaId, total, done, inProgress }]) => ({
                name,
                color,
                areaId,
                total,
                done,
                inProgress,
                share: totalAll > 0 ? (total / totalAll) * 100 : 0,
            }))
            .sort((a, b) => b.total - a.total);
    }, [projects, areaMetaMap]);

    const conclusion = useMemo(() => generateConclusion(areas), [areas]);

    if (areas.length === 0) return null;

    return (
        <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-xl p-4 shadow-sm h-full">
            <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-3">
                    Area Balance
                </h3>
                <div className="space-y-2">
                    {areas.map((area) => (
                        <div
                            key={area.name}
                            className={`flex items-center gap-3 ${area.areaId != null ? 'cursor-pointer group' : ''}`}
                            onClick={() => area.areaId != null && navigate(`/area/${area.areaId}`)}
                        >
                            <div className="w-36 flex-shrink-0 flex items-center justify-end gap-1.5 min-w-0">
                                <span className="text-xs text-gray-600 dark:text-gray-400 truncate group-hover:text-blue-500 transition-colors">
                                    {area.name}
                                </span>
                                {area.inProgress > 0 && (
                                    <span
                                        className="text-[10px] font-medium px-1 py-0.5 rounded flex-shrink-0"
                                        style={{
                                            backgroundColor: area.color
                                                ? `${area.color}22`
                                                : undefined,
                                            color: area.color || undefined,
                                        }}
                                    >
                                        {area.inProgress}
                                    </span>
                                )}
                            </div>
                            <div className="flex-1 relative h-3.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                                <div
                                    className="absolute inset-y-0 left-0 rounded-full transition-all duration-500"
                                    style={{
                                        width: `${area.share}%`,
                                        backgroundColor: area.color,
                                        opacity: 0.28,
                                    }}
                                />
                                <div
                                    className="absolute inset-y-0 left-0 rounded-full transition-all duration-500"
                                    style={{
                                        width: `${area.total > 0 ? (area.done / area.total) * area.share : 0}%`,
                                        backgroundColor: area.color,
                                    }}
                                />
                            </div>
                            <div className="w-20 text-xs text-gray-500 dark:text-gray-400 flex-shrink-0 text-right">
                                {area.done}/{area.total}
                                <span className="text-gray-400 dark:text-gray-600 ml-1">
                                    ({Math.round(area.share)}%)
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
                {conclusion && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-3 leading-relaxed italic border-t border-gray-100 dark:border-gray-800 pt-3">
                        {conclusion}
                    </p>
                )}
            </div>
        </div>
    );
};

export default LifeBalance;
