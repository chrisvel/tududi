import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getApiPath } from '../../config/paths';
import { Task } from '../../entities/Task';
import { Tag } from '../../entities/Tag';
import { useStore } from '../../store/useStore';

export type BoardScopeKind = 'area' | 'project' | 'tag' | 'priority';

export const BOARD_PRIORITIES = ['high', 'medium', 'low', 'none'] as const;
export type BoardPriority = (typeof BOARD_PRIORITIES)[number];

export interface BoardScope {
    areaUids: string[];
    projectUids: string[];
    // Tag names; a task must carry all of them (as in Focus).
    tags: string[];
    // A task matches any of them.
    priorities: string[];
}

export const EMPTY_SCOPE: BoardScope = {
    areaUids: [],
    projectUids: [],
    tags: [],
    priorities: [],
};

// resolving: being looked up. ready: usable. not_found: unknown, unshared
// or malformed. error: the lookup itself failed.
export type BoardScopeEntryStatus =
    'resolving' | 'ready' | 'not_found' | 'error';

export interface BoardScopeEntry {
    kind: BoardScopeKind;
    // UID for areas and projects, name for tags, key for priorities.
    value: string;
    status: BoardScopeEntryStatus;
    label: string | null;
}

// URL parameter of each filter, in display order.
const PARAMS: Record<BoardScopeKind, string> = {
    area: 'area',
    project: 'project',
    tag: 'tags',
    priority: 'priority',
};
const FIELDS: Record<BoardScopeKind, keyof BoardScope> = {
    area: 'areaUids',
    project: 'projectUids',
    tag: 'tags',
    priority: 'priorities',
};
const KINDS = Object.keys(PARAMS) as BoardScopeKind[];

// UIDs are short alphanumeric strings; anything else cannot match, so it is
// reported as not found instead of being sent to the API.
const UID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;
export const isValidUid = (uid: string) => UID_PATTERN.test(uid);

const isBoardPriority = (value: string): value is BoardPriority =>
    (BOARD_PRIORITIES as readonly string[]).includes(value);

const splitList = (value: string | null): string[] => {
    if (!value) return [];
    const items = value
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
    return Array.from(new Set(items));
};

/**
 * Reads the board filters from the URL, each a comma-separated list:
 * ?area=, ?project= (UIDs), ?tags= (names), ?priority= (high, medium, low,
 * none).
 */
export function parseBoardScope(params: URLSearchParams): BoardScope {
    return {
        areaUids: splitList(params.get('area')),
        projectUids: splitList(params.get('project')),
        tags: splitList(params.get('tags')),
        priorities: splitList(params.get('priority')),
    };
}

/**
 * Query-string fragments for GET /api/tasks, one request per fragment.
 * Picked projects define the board; areas then only narrow the project
 * picker. With no project, each area brings its tasks (its projects'
 * included). Tags narrow every request. `[]` means a scope that matches
 * nothing (only malformed UIDs), so no request is made at all - never an
 * unscoped one.
 */
export function scopeTaskQueries(scope: BoardScope): string[] {
    const { areaUids, projectUids, tags } = scope;
    const tagQuery =
        tags.length > 0 ? `&tags=${encodeURIComponent(tags.join(','))}` : '';
    if (areaUids.length === 0 && projectUids.length === 0) return [tagQuery];
    const [param, uids] =
        projectUids.length > 0
            ? ['project_uid', projectUids]
            : ['area_uid', areaUids];
    return uids
        .filter(isValidUid)
        .map((uid) => `&${param}=${encodeURIComponent(uid)}${tagQuery}`);
}

/** Priority of a task as a filter key; tasks may carry 0-2 or a name. */
export function taskPriority(task: Pick<Task, 'priority'>): BoardPriority {
    const value = task.priority as unknown;
    if (value === 2 || value === 'high') return 'high';
    if (value === 1 || value === 'medium') return 'medium';
    if (value === 0 || value === 'low') return 'low';
    return 'none';
}

/**
 * Fetches the tasks of every query fragment, merges them without
 * duplicates, then keeps the picked priorities. `fetchKey` comes from
 * useBoardScope; `baseQuery` is the board's own query string.
 */
export async function fetchBoardTasks(
    baseQuery: string,
    fetchKey: string
): Promise<Task[]> {
    const { queries, priorities } = JSON.parse(fetchKey) as {
        queries: string[];
        priorities: BoardPriority[];
    };
    const lists = await Promise.all(
        queries.map(async (fragment) => {
            const res = await fetch(
                getApiPath(`tasks?${baseQuery}${fragment}`)
            );
            if (!res.ok) throw new Error('Failed to fetch tasks');
            const data = await res.json();
            return (data.tasks || []) as Task[];
        })
    );
    const seen = new Set<string | number>();
    const merged: Task[] = [];
    for (const task of lists.flat()) {
        const key = task.uid ?? task.id;
        if (key !== undefined && seen.has(key)) continue;
        if (key !== undefined) seen.add(key);
        merged.push(task);
    }
    return priorities.length > 0
        ? merged.filter((task) => priorities.includes(taskPriority(task)))
        : merged;
}

