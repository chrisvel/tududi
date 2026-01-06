import React, { useState, useRef, useEffect } from 'react';
import {
    ChevronDownIcon,
    ClipboardDocumentListIcon,
    PlayIcon,
    CheckCircleIcon,
    ClockIcon,
    XCircleIcon,
    EllipsisHorizontalCircleIcon,
} from '@heroicons/react/24/outline';
import { ProjectStatus } from '../../entities/Project';
import { useTranslation } from 'react-i18next';

interface ProjectStateDropdownProps {
    value: ProjectStatus;
    onChange: (value: ProjectStatus) => void;
}

const ProjectStateDropdown: React.FC<ProjectStateDropdownProps> = ({
    value,
    onChange,
}) => {
    const { t } = useTranslation();

    const states = [
        {
            value: 'not_started' as ProjectStatus,
            label: t('projectStatus.not_started', 'Not Started'),
            description: t(
                'projectStatus.not_started_desc',
                'captured but not started yet'
            ),
            icon: (
                <EllipsisHorizontalCircleIcon className="w-5 h-5 text-gray-500" />
            ),
        },
        {
            value: 'planned' as ProjectStatus,
            label: t('projectStatus.planned', 'Planned'),
            description: t(
                'projectStatus.planned_desc',
                'scoped and ready to start'
            ),
            icon: (
                <ClipboardDocumentListIcon className="w-5 h-5 text-blue-500" />
            ),
        },
        {
            value: 'in_progress' as ProjectStatus,
            label: t('projectStatus.in_progress', 'In Progress'),
            description: t(
                'projectStatus.in_progress_desc',
                'active work happening'
            ),
            icon: <PlayIcon className="w-5 h-5 text-green-500" />,
        },
        {
            value: 'waiting' as ProjectStatus,
            label: t('projectStatus.waiting', 'Waiting'),
            description: t(
                'projectStatus.waiting_desc',
                'waiting on external input'
            ),
            icon: <ClockIcon className="w-5 h-5 text-yellow-500" />,
        },
        {
            value: 'done' as ProjectStatus,
            label: t('projectStatus.done', 'Completed'),
            description: t('projectStatus.done_desc', 'finished and done'),
            icon: <CheckCircleIcon className="w-5 h-5 text-green-600" />,
        },
        {
            value: 'cancelled' as ProjectStatus,
            label: t('projectStatus.cancelled', 'Cancelled'),
            description: t(
                'projectStatus.cancelled_desc',
                'will not be completed'
            ),
            icon: <XCircleIcon className="w-5 h-5 text-red-500" />,
        },
    ];

    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    const handleToggle = () => {
        setIsOpen(!isOpen);

        // Scroll dropdown into view when opening to ensure options are visible
        if (!isOpen && dropdownRef.current) {
            setTimeout(() => {
                // Find the dropdown options container
                const dropdownOptions =
                    dropdownRef.current?.querySelector('.absolute.z-10');
                if (dropdownOptions) {
                    dropdownOptions.scrollIntoView({
                        behavior: 'smooth',
                        block: 'nearest',
                        inline: 'nearest',
                    });
                } else {
                    // Fallback to scrolling the dropdown container itself
                    dropdownRef.current?.scrollIntoView({
                        behavior: 'smooth',
                        block: 'nearest',
                        inline: 'nearest',
                    });
                }
            }, 150); // Increased timeout to ensure dropdown is rendered
        }
    };

    const handleClickOutside = (event: MouseEvent) => {
        if (
            dropdownRef.current &&
            !dropdownRef.current.contains(event.target as Node)
        ) {
            setIsOpen(false);
        }
    };

    const handleSelect = (status: ProjectStatus) => {
        onChange(status);
        setIsOpen(false);
    };

    useEffect(() => {
        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);

            // Ensure dropdown is visible after opening
            setTimeout(() => {
                const dropdownOptions =
                    dropdownRef.current?.querySelector('.absolute.z-10');
                if (dropdownOptions) {
                    // Try to scroll the parent modal container to show the dropdown
                    const modalScrollContainer =
                        document.querySelector(
                            '.absolute.inset-0.overflow-y-auto'
                        ) ||
                        document.querySelector('[style*="overflow-y"]') ||
                        document.querySelector('.overflow-y-auto');

                    if (modalScrollContainer) {
                        const rect = dropdownOptions.getBoundingClientRect();
                        const containerRect =
                            modalScrollContainer.getBoundingClientRect();

                        // Check if dropdown is below visible area
                        if (rect.bottom > containerRect.bottom) {
                            modalScrollContainer.scrollTo({
                                top:
                                    modalScrollContainer.scrollTop +
                                    (rect.bottom - containerRect.bottom) +
                                    20,
                                behavior: 'smooth',
                            });
                        }
                    } else {
                        // Fallback to scrollIntoView
                        dropdownOptions.scrollIntoView({
                            behavior: 'smooth',
                            block: 'nearest',
                            inline: 'nearest',
                        });
                    }
                }
            }, 200);
        } else {
            document.removeEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen]);

    const selectedState = states.find((s) => s.value === value);

    return (
        <div
            ref={dropdownRef}
            className="relative inline-block text-left w-full"
        >
            <button
                type="button"
                className="inline-flex justify-between w-full px-3 py-2 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-gray-100 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition duration-150 ease-in-out"
                onClick={handleToggle}
            >
                <span className="flex items-center space-x-2">
                    {selectedState ? (
                        selectedState.icon
                    ) : (
                        <EllipsisHorizontalCircleIcon className="w-5 h-5 text-gray-400" />
                    )}
                    <span>
                        {selectedState
                            ? selectedState.label
                            : t('projects.selectState', 'Select State')}
                    </span>
                </span>
                <ChevronDownIcon className="w-5 h-5 text-gray-500 dark:text-gray-300" />
            </button>

            {isOpen && (
                <div className="absolute z-10 mt-2 w-full bg-white dark:bg-gray-700 shadow-lg rounded-md border border-gray-200 dark:border-gray-600">
                    {states.map((state) => (
                        <button
                            key={state.value}
                            onClick={() => handleSelect(state.value)}
                            className="flex items-center justify-between w-full px-4 py-3 text-sm text-gray-900 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-600 first:rounded-t-md last:rounded-b-md transition duration-150 ease-in-out"
                        >
                            <div className="flex items-center space-x-3">
                                {state.icon}
                                <div className="text-left">
                                    <div className="font-medium">
                                        {state.label}
                                    </div>
                                    <div className="text-xs text-gray-500 dark:text-gray-400">
                                        {state.description}
                                    </div>
                                </div>
                            </div>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};

export default ProjectStateDropdown;
