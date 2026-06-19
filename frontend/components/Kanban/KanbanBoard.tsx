import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Cog6ToothIcon } from '@heroicons/react/24/outline';
import { useStore } from '../../store/useStore';
import { getApiPath } from '../../config/paths';
import { Task } from '../../entities/Task';
import { Project } from '../../entities/Project';
import TaskItem from '../Task/TaskItem';
import { getCsrfToken } from '../../utils/csrfService';

const COLUMN_STATUS: Record<string, number> = {
    not_started: 0,
    planned:     6,
    in_progress: 1,
    waiting:     4,
    cancelled:   5,
    done:        2,
    archived:    3,
};

const ALL_COLS = [
    'not_started',
    'planned',
    'in_progress',
    'waiting',
    'cancelled',
    'done',
    'archived',
] as const;
type ColKey = (typeof ALL_COLS)[number];

const DEFAULT_VISIBLE: ColKey[] = ['not_started', 'in_progress', 'waiting', 'done'];
const STORAGE_KEY = 'kanban_visible_columns';

function loadVisibleCols(): ColKey[] {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return DEFAULT_VISIBLE;
        const parsed = JSON.parse(raw) as string[];
        const valid = parsed.filter((c): c is ColKey =>
            (ALL_COLS as readonly string[]).includes(c)
        );
        return valid.length > 0 ? valid : DEFAULT_VISIBLE;
    } catch {
        return DEFAULT_VISIBLE;
    }
}

function saveVisibleCols(cols: ColKey[]) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cols));
}

const getTaskColumn = (task: Task): ColKey | null => {
    const s = task.status;
    if (s === 'not_started' || s === 0) return 'not_started';
    if (s === 'planned' || s === 6) return 'planned';
    if (s === 'in_progress' || s === 1) return 'in_progress';
    if (s === 'waiting' || s === 4) return 'waiting';
    if (s === 'cancelled' || s === 5) return 'cancelled';
    if (s === 'done' || s === 2) return 'done';
    if (s === 'archived' || s === 3) return 'archived';
    return null;
};

const COL_CONFIG: Record<
    ColKey,
    { labelKey: string; labelDefault: string; bg: string; dragOverBg: string; headerBg: string; headerColor: string }
> = {
    not_started: {
        labelKey: 'tasks.kanban.todo',
        labelDefault: 'To Do',
        bg: 'bg-gray-50 dark:bg-gray-900/20',
        dragOverBg: 'bg-gray-100 dark:bg-gray-800/40',
        headerBg: 'bg-gray-100 dark:bg-gray-800/60',
        headerColor: 'text-gray-600 dark:text-gray-400',
    },
    planned: {
        labelKey: 'tasks.kanban.planned',
        labelDefault: 'Planned',
        bg: 'bg-purple-50 dark:bg-purple-900/10',
        dragOverBg: 'bg-purple-100 dark:bg-purple-900/20',
        headerBg: 'bg-purple-100 dark:bg-purple-900/30',
        headerColor: 'text-purple-700 dark:text-purple-400',
    },
    in_progress: {
        labelKey: 'tasks.kanban.inProgress',
        labelDefault: 'In Progress',
        bg: 'bg-blue-50 dark:bg-blue-900/10',
        dragOverBg: 'bg-blue-100 dark:bg-blue-900/20',
        headerBg: 'bg-blue-100 dark:bg-blue-900/30',
        headerColor: 'text-blue-700 dark:text-blue-400',
    },
    waiting: {
        labelKey: 'tasks.kanban.waiting',
        labelDefault: 'Waiting',
        bg: 'bg-yellow-50 dark:bg-yellow-900/10',
        dragOverBg: 'bg-yellow-100 dark:bg-yellow-900/20',
        headerBg: 'bg-yellow-100 dark:bg-yellow-900/30',
        headerColor: 'text-yellow-700 dark:text-yellow-400',
    },
    cancelled: {
        labelKey: 'tasks.kanban.cancelled',
        labelDefault: 'Cancelled',
        bg: 'bg-red-50 dark:bg-red-900/10',
        dragOverBg: 'bg-red-100 dark:bg-red-900/20',
        headerBg: 'bg-red-100 dark:bg-red-900/30',
        headerColor: 'text-red-700 dark:text-red-400',
    },
    done: {
        labelKey: 'tasks.kanban.done',
        labelDefault: 'Done',
        bg: 'bg-green-50 dark:bg-green-900/10',
        dragOverBg: 'bg-green-100 dark:bg-green-900/20',
        headerBg: 'bg-green-100 dark:bg-green-900/30',
        headerColor: 'text-green-700 dark:text-green-400',
    },
    archived: {
        labelKey: 'tasks.kanban.archived',
        labelDefault: 'Archived',
        bg: 'bg-stone-50 dark:bg-stone-900/10',
        dragOverBg: 'bg-stone-100 dark:bg-stone-900/20',
        headerBg: 'bg-stone-100 dark:bg-stone-900/30',
        headerColor: 'text-stone-600 dark:text-stone-400',
    },
};

