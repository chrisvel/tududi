import React, { useMemo } from 'react';
import { Project } from '../../entities/Project';
import ShareModal from '../Shared/ShareModal';

interface ProjectShareModalProps {
    isOpen: boolean;
    onClose: () => void;
    project: Project;
}

const ProjectShareModal: React.FC<ProjectShareModalProps> = ({
    isOpen,
    onClose,
    project,
}) => {
    const projectUid: string | null = useMemo(() => {
        return (project as any).uid || null;
    }, [project]);

    return (
        <ShareModal
            isOpen={isOpen}
            onClose={onClose}
            resourceType="project"
            resourceUid={projectUid}
            resourceName={project?.name}
        />
    );
};

export default ProjectShareModal;
