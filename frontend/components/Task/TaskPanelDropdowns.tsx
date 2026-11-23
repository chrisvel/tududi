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
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') setIsOpen(false);
        };
        document.addEventListener('mousedown', onPointerDown);
        document.addEventListener('keydown', onKeyDown);
        return () => {
            document.removeEventListener('mousedown', onPointerDown);
            document.removeEventListener('keydown', onKeyDown);
        };
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

export interface PickerOption {
    value: string;
    label: string;
}

interface PickerSharedProps {
    options: PickerOption[];
    emptyLabel: string;
    ariaLabel: string;
    searchPlaceholder: string;
    // Options shown as muted choices, like "No project"
    mutedValues?: string[];
    Icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
    testId?: string;
    searchTestId?: string;
    // 'panel' sits on the white task panel; 'page' on the grey page behind
    // list views, like the notes table filters.
    tone?: 'panel' | 'page';
    // Always show the search box; otherwise it appears once the list is long.
    searchable?: boolean;
}

const PICKER_TRIGGER_TONES = {
    panel: 'bg-gray-100 hover:bg-gray-200/70 dark:bg-gray-900 dark:hover:bg-gray-900/70',
    page: 'bg-white shadow-sm hover:bg-gray-50 dark:bg-gray-900 dark:hover:bg-gray-900/70',
};

interface PickerMenuProps extends PickerSharedProps {
    selectedValues: string[];
    // null is the empty choice at the top of the menu
    onPick: (value: string | null) => void;
    multiple: boolean;
}

// The searchable menu on tasks and in the notes table: a button showing the
// choice, and a list under it with a search box once it is long.
const PickerMenu: React.FC<PickerMenuProps> = ({
    selectedValues,
    onPick,
    multiple,
    options,
    emptyLabel,
    ariaLabel,
    searchPlaceholder,
    mutedValues = [],
    Icon,
    testId,
    searchTestId,
    tone = 'panel',
    searchable = false,
}) => {
    const { isOpen, setIsOpen, position, triggerRef, menuRef } =
        usePortalMenu();
    const [query, setQuery] = useState('');

    useEffect(() => {
        if (!isOpen) setQuery('');
    }, [isOpen]);

    const selected = options.filter((option) =>
        selectedValues.includes(option.value)
    );
    const triggerMuted =
        selected.length === 0 ||
        selected.every((option) => mutedValues.includes(option.value));
    const triggerLabel =
        selected.length === 0
            ? emptyLabel
            : selected.length === 1
              ? selected[0].label
              : `${selected[0].label} +${selected.length - 1}`;
    const needle = query.trim().toLowerCase();
    const choices = options.filter((option) =>
        option.label.toLowerCase().includes(needle)
    );

    const pick = (value: string | null) => {
        onPick(value);
        if (!multiple) setIsOpen(false);
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
                aria-label={ariaLabel}
                data-testid={testId}
                className={`inline-flex w-full items-center justify-between gap-2 rounded-md px-3 py-2 text-sm text-gray-900 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:text-gray-100 ${PICKER_TRIGGER_TONES[tone]}`}
            >
                <span className="flex min-w-0 items-center gap-2">
                    <Icon
                        className={`h-4 w-4 flex-shrink-0 ${
                            triggerMuted
                                ? 'text-gray-400 dark:text-gray-500'
                                : 'text-blue-500 dark:text-blue-400'
                        }`}
                    />
                    <span
                        className={`truncate ${
                            triggerMuted
                                ? 'text-gray-500 dark:text-gray-400'
                                : ''
                        }`}
                    >
                        {triggerLabel}
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
                        {(searchable || options.length > 8) && (
                            <div className="px-2 pb-1 pt-1">
                                <input
                                    autoFocus
                                    value={query}
                                    onChange={(e) => setQuery(e.target.value)}
                                    placeholder={searchPlaceholder}
                                    className="w-full rounded-md bg-gray-100 px-2.5 py-1.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-900 dark:text-gray-100"
                                    data-testid={searchTestId}
                                />
                            </div>
                        )}
                        <div role="listbox" aria-multiselectable={multiple}>
                            <button
                                type="button"
                                role="option"
                                aria-selected={selected.length === 0}
                                onClick={() => pick(null)}
                                className={optionClass(selected.length === 0)}
                            >
                                <Icon className="h-4 w-4 text-gray-300 dark:text-gray-600" />
                                {emptyLabel}
                            </button>
                            {choices.map((option) => {
                                const active = selectedValues.includes(
                                    option.value
                                );
                                return (
                                    <button
                                        key={option.value}
                                        type="button"
                                        role="option"
                                        aria-selected={active}
                                        onClick={() => pick(option.value)}
                                        className={optionClass(active)}
                                    >
                                        <Icon
                                            className={`h-4 w-4 flex-shrink-0 ${
                                                mutedValues.includes(
                                                    option.value
                                                )
                                                    ? 'text-gray-300 dark:text-gray-600'
                                                    : 'text-blue-500 dark:text-blue-400'
                                            }`}
                                        />
                                        <span className="min-w-0 flex-1 truncate">
                                            {option.label}
                                        </span>
                                        {multiple && active && (
                                            <CheckIcon className="h-4 w-4 flex-shrink-0" />
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    </div>,
                    document.body
                )}
        </>
    );
};

interface PickerDropdownProps extends PickerSharedProps {
    value: string | null;
    onChange: (value: string | null) => void;
}

export const PickerDropdown: React.FC<PickerDropdownProps> = ({
    value,
    onChange,
    ...shared
}) => (
    <PickerMenu
        {...shared}
        multiple={false}
        selectedValues={value === null ? [] : [value]}
        onPick={onChange}
    />
);

interface MultiPickerDropdownProps extends PickerSharedProps {
    values: string[];
    onChange: (values: string[]) => void;
}

// The menu stays open so several can be ticked; the empty choice clears them.
export const MultiPickerDropdown: React.FC<MultiPickerDropdownProps> = ({
    values,
    onChange,
    ...shared
}) => (
    <PickerMenu
        {...shared}
        multiple
        selectedValues={values}
        onPick={(value) => {
            if (value === null) {
                onChange([]);
            } else if (values.includes(value)) {
                onChange(values.filter((v) => v !== value));
            } else {
                onChange([...values, value]);
            }
        }}
    />
);

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

    // Finished projects stay out of the list unless the task is already in one
    const options = projects
        .filter(
            (project) =>
                project.id === value ||
                (project.status !== 'done' && project.status !== 'cancelled')
        )
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((project) => ({ value: String(project.id), label: project.name }));

    return (
        <PickerDropdown
            value={value === null ? null : String(value)}
            onChange={(next) => onChange(next === null ? null : Number(next))}
            options={options}
            emptyLabel={t('tasks.noProject', 'No project')}
            ariaLabel={t('forms.project', 'Project')}
            searchPlaceholder={t(
                'projects.searchPlaceholder',
                'Search projects...'
            )}
            Icon={FolderIcon}
            testId="task-project-select"
            searchTestId="task-project-search"
        />
    );
};
