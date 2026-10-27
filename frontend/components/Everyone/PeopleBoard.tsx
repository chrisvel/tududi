import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { UsersIcon } from '@heroicons/react/24/outline';
import {
    DndContext,
    DragEndEvent,
    DragOverlay,
    DragStartEvent,
    useDroppable,
} from '@dnd-kit/core';
import { Task } from '../../entities/Task';
import {
    EveryoneColumn,
    EveryoneSummary,
    EveryoneResponse,
    EVERYONE_BUCKETS,
} from '../../utils/everyoneService';
import { updateTask } from '../../utils/tasksService';
import BoardTaskRow from './BoardTaskRow';
import { isTaskCompleted } from '../../constants/taskStatus';
import { useToast } from '../Shared/ToastContext';
import {
    resetSortableCursor,
    sortableCursorHandlers,
    swallowNextClick,
    useSortableSensors,
} from '../Shared/sortableList';

type Bucket = keyof EveryoneColumn['counts'];

const BUCKET_META: Record<
    Bucket,
    { key: string; fallback: string; tone: string }
> = {
    overdue: {
        key: 'everyone.overdue',
        fallback: 'Overdue',
        tone: 'text-red-600 dark:text-red-400',
    },
    today: {
        key: 'everyone.today',
        fallback: 'Today',
        tone: 'text-blue-600 dark:text-blue-400',
    },
    tomorrow: {
        key: 'everyone.tomorrow',
        fallback: 'Tomorrow',
        tone: 'text-gray-600 dark:text-gray-300',
    },
    upcoming: {
        key: 'everyone.upcoming',
        fallback: 'This week',
        tone: 'text-gray-500 dark:text-gray-400',
    },
    no_date: {
        key: 'everyone.noDate',
        fallback: 'No date',
        tone: 'text-gray-400 dark:text-gray-500',
    },
};

// People without a colour of their own get one from this set, in column
// order and skipping colours already taken, so no two columns look alike.
const PERSON_PALETTE = [
    '#6366f1',
    '#10b981',
    '#f59e0b',
    '#0ea5e9',
    '#f43f5e',
    '#14b8a6',
    '#d946ef',
    '#f97316',
    '#8b5cf6',
    '#84cc16',
];

export const columnColors = (
    columns: { person: { uid: string; color: string | null } }[]
): Record<string, string> => {
    const taken = new Set(
        columns
            .map((c) => c.person.color?.toLowerCase())
            .filter(Boolean) as string[]
    );
    const free = PERSON_PALETTE.filter((c) => !taken.has(c));
    const pool = free.length > 0 ? free : PERSON_PALETTE;
    let next = 0;
    const out: Record<string, string> = {};
    for (const col of columns) {
        out[col.person.uid] = col.person.color || pool[next++ % pool.length];
    }
    return out;
};

const initials = (name: string): string => {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return '?';
    const first = parts[0][0];
    const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
    return (first + last).toUpperCase();
};

export const PersonAvatar: React.FC<{ name: string; color: string }> = ({
    name,
    color,
}) => (
    <span
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold text-white"
        style={{ backgroundColor: color }}
        aria-hidden="true"
    >
        {initials(name)}
    </span>
);

const Stat: React.FC<{ value: number; label: string; tone?: string }> = ({
    value,
    label,
    tone,
}) => (
    <span className="inline-flex items-baseline gap-1.5">
        <span
            className={`font-semibold tabular-nums ${
                tone || 'text-gray-900 dark:text-gray-100'
            }`}
        >
            {value}
        </span>
        <span className="text-gray-500 dark:text-gray-400">{label}</span>
    </span>
);

interface PersonColumnProps {
    col: EveryoneColumn;
    color: string;
    onTaskUpdate: (task: Task) => void;
}

