import React from 'react';
import { useTranslation } from 'react-i18next';
import { PriorityType, StatusType } from '../../../entities/Task';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import StatusDropdown from '../../Shared/StatusDropdown';
import PriorityDropdown from '../../Shared/PriorityDropdown';
import DatePicker from '../../Shared/DatePicker';

interface TaskMetadataSectionProps {
    priority: PriorityType;
    dueDate: string;
    taskId?: number;
    onStatusChange: (value: StatusType) => void;
    onPriorityChange: (value: PriorityType) => void;
    onDueDateChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

const TaskMetadataSection: React.FC<TaskMetadataSectionProps> = ({
    priority,
    dueDate,
    taskId, // eslint-disable-line @typescript-eslint/no-unused-vars
    onStatusChange, // eslint-disable-line @typescript-eslint/no-unused-vars
    onPriorityChange,
    onDueDateChange,
}) => {
    const { t } = useTranslation();

    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 overflow-visible">
            <div className="overflow-visible">
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {t('forms.task.labels.priority', 'Priority')}
                </label>
                <PriorityDropdown
                    value={priority}
                    onChange={onPriorityChange}
                />
            </div>
            <div className="overflow-visible">
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {t('forms.task.labels.dueDate', 'Due Date')}
                </label>
                <DatePicker
                    value={dueDate}
                    onChange={(value) => {
                        const event = {
                            target: { name: 'due_date', value },
                        } as React.ChangeEvent<HTMLInputElement>;
                        onDueDateChange(event);
                    }}
                    placeholder={t(
                        'forms.task.dueDatePlaceholder',
                        'Select due date'
                    )}
                />
            </div>
        </div>
    );
};

export default TaskMetadataSection;
