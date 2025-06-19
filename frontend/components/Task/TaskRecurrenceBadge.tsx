import React from 'react';
import { RecurrenceType } from '../../entities/Task';
import { useTranslation } from 'react-i18next';

interface TaskRecurrenceBadgeProps {
  recurrenceType: RecurrenceType;
}

const TaskRecurrenceBadge: React.FC<TaskRecurrenceBadgeProps> = ({ recurrenceType }) => {
  const { t } = useTranslation();

  if (!recurrenceType || recurrenceType === 'none') {
    return null;
  }

  const getRecurrenceIcon = () => {
    return (
      <svg
        className="w-3 h-3 mr-1"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
        />
      </svg>
    );
  };

  const getRecurrenceLabel = (type: RecurrenceType) => {
    switch (type) {
      case 'daily':
        return t('recurrence.daily', 'DAILY');
      case 'weekly':
        return t('recurrence.weekly', 'WEEKLY');
      case 'monthly':
        return t('recurrence.monthly', 'MONTHLY');
      case 'monthly_weekday':
        return t('recurrence.monthlyWeekday', 'MONTHLY');
      case 'monthly_last_day':
        return t('recurrence.monthlyLastDay', 'MONTHLY');
      default:
        return t('recurrence.recurring', 'RECURRING');
    }
  };

  return (
    <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-800 dark:text-purple-100">
      {getRecurrenceIcon()}
      {getRecurrenceLabel(recurrenceType)}
    </span>
  );
};

export default TaskRecurrenceBadge;