// One person's card. The whole card is a drop target: a task dropped here
// is assigned to this person.
const PersonColumn: React.FC<PersonColumnProps> = ({
    col,
    color,
    onTaskUpdate,
}) => {
    const { t } = useTranslation();
    const { setNodeRef, isOver, active } = useDroppable({
        id: `person-${col.person.uid}`,
        data: { personUid: col.person.uid },
    });
    const dragFromElsewhere =
        !!active && active.data.current?.personUid !== col.person.uid;

    const total = EVERYONE_BUCKETS.reduce(
        (n, b) => n + (col[b] as Task[]).length,
        0
    );
    const activeBuckets = EVERYONE_BUCKETS.filter(
        (b) => (col[b] as Task[]).length > 0
    );

    return (
        <section
            ref={setNodeRef}
            data-testid={`person-column-${col.person.uid}`}
            className="relative flex flex-col flex-1 max-h-full min-w-[16rem] max-w-[22rem] shrink-0 overflow-hidden rounded-xl bg-white transition-colors dark:bg-gray-900/60"
            style={
                isOver && dragFromElsewhere
                    ? { backgroundColor: `${color}1f` }
                    : undefined
            }
        >
            <div className="h-1 shrink-0" style={{ backgroundColor: color }} />
            <div className="shrink-0 flex items-center gap-2.5 px-3 pt-3 pb-2">
                <PersonAvatar name={col.person.name} color={color} />
                <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-gray-900 dark:text-gray-100">
                        {col.is_self
                            ? t('everyone.you', 'You')
                            : col.person.name}
                    </div>
                    {col.is_self && (
                        <div className="truncate text-xs text-gray-400 dark:text-gray-500">
                            {col.person.name}
                        </div>
                    )}
                </div>
                <span className="ml-auto text-xs tabular-nums text-gray-400 dark:text-gray-500">
                    {total}
                </span>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto px-1 pb-2 space-y-3">
                {activeBuckets.length === 0 ? (
                    <p className="text-xs text-gray-400 dark:text-gray-500 px-2.5 py-2">
                        {dragFromElsewhere
                            ? t('everyone.dropHere', 'Drop to assign')
                            : t('everyone.nothing', 'Nothing right now')}
                    </p>
                ) : (
                    activeBuckets.map((b) => {
                        const meta = BUCKET_META[b];
                        const tasks = col[b] as Task[];
                        return (
                            <div key={b}>
                                <div className="flex items-center gap-1.5 px-2.5 pt-1 pb-0.5">
                                    <span
                                        className={`text-[11px] font-medium uppercase tracking-wide ${meta.tone}`}
                                    >
                                        {t(meta.key, meta.fallback)}
                                    </span>
                                    <span className="text-[11px] tabular-nums text-gray-400 dark:text-gray-500">
                                        {tasks.length}
                                    </span>
                                </div>
                                <ul>
                                    {tasks.map((task) => (
                                        <BoardTaskRow
                                            key={task.uid}
                                            task={task}
                                            personUid={col.person.uid}
                                            overdue={b === 'overdue'}
                                            onTaskUpdate={onTaskUpdate}
                                        />
                                    ))}
                                </ul>
                            </div>
                        );
                    })
                )}
            </div>
        </section>
    );
};

export interface PeopleBoardProps<T extends EveryoneResponse> {
    fetchBoard: () => Promise<T>;
    testId: string;
    heading: (data: T | null) => { title: string; subtitle?: string };
    emptyMessage: string;
    headerExtra?: React.ReactNode;
}

