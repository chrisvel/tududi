import { Project } from "../../entities/Project";

export const getTitleAndIcon = (query: URLSearchParams, projects: Project[]) => {
  const projectId = query.get('project_id');
  if (projectId) {
    const project = projects.find((p) => p.id?.toString() === projectId);
    return { title: project ? project.name : 'Project', icon: 'bi-folder-fill' };
  }

  if (query.get('type') === 'today') {
    return { title: 'Today', icon: 'bi-calendar-day-fill' };
  }
  if (query.get('type') === 'inbox') {
    return { title: 'Inbox', icon: 'bi-inbox-fill' };
  }
  if (query.get('type') === 'next') {
    return { title: 'Next Actions', icon: 'bi-arrow-right-circle-fill' };
  }
  if (query.get('type') === 'upcoming') {
    return { title: 'Upcoming', icon: 'bi-calendar3' };
  }
  if (query.get('type') === 'someday') {
    return { title: 'Someday', icon: 'bi-moon-stars-fill' };
  }
  if (query.get('status') === 'done') {
    return { title: 'Completed', icon: 'bi-check-circle' };
  }
  return { title: 'All Tasks', icon: 'bi-layers' };
};