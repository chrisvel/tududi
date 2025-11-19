import React from 'react';
import { PriorityType } from '../../../entities/Task';
import PriorityDropdown from '../../Shared/PriorityDropdown';

interface TaskPrioritySectionProps {
    value: PriorityType;
    onChange: (value: PriorityType) => void;
}

const TaskPrioritySection: React.FC<TaskPrioritySectionProps> = ({
    value,
    onChange,
}) => {
    return <PriorityDropdown value={value} onChange={onChange} />;
};

export default TaskPrioritySection;
