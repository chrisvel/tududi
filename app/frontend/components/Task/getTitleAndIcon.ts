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

export const getTitleAndIcon = (query: URLSearchParams, projects: Project[]) => {
  const projectId = query.get('project_id');
  if (projectId) {
    const project = projects.find((p) => p.id?.toString() === projectId);
    return { title: project ? project.name : 'Project', icon: FolderIcon };
  }

  if (query.get('type') === 'today') {
    return { title: 'Today', icon: CalendarIcon };
  }
  if (query.get('type') === 'inbox') {
    return { title: 'Inbox', icon: InboxIcon };
  }
  if (query.get('type') === 'next') {
    return { title: 'Next Actions', icon: ArrowRightIcon };
  }
  if (query.get('type') === 'upcoming') {
    return { title: 'Upcoming', icon: ClockIcon };
  }
  if (query.get('type') === 'someday') {
    return { title: 'Someday', icon: MoonIcon };
  }
  if (query.get('status') === 'done') {
    return { title: 'Completed', icon: CheckCircleIcon };
  }
  return { title: 'All Tasks', icon: Bars4Icon };
};
