import { Project } from "../../entities/Project";

export const getDescription = (query: URLSearchParams, projects: Project[]): string => {
  const projectId = query.get('project_id');
  if (projectId) {
    const project = projects.find((p) => p.id?.toString() === projectId);
    return project
      ? `You are currently viewing all tasks associated with the "${project.name}" project. You can organize tasks within this project, set their priority, and track their completion. Use this space to focus on the tasks that belong specifically to this project.`
      : 'You are viewing tasks for a specific project. Use this space to manage and track tasks associated with this project.';
  }

  if (query.get('type') === 'today') {
    return 'These are the tasks that are due today or tasks you’ve scheduled for immediate attention. Use this view to focus on what needs to be completed today. Mark tasks as completed, update their status, or adjust their due dates if needed.';
  }
  if (query.get('type') === 'inbox') {
    return 'The inbox is where all uncategorized tasks live. Tasks that haven’t been assigned to a project or given a due date will show up here. This is your “brain dump” area where you can quickly jot down tasks and organize them later.';
  }
  if (query.get('type') === 'next') {
    return 'This view shows all the tasks that are actionable in the near future. These tasks are ready to be worked on next and don’t have long-term deadlines. It’s a good place to focus when you’re looking to make quick progress on tasks.';
  }
  if (query.get('type') === 'upcoming') {
    return 'This view highlights tasks that are scheduled for the upcoming week. It helps you prepare and stay ahead of deadlines by giving you an overview of the work you need to tackle in the near future. Tasks with due dates within the next 7 days will appear here.';
  }
  if (query.get('type') === 'someday') {
    return 'The “Someday” view is for tasks that aren’t urgent and don’t have a specific due date. These are tasks you may want to get to at some point, but they aren’t a priority right now. Use this section to keep track of ideas or long-term goals.';
  }
  if (query.get('status') === 'done') {
    return 'Here you can see all the tasks you’ve completed. It’s a great way to review your accomplishments and reflect on the work you’ve finished. You can also find tasks that may need to be unarchived or referenced in the future.';
  }
  return 'You are viewing all tasks. This includes tasks from different projects, tasks without specific due dates, and tasks with varying levels of priority. Use this view for an overall look at everything on your to-do list.';
};