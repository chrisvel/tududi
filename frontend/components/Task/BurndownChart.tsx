import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Task } from '../../entities/Task';
import { getApiPath } from '../../config/paths';
import { getDefaultHeaders } from '../../utils/authUtils';

const M = { top: 16, right: 24, bottom: 44, left: 36 };
const DAYS = 28;

function smoothPath(pts: { x: number; y: number }[]): string {
    if (pts.length < 2) return '';
    let d = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
    for (let i = 1; i < pts.length; i++) {
        const p = pts[i - 1];
        const c = pts[i];
        const mx = ((p.x + c.x) / 2).toFixed(1);
        d += ` C ${mx} ${p.y.toFixed(1)} ${mx} ${c.y.toFixed(1)} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`;
    }
    return d;
}

const BurndownChart: React.FC = () => {
    const [allTasks, setAllTasks] = useState<Task[]>([]);
    const [loading, setLoading] = useState(true);
    const containerRef = useRef<HTMLDivElement>(null);
    const [containerW, setContainerW] = useState(300);
    const [containerH, setContainerH] = useState(160);

    useEffect(() => {
        fetch(getApiPath('tasks?status=all'), {
            credentials: 'include',
            headers: getDefaultHeaders(),
        })
            .then((r) => r.json())
            .then((data) => setAllTasks(data.tasks ?? []))
            .catch(() => {})
            .finally(() => setLoading(false));
    }, []);

    useLayoutEffect(() => {
        const el = containerRef.current;
        if (!el) return;
        const ro = new ResizeObserver((entries) => {
            const { width, height } = entries[0].contentRect;
            if (width > 0) setContainerW(width);
            if (height > 0) setContainerH(height);
        });
        ro.observe(el);
        return () => ro.disconnect();
    }, []);

    const CHART_H = containerH;
    const PH = CHART_H - M.top - M.bottom;
    const PW = containerW - M.left - M.right;

    const hasCompletedAt = useMemo(
        () => allTasks.some((t) => t.completed_at != null),
        [allTasks]
    );

    const dataPoints = useMemo(() => {
        const now = new Date();
        now.setHours(23, 59, 59, 999);
        return Array.from({ length: DAYS }, (_, i) => {
            const dayEnd = new Date(now);
            dayEnd.setDate(dayEnd.getDate() - (DAYS - 1 - i));
            let count: number;
            if (hasCompletedAt) {
                count = allTasks.filter((t) => {
                    if (!t.created_at) return false;
                    if (new Date(t.created_at) > dayEnd) return false;
                    if (t.completed_at) return new Date(t.completed_at) > dayEnd;
                    return true;
                }).length;
            } else {
                count = allTasks.filter(
                    (t) => t.created_at && new Date(t.created_at) <= dayEnd
                ).length;
            }
            return { i, daysAgo: DAYS - 1 - i, count };
        });
    }, [allTasks, hasCompletedAt]);

    const { minY, maxY } = useMemo(() => {
        if (dataPoints.length === 0) return { minY: 0, maxY: 10 };
        const counts = dataPoints.map((p) => p.count);
        const lo = Math.min(...counts);
        const hi = Math.max(...counts);
        const pad = Math.max(1, Math.ceil((hi - lo) * 0.12));
        return { minY: Math.max(0, lo - pad), maxY: hi + pad };
    }, [dataPoints]);

    const lineColor = useMemo(() => {
        if (!hasCompletedAt || dataPoints.length < 7) return '#3b82f6';
        const recent = dataPoints.slice(-7);
        const delta = recent[recent.length - 1].count - recent[0].count;
        if (delta < -1) return '#22c55e';
        if (delta > 1) return '#ef4444';
        return '#f59e0b';
    }, [dataPoints, hasCompletedAt]);

    const toSvgX = (i: number) => M.left + (i / (DAYS - 1)) * PW;
    const toSvgY = (v: number) =>
        maxY === minY
            ? M.top + PH / 2
            : M.top + ((maxY - v) / (maxY - minY)) * PH;

    const svgPts = useMemo(
        () => dataPoints.map((p) => ({ x: toSvgX(p.i), y: toSvgY(p.count) })),
        [dataPoints, minY, maxY, PW]
    );

    const linePath = smoothPath(svgPts);
    const last = svgPts[svgPts.length - 1];
    const areaPath =
        svgPts.length > 0 && last
            ? `${linePath} L ${last.x.toFixed(1)} ${(M.top + PH).toFixed(1)} L ${svgPts[0].x.toFixed(1)} ${(M.top + PH).toFixed(1)} Z`
            : '';

    const todayCount = dataPoints[dataPoints.length - 1]?.count ?? 0;

    const X_LABELS: { i: number; label: string }[] = [
        { i: 0, label: '4w ago' },
        { i: 7, label: '3w ago' },
        { i: 14, label: '2w ago' },
        { i: 21, label: 'Last week' },
        { i: DAYS - 1, label: 'Today' },
    ];

    const Y_TICKS = useMemo(() => {
        const range = maxY - minY;
        if (range === 0) return [minY];
        return [minY, Math.round(minY + range / 2), maxY];
    }, [minY, maxY]);

    const gradId = 'bd-grad';

    return (
        <div className="bg-white dark:bg-gray-900 rounded-lg shadow p-4 h-full flex flex-col">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-3">
                4-Week Burndown
            </h3>
            {!hasCompletedAt && !loading && allTasks.length > 0 && (
                <p className="text-[10px] text-gray-400 dark:text-gray-500 mb-1 leading-tight">
                    Tasks created (completion tracking coming soon)
                </p>
            )}
            <div ref={containerRef} className="flex-1 min-h-0 relative">
                {loading && (
                    <div className="flex items-center justify-center h-full">
                        <span className="text-xs text-gray-400 dark:text-gray-500">
                            Loading…
                        </span>
                    </div>
                )}
                {!loading && allTasks.length === 0 && (
                    <div className="flex items-center justify-center h-full">
                        <span className="text-xs text-gray-400 dark:text-gray-500">
                            No task data
                        </span>
                    </div>
                )}
                {!loading && allTasks.length > 0 && (
                    <svg
                        width={containerW}
                        height={CHART_H}
                        style={{ display: 'block', overflow: 'visible', width: '100%', height: '100%' }}
                    >
                        <defs>
                            <linearGradient
                                id={gradId}
                                x1="0"
                                y1="0"
                                x2="0"
                                y2="1"
                            >
                                <stop
                                    offset="0%"
                                    stopColor={lineColor}
                                    stopOpacity="0.18"
                                />
                                <stop
                                    offset="100%"
                                    stopColor={lineColor}
                                    stopOpacity="0.02"
                                />
                            </linearGradient>
                        </defs>

                        {/* Horizontal grid lines */}
                        {Y_TICKS.map((tick) => {
                            const y = toSvgY(tick);
                            return (
                                <line
                                    key={tick}
                                    x1={M.left}
                                    y1={y}
                                    x2={M.left + PW}
                                    y2={y}
                                    stroke="currentColor"
                                    className="text-gray-100 dark:text-gray-800"
                                    strokeWidth="1"
                                />
                            );
                        })}

                        {/* Area fill */}
                        <path d={areaPath} fill={`url(#${gradId})`} />

                        {/* Line */}
                        <path
                            d={linePath}
                            fill="none"
                            stroke={lineColor}
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        />

                        {/* Today dot */}
                        {last && (
                            <circle
                                cx={last.x}
                                cy={last.y}
                                r="4"
                                fill={lineColor}
                                stroke="white"
                                strokeWidth="1.5"
                            />
                        )}

                        {/* Today count label */}
                        {last && (
                            <text
                                x={last.x}
                                y={last.y - 8}
                                textAnchor="middle"
                                fontSize="10"
                                fontWeight="600"
                                fill={lineColor}
                            >
                                {todayCount}
                            </text>
                        )}

                        {/* Y axis labels */}
                        {Y_TICKS.map((tick) => (
                            <text
                                key={tick}
                                x={M.left - 4}
                                y={toSvgY(tick) + 3}
                                textAnchor="end"
                                fontSize="9"
                                fill="currentColor"
                                className="text-gray-400 dark:text-gray-500"
                            >
                                {tick}
                            </text>
                        ))}

                        {/* X axis labels */}
                        {X_LABELS.map(({ i, label }) => (
                            <text
                                key={label}
                                x={toSvgX(i)}
                                y={M.top + PH + 22}
                                textAnchor={
                                    i === 0
                                        ? 'start'
                                        : i === DAYS - 1
                                          ? 'end'
                                          : 'middle'
                                }
                                fontSize="9"
                                fill="currentColor"
                                className="text-gray-400 dark:text-gray-500"
                            >
                                {label}
                            </text>
                        ))}
                    </svg>
                )}
            </div>
        </div>
    );
};

export default BurndownChart;
