import React from 'react';
import DateTimePicker from '../../Shared/DateTimePicker';

interface TaskDeferUntilSectionProps {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
}

const TaskDeferUntilSection: React.FC<TaskDeferUntilSectionProps> = ({
    value,
    onChange,
    placeholder = 'Select defer until date and time',
}) => {
    return (
        <div className="overflow-visible">
            <DateTimePicker
                value={value || ''}
                onChange={onChange}
                placeholder={placeholder}
            />
        </div>
    );
};

export default TaskDeferUntilSection;
