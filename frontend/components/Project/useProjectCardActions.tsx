import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Project, ProjectStatus } from '../../entities/Project';
import { Area } from '../../entities/Area';
import { deleteProject, updateProject } from '../../utils/projectsService';
import { useStore } from '../../store/useStore';
import { useToast } from '../Shared/ToastContext';
import ConfirmDialog from '../Shared/ConfirmDialog';
import ProjectModal from './ProjectModal';
import ProjectShareModal from './ProjectShareModal';

// Handlers and modals behind the ProjectItem cards, so a page can show the
// same cards /projects shows. `refresh` reloads that page's project list.
const useProjectCardActions = (refresh: () => Promise<void>) => {
    const { t } = useTranslation();
    const { showErrorToast } = useToast();
    const areas: Area[] = useStore((state: any) => state.areasStore.areas);
    const areasLoaded = useStore((state: any) => state.areasStore.hasLoaded);
    const loadAreas = useStore((state: any) => state.areasStore.loadAreas);

    const [activeDropdown, setActiveDropdown] = useState<number | null>(null);
    const [projectModal, setProjectModal] = useState<{
        isOpen: boolean;
        project: Project | null;
    }>({ isOpen: false, project: null });
    const [projectToDelete, setProjectToDelete] = useState<Project | null>(
        null
    );
    const [isDeleteOpen, setIsDeleteOpen] = useState(false);
    const [projectShare, setProjectShare] = useState<Project | null>(null);

    useEffect(() => {
        if (!areasLoaded) loadAreas();
    }, [areasLoaded, loadAreas]);

    const closeModal = () => setProjectModal({ isOpen: false, project: null });

    const handleSave = async (project: Project) => {
        try {
            if (project.uid) await updateProject(project.uid, project);
            await refresh();
        } catch {
            showErrorToast(
                t('errors.failedToSaveProject', 'Failed to save project.')
            );
        } finally {
            closeModal();
        }
    };

    const handleDeleteUid = async (projectUid: string) => {
        try {
            await deleteProject(projectUid);
            await refresh();
        } catch {
            showErrorToast(
                t('errors.failedToDeleteProject', 'Failed to delete project.')
            );
        } finally {
            closeModal();
        }
    };

    const handleConfirmDelete = async () => {
        if (projectToDelete?.uid) await handleDeleteUid(projectToDelete.uid);
        setIsDeleteOpen(false);
        setProjectToDelete(null);
    };

    const handleStatusChange = async (
        project: Project,
        status: ProjectStatus
    ) => {
        if (!project.uid) return;
        try {
            await updateProject(project.uid, { status });
            await refresh();
        } catch {
            showErrorToast(
                t('errors.failedToSaveProject', 'Failed to save project.')
            );
        }
    };

    const cardActions = {
        activeDropdown,
        setActiveDropdown,
        handleEditProject: (project: Project) =>
            setProjectModal({ isOpen: true, project }),
        setProjectToDelete,
        setIsConfirmDialogOpen: setIsDeleteOpen,
        onOpenShare: setProjectShare,
        onStatusChange: handleStatusChange,
    };

    const modals = (
        <>
            {projectModal.isOpen && (
                <ProjectModal
                    isOpen={projectModal.isOpen}
                    onClose={closeModal}
                    onSave={handleSave}
                    onDelete={handleDeleteUid}
                    project={projectModal.project || undefined}
                    areas={areas}
                />
            )}
            {isDeleteOpen && projectToDelete && (
                <ConfirmDialog
                    title={t('modals.deleteProject.title')}
                    message={t('modals.deleteProject.message', {
                        projectName: projectToDelete.name,
                    })}
                    onConfirm={handleConfirmDelete}
                    onCancel={() => {
                        setIsDeleteOpen(false);
                        setProjectToDelete(null);
                    }}
                />
            )}
            {projectShare && (
                <ProjectShareModal
                    isOpen={!!projectShare}
                    onClose={() => setProjectShare(null)}
                    project={projectShare}
                />
            )}
        </>
    );

    return { cardActions, modals };
};

export default useProjectCardActions;