function PeopleBoard<T extends EveryoneResponse>({
    fetchBoard,
    testId,
    heading,
    emptyMessage,
    headerExtra,
}: PeopleBoardProps<T>) {
    const { t } = useTranslation();
    const [columns, setColumns] = useState<EveryoneColumn[] | null>(null);
    const [summary, setSummary] = useState<EveryoneSummary | null>(null);
    const [data, setData] = useState<T | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [dragging, setDragging] = useState<Task | null>(null);
    const { showErrorToast } = useToast();
    const sensors = useSortableSensors();
    const colors = useMemo(() => columnColors(columns ?? []), [columns]);

    const load = useCallback(async () => {
        try {
            const next = await fetchBoard();
            setData(next);
            setColumns(next.columns);
            setSummary(next.summary ?? null);
        } catch (e: any) {
            setError(e?.message || 'Failed to load the dashboard.');
        }
    }, [fetchBoard]);

    useEffect(() => {
        load();
    }, [load]);

    const removeLocally = useCallback((taskUid: string) => {
        setColumns((prev) =>
            prev
                ? prev.map((col) => {
                      const next = { ...col };
                      for (const b of EVERYONE_BUCKETS) {
                          next[b] = (col[b] as Task[]).filter(
                              (x) => x.uid !== taskUid
                          );
                      }
                      return next;
                  })
                : prev
        );
    }, []);

    // Rows are the shared task rows: a done or deleted task leaves the board
    // at once, then the board is re-read for the new buckets.
    const handleTaskUpdate = useCallback(
        async (updated: Task) => {
            if (!updated.uid) return;
            if (isTaskCompleted(updated.status)) {
                removeLocally(updated.uid);
            } else {
                setColumns((prev) =>
                    prev
                        ? prev.map((col) => {
                              const next = { ...col };
                              for (const b of EVERYONE_BUCKETS) {
                                  next[b] = (col[b] as Task[]).map((x) =>
                                      x.uid === updated.uid ? updated : x
                                  );
                              }
                              return next;
                          })
                        : prev
                );
            }
            load();
        },
        [load, removeLocally]
    );

    // Moves a row to another person's column, keeping its date bucket.
    const moveLocally = useCallback((taskUid: string, toPersonUid: string) => {
        setColumns((prev) => {
            if (!prev) return prev;
            let moved: { task: Task; bucket: Bucket } | null = null;
            const stripped = prev.map((col) => {
                const next = { ...col };
                for (const b of EVERYONE_BUCKETS) {
                    const found = (col[b] as Task[]).find(
                        (x) => x.uid === taskUid
                    );
                    if (found) moved = { task: found, bucket: b };
                    next[b] = (col[b] as Task[]).filter(
                        (x) => x.uid !== taskUid
                    );
                }
                return next;
            });
            if (!moved) return prev;
            const { task, bucket } = moved as { task: Task; bucket: Bucket };
            return stripped.map((col) =>
                col.person.uid === toPersonUid
                    ? {
                          ...col,
                          [bucket]: [...(col[bucket] as Task[]), task],
                      }
                    : col
            );
        });
    }, []);

    const handleDragStart = useCallback((event: DragStartEvent) => {
        sortableCursorHandlers.onDragStart();
        setDragging((event.active.data.current?.task as Task) ?? null);
    }, []);

    const handleDragEnd = useCallback(
        async (event: DragEndEvent) => {
            resetSortableCursor();
            setDragging(null);
            swallowNextClick();
            const task = event.active.data.current?.task as Task | undefined;
            const from = event.active.data.current?.personUid as
                string | undefined;
            const to = event.over?.data.current?.personUid as
                string | undefined;
            if (!task?.uid || !to || to === from) return;

            moveLocally(task.uid, to);
            try {
                await updateTask(task.uid, { assigned_to: to });
            } catch (e: any) {
                showErrorToast(
                    e?.message ||
                        t(
                            'everyone.reassignFailed',
                            'Could not assign this task.'
                        )
                );
            }
            load();
        },
        [load, moveLocally, showErrorToast, t]
    );

    const handleDragCancel = useCallback(() => {
        resetSortableCursor();
        setDragging(null);
    }, []);

    if (error) {
        return (
            <div className="px-4 sm:px-6 py-6">
                <p className="text-sm text-red-600 dark:text-red-400">
                    {error}
                </p>
            </div>
        );
    }

    if (!columns) {
        return (
            <div className="px-4 sm:px-6 py-6">
                <p className="text-sm text-gray-500 dark:text-gray-400">
                    {t('common.loading', 'Loading...')}
                </p>
            </div>
        );
    }

    const anyTasks = columns.some((c) =>
        EVERYONE_BUCKETS.some((b) => (c[b] as Task[]).length > 0)
    );

    const { title, subtitle } = heading(data);

    return (
        <div
            className="h-full flex flex-col overflow-hidden px-4 sm:px-6 lg:px-8"
            data-testid={testId}
        >
            <header className="shrink-0 pt-4 pb-5">
                <div className="flex items-center gap-2">
                    <UsersIcon className="w-5 h-5 text-gray-400 dark:text-gray-500" />
                    <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                        {title}
                    </h1>
                </div>
                {subtitle && (
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                        {subtitle}
                    </p>
                )}
                {(summary || headerExtra) && (
                    <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-2">
                        {summary && (
                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                                <Stat
                                    value={summary.people}
                                    label={t('everyone.people', 'People')}
                                />
                                <Stat
                                    value={summary.total}
                                    label={t('everyone.tasks', 'Tasks')}
                                />
                                <Stat
                                    value={summary.overdue}
                                    label={t('everyone.overdue', 'Overdue')}
                                    tone={
                                        summary.overdue > 0
                                            ? 'text-red-600 dark:text-red-400'
                                            : undefined
                                    }
                                />
                                <Stat
                                    value={summary.today}
                                    label={t('everyone.today', 'Today')}
                                />
                            </div>
                        )}
                        {headerExtra}
                    </div>
                )}
            </header>

            {!anyTasks && (
                <div className="shrink-0 mb-5 bg-white dark:bg-gray-800 rounded-xl p-6 text-sm text-gray-500 dark:text-gray-400">
                    {emptyMessage}
                </div>
            )}

            <DndContext
                sensors={sensors}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
                onDragCancel={handleDragCancel}
            >
                <div className="flex-1 min-h-0 flex items-start gap-4 overflow-x-auto pb-4">
                    {columns.map((col) => (
                        <PersonColumn
                            key={col.person.uid}
                            col={col}
                            color={colors[col.person.uid]}
                            onTaskUpdate={handleTaskUpdate}
                        />
                    ))}
                </div>
                <DragOverlay dropAnimation={null}>
                    {dragging ? (
                        <ul className="w-[18rem]">
                            <BoardTaskRow
                                task={dragging}
                                onTaskUpdate={handleTaskUpdate}
                                overlay
                            />
                        </ul>
                    ) : null}
                </DragOverlay>
            </DndContext>
        </div>
    );
}

export default PeopleBoard;
