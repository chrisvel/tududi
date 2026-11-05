import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import {
    CalendarIcon,
    CheckIcon,
    ChevronDownIcon,
    ClockIcon,
    PauseCircleIcon,
    PlayIcon,
    XCircleIcon,
} from '@heroicons/react/24/outline';
import { FolderIcon } from '@heroicons/react/24/solid';
import { TASK_STATUS, getStatusString } from '../../constants/taskStatus';
import { getStatusButtonColorClasses } from './statusStyles';

// Menus portal to the body above the side panel (z-[60]). They carry
// data-portal-menu so the panel knows a menu is open: Escape and a click
// outside then close the menu, not the panel.
const usePortalMenu = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [position, setPosition] = useState({ top: 0, left: 0, width: 0 });
    const triggerRef = useRef<HTMLButtonElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);

    useLayoutEffect(() => {
        if (!isOpen || !triggerRef.current) return;
        const rect = triggerRef.current.getBoundingClientRect();
        const menuHeight = menuRef.current?.offsetHeight ?? 240;
        const openUpward =
            window.innerHeight - rect.bottom < menuHeight + 8 &&
            rect.top > menuHeight + 8;
        setPosition({
            top: openUpward ? rect.top - menuHeight - 4 : rect.bottom + 4,
            left: rect.left,
            width: rect.width,
        });
    }, [isOpen]);

    useEffect(() => {
        if (!isOpen) return;
        const onPointerDown = (event: MouseEvent) => {
            const target = event.target as Node;
            if (
                triggerRef.current?.contains(target) ||
                menuRef.current?.contains(target)
            ) {
                return;
            }
            setIsOpen(false);
        };
        document.addEventListener('mousedown', onPointerDown);
        return () => document.removeEventListener('mousedown', onPointerDown);
    }, [isOpen]);

    return { isOpen, setIsOpen, position, triggerRef, menuRef };
};

const menuClass =
    'fixed z-[10050] max-h-64 overflow-y-auto rounded-lg bg-white py-1 shadow-lg ring-1 ring-black/5 dark:bg-gray-800 dark:ring-white/10';

type StatusOption = {
    value: number;
    label: string;
    Icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
    iconClass: string;
    activeClass: string;
};

interface TaskStatusDropdownProps {
    value: number;
    onChange: (value: number) => void;
}

