import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useStore } from '../../store/useStore';
import { getApiPath } from '../../config/paths';
import { Task } from '../../entities/Task';
import { Project } from '../../entities/Project';
import TaskItem from '../Task/TaskItem';
import { getCsrfToken } from '../../utils/csrfService';

const COLUMN_STATUS: Record<string, number> = {
    not_started: 0,
    in_progress: 1,
    waiting:     4,
    done:        2,
};

const COLS = ['not_started', 'in_progress', 'waiting', 'done'] as const;
type ColKey = (typeof COLS)[number];

const getTaskColumn = (task: Task): ColKey | null => {
    const s = task.status;
    if (s === 'not_started' || s === 0 || s === 'planned' || s === 6) return 'not_started';
    if (s === 'in_progress' || s === 1) return 'in_progress';
    if (s === 'waiting' || s === 4) return 'waiting';
    if (s === 'done' || s === 2) return 'done';
    return null;
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

    const columns = useMemo(() => {
        const filtered = tasks.filter((t) => {
            const s = t.status;
            return s !== 'archived' && s !== 3 && s !== 'cancelled' && s !== 5;
        });

        const result: Record<ColKey, Task[]> = {
            not_started: [],
            in_progress: [],
            waiting:     [],
            done:        [],
        };

        for (const task of filtered) {
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

    const colConfig: Record<ColKey, { label: string; bg: string; dragOverBg: string; headerBg: string; headerColor: string }> = {
        not_started: {
            label: t('tasks.kanban.todo', 'To Do'),
            bg: 'bg-gray-50 dark:bg-gray-900/20',
            dragOverBg: 'bg-gray-100 dark:bg-gray-800/40',
            headerBg: 'bg-gray-100 dark:bg-gray-800/60',
            headerColor: 'text-gray-600 dark:text-gray-400',
        },
        in_progress: {
            label: t('tasks.kanban.inProgress', 'In Progress'),
            bg: 'bg-blue-50 dark:bg-blue-900/10',
            dragOverBg: 'bg-blue-100 dark:bg-blue-900/20',
            headerBg: 'bg-blue-100 dark:bg-blue-900/30',
            headerColor: 'text-blue-700 dark:text-blue-400',
        },
        waiting: {
            label: t('tasks.kanban.waiting', 'Waiting'),
            bg: 'bg-yellow-50 dark:bg-yellow-900/10',
            dragOverBg: 'bg-yellow-100 dark:bg-yellow-900/20',
            headerBg: 'bg-yellow-100 dark:bg-yellow-900/30',
            headerColor: 'text-yellow-700 dark:text-yellow-400',
        },
        done: {
            label: t('tasks.kanban.done', 'Done'),
            bg: 'bg-green-50 dark:bg-green-900/10',
            dragOverBg: 'bg-green-100 dark:bg-green-900/20',
            headerBg: 'bg-green-100 dark:bg-green-900/30',
            headerColor: 'text-green-700 dark:text-green-400',
        },
    };

    return (
        <div className="w-full h-[calc(100vh-5rem)] flex flex-col pt-6 pb-4">
            <div className="flex items-center justify-between mb-6 flex-shrink-0 px-4 sm:px-6">
                <h2 className="text-2xl font-light text-gray-900 dark:text-gray-100">
                    {t('sidebar.kanban', 'Kanban Board')}
                </h2>
            </div>

            {loading && (
                <p className="text-sm text-gray-500 dark:text-gray-400">{t('common.loading', 'Loading...')}</p>
            )}
            {error && (
                <p className="text-sm text-red-500">{error}</p>
            )}

            {!loading && !error && (
                <div className="flex-1 flex min-h-0 overflow-auto px-4 sm:px-6 gap-3">
                    {COLS.map((col) => {
                        const cfg = colConfig[col];
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

                                {/* Column header */}
                                <div className={`px-3 py-2 flex items-center justify-between flex-shrink-0 ${cfg.headerBg}`}>
                                    <span className={`text-xs font-semibold tracking-wide uppercase ${cfg.headerColor}`}>
                                        {cfg.label}
                                    </span>
                                    <span className={`text-xs font-medium ${cfg.headerColor} opacity-70`}>
                                        {colTasks.length}
                                    </span>
                                </div>

                                {/* Tasks */}
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
