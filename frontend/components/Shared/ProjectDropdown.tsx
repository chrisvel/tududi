import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Project } from '../../entities/Project';
import { ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/24/outline';

interface ProjectDropdownProps {
    projectName: string;
    onProjectSearch: (e: React.ChangeEvent<HTMLInputElement>) => void;
    dropdownOpen: boolean;
    filteredProjects: Project[];
    onProjectSelection: (project: Project) => void;
    onCreateProject: () => void;
    isCreatingProject: boolean;
    onShowAllProjects: () => void;
    allProjects: Project[];
    placeholder?: string;
    disabled?: boolean;
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
            if (
                highlightedIndex >= 0 &&
                highlightedIndex < projectsToShow.length
            ) {
                // Select the highlighted project (only works after using arrow keys)
                onProjectSelection(projectsToShow[highlightedIndex]);
            } else if (projectName.trim() && projectsToShow.length === 0) {
                // No matches - create new project
                onCreateProject();
            }
            // Note: Enter does nothing if user hasn't navigated with arrows
        } else if (event.key === 'Escape') {
            event.preventDefault();
            setHighlightedIndex(-1);
        }
    };

    return (
        <div className="relative">
            <div className="relative">
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
                    onChange={onProjectSearch}
                    onKeyDown={handleKeyDown}
                    disabled={disabled}
                    className="block w-full border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm px-3 py-2 pr-10 text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 disabled:bg-gray-100 disabled:dark:bg-gray-800 disabled:cursor-not-allowed"
                    autoComplete="off"
                />
                <button
                    type="button"
                    onClick={onShowAllProjects}
                    disabled={disabled}
                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                    aria-label={
                        dropdownOpen ? 'Hide projects' : 'Show all projects'
                    }
                >
                    {dropdownOpen ? (
                        <ChevronUpIcon className="h-5 w-5" />
                    ) : (
                        <ChevronDownIcon className="h-5 w-5" />
                    )}
                </button>
            </div>
            {dropdownOpen && (
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
                            onClick={onCreateProject}
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
