import { handleAuthResponse } from './authUtils';
import { getApiPath } from '../config/paths';

export type RoadmapTaskKind = 'range' | 'due' | 'start';

export interface RoadmapTask {
    uid: string;
    name: string;
    status: number | string;
    start_date: string | null;
    due_date: string | null;
    kind: RoadmapTaskKind;
}

export interface RoadmapProject {
    uid: string;
    name: string;
    status: string;
    start: string | null;
    end: string | null;
    // False when no task has a date and these are the project's own dates
    dated_from_tasks: boolean;
    task_count: number;
    tasks: RoadmapTask[];
}

export interface RoadmapArea {
    // Null for the group of projects without an area
    uid: string | null;
    name: string | null;
    color: string | null;
    start: string | null;
    end: string | null;
    projects: RoadmapProject[];
}

export interface RoadmapGoal {
    uid: string;
    title: string;
    target_date: string;
    status: string;
    area_uid: string | null;
}

export interface RoadmapResponse {
    from: string;
    to: string;
    goals: RoadmapGoal[];
    goals_outside: number;
    areas: RoadmapArea[];
}

export const fetchRoadmap = async (
    from: string,
    days: number,
    areaUid?: string
): Promise<RoadmapResponse> => {
    const params = new URLSearchParams({ from, days: String(days) });
    if (areaUid) params.set('area_uid', areaUid);
    const response = await fetch(getApiPath(`roadmap?${params.toString()}`), {
        credentials: 'include',
        headers: { Accept: 'application/json' },
    });
    await handleAuthResponse(response, 'Failed to load the roadmap.');
    return response.json();
};