const entryKey = (kind: BoardScopeKind, value: string) => `${kind}:${value}`;

function lookupPath(kind: 'area' | 'project', uid: string): string {
    const encoded = encodeURIComponent(uid);
    return kind === 'project' ? `project/${encoded}` : `areas/${encoded}`;
}

type Resolved = Record<
    string,
    { status: BoardScopeEntryStatus; label: string | null }
>;

const NO_TAGS: Tag[] = [];

/**
 * URL-driven filters shared by the Kanban and Eisenhower boards. Kept
 * independent of the account-wide Focus on purpose, so a bookmarked board
 * shows the same tasks to whoever opens it.
 */
export function useBoardScope() {
    const [searchParams, setSearchParams] = useSearchParams();
    const raw = KINDS.map((kind) => searchParams.get(PARAMS[kind]) ?? '');
    const rawKey = raw.join('\n');

    // Stable per URL value, so effects keyed on it only rerun on change.
    const scope = useMemo(
        () =>
            parseBoardScope(
                new URLSearchParams(
                    KINDS.map((kind, i) => [PARAMS[kind], raw[i]])
                )
            ),
        [rawKey]
    );

    // Tags are checked against the viewer's own tags, loaded once.
    const tags: Tag[] = useStore(
        (state: any) => state.tagsStore?.tags ?? NO_TAGS
    );
    const tagsLoaded: boolean = useStore(
        (state: any) => state.tagsStore?.hasLoaded ?? false
    );
    const loadTags = useStore((state: any) => state.tagsStore?.loadTags);
    useEffect(() => {
        if (scope.tags.length > 0 && !tagsLoaded && loadTags) loadTags();
    }, [scope.tags.length, tagsLoaded, loadTags]);

    // Area and project lookups are kept across scope changes: toggling one
    // back on does not ask the server again.
    const [resolved, setResolved] = useState<Resolved>({});

    useEffect(() => {
        const pending = (['area', 'project'] as const).flatMap((kind) =>
            scope[FIELDS[kind]]
                .filter((uid) => !resolved[entryKey(kind, uid)])
                .map((uid) => ({ kind, uid }))
        );
        if (pending.length === 0) return;

        const update = (key: string, value: Resolved[string]) =>
            setResolved((prev) => ({ ...prev, [key]: value }));

        for (const { kind, uid } of pending) {
            const key = entryKey(kind, uid);
            if (!isValidUid(uid)) {
                update(key, { status: 'not_found', label: null });
                continue;
            }
            update(key, { status: 'resolving', label: null });
            (async () => {
                try {
                    const res = await fetch(getApiPath(lookupPath(kind, uid)), {
                        credentials: 'include',
                        headers: { Accept: 'application/json' },
                    });
                    if (res.status === 403 || res.status === 404) {
                        update(key, { status: 'not_found', label: null });
                        return;
                    }
                    if (!res.ok) throw new Error(`HTTP ${res.status}`);
                    const data = await res.json();
                    update(key, {
                        status: 'ready',
                        label:
                            typeof data?.name === 'string' ? data.name : null,
                    });
                } catch {
                    update(key, { status: 'error', label: null });
                }
            })();
        }
        // `resolved` is read only to skip known entries; adding it to the
        // deps would rerun this effect on every lookup it starts.
    }, [scope]);

    const entries: BoardScopeEntry[] = useMemo(
        () =>
            KINDS.flatMap((kind) =>
                scope[FIELDS[kind]].map((value): BoardScopeEntry => {
                    if (kind === 'tag') {
                        const known = tags.some((tag) => tag.name === value);
                        return {
                            kind,
                            value,
                            label: value,
                            status: known
                                ? 'ready'
                                : tagsLoaded
                                  ? 'not_found'
                                  : 'resolving',
                        };
                    }
                    if (kind === 'priority') {
                        return {
                            kind,
                            value,
                            label: null,
                            status: isBoardPriority(value)
                                ? 'ready'
                                : 'not_found',
                        };
                    }
                    const found = resolved[entryKey(kind, value)];
                    return {
                        kind,
                        value,
                        status: found?.status ?? 'resolving',
                        label: found?.label ?? null,
                    };
                })
            ),
        [scope, resolved, tags, tagsLoaded]
    );

    // Pushes a history entry, so Back returns to the previous filters.
    const setScope = useCallback(
        (next: BoardScope) => {
            setSearchParams((prev) => {
                const params = new URLSearchParams(prev);
                for (const kind of KINDS) {
                    params.delete(PARAMS[kind]);
                    const values = next[FIELDS[kind]];
                    if (values.length > 0) {
                        params.set(PARAMS[kind], values.join(','));
                    }
                }
                return params;
            });
        },
        [setSearchParams]
    );

    // One string for the board's fetch effect: the requests, and the
    // priorities kept afterwards (unknown keys ignored, marked in red).
    const fetchKey = useMemo(
        () =>
            JSON.stringify({
                queries: scopeTaskQueries(scope),
                priorities: scope.priorities.filter(isBoardPriority),
            }),
        [scope]
    );

    return { scope, entries, fetchKey, setScope };
}
