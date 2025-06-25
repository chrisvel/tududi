import React from 'react';
import { RecurrenceType } from '../../entities/Task';
import { useTranslation } from 'react-i18next';
import { ArrowPathIcon } from '@heroicons/react/24/outline';

interface TaskRecurrenceBadgeProps {
  recurrenceType: RecurrenceType;
}

const TaskRecurrenceBadge: React.FC<TaskRecurrenceBadgeProps> = ({ recurrenceType }) => {
  const { t } = useTranslation();

  if (!recurrenceType || recurrenceType === 'none') {
    return null;
  }

  const getRecurrenceIcon = () => {
    return <ArrowPathIcon className="w-3 h-3 mr-1" />;
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