export const TaskStatusDropdown: React.FC<TaskStatusDropdownProps> = ({
    value,
    onChange,
}) => {
    const { t } = useTranslation();
    const { isOpen, setIsOpen, position, triggerRef, menuRef } =
        usePortalMenu();

    // Same icons and colors as the status control on task rows
    const options: StatusOption[] = [
        {
            value: TASK_STATUS.NOT_STARTED,
            label: t('task.status.notStarted', 'Not started'),
            Icon: PauseCircleIcon,
            iconClass: 'text-gray-500 dark:text-gray-400',
            activeClass:
                'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100',
        },
        {
            value: TASK_STATUS.PLANNED,
            label: t('task.status.planned', 'Planned'),
            Icon: CalendarIcon,
            iconClass: 'text-purple-500 dark:text-purple-400',
            activeClass:
                'bg-purple-50 dark:bg-purple-900/30 text-purple-900 dark:text-purple-100',
        },
        {
            value: TASK_STATUS.IN_PROGRESS,
            label: t('task.status.inProgress', 'In progress'),
            Icon: PlayIcon,
            iconClass: 'text-blue-500 dark:text-blue-400',
            activeClass:
                'bg-blue-50 dark:bg-blue-900/30 text-blue-900 dark:text-blue-100',
        },
        {
            value: TASK_STATUS.WAITING,
            label: t('task.status.waiting', 'Waiting'),
            Icon: ClockIcon,
            iconClass: 'text-yellow-500 dark:text-yellow-400',
            activeClass:
                'bg-yellow-50 dark:bg-yellow-900/30 text-yellow-900 dark:text-yellow-100',
        },
        {
            value: TASK_STATUS.DONE,
            label: t('tasks.done', 'Done'),
            Icon: CheckIcon,
            iconClass: 'text-green-500 dark:text-green-400',
            activeClass:
                'bg-green-50 dark:bg-green-900/30 text-green-900 dark:text-green-100',
        },
        {
            value: TASK_STATUS.CANCELLED,
            label: t('task.status.cancelled', 'Cancelled'),
            Icon: XCircleIcon,
            iconClass: 'text-red-500 dark:text-red-400',
            activeClass:
                'bg-red-50 dark:bg-red-900/30 text-red-900 dark:text-red-100',
        },
    ];

    const selected =
        options.find((option) => option.value === value) ?? options[0];
    const SelectedIcon = selected.Icon;

    return (
        <>
            <button
                ref={triggerRef}
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                aria-haspopup="listbox"
                aria-expanded={isOpen}
                aria-label={t('common.status', 'Status')}
                data-testid="task-status-select"
                data-status={getStatusString(value)}
                className={`inline-flex w-full items-center justify-between gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${getStatusButtonColorClasses(
                    value
                )}`}
            >
                <span className="flex items-center gap-2">
                    <SelectedIcon className="h-4 w-4" />
                    {selected.label}
                </span>
                <ChevronDownIcon className="h-4 w-4 opacity-70" />
            </button>
            {isOpen &&
                createPortal(
                    <div
                        ref={menuRef}
                        data-portal-menu
                        role="listbox"
                        className={menuClass}
                        style={{
                            top: position.top,
                            left: position.left,
                            width: position.width,
                        }}
                    >
                        {options.map((option) => {
                            const active = option.value === value;
                            return (
                                <button
                                    key={option.value}
                                    type="button"
                                    role="option"
                                    aria-selected={active}
                                    onClick={() => {
                                        onChange(option.value);
                                        setIsOpen(false);
                                    }}
                                    data-testid={`task-status-option-${getStatusString(option.value)}`}
                                    className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm ${
                                        active
                                            ? `${option.activeClass} font-semibold`
                                            : 'text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-700/60'
                                    }`}
                                >
                                    <option.Icon
                                        className={`h-4 w-4 ${option.iconClass}`}
                                    />
                                    {option.label}
                                </button>
                            );
                        })}
                    </div>,
                    document.body
                )}
        </>
    );
};

interface PanelProject {
    id: number;
    name: string;
    status?: string | null;
}

interface TaskProjectDropdownProps {
    value: number | null;
    onChange: (value: number | null) => void;
    projects: PanelProject[];
}

export const TaskProjectDropdown: React.FC<TaskProjectDropdownProps> = ({
    value,
    onChange,
    projects,
}) => {
    const { t } = useTranslation();
    const { isOpen, setIsOpen, position, triggerRef, menuRef } =
        usePortalMenu();
    const [query, setQuery] = useState('');

    useEffect(() => {
        if (!isOpen) setQuery('');
    }, [isOpen]);

    const selected = projects.find((project) => project.id === value) ?? null;
    // Finished projects stay out of the list unless the task is already in one
    const choices = projects
        .filter(
            (project) =>
                project.id === value ||
                (project.status !== 'done' && project.status !== 'cancelled')
        )
        .filter((project) =>
            project.name.toLowerCase().includes(query.trim().toLowerCase())
        )
        .sort((a, b) => a.name.localeCompare(b.name));

    const select = (projectId: number | null) => {
        onChange(projectId);
        setIsOpen(false);
    };

    const optionClass = (active: boolean) =>
        `flex w-full items-center gap-2 px-3 py-2 text-left text-sm ${
            active
                ? 'bg-blue-50 font-semibold text-blue-900 dark:bg-blue-900/30 dark:text-blue-100'
                : 'text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-700/60'
        }`;

    return (
        <>
            <button
                ref={triggerRef}
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                aria-haspopup="listbox"
                aria-expanded={isOpen}
                aria-label={t('forms.project', 'Project')}
                data-testid="task-project-select"
                className="inline-flex w-full items-center justify-between gap-2 rounded-md bg-gray-100 px-3 py-2 text-sm text-gray-900 transition-colors hover:bg-gray-200/70 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:bg-gray-900 dark:text-gray-100 dark:hover:bg-gray-900/70"
            >
                <span className="flex min-w-0 items-center gap-2">
                    <FolderIcon
                        className={`h-4 w-4 flex-shrink-0 ${
                            selected
                                ? 'text-blue-500 dark:text-blue-400'
                                : 'text-gray-400 dark:text-gray-500'
                        }`}
                    />
                    <span
                        className={`truncate ${
                            selected ? '' : 'text-gray-500 dark:text-gray-400'
                        }`}
                    >
                        {selected
                            ? selected.name
                            : t('tasks.noProject', 'No project')}
                    </span>
                </span>
                <ChevronDownIcon className="h-4 w-4 flex-shrink-0 text-gray-500 dark:text-gray-400" />
            </button>
            {isOpen &&
                createPortal(
                    <div
                        ref={menuRef}
                        data-portal-menu
                        className={menuClass}
                        style={{
                            top: position.top,
                            left: position.left,
                            width: position.width,
                        }}
                    >
                        {projects.length > 8 && (
                            <div className="px-2 pb-1 pt-1">
                                <input
                                    autoFocus
                                    value={query}
                                    onChange={(e) => setQuery(e.target.value)}
                                    placeholder={t(
                                        'projects.searchPlaceholder',
                                        'Search projects...'
                                    )}
                                    className="w-full rounded-md bg-gray-100 px-2.5 py-1.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-900 dark:text-gray-100"
                                    data-testid="task-project-search"
                                />
                            </div>
                        )}
                        <div role="listbox">
                            <button
                                type="button"
                                role="option"
                                aria-selected={value === null}
                                onClick={() => select(null)}
                                className={optionClass(value === null)}
                            >
                                <FolderIcon className="h-4 w-4 text-gray-300 dark:text-gray-600" />
                                {t('tasks.noProject', 'No project')}
                            </button>
                            {choices.map((project) => (
                                <button
                                    key={project.id}
                                    type="button"
                                    role="option"
                                    aria-selected={project.id === value}
                                    onClick={() => select(project.id)}
                                    className={optionClass(
                                        project.id === value
                                    )}
                                >
                                    <FolderIcon className="h-4 w-4 flex-shrink-0 text-blue-500 dark:text-blue-400" />
                                    <span className="truncate">
                                        {project.name}
                                    </span>
                                </button>
                            ))}
                        </div>
                    </div>,
                    document.body
                )}
        </>
    );
};
