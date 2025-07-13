import React from 'react';
import { useTranslation } from 'react-i18next';
import { Project } from '../../../entities/Project';
import ProjectDropdown from '../../Shared/ProjectDropdown';

interface TaskProjectSectionProps {
    newProjectName: string;
    onProjectSearch: (e: React.ChangeEvent<HTMLInputElement>) => void;
    dropdownOpen: boolean;
    filteredProjects: Project[];
    onProjectSelection: (project: Project) => void;
    onCreateProject: () => void;
    isCreatingProject: boolean;
    onShowAllProjects: () => void;
    allProjects: Project[];
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
}) => {
    const { t } = useTranslation();

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
        />
    );
};

export default TaskProjectSection;
