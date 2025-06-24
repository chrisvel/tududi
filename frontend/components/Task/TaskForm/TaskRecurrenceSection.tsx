import React from 'react';
import { RecurrenceType, Task } from '../../../entities/Task';
import RecurrenceInput from '../RecurrenceInput';

interface TaskRecurrenceSectionProps {
  formData: Task;
  parentTask: Task | null;
  parentTaskLoading: boolean;
  onRecurrenceChange: (field: string, value: any) => void;
  onEditParent?: () => void;
  onParentRecurrenceChange?: (field: string, value: any) => void;
}

const TaskRecurrenceSection: React.FC<TaskRecurrenceSectionProps> = ({
  formData,
  parentTask,
  parentTaskLoading,
  onRecurrenceChange,
  onEditParent,
  onParentRecurrenceChange
}) => {
  return (
    <RecurrenceInput
      recurrenceType={parentTask ? (parentTask.recurrence_type || 'none') : (formData.recurrence_type || 'none')}
      recurrenceInterval={parentTask ? (parentTask.recurrence_interval || 1) : (formData.recurrence_interval || 1)}
      recurrenceEndDate={parentTask ? parentTask.recurrence_end_date : formData.recurrence_end_date}
      recurrenceWeekday={parentTask ? parentTask.recurrence_weekday : formData.recurrence_weekday}
      recurrenceMonthDay={parentTask ? parentTask.recurrence_month_day : formData.recurrence_month_day}
      recurrenceWeekOfMonth={parentTask ? parentTask.recurrence_week_of_month : formData.recurrence_week_of_month}
      completionBased={parentTask ? (parentTask.completion_based || false) : (formData.completion_based || false)}
      onChange={onRecurrenceChange}
      disabled={!!parentTask}
      isChildTask={!!parentTask}
      parentTaskLoading={parentTaskLoading}
      onEditParent={parentTask ? onEditParent : undefined}
      onParentRecurrenceChange={parentTask ? onParentRecurrenceChange : undefined}
    />
  );
};

export default TaskRecurrenceSection;