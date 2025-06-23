import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { TaskEvent } from '../../entities/TaskEvent';
import { getTaskTimeline, formatDuration, getEventTypeLabel, getStatusLabel, getPriorityLabel } from '../../utils/taskEventService';
import {
  ClockIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  PencilIcon,
  TagIcon,
  CalendarIcon,
  FolderIcon,
  PlayIcon,
  PauseIcon,
  ArchiveBoxIcon,
  SparklesIcon,
  AdjustmentsHorizontalIcon
} from '@heroicons/react/24/outline';

interface TaskTimelineProps {
  taskId: number | undefined;
}

const TaskTimeline: React.FC<TaskTimelineProps> = ({ taskId }) => {
  const { t } = useTranslation();
  const [events, setEvents] = useState<TaskEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchTimeline = async () => {
      if (!taskId || taskId === undefined) {
        setLoading(false);
        setEvents([]);
        return;
      }
      
      setLoading(true);
      setError(null);
      
      try {
        const timeline = await getTaskTimeline(taskId);
        setEvents(timeline);
      } catch (err) {
        console.error('Error fetching task timeline:', err);
        setError('Failed to load timeline');
      } finally {
        setLoading(false);
      }
    };

    fetchTimeline();
  }, [taskId]);

  const getEventIcon = (eventType: string, newValue?: any) => {
    const iconClass = "h-3.5 w-3.5";
    
    switch (eventType) {
      case 'created':
        return <SparklesIcon className={`${iconClass} text-blue-500`} />;
      case 'status_changed':
        if (newValue?.status === 1) return <PlayIcon className={`${iconClass} text-yellow-500`} />;
        if (newValue?.status === 2) return <CheckCircleIcon className={`${iconClass} text-green-500`} />;
        if (newValue?.status === 3) return <ArchiveBoxIcon className={`${iconClass} text-gray-500`} />;
        return <AdjustmentsHorizontalIcon className={`${iconClass} text-blue-500`} />;
      case 'completed':
        return <CheckCircleIcon className={`${iconClass} text-green-500`} />;
      case 'priority_changed':
        return <ExclamationTriangleIcon className={`${iconClass} text-orange-500`} />;
      case 'due_date_changed':
        return <CalendarIcon className={`${iconClass} text-purple-500`} />;
      case 'project_changed':
        return <FolderIcon className={`${iconClass} text-indigo-500`} />;
      case 'name_changed':
      case 'description_changed':
      case 'note_changed':
        return <PencilIcon className={`${iconClass} text-gray-500`} />;
      case 'tags_changed':
        return <TagIcon className={`${iconClass} text-pink-500`} />;
      case 'archived':
        return <ArchiveBoxIcon className={`${iconClass} text-gray-500`} />;
      default:
        return <ClockIcon className={`${iconClass} text-gray-400`} />;
    }
  };

  const getEventDescription = (event: TaskEvent) => {
    const { event_type, old_value, new_value, field_name } = event;
    
    switch (event_type) {
      case 'created':
        return 'Task created';
      case 'status_changed':
      case 'completed':
        const oldStatus = old_value?.status;
        const newStatus = new_value?.status;
        if (oldStatus !== undefined && newStatus !== undefined) {
          return `Status: ${getStatusLabel(oldStatus)} → ${getStatusLabel(newStatus)}`;
        }
        return 'Status changed';
      case 'priority_changed':
        const oldPriority = old_value?.priority;
        const newPriority = new_value?.priority;
        if (oldPriority !== undefined && newPriority !== undefined) {
          return `Priority: ${getPriorityLabel(oldPriority)} → ${getPriorityLabel(newPriority)}`;
        }
        return 'Priority changed';
      case 'due_date_changed':
        const oldDate = old_value?.due_date;
        const newDate = new_value?.due_date;
        if (oldDate || newDate) {
          return `Due date: ${oldDate || 'None'} → ${newDate || 'None'}`;
        }
        return 'Due date changed';
      case 'name_changed':
        return 'Name updated';
      case 'description_changed':
        return 'Description updated';
      case 'note_changed':
        return 'Note updated';
      case 'project_changed':
        return 'Project changed';
      case 'tags_changed':
        return 'Tags updated';
      case 'archived':
        return 'Task archived';
      default:
        return getEventTypeLabel(event_type);
    }
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMinutes < 1) return 'Just now';
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return date.toLocaleDateString();
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-32 text-gray-500 dark:text-gray-400">
        <ClockIcon className="h-6 w-6 mb-2 animate-spin" />
        <span className="text-sm">Loading timeline...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-32 text-red-500">
        <ExclamationTriangleIcon className="h-6 w-6 mb-2" />
        <span className="text-sm">{error}</span>
      </div>
    );
  }

  if (!taskId) {
    return (
      <div className="flex flex-col items-center justify-center h-32 text-gray-500 dark:text-gray-400">
        <SparklesIcon className="h-6 w-6 mb-2" />
        <span className="text-sm text-center">Timeline will appear after saving</span>
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-32 text-gray-500 dark:text-gray-400">
        <ClockIcon className="h-6 w-6 mb-2" />
        <span className="text-sm">No activity yet</span>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="space-y-2">
        {events.map((event, index) => (
          <div key={event.id} className="relative">
            {/* Event item */}
            <div className="flex items-start space-x-3 py-1 relative z-10">
              {/* Icon */}
              <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center border-2 ${
                event.event_type === 'created' ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-700' :
                event.event_type === 'completed' ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-700' :
                event.event_type === 'status_changed' && event.new_value?.status === 1 ? 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-700' :
                event.event_type === 'priority_changed' ? 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-700' :
                'bg-gray-50 dark:bg-gray-900/20 border-gray-200 dark:border-gray-700'
              }`}>
                {getEventIcon(event.event_type, event.new_value)}
              </div>
              
              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium text-gray-900 dark:text-gray-100 leading-tight">
                  {getEventDescription(event)}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {formatTimeAgo(event.created_at)}
                </div>
                
                {/* Additional details for certain events */}
                {event.event_type === 'tags_changed' && event.new_value && (
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {Array.isArray(event.new_value) && event.new_value.map((tag: any, tagIndex: number) => (
                      <span
                        key={tagIndex}
                        className="inline-flex items-center px-1.5 py-0.5 rounded text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 border border-blue-200 dark:border-blue-800"
                      >
                        {tag.name || tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default TaskTimeline;