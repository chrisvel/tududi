import React from 'react';
import { Project } from '../../../entities/Project';
import ProjectDropdown from '../../Shared/ProjectDropdown';

interface TaskProjectSectionProps {
    newProjectName: string;
    onProjectSearch: (query: string) => void;
    dropdownOpen: boolean;
    filteredProjects: Project[];
    onProjectSelection: (project: Project) => void;
    onCreateProject: (name: string) => void | Promise<void>;
    isCreatingProject: boolean;
    onShowAllProjects: () => void;
    allProjects: Project[];
    selectedProject?: Project | null;
    onClearProject?: () => void;
}

const TaskProjectSection: React.FC<TaskProjectSectionProps> = ({
    newProjectName,
    onProjectSearch,
    dropdownOpen,
    filteredProjects,
    onProjectSelection,
    onCreateProject,
    isCreatingProject,
    onShowAllProjects,
    allProjects,
    selectedProject,
    onClearProject,
}) => {
    return (
        <ProjectDropdown
            projectName={newProjectName}
            onProjectSearch={onProjectSearch}
            dropdownOpen={dropdownOpen}
            filteredProjects={filteredProjects}
            onProjectSelection={onProjectSelection}
            onCreateProject={onCreateProject}
            isCreatingProject={isCreatingProject}
            onShowAllProjects={onShowAllProjects}
            allProjects={allProjects}
            selectedProject={selectedProject}
            onClearProject={onClearProject}
        />
    );
};

export default TaskProjectSection;
