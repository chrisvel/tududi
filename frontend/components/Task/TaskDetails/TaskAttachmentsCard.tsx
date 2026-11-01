import React, { useMemo } from 'react';
import AttachmentsPanel from '../../Shared/AttachmentsPanel';
import { taskAttachmentsApi } from '../../../utils/attachmentsService';

interface TaskAttachmentsCardProps {
    taskUid: string;
    onAttachmentsCountChange?: (count: number) => void;
    showTitle?: boolean;
}

const TaskAttachmentsCard: React.FC<TaskAttachmentsCardProps> = ({
    taskUid,
    onAttachmentsCountChange,
    showTitle,
}) => {
    const api = useMemo(() => taskAttachmentsApi(taskUid), [taskUid]);
    return (
        <AttachmentsPanel
            api={api}
            onAttachmentsCountChange={onAttachmentsCountChange}
            showTitle={showTitle}
        />
    );
};

export default TaskAttachmentsCard;
