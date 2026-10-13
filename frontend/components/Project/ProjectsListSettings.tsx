import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Cog6ToothIcon } from '@heroicons/react/24/outline';
import ToggleSwitch from '../Shared/ToggleSwitch';

export interface ProjectsListFilters {
    showSomeday: boolean;
    showCompleted: boolean;
}

interface ProjectsListSettingsProps {
    value: ProjectsListFilters;
    onChange: (next: ProjectsListFilters) => void;
}

const ProjectsListSettings: React.FC<ProjectsListSettingsProps> = ({
    value,
    onChange,
}) => {
    const { t } = useTranslation();
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!isOpen) return;
        const handleClickOutside = (event: MouseEvent) => {
            if (
                containerRef.current &&
                !containerRef.current.contains(event.target as Node)
            ) {
                setIsOpen(false);
            }
        };
        const handleEscape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') setIsOpen(false);
        };
        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('keydown', handleEscape);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('keydown', handleEscape);
        };
    }, [isOpen]);

    // Marks the cog when a setting differs from the default.
    const changed = value.showSomeday || value.showCompleted;
    const label = t('projects.listSettings.title', 'Projects settings');

    return (
        <div className="relative" ref={containerRef}>
            <button
                type="button"
                onClick={() => setIsOpen((open) => !open)}
                className="relative p-1.5 sm:p-2 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 focus:outline-none transition-colors"
                aria-label={label}
                aria-expanded={isOpen}
                title={label}
                data-testid="projects-list-settings"
            >
                <Cog6ToothIcon className="h-4 w-4 sm:h-5 sm:w-5" />
                {changed && (
                    <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-blue-500" />
                )}
            </button>
            {isOpen && (
                <div className="absolute right-0 mt-1 w-72 rounded-md shadow-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 z-50 p-4 space-y-4">
                    <ToggleSwitch
                        checked={value.showSomeday}
                        onChange={(checked) =>
                            onChange({ ...value, showSomeday: checked })
                        }
                        label={t(
                            'projects.listSettings.showSomeday',
                            'Show someday projects'
                        )}
                        description={t(
                            'projects.listSettings.showSomedayHint',
                            'Projects tagged #someday.'
                        )}
                    />
                    <ToggleSwitch
                        checked={value.showCompleted}
                        onChange={(checked) =>
                            onChange({ ...value, showCompleted: checked })
                        }
                        label={t(
                            'projects.listSettings.showCompleted',
                            'Show completed projects'
                        )}
                    />
                </div>
            )}
        </div>
    );
};

export default ProjectsListSettings;
