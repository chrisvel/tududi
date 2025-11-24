import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Project } from '../../entities/Project';
import { ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/24/outline';

interface ProjectDropdownProps {
    projectName: string;
    onProjectSearch: (query: string) => void;
    dropdownOpen: boolean;
    filteredProjects: Project[];
    onProjectSelection: (project: Project) => void;
    onCreateProject: (name: string) => void | Promise<void>;
    isCreatingProject: boolean;
    onShowAllProjects: () => void;
    allProjects: Project[];
    placeholder?: string;
    disabled?: boolean;
    selectedProject?: Project | null;
    onClearProject?: () => void;
}

const ProjectDropdown: React.FC<ProjectDropdownProps> = ({
    projectName,
    onProjectSearch,
    dropdownOpen,
    filteredProjects,
    onProjectSelection,
    onCreateProject,
    isCreatingProject,
    onShowAllProjects,
    allProjects,
    placeholder,
    disabled = false,
    selectedProject,
    onClearProject,
}) => {
    const { t } = useTranslation();
    const dropdownRef = useRef<HTMLDivElement>(null);
    const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);

    // Scroll to dropdown when it opens, keeping input visible
    useEffect(() => {
        if (dropdownOpen && dropdownRef.current) {
            // Small delay to ensure the dropdown is rendered
            setTimeout(() => {
                const dropdownElement = dropdownRef.current;
                if (dropdownElement) {
                    // Find the input field to keep it visible
                    const inputElement =
                        dropdownElement.parentElement?.querySelector('input');

                    // Find the appropriate scroll container (modal or window)
                    const modalScrollContainer = dropdownElement.closest(
                        '.absolute.inset-0.overflow-y-auto'
                    );

                    if (modalScrollContainer && inputElement) {
                        // We're inside a modal - scroll the modal container
                        const containerRect =
                            modalScrollContainer.getBoundingClientRect();
                        const dropdownRect =
                            dropdownElement.getBoundingClientRect();
                        const inputRect = inputElement.getBoundingClientRect();

                        // Only scroll if dropdown extends below the visible area
                        if (dropdownRect.bottom > containerRect.bottom - 50) {
                            // Calculate very conservative scroll - prioritize keeping input visible
                            const inputDistanceFromTop =
                                inputRect.top - containerRect.top;
                            const minInputVisible = 60; // Keep at least 60px of input visible

                            // Only scroll if we can maintain input visibility
                            if (inputDistanceFromTop > minInputVisible) {
                                const maxAllowedScroll =
                                    inputDistanceFromTop - minInputVisible;
                                const neededScroll =
                                    dropdownRect.bottom -
                                    containerRect.bottom +
                                    30;
                                const scrollAmount = Math.min(
                                    maxAllowedScroll,
                                    neededScroll
                                );

                                if (scrollAmount > 0) {
                                    modalScrollContainer.scrollBy({
                                        top: scrollAmount,
                                        behavior: 'smooth',
                                    });
                                }
                            }
                        }
                    } else if (inputElement) {
                        // We're not in a modal - scroll the window
                        const dropdownRect =
                            dropdownElement.getBoundingClientRect();
                        const inputRect = inputElement.getBoundingClientRect();
                        const viewportHeight = window.innerHeight;

                        // Only scroll if dropdown extends below the viewport
                        if (dropdownRect.bottom > viewportHeight - 50) {
                            // Calculate very conservative scroll - prioritize keeping input visible
                            const inputDistanceFromTop = inputRect.top;
                            const minInputVisible = 60; // Keep at least 60px of input visible

                            // Only scroll if we can maintain input visibility
                            if (inputDistanceFromTop > minInputVisible) {
                                const maxAllowedScroll =
                                    inputDistanceFromTop - minInputVisible;
                                const neededScroll =
                                    dropdownRect.bottom - viewportHeight + 30;
                                const scrollAmount = Math.min(
                                    maxAllowedScroll,
                                    neededScroll
                                );

                                if (scrollAmount > 0) {
                                    window.scrollBy({
                                        top: scrollAmount,
                                        behavior: 'smooth',
                                    });
                                }
                            }
                        }
                    }
                }
            }, 200);
        }
    }, [dropdownOpen]);

    // Reset highlighted index when dropdown state changes or projects change
    useEffect(() => {
        setHighlightedIndex(-1);
    }, [dropdownOpen, filteredProjects, allProjects]);

    const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
        if (!dropdownOpen) return;

        const projectsToShow = projectName ? filteredProjects : allProjects;

        if (event.key === 'ArrowDown') {
            event.preventDefault();
            setHighlightedIndex((prev) =>
                prev < projectsToShow.length - 1 ? prev + 1 : prev
            );
        } else if (event.key === 'ArrowUp') {
            event.preventDefault();
            setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : prev));
        } else if (event.key === 'Enter') {
            event.preventDefault();

            // Check for exact match first (case-insensitive)
            const exactMatch = projectsToShow.find(
                (project) =>
                    project.name.toLowerCase() ===
                    projectName.trim().toLowerCase()
            );

            if (exactMatch) {
                // Exact match found - auto-select it
                onProjectSelection(exactMatch);
            } else if (
                highlightedIndex >= 0 &&
                highlightedIndex < projectsToShow.length
            ) {
                // Select the highlighted project (after using arrow keys)
                onProjectSelection(projectsToShow[highlightedIndex]);
            } else if (projectName.trim() && projectsToShow.length === 0) {
                // No matches - create new project
                onCreateProject(projectName.trim());
            }
            // Note: Enter does nothing if no exact match and user hasn't navigated with arrows
        } else if (event.key === 'Escape') {
            event.preventDefault();
            setHighlightedIndex(-1);
        }
    };

    return (
        <div className="relative">
            <div className="flex flex-wrap items-center border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 rounded-md p-2 min-h-[40px]">
                {selectedProject ? (
                    // Only show badge when project is selected - no input allowed
                    <span className="flex items-center bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 text-sm font-medium px-2.5 py-1 rounded">
                        {selectedProject.name}
                        {onClearProject && !disabled && (
                            <button
                                type="button"
                                onClick={onClearProject}
                                className="ml-1.5 text-blue-600 dark:text-blue-300 hover:text-blue-800 dark:hover:text-blue-100 focus:outline-none"
                                aria-label={`Remove project ${selectedProject.name}`}
                            >
                                &times;
                            </button>
                        )}
                    </span>
                ) : (
                    // Only show input when no project is selected
                    <div className="flex-grow relative min-w-[150px]">
                        <input
                            type="text"
                            placeholder={
                                placeholder ||
                                t(
                                    'forms.task.projectSearchPlaceholder',
                                    'Search or create a project...'
                                )
                            }
                            value={projectName}
                            onChange={(e) => onProjectSearch(e.target.value)}
                            onKeyDown={handleKeyDown}
                            disabled={disabled}
                            className="w-full bg-transparent border-none outline-none text-sm text-gray-900 dark:text-gray-100 disabled:cursor-not-allowed pr-8"
                            autoComplete="off"
                        />
                        <button
                            type="button"
                            onClick={onShowAllProjects}
                            disabled={disabled}
                            className="absolute inset-y-0 right-0 flex items-center pr-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                            aria-label={
                                dropdownOpen
                                    ? 'Hide projects'
                                    : 'Show all projects'
                            }
                        >
                            {dropdownOpen ? (
                                <ChevronUpIcon className="h-5 w-5" />
                            ) : (
                                <ChevronDownIcon className="h-5 w-5" />
                            )}
                        </button>
                    </div>
                )}
            </div>
            {dropdownOpen && !selectedProject && (
                <div
                    ref={dropdownRef}
                    className="absolute mt-1 bg-white dark:bg-gray-800 shadow-lg rounded-md w-full z-50 border border-gray-200 dark:border-gray-700"
                >
                    {(() => {
                        // Show filtered projects if user is typing, otherwise show all projects
                        const projectsToShow = projectName
                            ? filteredProjects
                            : allProjects;

                        return projectsToShow.length > 0 ? (
                            projectsToShow.map((project, index) => (
                                <button
                                    key={project.id}
                                    type="button"
                                    onClick={() => onProjectSelection(project)}
                                    className={`block w-full text-gray-700 dark:text-gray-300 text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ${
                                        index === highlightedIndex
                                            ? 'bg-blue-50 dark:bg-blue-900/30'
                                            : ''
                                    }`}
                                >
                                    {project.name}
                                </button>
                            ))
                        ) : (
                            <div className="px-4 py-2 text-gray-500 dark:text-gray-400">
                                {projectName
                                    ? t(
                                          'forms.task.noMatchingProjects',
                                          'No matching projects'
                                      )
                                    : 'No projects available'}
                            </div>
                        );
                    })()}
                    {projectName && (
                        <button
                            type="button"
                            onClick={() => onCreateProject(projectName.trim())}
                            disabled={isCreatingProject}
                            className="block w-full text-left px-4 py-2 bg-blue-500 text-white hover:bg-blue-600 transition-colors disabled:bg-blue-400 disabled:cursor-not-allowed"
                        >
                            {isCreatingProject
                                ? t('forms.task.creatingProject', 'Creating...')
                                : t('forms.task.createProject', '+ Create') +
                                  ` "${projectName}"`}
                        </button>
                    )}
                </div>
            )}
        </div>
    );
};

export default ProjectDropdown;
