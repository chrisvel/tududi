import { dateOf, fromDay, toDay } from '../Project/Timeline/timelineLayout';
import {
    RoadmapArea,
    RoadmapGoal,
    RoadmapProject,
    RoadmapTask,
} from '../../utils/roadmapService';

export interface Quarter {
    year: number;
    quarter: number;
}

export const quarterOfDay = (day: number): Quarter => {
    const date = dateOf(day);
    return {
        year: date.getFullYear(),
        quarter: Math.floor(date.getMonth() / 3) + 1,
    };
};

export const quarterKey = ({ year, quarter }: Quarter): string =>
    `${year}-Q${quarter}`;

export const parseQuarter = (value: string | null): Quarter | null => {
    const match = /^(\d{4})-Q([1-4])$/.exec(value || '');
    return match ? { year: Number(match[1]), quarter: Number(match[2]) } : null;
};

export const shiftQuarter = (value: Quarter, by: number): Quarter => {
    const index = value.year * 4 + (value.quarter - 1) + by;
    return { year: Math.floor(index / 4), quarter: (index % 4) + 1 };
};

const dayFromParts = (year: number, month: number, date: number): number =>
    toDay(
        `${year}-${String(month + 1).padStart(2, '0')}-${String(date).padStart(2, '0')}`
    ) as number;

// First and last day number of a quarter.
export const quarterBounds = ({
    year,
    quarter,
}: Quarter): { first: number; last: number } => {
    const startMonth = (quarter - 1) * 3;
    const next = shiftQuarter({ year, quarter }, 1);
    return {
        first: dayFromParts(year, startMonth, 1),
        last: dayFromParts(next.year, (next.quarter - 1) * 3, 1) - 1,
    };
};

export const percentOf = (day: number, first: number, last: number): number =>
    ((day - first) / (last - first + 1)) * 100;

// Where a span of days sits, clipped to the chart; null when it is outside.
export const barPosition = (
    from: number,
    to: number,
    first: number,
    last: number
): { left: number; width: number } | null => {
    if (to < first || from > last) return null;
    const left = percentOf(Math.max(from, first), first, last);
    const right = percentOf(Math.min(to, last) + 1, first, last);
    return { left, width: right - left };
};

// The middle of one day, for diamonds and lines; null when it is outside.
export const dayCenter = (
    day: number,
    first: number,
    last: number
): number | null =>
    day < first || day > last ? null : percentOf(day + 0.5, first, last);

export const monthTicks = (
    first: number,
    last: number
): { day: number; left: number }[] => {
    const ticks: { day: number; left: number }[] = [];
    for (let day = first; day <= last; day++) {
        if (fromDay(day).endsWith('-01')) {
            ticks.push({ day, left: percentOf(day, first, last) });
        }
    }
    return ticks;
};

export const weekTicks = (
    first: number,
    last: number
): { day: number; left: number }[] => {
    const ticks: { day: number; left: number }[] = [];
    for (let day = first; day <= last; day++) {
        if (dateOf(day).getDay() === 1) {
            ticks.push({ day, left: percentOf(day, first, last) });
        }
    }
    return ticks;
};

export interface PlacedGoal {
    goal: RoadmapGoal;
    day: number;
    left: number;
    lane: number;
    // Near the right edge the label goes before the diamond
    flip: boolean;
}

// How far apart, in percent of the chart, goals need to be for their labels
// to share a line, and where labels start going before their diamond.
const GOAL_LABEL_SPAN = 16;
const GOAL_FLIP_AT = 84;

export const placeGoals = (
    goals: RoadmapGoal[],
    first: number,
    last: number
): { placed: PlacedGoal[]; lanes: number } => {
    const laneEnds: number[] = [];
    const placed: PlacedGoal[] = [];
    [...goals]
        .sort((a, b) => a.target_date.localeCompare(b.target_date))
        .forEach((goal) => {
            const day = toDay(goal.target_date);
            if (day === null) return;
            const left = dayCenter(day, first, last);
            if (left === null) return;
            let lane = laneEnds.findIndex(
                (end) => left - end >= GOAL_LABEL_SPAN
            );
            if (lane === -1) {
                lane = laneEnds.length;
                laneEnds.push(left);
            } else {
                laneEnds[lane] = left;
            }
            placed.push({
                goal,
                day,
                left,
                lane,
                flip: left > GOAL_FLIP_AT,
            });
        });
    return { placed, lanes: Math.max(laneEnds.length, 1) };
};

export const areaKey = (area: RoadmapArea): string =>
    `area:${area.uid ?? 'none'}`;
export const projectKey = (project: RoadmapProject): string =>
    `project:${project.uid}`;

export type RoadmapRow =
    | { kind: 'area'; key: string; area: RoadmapArea; open: boolean }
    | { kind: 'project'; key: string; project: RoadmapProject; open: boolean }
    | { kind: 'task'; key: string; task: RoadmapTask };

export const buildRows = (
    areas: RoadmapArea[],
    open: Set<string>
): RoadmapRow[] => {
    const rows: RoadmapRow[] = [];
    areas.forEach((area) => {
        const aKey = areaKey(area);
        const areaOpen = open.has(aKey);
        rows.push({ kind: 'area', key: aKey, area, open: areaOpen });
        if (!areaOpen) return;
        area.projects.forEach((project) => {
            const pKey = projectKey(project);
            const projectOpen = open.has(pKey);
            rows.push({
                kind: 'project',
                key: pKey,
                project,
                open: projectOpen,
            });
            if (!projectOpen) return;
            project.tasks.forEach((task) => {
                rows.push({
                    kind: 'task',
                    key: `task:${task.uid}`,
                    task,
                });
            });
        });
    });
    return rows;
};

// Every row that can open, for Expand all.
export const allKeys = (areas: RoadmapArea[]): string[] =>
    areas.flatMap((area) => [areaKey(area), ...area.projects.map(projectKey)]);
