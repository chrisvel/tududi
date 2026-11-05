import React, { useEffect } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { openTaskPanel } from '../../store/taskPanelStore';

// A task link (/task/<uid>) lands on all tasks with that task open in the
// side panel. The full task page lives at /task/<uid>/details.
const TaskLinkRedirect: React.FC = () => {
    const { uid } = useParams<{ uid: string }>();

    useEffect(() => {
        if (uid) openTaskPanel(uid);
    }, [uid]);

    return <Navigate to="/tasks" replace />;
};

export default TaskLinkRedirect;
