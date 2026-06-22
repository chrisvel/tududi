import React, { useMemo } from 'react';
import { Project } from '../../entities/Project';

interface Slice {
    name: string;
    color: string;
    pct: number;
}

interface Props {
    projects: Project[];
}

const FALLBACK_COLOR = '#6b7280';
const CX = 56;
const CY = 56;
const R_OUT = 50;
const R_IN = 30;
const GAP_DEG = 2;

function polar(cx: number, cy: number, r: number, deg: number) {
    const rad = ((deg - 90) * Math.PI) / 180;
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function arc(startDeg: number, endDeg: number): string {
    const large = endDeg - startDeg > 180 ? 1 : 0;
    const o1 = polar(CX, CY, R_OUT, startDeg);
    const o2 = polar(CX, CY, R_OUT, endDeg);
    const i2 = polar(CX, CY, R_IN, endDeg);
    const i1 = polar(CX, CY, R_IN, startDeg);
    return [
        `M ${o1.x.toFixed(2)} ${o1.y.toFixed(2)}`,
        `A ${R_OUT} ${R_OUT} 0 ${large} 1 ${o2.x.toFixed(2)} ${o2.y.toFixed(2)}`,
        `L ${i2.x.toFixed(2)} ${i2.y.toFixed(2)}`,
        `A ${R_IN} ${R_IN} 0 ${large} 0 ${i1.x.toFixed(2)} ${i1.y.toFixed(2)}`,
        'Z',
    ].join(' ');
}

const AreaDonut: React.FC<Props> = ({ projects }) => {
    const slices = useMemo<Slice[]>(() => {
        const map = new Map<string, { color: string; total: number }>();
        projects.forEach((p) => {
            const areaObj = (p as any).Area ?? p.area;
            const name = areaObj?.name ?? 'No Area';
            const color: string = areaObj?.color ?? FALLBACK_COLOR;
            const total = p.task_status?.total ?? 0;
            const existing = map.get(name);
            if (existing) {
                existing.total += total;
            } else {
                map.set(name, { color, total });
            }
        });
        const grand = Array.from(map.values()).reduce((s, a) => s + a.total, 0);
        if (grand === 0) return [];
        return Array.from(map.entries())
            .filter(([, a]) => a.total > 0)
            .sort(([, a], [, b]) => b.total - a.total)
            .map(([name, { color, total }]) => ({
                name,
                color,
                pct: (total / grand) * 100,
            }));
    }, [projects]);

    const paths = useMemo(() => {
        const result: { d: string; color: string }[] = [];
        const gap = slices.length > 1 ? GAP_DEG : 0;
        let angle = 0;
        for (const s of slices) {
            const sweep = (s.pct / 100) * 360;
            if (sweep > gap) {
                result.push({ d: arc(angle + gap / 2, angle + sweep - gap / 2), color: s.color });
            }
            angle += sweep;
        }
        return result;
    }, [slices]);

    if (slices.length === 0) return null;

    return (
        <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-xl p-4 shadow-sm h-full flex flex-col">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-3">
                Balance
            </h3>
            <div className="flex-1 flex flex-col items-center justify-between gap-3 min-h-0">
                <svg
                    viewBox={`0 0 ${CX * 2} ${CY * 2}`}
                    className="w-full max-w-[120px]"
                    aria-hidden="true"
                >
                    {paths.map((p, i) => (
                        <path key={i} d={p.d} fill={p.color} opacity={0.85} />
                    ))}
                </svg>
                <div className="w-full space-y-1.5">
                    {slices.map((s) => (
                        <div key={s.name} className="flex items-center gap-1.5 min-w-0">
                            <span
                                className="w-2 h-2 rounded-full flex-shrink-0"
                                style={{ backgroundColor: s.color }}
                            />
                            <span className="text-[10px] text-gray-600 dark:text-gray-400 truncate flex-1">
                                {s.name}
                            </span>
                            <span className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 flex-shrink-0">
                                {Math.round(s.pct)}%
                            </span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default AreaDonut;
