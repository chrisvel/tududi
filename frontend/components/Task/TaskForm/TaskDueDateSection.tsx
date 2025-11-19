import React from 'react';
import DatePicker from '../../Shared/DatePicker';

interface TaskDueDateSectionProps {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
}

const TaskDueDateSection: React.FC<TaskDueDateSectionProps> = ({
    value,
    onChange,
    placeholder = 'Select due date',
}) => {
    return (
        <div className="overflow-visible">
            <DatePicker
                value={value || ''}
                onChange={onChange}
                placeholder={placeholder}
            />
        </div>
    );
};

export default TaskDueDateSection;
