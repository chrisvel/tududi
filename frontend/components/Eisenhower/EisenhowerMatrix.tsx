import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDownIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import { useStore } from '../../store/useStore';
import { getApiPath } from '../../config/paths';
import { Task } from '../../entities/Task';
import { Project } from '../../entities/Project';
import TaskItem from '../Task/TaskItem';
import { getCsrfToken } from '../../utils/csrfService';

const URGENT_TAG = 'urgent';

const isUrgent = (task: Task) =>
    task.tags?.some((tag) => tag.name.toLowerCase() === URGENT_TAG) ?? false;

const isImportant = (task: Task) =>
    (typeof task.priority === 'number' ? task.priority : 0) >= 1;

interface Quadrant {
    key: string;
    tasks: Task[];
}

const QUADRANT_AXES: Record<string, { important: boolean; urgent: boolean }> = {
    do_now:   { important: true,  urgent: true  },
    schedule: { important: true,  urgent: false },
    delegate: { important: false, urgent: true  },
    eliminate:{ important: false, urgent: false },
};

const EisenhowerMatrix: React.FC = () => {
    const { t } = useTranslation();
    const projects: Project[] = useStore((state: any) => state.projectsStore.projects);

    const [tasks, setTasks] = useState<Task[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

    const [draggingTaskId, setDraggingTaskId] = useState<number | null>(null);
    const [dragOverQuadrant, setDragOverQuadrant] = useState<string | null>(null);
    // Counter per quadrant to handle dragLeave bubbling from child elements
    const dragEnterCounters = useRef<Record<string, number>>({});

    useEffect(() => {
        const fetchTasks = async () => {
            setLoading(true);
            setError(null);
            try {
                const res = await fetch(
                    getApiPath('tasks?client_side_filtering=true&status=active&limit=10000&offset=0')
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

    const quadrants: Quadrant[] = useMemo(() => {
        const active = tasks.filter((t) => {
            const done =
                t.status === 'done' || t.status === 'archived' ||
                t.status === 2 || t.status === 3;
            return !done;
        });
        return [
            { key: 'do_now',    tasks: active.filter((t) => isImportant(t) && isUrgent(t)) },
            { key: 'schedule',  tasks: active.filter((t) => isImportant(t) && !isUrgent(t)) },
            { key: 'delegate',  tasks: active.filter((t) => !isImportant(t) && isUrgent(t)) },
            { key: 'eliminate', tasks: active.filter((t) => !isImportant(t) && !isUrgent(t)) },
        ];
    }, [tasks]);

    const toggleCollapsed = (key: string) => {
        setCollapsed((prev) => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key);
            else next.add(key);
            return next;
        });
    };

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

    const moveTaskToQuadrant = async (task: Task, targetKey: string) => {
        const { important: targetImportant, urgent: targetUrgent } = QUADRANT_AXES[targetKey];

        // Priority: bump to MEDIUM if moving to important and currently LOW; demote to LOW otherwise
        const currentPriority = typeof task.priority === 'number' ? task.priority : 0;
        const newPriority = targetImportant
            ? Math.max(currentPriority, 1)
            : 0;

        // Tags: add or remove the 'urgent' tag
        const otherTags = (task.tags || []).filter((tag) => tag.name.toLowerCase() !== URGENT_TAG);
        const newTags = targetUrgent
            ? [...otherTags, { name: URGENT_TAG }]
            : otherTags;

        const updatedTask: Task = { ...task, priority: newPriority, tags: newTags };

        // Optimistic update so the task moves instantly
        setTasks((prev) => prev.map((t) => (t.id === task.id ? updatedTask : t)));

        await handleTaskUpdate(updatedTask);
    };

    // ── Drag handlers ──────────────────────────────────────────────────────────

    const onDragStart = (e: React.DragEvent, task: Task) => {
        setDraggingTaskId(task.id ?? null);
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', String(task.id));
    };

    const onDragEnd = () => {
        setDraggingTaskId(null);
        setDragOverQuadrant(null);
        dragEnterCounters.current = {};
    };

    const onCellDragEnter = (e: React.DragEvent, key: string) => {
        e.preventDefault();
        dragEnterCounters.current[key] = (dragEnterCounters.current[key] ?? 0) + 1;
        setDragOverQuadrant(key);
    };

    const onCellDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    };

    const onCellDragLeave = (e: React.DragEvent, key: string) => {
        dragEnterCounters.current[key] = (dragEnterCounters.current[key] ?? 1) - 1;
        if (dragEnterCounters.current[key] <= 0) {
            dragEnterCounters.current[key] = 0;
            setDragOverQuadrant((prev) => (prev === key ? null : prev));
        }
    };

    const onCellDrop = async (e: React.DragEvent, targetKey: string) => {
        e.preventDefault();
        dragEnterCounters.current[targetKey] = 0;
        setDragOverQuadrant(null);

        if (draggingTaskId === null) return;
        const task = tasks.find((t) => t.id === draggingTaskId);
        if (!task) return;

        // Find the source quadrant - skip if dropping onto same quadrant
        const sourceKey = quadrants.find((q) => q.tasks.some((t) => t.id === draggingTaskId))?.key;
        if (sourceKey === targetKey) return;

        await moveTaskToQuadrant(task, targetKey);
        setDraggingTaskId(null);
    };

    // ── Config ─────────────────────────────────────────────────────────────────

    const quadrantConfig: Record<string, {
        label: string;
        bgColor: string;
        dragOverBg: string;
        badgeColor: string;
        headerColor: string;
        cellBorder: string;
    }> = {
        do_now: {
            label: t('tasks.eisenhower.doNow', 'Do Now'),
            bgColor: 'bg-red-50 dark:bg-red-900/10',
            dragOverBg: 'bg-red-100 dark:bg-red-900/20',
            badgeColor: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300',
            headerColor: 'text-red-700 dark:text-red-400',
            cellBorder: 'border-r border-b border-gray-200 dark:border-gray-700',
        },
        schedule: {
            label: t('tasks.eisenhower.schedule', 'Schedule'),
            bgColor: 'bg-blue-50 dark:bg-blue-900/10',
            dragOverBg: 'bg-blue-100 dark:bg-blue-900/20',
            badgeColor: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',
            headerColor: 'text-blue-700 dark:text-blue-400',
            cellBorder: 'border-b border-gray-200 dark:border-gray-700',
        },
        delegate: {
            label: t('tasks.eisenhower.delegate', 'Delegate'),
            bgColor: 'bg-yellow-50 dark:bg-yellow-900/10',
            dragOverBg: 'bg-yellow-100 dark:bg-yellow-900/20',
            badgeColor: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300',
            headerColor: 'text-yellow-700 dark:text-yellow-400',
            cellBorder: 'border-r border-gray-200 dark:border-gray-700',
        },
        eliminate: {
            label: t('tasks.eisenhower.eliminate', 'Eliminate'),
            bgColor: 'bg-gray-50 dark:bg-gray-900/20',
            dragOverBg: 'bg-gray-100 dark:bg-gray-800/40',
            badgeColor: 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400',
            headerColor: 'text-gray-600 dark:text-gray-400',
            cellBorder: '',
        },
    };

    const axisLabelStyle: React.CSSProperties = {
        writingMode: 'vertical-rl',
        transform: 'rotate(180deg)',
        whiteSpace: 'nowrap',
    };

    // ── Cell renderer ──────────────────────────────────────────────────────────

    const renderCell = ({ key, tasks: cellTasks }: Quadrant) => {
        const cfg = quadrantConfig[key];
        const isCollapsed = collapsed.has(key);
        const isDragOver = dragOverQuadrant === key;
        const isDraggingActive = draggingTaskId !== null;

        return (
            <div
                key={key}
                className={`${isDragOver ? cfg.dragOverBg : cfg.bgColor} ${cfg.cellBorder} flex flex-col min-h-0 transition-colors duration-150 relative`}
                onDragEnter={(e) => onCellDragEnter(e, key)}
                onDragOver={onCellDragOver}
                onDragLeave={(e) => onCellDragLeave(e, key)}
                onDrop={(e) => onCellDrop(e, key)}
            >
                {/* Drop target overlay */}
                {isDragOver && (
                    <div className="absolute inset-0 border-2 border-dashed border-gray-400 dark:border-gray-500 rounded-none pointer-events-none z-10" />
                )}

                <button
                    onClick={() => toggleCollapsed(key)}
                    className="flex items-center justify-between px-4 py-3 text-left w-full flex-shrink-0"
                >
                    <div className="flex items-center gap-2">
                        {isCollapsed
                            ? <ChevronRightIcon className="h-4 w-4 text-gray-400 flex-shrink-0" />
                            : <ChevronDownIcon className="h-4 w-4 text-gray-400 flex-shrink-0" />
                        }
                        <span className={`text-sm font-semibold ${cfg.headerColor}`}>
                            {cfg.label}
                        </span>
                    </div>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${cfg.badgeColor}`}>
                        {cellTasks.length}
                    </span>
                </button>

                {!isCollapsed && (
                    <div className="flex-1 overflow-y-auto px-3 pb-4 space-y-1.5 min-h-0">
                        {cellTasks.length === 0 ? (
                            <p className={`text-xs py-4 text-center ${isDraggingActive ? 'text-gray-400 dark:text-gray-500' : 'text-gray-400 dark:text-gray-600'}`}>
                                {isDraggingActive
                                    ? t('tasks.eisenhower.dropHere', 'Drop here')
                                    : t('tasks.noTasksAvailable', 'No tasks available.')}
                            </p>
                        ) : (
                            cellTasks.map((task) => (
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
                                    />
                                </div>
                            ))
                        )}
                    </div>
                )}
            </div>
        );
    };

    // ── Render ─────────────────────────────────────────────────────────────────

    return (
        <div className="w-full h-[calc(100vh-5rem)] flex flex-col px-4 sm:px-6 lg:px-10 pt-6 pb-4">
            {/* Page header */}
            <div className="flex items-center justify-between mb-6 flex-shrink-0">
                <div>
                    <h2 className="text-2xl font-light text-gray-900 dark:text-gray-100">
                        {t('sidebar.eisenhower', 'Eisenhower Matrix')}
                    </h2>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 italic">
                        {t('tasks.eisenhower.urgentHint', "Tag tasks with 'urgent' to mark them as urgent")}
                    </p>
                </div>
            </div>

            {loading && (
                <p className="text-sm text-gray-500 dark:text-gray-400">{t('common.loading', 'Loading...')}</p>
            )}
            {error && (
                <p className="text-sm text-red-500">{error}</p>
            )}

            {!loading && !error && (
                <div className="flex-1 flex flex-col min-h-0">
                    {/* Column axis labels */}
                    <div className="grid grid-cols-[36px_minmax(0,1fr)_minmax(0,1fr)] mb-1 flex-shrink-0">
                        <div />
                        <div className="text-center text-xs font-semibold text-gray-500 dark:text-gray-400 pb-1 tracking-wide uppercase">
                            {t('tasks.eisenhower.urgent', 'Urgent')}
                        </div>
                        <div className="text-center text-xs font-semibold text-gray-500 dark:text-gray-400 pb-1 tracking-wide uppercase">
                            {t('tasks.eisenhower.notUrgent', 'Not Urgent')}
                        </div>
                    </div>

                    {/* Matrix */}
                    <div className="flex-1 grid grid-cols-[36px_minmax(0,1fr)_minmax(0,1fr)] grid-rows-[1fr_1fr] min-h-0 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden shadow-sm">

                        {/* Row 1 axis label */}
                        <div className="flex items-center justify-center bg-white dark:bg-gray-900 border-r border-b border-gray-200 dark:border-gray-700 min-h-0">
                            <span style={axisLabelStyle} className="text-xs font-semibold text-gray-500 dark:text-gray-400 tracking-wide uppercase">
                                {t('tasks.eisenhower.important', 'Important')}
                            </span>
                        </div>

                        {renderCell(quadrants[0])}
                        {renderCell(quadrants[1])}

                        {/* Row 2 axis label */}
                        <div className="flex items-center justify-center bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 min-h-0">
                            <span style={axisLabelStyle} className="text-xs font-semibold text-gray-500 dark:text-gray-400 tracking-wide uppercase">
                                {t('tasks.eisenhower.notImportant', 'Not Important')}
                            </span>
                        </div>

                        {renderCell(quadrants[2])}
                        {renderCell(quadrants[3])}
                    </div>
                </div>
            )}
        </div>
    );
};

export default EisenhowerMatrix;
