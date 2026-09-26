import React, { useMemo } from 'react';
import AttachmentsPanel from '../../Shared/AttachmentsPanel';
import { taskAttachmentsApi } from '../../../utils/attachmentsService';

interface TaskAttachmentsCardProps {
    taskUid: string;
    onAttachmentsCountChange?: (count: number) => void;
}

const TaskAttachmentsCard: React.FC<TaskAttachmentsCardProps> = ({
    taskUid,
    onAttachmentsCountChange,
}) => {
    const api = useMemo(() => taskAttachmentsApi(taskUid), [taskUid]);
    return (
        <AttachmentsPanel
            api={api}
            onAttachmentsCountChange={onAttachmentsCountChange}
        />
    );
};

export default TaskAttachmentsCard;