const KanbanBoard: React.FC = () => {
    const { t } = useTranslation();
    const projects: Project[] = useStore((state: any) => state.projectsStore.projects);

    const [tasks, setTasks] = useState<Task[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [draggingTaskId, setDraggingTaskId] = useState<number | null>(null);
    const [dragOverCol, setDragOverCol] = useState<ColKey | null>(null);
    const dragEnterCounters = useRef<Record<string, number>>({});

    const [visibleCols, setVisibleCols] = useState<ColKey[]>(loadVisibleCols);
    const [settingsOpen, setSettingsOpen] = useState(false);
    const settingsRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const fetchTasks = async () => {
            setLoading(true);
            setError(null);
            try {
                const res = await fetch(
                    getApiPath('tasks?client_side_filtering=true&limit=10000&offset=0')
                );
                if (!res.ok) throw new Error('Failed to fetch tasks');
                const data = await res.json();
                setTasks(data.tasks || []);
            } catch (e) {
                setError((e as Error).message);
            } finally {
                setLoading(false);
            }
        };
        fetchTasks();
    }, []);

    useEffect(() => {
        if (!settingsOpen) return;
        const handleClickOutside = (e: MouseEvent) => {
            if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) {
                setSettingsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [settingsOpen]);

    const toggleCol = (col: ColKey) => {
        setVisibleCols((prev) => {
            const next = prev.includes(col)
                ? prev.filter((c) => c !== col)
                : [...ALL_COLS.filter((c) => prev.includes(c) || c === col)];
            saveVisibleCols(next);
            return next;
        });
    };

    const columns = useMemo(() => {
        const result = {} as Record<ColKey, Task[]>;
        for (const col of ALL_COLS) result[col] = [];

        for (const task of tasks) {
            const col = getTaskColumn(task);
            if (col) result[col].push(task);
        }
        return result;
    }, [tasks]);

    const handleTaskUpdate = async (updatedTask: Task) => {
        try {
            const res = await fetch(getApiPath(`task/${updatedTask.uid}`), {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'x-csrf-token': await getCsrfToken(),
                },
                body: JSON.stringify(updatedTask),
            });
            if (res.ok) {
                const saved = await res.json();
                setTasks((prev) =>
                    prev.map((t) => (t.id === updatedTask.id ? { ...t, ...saved } : t))
                );
            }
        } catch (e) {
            console.error('Error updating task:', e);
        }
    };

    const handleTaskCompletionToggle = (updatedTask: Task) => {
        setTasks((prev) =>
            prev.map((t) => (t.id === updatedTask.id ? updatedTask : t))
        );
    };

    const handleTaskDelete = async (taskUid: string) => {
        try {
            const res = await fetch(getApiPath(`task/${encodeURIComponent(taskUid)}`), {
                method: 'DELETE',
                headers: { 'x-csrf-token': await getCsrfToken() },
            });
            if (res.ok) {
                setTasks((prev) => prev.filter((t) => t.uid !== taskUid));
            }
        } catch (e) {
            console.error('Error deleting task:', e);
        }
    };

    const moveTaskToCol = async (task: Task, targetCol: ColKey) => {
        const newStatus = COLUMN_STATUS[targetCol];
        const updatedTask: Task = { ...task, status: newStatus };
        setTasks((prev) => prev.map((t) => (t.id === task.id ? updatedTask : t)));
        await handleTaskUpdate(updatedTask);
    };

    const onDragStart = (e: React.DragEvent, task: Task) => {
        setDraggingTaskId(task.id ?? null);
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', String(task.id));
    };

    const onDragEnd = () => {
        setDraggingTaskId(null);
        setDragOverCol(null);
        dragEnterCounters.current = {};
    };

    const onColDragEnter = (e: React.DragEvent, col: ColKey) => {
        e.preventDefault();
        dragEnterCounters.current[col] = (dragEnterCounters.current[col] ?? 0) + 1;
        setDragOverCol(col);
    };

    const onColDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    };

    const onColDragLeave = (e: React.DragEvent, col: ColKey) => {
        dragEnterCounters.current[col] = (dragEnterCounters.current[col] ?? 1) - 1;
        if (dragEnterCounters.current[col] <= 0) {
            dragEnterCounters.current[col] = 0;
            setDragOverCol((prev) => (prev === col ? null : prev));
        }
    };

    const onColDrop = async (e: React.DragEvent, col: ColKey) => {
        e.preventDefault();
        dragEnterCounters.current[col] = 0;
        setDragOverCol(null);

        if (draggingTaskId === null) return;
        const task = tasks.find((t) => t.id === draggingTaskId);
        if (!task) return;

        if (getTaskColumn(task) === col) return;

        await moveTaskToCol(task, col);
        setDraggingTaskId(null);
    };

    const activeCols = ALL_COLS.filter((c) => visibleCols.includes(c));

    return (
        <div className="w-full h-[calc(100vh-5rem)] flex flex-col pt-6 pb-4">
            <div className="flex items-center justify-between mb-6 flex-shrink-0 px-4 sm:px-6">
                <h2 className="text-2xl font-light text-gray-900 dark:text-gray-100">
                    {t('sidebar.kanban', 'Kanban Board')}
                </h2>

                <div className="relative" ref={settingsRef}>
                    <button
                        onClick={() => setSettingsOpen((o) => !o)}
                        className="p-1.5 rounded-lg text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                        title={t('tasks.kanban.customizeColumns', 'Customize columns')}
                    >
                        <Cog6ToothIcon className="w-5 h-5" />
                    </button>

                    {settingsOpen && (
                        <div className="absolute right-0 top-full mt-1 z-50 w-52 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-lg py-1">
                            <p className="px-3 pt-2 pb-1 text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
                                {t('tasks.kanban.columns', 'Columns')}
                            </p>
                            {ALL_COLS.map((col) => {
                                const cfg = COL_CONFIG[col];
                                const checked = visibleCols.includes(col);
                                return (
                                    <label
                                        key={col}
                                        className="flex items-center gap-2.5 px-3 py-1.5 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 select-none"
                                    >
                                        <input
                                            type="checkbox"
                                            checked={checked}
                                            onChange={() => toggleCol(col)}
                                            className="w-3.5 h-3.5 rounded accent-gray-600"
                                        />
                                        <span className={`text-sm font-medium ${cfg.headerColor}`}>
                                            {t(cfg.labelKey, cfg.labelDefault)}
                                        </span>
                                    </label>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            {loading && (
                <p className="text-sm text-gray-500 dark:text-gray-400">{t('common.loading', 'Loading...')}</p>
            )}
            {error && (
                <p className="text-sm text-red-500">{error}</p>
            )}

            {!loading && !error && (
                <div className="flex-1 flex min-h-0 overflow-auto px-4 sm:px-6 gap-3">
                    {activeCols.map((col) => {
                        const cfg = COL_CONFIG[col];
                        const isDragOver = dragOverCol === col;
                        const isDraggingActive = draggingTaskId !== null;
                        const colTasks = columns[col];

                        return (
                            <div
                                key={col}
                                className={`relative flex flex-col flex-1 min-w-[200px] rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden transition-colors duration-150 ${isDragOver ? cfg.dragOverBg : cfg.bg}`}
                                onDragEnter={(e) => onColDragEnter(e, col)}
                                onDragOver={onColDragOver}
                                onDragLeave={(e) => onColDragLeave(e, col)}
                                onDrop={(e) => onColDrop(e, col)}
                            >
                                {isDragOver && (
                                    <div className="absolute inset-0 border-2 border-dashed border-gray-400 dark:border-gray-500 pointer-events-none z-10 rounded-xl" />
                                )}

                                <div className={`px-3 py-2 flex items-center justify-between flex-shrink-0 ${cfg.headerBg}`}>
                                    <span className={`text-xs font-semibold tracking-wide uppercase ${cfg.headerColor}`}>
                                        {t(cfg.labelKey, cfg.labelDefault)}
                                    </span>
                                    <span className={`text-xs font-medium ${cfg.headerColor} opacity-70`}>
                                        {colTasks.length}
                                    </span>
                                </div>

                                <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
                                    {colTasks.length === 0 ? (
                                        <p className={`text-xs py-3 text-center ${isDraggingActive ? 'text-gray-400 dark:text-gray-500' : 'text-gray-300 dark:text-gray-600'}`}>
                                            {isDraggingActive
                                                ? t('tasks.kanban.dropHere', 'Drop here')
                                                : '—'}
                                        </p>
                                    ) : (
                                        colTasks.map((task) => (
                                            <div
                                                key={task.id}
                                                draggable
                                                onDragStart={(e) => onDragStart(e, task)}
                                                onDragEnd={onDragEnd}
                                                className={`relative hover:z-[10000] focus-within:z-[10000] cursor-grab active:cursor-grabbing transition-opacity duration-150 ${draggingTaskId === task.id ? 'opacity-40' : 'opacity-100'}`}
                                            >
                                                <TaskItem
                                                    task={task}
                                                    onTaskUpdate={handleTaskUpdate}
                                                    onTaskCompletionToggle={handleTaskCompletionToggle}
                                                    onTaskDelete={handleTaskDelete}
                                                    projects={projects}
                                                    hideProjectName={false}
                                                    onToggleToday={undefined}
                                                    hideStatusControl={true}
                                                    isKanbanView={true}
                                                />
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default KanbanBoard;
