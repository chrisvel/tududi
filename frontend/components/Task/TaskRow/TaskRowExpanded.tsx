import React, {
    useEffect,
    useLayoutEffect,
    useMemo,
    useRef,
    useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { PlusCircleIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { Task, RecurrenceType } from '../../../entities/Task';
import { Project } from '../../../entities/Project';
import { useReducedMotion } from '../../../hooks/useReducedMotion';
import { useStore } from '../../../store/useStore';
import TagInput from '../../Tag/TagInput';
import TaskAttachmentsCard from '../TaskDetails/TaskAttachmentsCard';
import { TaskRowSetters } from './useTaskRowSave';
import TaskRowToolbar, { TaskRowSection } from './TaskRowToolbar';

interface TaskRowExpandedProps {
    task: Task;
    projects: Project[];
    setters: TaskRowSetters;
    // Drives the expand / collapse animation. When it flips to false the panel
    // animates shut and then calls onExited so the parent can unmount it.
    open: boolean;
    onExited: () => void;
    subtasksOpen: boolean;
    onToggleSubtasks: () => void;
    onAddSubtask: (name: string) => void;
    onDelete: (e: React.MouseEvent) => void;
    fullPagePath: string;
}

const RECURRENCE_TYPES: {
    value: RecurrenceType;
    key: string;
    label: string;
}[] = [
    { value: 'none', key: 'recurrence.none', label: 'No repeat' },
    { value: 'daily', key: 'recurrence.daily', label: 'Daily' },
    { value: 'weekly', key: 'recurrence.weekly', label: 'Weekly' },
    { value: 'monthly', key: 'recurrence.monthly', label: 'Monthly' },
];

// The Things-style quick-edit panel that slides open under a task row.
const TaskRowExpanded: React.FC<TaskRowExpandedProps> = ({
    task,
    projects,
    setters,
    open,
    onExited,
    subtasksOpen,
    onToggleSubtasks,
    onAddSubtask,
    onDelete,
    fullPagePath,
}) => {
    const { t } = useTranslation();
    const reducedMotion = useReducedMotion();
    const tagsStore = useStore((s) => s.tagsStore);

    const wrapperRef = useRef<HTMLDivElement>(null);
    const contentRef = useRef<HTMLDivElement>(null);

    const [openSection, setOpenSection] = useState<TaskRowSection | null>(
        subtasksOpen ? 'subtasks' : null
    );
    const [note, setNote] = useState(task.note || '');
    const [projectQuery, setProjectQuery] = useState('');
    const [newSubtask, setNewSubtask] = useState('');
    const [recurrenceType, setRecurrenceType] = useState<RecurrenceType>(
        (task.recurrence_type || 'none') as RecurrenceType
    );
    const [recurrenceInterval, setRecurrenceInterval] = useState(
        task.recurrence_interval || 1
    );

    useEffect(() => {
        setNote(task.note || '');
    }, [task.uid, task.note]);
    useEffect(() => {
        setRecurrenceType((task.recurrence_type || 'none') as RecurrenceType);
        setRecurrenceInterval(task.recurrence_interval || 1);
    }, [task.uid, task.recurrence_type, task.recurrence_interval]);

    const toggleSection = (section: TaskRowSection) => {
        const willOpen = openSection !== section;
        setOpenSection(willOpen ? section : null);
        if (section === 'subtasks' && willOpen && !subtasksOpen) {
            onToggleSubtasks();
        }
        if (section === 'tags' && willOpen) void tagsStore.loadTags();
    };

    // ---- expand / collapse height + fade animation ----
    useLayoutEffect(() => {
        const el = wrapperRef.current;
        const content = contentRef.current;
        if (!el || !content) return;

        if (reducedMotion) {
            if (open) {
                el.style.maxHeight = 'none';
                el.style.opacity = '1';
                el.style.overflow = 'visible';
            } else {
                onExited();
            }
            return;
        }

        const transition = 'max-height 190ms ease, opacity 150ms ease';

        if (open) {
            el.style.overflow = 'hidden';
            el.style.maxHeight = '0px';
            el.style.opacity = '0';
            const raf = requestAnimationFrame(() => {
                el.style.transition = transition;
                el.style.maxHeight = `${content.scrollHeight}px`;
                el.style.opacity = '1';
            });
            const onEnd = (e: TransitionEvent) => {
                if (e.propertyName !== 'max-height') return;
                el.style.maxHeight = 'none';
                el.style.overflow = 'visible';
            };
            el.addEventListener('transitionend', onEnd);
            return () => {
                cancelAnimationFrame(raf);
                el.removeEventListener('transitionend', onEnd);
            };
        }

        // collapse: from current height to 0, then unmount via onExited
        el.style.overflow = 'hidden';
        el.style.maxHeight = `${content.scrollHeight}px`;
        el.style.opacity = '1';
        void el.offsetHeight; // force reflow so the transition takes effect
        const raf = requestAnimationFrame(() => {
            el.style.transition = transition;
            el.style.maxHeight = '0px';
            el.style.opacity = '0';
        });
        const onEnd = (e: TransitionEvent) => {
            if (e.propertyName !== 'max-height') return;
            onExited();
        };
        el.addEventListener('transitionend', onEnd);
        const safety = window.setTimeout(onExited, 400);
        return () => {
            cancelAnimationFrame(raf);
            window.clearTimeout(safety);
            el.removeEventListener('transitionend', onEnd);
        };
    }, [open, reducedMotion, onExited]);

    const commitNote = () => {
        if (note.trim() !== (task.note || '').trim()) {
            void setters.setNote(note);
        }
    };

    const saveRecurrence = (type: RecurrenceType, interval: number) => {
        void setters.setRecurrence({
            recurrence_type: type,
            recurrence_interval: interval || 1,
            recurrence_end_date: null,
            recurrence_weekday: null,
            recurrence_weekdays: null,
            recurrence_month_day: null,
            recurrence_week_of_month: null,
            completion_based: !!task.completion_based,
        });
    };

    const selectedProject = useMemo(
        () =>
            (task.Project as Project | undefined) ||
            projects.find((p) => p.id === task.project_id) ||
            null,
        [task.Project, task.project_id, projects]
    );
    const filteredProjects = useMemo(() => {
        const q = projectQuery.trim().toLowerCase();
        const list = q
            ? projects.filter((p) => p.name.toLowerCase().includes(q))
            : projects;
        return list.slice(0, 30);
    }, [projectQuery, projects]);

    const intervalUnit = (): string => {
        switch (recurrenceType) {
            case 'daily':
                return t('recurrence.days', 'days');
            case 'weekly':
                return t('recurrence.weeks', 'weeks');
            case 'monthly':
                return t('recurrence.months', 'months');
            default:
                return '';
        }
    };

    const sectionBox =
        'mt-2 rounded-md border border-gray-200 dark:border-gray-700 p-2';

    return (
        <div ref={wrapperRef}>
            <div ref={contentRef} className="px-4 pb-3 pt-1">
                <TaskRowToolbar
                    task={task}
                    setters={setters}
                    openSection={openSection}
                    onToggleSection={toggleSection}
                    onDelete={onDelete}
                    fullPagePath={fullPagePath}
                />

                {openSection === 'note' && (
                    <textarea
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        onBlur={commitNote}
                        rows={2}
                        autoFocus
                        placeholder={t(
                            'forms.task.notePlaceholder',
                            'Add a note...'
                        )}
                        className="mt-2 w-full resize-y rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-2 py-1.5 text-sm text-gray-800 dark:text-gray-200 focus:border-blue-500 focus:outline-none focus:ring-0"
                    />
                )}

                {openSection === 'project' && (
                    <div className={sectionBox}>
                        <div className="flex items-center gap-2">
                            <input
                                autoFocus
                                value={projectQuery}
                                onChange={(e) =>
                                    setProjectQuery(e.target.value)
                                }
                                placeholder={t(
                                    'forms.task.projectSearchPlaceholder',
                                    'Search projects...'
                                )}
                                className="flex-1 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none focus:ring-0"
                            />
                            {selectedProject && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        void setters.setProject(null);
                                        setOpenSection(null);
                                    }}
                                    className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-red-600"
                                >
                                    <XMarkIcon className="h-3.5 w-3.5" />
                                    {t('common.clear', 'Clear')}
                                </button>
                            )}
                        </div>
                        <div className="mt-1 max-h-44 overflow-y-auto">
                            {filteredProjects.length === 0 ? (
                                <p className="px-2 py-1.5 text-sm text-gray-400">
                                    {t('projects.noResults', 'No projects')}
                                </p>
                            ) : (
                                filteredProjects.map((p) => (
                                    <button
                                        key={p.id ?? p.uid}
                                        type="button"
                                        onClick={() => {
                                            void setters.setProject(
                                                p.id ?? null
                                            );
                                            setOpenSection(null);
                                        }}
                                        className={`block w-full truncate rounded px-2 py-1.5 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 ${
                                            selectedProject?.id === p.id
                                                ? 'text-blue-600 dark:text-blue-300 font-medium'
                                                : 'text-gray-800 dark:text-gray-200'
                                        }`}
                                    >
                                        {p.name}
                                    </button>
                                ))
                            )}
                        </div>
                    </div>
                )}

                {openSection === 'tags' && (
                    <div className={sectionBox}>
                        <TagInput
                            initialTags={task.tags?.map((tg) => tg.name) || []}
                            availableTags={tagsStore.tags}
                            onTagsChange={(names) =>
                                void setters.setTags(names)
                            }
                            onFocus={() => void tagsStore.loadTags()}
                        />
                    </div>
                )}

                {openSection === 'recurrence' && (
                    <div className={`${sectionBox} space-y-2`}>
                        <div className="flex flex-wrap gap-1">
                            {RECURRENCE_TYPES.map((opt) => (
                                <button
                                    key={opt.value}
                                    type="button"
                                    onClick={() => {
                                        setRecurrenceType(opt.value);
                                        saveRecurrence(
                                            opt.value,
                                            recurrenceInterval
                                        );
                                    }}
                                    className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                                        recurrenceType === opt.value
                                            ? 'bg-blue-600 text-white'
                                            : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600'
                                    }`}
                                >
                                    {t(opt.key, opt.label)}
                                </button>
                            ))}
                        </div>
                        {recurrenceType !== 'none' && (
                            <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                                <span>{t('recurrence.every', 'Every')}</span>
                                <input
                                    type="number"
                                    min={1}
                                    value={recurrenceInterval}
                                    onChange={(e) => {
                                        const n = Math.max(
                                            1,
                                            parseInt(e.target.value, 10) || 1
                                        );
                                        setRecurrenceInterval(n);
                                    }}
                                    onBlur={() =>
                                        saveRecurrence(
                                            recurrenceType,
                                            recurrenceInterval
                                        )
                                    }
                                    className="w-14 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none focus:ring-0"
                                />
                                <span>{intervalUnit()}</span>
                            </div>
                        )}
                        <p className="text-xs text-gray-400 dark:text-gray-500">
                            {t(
                                'recurrence.advancedHint',
                                'For specific weekdays or an end date, open the full task.'
                            )}
                        </p>
                    </div>
                )}

                {openSection === 'subtasks' && (
                    <div className="mt-2 flex items-center gap-2 rounded-md border border-gray-200 dark:border-gray-700 px-2 py-1.5">
                        <PlusCircleIcon className="h-4 w-4 flex-shrink-0 text-gray-400" />
                        <input
                            autoFocus
                            value={newSubtask}
                            onChange={(e) => setNewSubtask(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && newSubtask.trim()) {
                                    e.preventDefault();
                                    onAddSubtask(newSubtask.trim());
                                    setNewSubtask('');
                                }
                            }}
                            placeholder={t(
                                'subtasks.placeholder',
                                'Add a subtask...'
                            )}
                            className="w-full bg-transparent text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-0"
                        />
                    </div>
                )}

                {openSection === 'attachments' && task.uid && (
                    <div className="mt-2">
                        <TaskAttachmentsCard taskUid={task.uid} />
                    </div>
                )}
            </div>
        </div>
    );
};

export default TaskRowExpanded;
