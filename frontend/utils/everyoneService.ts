import { Task } from '../entities/Task';
import { handleAuthResponse } from './authUtils';
import { getApiPath } from '../config/paths';

export interface EveryoneColumn {
    person: {
        uid: string;
        name: string;
        color: string | null;
        relationship_type: string | null;
        linked_user_id: number | null;
    };
    is_self: boolean;
    counts: {
        overdue: number;
        today: number;
        tomorrow: number;
        upcoming: number;
        no_date: number;
    };
    overdue: Task[];
    today: Task[];
    tomorrow: Task[];
    upcoming: Task[];
    no_date: Task[];
}

export interface EveryoneSummary {
    people: number;
    total: number;
    overdue: number;
    today: number;
}

export interface EveryoneResponse {
    columns: EveryoneColumn[];
    summary: EveryoneSummary;
}

export const fetchEveryone = async (): Promise<EveryoneResponse> => {
    const response = await fetch(getApiPath('everyone'), {
        credentials: 'include',
        headers: { Accept: 'application/json' },
    });
    await handleAuthResponse(response, 'Failed to load the dashboard.');
    return response.json();
};

export const EVERYONE_BUCKETS: Array<keyof EveryoneColumn['counts']> = [
    'overdue',
    'today',
    'tomorrow',
    'upcoming',
    'no_date',
];
