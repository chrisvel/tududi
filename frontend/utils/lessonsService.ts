// Life-to-Day (T-1103): client for /api/lessons (T-1102) and the task
// effect (T-1101). Days are ISO Gregorian; Jalali is display-only.
import { mutate } from 'swr';
import { getApiPath } from '../config/paths';
import { getPostHeadersWithCsrf, handleAuthResponse } from './authUtils';
import { getCsrfToken } from './csrfService';
import { newClientUid, newIdempotencyKey } from './offlineIdentity';

export type LessonStatus = 'active' | 'parked' | 'retired';
export type LessonLinkType = 'goal' | 'project' | 'area' | 'tag';
export type LessonVerdict = 'holds' | 'not_yet' | 'park';

export interface LessonLink {
    type: LessonLinkType;
    uid: string;
    title?: string;
}

export interface Lesson {
    uid: string;
    title: string;
    expected: string | null;
    happened: string | null;
    if_text: string | null;
    then_text: string | null;
    learned_on: string;
    review_on: string | null;
    status: LessonStatus;
    source_type: 'free' | 'milestone' | 'task' | 'goal' | null;
    source_uid: string | null;
    links: LessonLink[];
}

export type LessonInput = Partial<
    Omit<Lesson, 'uid' | 'links' | 'source_type' | 'source_uid'>
> & { links?: LessonLink[] };

export interface LessonSaved {
    lesson: Lesson;
    warning?: 'three_is_enough';
}

export interface EffectNode {
    uid: string;
    title: string;
    horizon: string;
    why: string | null;
}

export interface TaskEffect {
    task_uid: string;
    kind: 'linked' | 'unlinked';
    chain: EffectNode[];
    fiveYear: EffectNode | null;
    vision: EffectNode | null;
    meaning: string | null;
    outcome: {
        goal_uid: string;
        title: string;
        horizon: string;
        value: number;
    } | null;
    activity: boolean;
    lesson: Pick<
        Lesson,
        'uid' | 'title' | 'if_text' | 'then_text' | 'review_on'
    > | null;
}

export const lessonKeys = {
    effect: (taskUid: string) => `ltd:effect:${taskUid}`,
    list: (goalUid?: string) => `ltd:lessons:${goalUid ?? 'all'}`,
    due: 'ltd:lessons:due',
};

// Any lesson write can change which lesson a task shows.
export const refreshLessons = () =>
    mutate(
        (key) =>
            typeof key === 'string' &&
            (key.startsWith('ltd:lessons') || key.startsWith('ltd:effect')),
        undefined,
        { revalidate: true }
    );

const read = async <T>(path: string): Promise<T> => {
    const response = await fetch(getApiPath(path), {
        credentials: 'include',
        headers: { Accept: 'application/json' },
    });
    await handleAuthResponse(response, 'Failed to load lessons.');
    return response.json();
};

const write = async <T>(
    method: 'POST' | 'PATCH',
    path: string,
    body: unknown,
    headers: Record<string, string> = {}
): Promise<T> => {
    const response = await fetch(getApiPath(path), {
        method,
        credentials: 'include',
        headers: { ...(await getPostHeadersWithCsrf()), ...headers },
        body: JSON.stringify(body),
    });
    await handleAuthResponse(response, 'Failed to save lesson.');
    const result = await response.json();
    void refreshLessons();
    return result;
};

export const fetchTaskEffect = (taskUid: string) =>
    read<TaskEffect>(
        `lessons/effect?task_uid=${encodeURIComponent(taskUid)}`
    );

export const fetchLessons = async (goalUid?: string): Promise<Lesson[]> =>
    (
        await read<{ lessons: Lesson[] }>(
            goalUid
                ? `lessons?goal_uid=${encodeURIComponent(goalUid)}`
                : 'lessons'
        )
    ).lessons;

export const fetchDueLesson = async (): Promise<Lesson | null> =>
    (await read<{ lesson: Lesson | null }>('lessons/due')).lesson;

// A stable uid and key make a retried create return the first lesson.
export const createLesson = (data: LessonInput) =>
    write<LessonSaved>(
        'POST',
        'lessons',
        { ...data, uid: newClientUid() },
        { 'Idempotency-Key': newIdempotencyKey() }
    );

export const updateLesson = (uid: string, data: LessonInput) =>
    write<LessonSaved>('PATCH', `lessons/${uid}`, data);

export const reviewLesson = (uid: string, verdict: LessonVerdict) =>
    write<{ lesson: Lesson; journal_uid: string }>(
        'POST',
        `lessons/${uid}/checks`,
        { verdict }
    );

export const deleteLesson = async (
    uid: string
): Promise<{ journal_uid: string }> => {
    const response = await fetch(getApiPath(`lessons/${uid}`), {
        method: 'DELETE',
        credentials: 'include',
        headers: {
            Accept: 'application/json',
            'x-csrf-token': await getCsrfToken(),
        },
    });
    await handleAuthResponse(response, 'Failed to delete lesson.');
    const result = await response.json();
    void refreshLessons();
    return result;
};
