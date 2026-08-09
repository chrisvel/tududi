import React from 'react';
import { useTranslation } from 'react-i18next';
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
    const { t } = useTranslation();

    return (
        <ShareModal
            isOpen={isOpen}
            onClose={onClose}
            resourceType="project"
            resourceUid={(project as any)?.uid || null}
            title={t('shares.shareProject', 'Share project')}
            subtitle={project?.name}
        />
    );
};

export default ProjectShareModal;
