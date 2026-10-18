import React from 'react';
import DateTimePicker from '../../Shared/DateTimePicker';
import { fromDueParts, toDueParts } from '../../../utils/dueDateTime';

interface TaskDueDateSectionProps {
    value: string;
    onChange: (value: string) => void;
    time?: string;
    onTimeChange?: (value: string) => void;
    placeholder?: string;
}

const TaskDueDateSection: React.FC<TaskDueDateSectionProps> = ({
    value,
    onChange,
    time = '',
    onTimeChange,
    placeholder = 'Select due date',
}) => {
    return (
        <div className="overflow-visible">
            <DateTimePicker
                value={fromDueParts(value, time)}
                onChange={(iso) => {
                    const parts = toDueParts(iso);
                    onChange(parts.date || '');
                    onTimeChange?.(parts.time || '');
                }}
                placeholder={placeholder}
            />
        </div>
    );
};

export default TaskDueDateSection;
