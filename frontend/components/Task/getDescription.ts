import { Project } from "../../entities/Project";

export const getDescription = (
  query: URLSearchParams, 
  projects: Project[], 
  t: (key: string, options?: any) => string
): string => {
  try {
    // Default descriptions as fallbacks in case translation function fails
    const defaultDescriptions = {
      project: "Project tasks",
      today: "Tasks due today or scheduled for immediate attention",
      inbox: "Uncategorized tasks without project or due date",
      next: "Tasks that are actionable in the near future",
      upcoming: "Tasks scheduled for the upcoming week",
      someday: "Tasks without urgency or specific due date",
      completed: "Tasks you've completed",
      allTasks: "All tasks from different projects and priorities"
    };
    
    // Check for project_id first
    const projectId = query.get('project_id');
    if (projectId) {
      try {
        const project = projects.find((p) => p.id?.toString() === projectId);
        if (project) {
          return t("taskViews.project.withName", { projectName: project.name });
        } else {
          return t("taskViews.project.noName");
        }
      } catch (e) {
        console.error("Translation error for project description:", e);
        // Fallback with project name if available
        const project = projects.find((p) => p.id?.toString() === projectId);
        return project 
          ? `Tasks for project: ${project.name}`
          : defaultDescriptions.project;
      }
    }

    // Then check for type and status parameters
    try {
      if (query.get('type') === 'today') {
        return t("taskViews.today");
      }
      if (query.get('type') === 'inbox') {
        return t("taskViews.inbox");
      }
      if (query.get('type') === 'next') {
        return t("taskViews.next");
      }
      if (query.get('type') === 'upcoming') {
        return t("taskViews.upcoming");
      }
      if (query.get('type') === 'someday') {
        return t("taskViews.someday");
      }
      if (query.get('status') === 'done') {
        return t("taskViews.completed");
      }
      return t("taskViews.allTasks");
    } catch (e) {
      console.error("Translation error for task view description:", e);
      
      // Return appropriate fallback based on type or status
      if (query.get('type') === 'today') return defaultDescriptions.today;
      if (query.get('type') === 'inbox') return defaultDescriptions.inbox;
      if (query.get('type') === 'next') return defaultDescriptions.next;
      if (query.get('type') === 'upcoming') return defaultDescriptions.upcoming;
      if (query.get('type') === 'someday') return defaultDescriptions.someday;
      if (query.get('status') === 'done') return defaultDescriptions.completed;
      return defaultDescriptions.allTasks;
    }
  } catch (error) {
    console.error("Error in getDescription:", error);
    return "Tasks overview";
  }
};