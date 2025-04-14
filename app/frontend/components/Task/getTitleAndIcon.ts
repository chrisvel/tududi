import { Project } from "../../entities/Project";
import {
  FolderIcon,
  CalendarIcon,
  InboxIcon,
  ArrowRightIcon,
  ClockIcon,
  MoonIcon,
  CheckCircleIcon,
  Bars4Icon,
} from '@heroicons/react/24/outline';

export const getTitleAndIcon = (
  query: URLSearchParams, 
  projects: Project[],
  t: (key: string, options?: any) => string
) => {
  try {
    // Default titles as fallbacks in case translation function fails
    const defaultTitles = {
      project: 'Project',
      today: 'Today',
      inbox: 'Inbox',
      next: 'Next Actions',
      upcoming: 'Upcoming',
      someday: 'Someday',
      completed: 'Completed',
      allTasks: 'All Tasks'
    };
  const projectId = query.get('project_id');
  if (projectId) {
    const project = projects.find((p) => p.id?.toString() === projectId);
    return { title: project ? project.name : t('sidebar.projects'), icon: FolderIcon };
  }

  try {
    if (query.get('type') === 'today') {
      return { title: t('tasks.today'), icon: CalendarIcon };
    }
    if (query.get('type') === 'inbox') {
      return { title: t('sidebar.inbox'), icon: InboxIcon };
    }
    if (query.get('type') === 'next') {
      return { title: t('sidebar.nextActions'), icon: ArrowRightIcon };
    }
    if (query.get('type') === 'upcoming') {
      return { title: t('sidebar.upcoming'), icon: ClockIcon };
    }
    if (query.get('type') === 'someday') {
      return { title: t('taskViews.someday') || defaultTitles.someday, icon: MoonIcon };
    }
    if (query.get('status') === 'done') {
      return { title: t('sidebar.completed'), icon: CheckCircleIcon };
    }
    return { title: t('sidebar.allTasks'), icon: Bars4Icon };
  } catch (e) {
    console.error("Translation error for task view title:", e);
    
    // Return appropriate fallback based on type or status
    if (query.get('type') === 'today') return { title: defaultTitles.today, icon: CalendarIcon };
    if (query.get('type') === 'inbox') return { title: defaultTitles.inbox, icon: InboxIcon };
    if (query.get('type') === 'next') return { title: defaultTitles.next, icon: ArrowRightIcon };
    if (query.get('type') === 'upcoming') return { title: defaultTitles.upcoming, icon: ClockIcon };
    if (query.get('type') === 'someday') return { title: defaultTitles.someday, icon: MoonIcon };
    if (query.get('status') === 'done') return { title: defaultTitles.completed, icon: CheckCircleIcon };
    return { title: defaultTitles.allTasks, icon: Bars4Icon };
  }
} catch (error) {
  console.error("Error in getTitleAndIcon:", error);
  return { title: "Tasks", icon: Bars4Icon };
}
};
