import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Project } from '../../entities/Project';
import { completeProject } from '../../utils/projectsService';
import { useToast } from '../Shared/ToastContext';

// Open tasks according to the counts a project card or page already has.
export const countOpenTasks = (project: Project): number => {
    const status = project.task_status;
    if (!status) return 0;
    return Math.max(0, status.total - status.done);
};

interface PendingCompletion {
    project: Project;
    onDone: (project: Project) => void;
}

// Marking a project done goes through here so a project with open tasks
// asks whether to finish them too. `request` resolves straight away when
// nothing is open; otherwise `dialog` shows the question.
const useCompleteProject = () => {
    const { t } = useTranslation();
    const { showSuccessToast, showErrorToast } = useToast();
    const [pending, setPending] = useState<PendingCompletion | null>(null);
    const [saving, setSaving] = useState(false);

    const run = async (
        project: Project,
        completeOpenTasks: boolean,
        onDone: (project: Project) => void
    ) => {
        if (!project.uid) return;
        setSaving(true);
        try {
            const result = await completeProject(
                project.uid,
                completeOpenTasks
            );
            onDone(result.project);
            showSuccessToast(
                result.completed_tasks > 0
                    ? t(
                          'project.completedWithTasks',
                          'Project completed, {{count}} tasks marked done',
                          { count: result.completed_tasks }
                      )
                    : t('project.completedToast', 'Project completed')
            );
        } catch {
            showErrorToast(
                t(
                    'errors.projectStatusUpdateFailed',
                    'Failed to update project status'
                )
            );
        } finally {
            setSaving(false);
            setPending(null);
        }
    };

    const request = (
        project: Project,
        openTasks: number,
        onDone: (project: Project) => void
    ) => {
        if (openTasks > 0) {
            setPending({ project, onDone });
            return;
        }
        run(project, false, onDone);
    };

    const dialog = pending ? (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
            onClick={() => !saving && setPending(null)}
        >
            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="complete-project-title"
                className="mx-4 w-full max-w-xl rounded-lg bg-white p-6 shadow-xl dark:bg-gray-800"
                onClick={(e) => e.stopPropagation()}
                data-testid="complete-project-dialog"
            >
                <h3
                    id="complete-project-title"
                    className="mb-2 text-lg font-semibold text-gray-900 dark:text-white break-words"
                >
                    {t('project.completeTitle', 'Complete "{{name}}"?', {
                        name: pending.project.name,
                    })}
                </h3>
                <p className="mb-6 text-sm text-gray-600 dark:text-gray-300">
                    {t(
                        'project.completeOpenTasks',
                        'This project still has open tasks. Mark them done too, or leave them open? Recurring tasks keep their schedule either way.'
                    )}
                </p>
                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                    <button
                        type="button"
                        disabled={saving}
                        onClick={() => setPending(null)}
                        className="rounded-md px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
                    >
                        {t('common.cancel', 'Cancel')}
                    </button>
                    <button
                        type="button"
                        disabled={saving}
                        onClick={() =>
                            run(pending.project, false, pending.onDone)
                        }
                        className="rounded-md bg-gray-100 px-4 py-2 text-sm font-medium text-gray-800 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600"
                        data-testid="complete-project-leave-tasks"
                    >
                        {t('project.leaveTasksOpen', 'Leave them open')}
                    </button>
                    <button
                        type="button"
                        disabled={saving}
                        onClick={() =>
                            run(pending.project, true, pending.onDone)
                        }
                        className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                        data-testid="complete-project-with-tasks"
                    >
                        {t('project.completeTasksToo', 'Mark them done too')}
                    </button>
                </div>
            </div>
        </div>
    ) : null;

    return { requestComplete: request, completeDialog: dialog };
};

export default useCompleteProject;
