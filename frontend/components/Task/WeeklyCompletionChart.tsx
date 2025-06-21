import React from 'react';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts';
import { useTranslation } from 'react-i18next';
import { WeeklyCompletion } from '../../entities/Metrics';

interface WeeklyCompletionChartProps {
  data: WeeklyCompletion[];
}

const WeeklyCompletionChart: React.FC<WeeklyCompletionChartProps> = ({ data }) => {
  const { t } = useTranslation();

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white dark:bg-gray-800 p-3 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg">
          <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
            {data.dayName}
          </p>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {data.count} {data.count === 1 ? t('tasks.taskCompleted') : t('tasks.tasksCompleted')}
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-white dark:bg-gray-900 rounded-lg shadow p-3">
      <h3 className="text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
        {t('tasks.weeklyCompletions')}
      </h3>
      <div className="h-32">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 2, right: 2, left: 2, bottom: 2 }}>
            <XAxis 
              dataKey="dayName" 
              axisLine={false}
              tickLine={false}
              tick={{ 
                fontSize: 10, 
                fill: 'currentColor',
                className: 'text-gray-600 dark:text-gray-400'
              }}
            />
            <YAxis 
              axisLine={false}
              tickLine={false}
              tick={{ 
                fontSize: 10, 
                fill: 'currentColor',
                className: 'text-gray-600 dark:text-gray-400'
              }}
              allowDecimals={false}
              width={20}
            />
            <Tooltip content={<CustomTooltip />} />
            <Bar 
              dataKey="count" 
              fill="currentColor"
              className="text-blue-500 dark:text-blue-400"
              radius={[2, 2, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default WeeklyCompletionChart;