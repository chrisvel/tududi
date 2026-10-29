import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Task } from '../../entities/Task';
import { fetchTaskByUid } from '../../utils/tasksService';
import { useToast } from '../Shared/ToastContext';
import { useTaskPanel } from '../../store/taskPanelStore';
import TaskModal from './TaskModal';

const TaskPanelHost: React.FC = () => {
    const { t } = useTranslation();
    const { showErrorToast } = useToast();
    const uid = useTaskPanel((state) => state.uid);
    const close = useTaskPanel((state) => state.close);
    const [task, setTask] = useState<Task | null>(null);

    useEffect(() => {
        if (!uid) {
            setTask(null);
            return;
        }
        let cancelled = false;
        fetchTaskByUid(uid)
            .then((fresh) => {
                if (!cancelled) setTask(fresh);
            })
            .catch(() => {
                if (cancelled) return;
                showErrorToast(t('api.errors.taskNotFound', 'Task not found.'));
                close();
            });
        return () => {
            cancelled = true;
        };
    }, [uid]);

    if (!uid || !task || task.uid !== uid) return null;

    return <TaskModal isOpen onClose={close} task={task} />;
};

export default TaskPanelHost;
