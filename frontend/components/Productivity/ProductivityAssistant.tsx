import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  AcademicCapIcon,
  ExclamationTriangleIcon,
  ClockIcon,
  FolderIcon,
  ChevronDownIcon,
  ChevronRightIcon
} from '@heroicons/react/24/outline';
import { Task } from '../../entities/Task';
import { Project } from '../../entities/Project';
import TaskModal from '../Task/TaskModal';
import { fetchTaskById, updateTask, deleteTask } from '../../utils/tasksService';
import { fetchProjects, createProject } from '../../utils/projectsService';
import { useToast } from '../Shared/ToastContext';

interface ProductivityInsight {
  type: 'stalled_projects' | 'completed_no_next' | 'tasks_are_projects' | 'vague_tasks' | 'overdue_tasks' | 'stuck_projects';
  title: string;
  description: string;
  items: (Task | Project)[];
  icon: React.ComponentType<any>;
  color: string;
}

interface ProductivityAssistantProps {
  tasks: Task[];
  projects: Project[];
}

const ProductivityAssistant: React.FC<ProductivityAssistantProps> = ({ tasks, projects }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { showSuccessToast, showErrorToast } = useToast();
  
  const [isExpanded, setIsExpanded] = useState(false);
  const [insights, setInsights] = useState<ProductivityInsight[]>([]);
  const [expandedInsights, setExpandedInsights] = useState<Set<number>>(new Set());
  
  // Modal states
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [allProjects, setAllProjects] = useState<Project[]>(projects);
  const [loading, setLoading] = useState(false);

  const PROJECT_VERBS = ['plan', 'organize', 'set up', 'setup', 'fix', 'review', 'implement', 'create', 'build', 'develop'];
  const OVERDUE_THRESHOLD_DAYS = 30;

  useEffect(() => {
    const generateInsights = () => {
      const newInsights: ProductivityInsight[] = [];

      // Filter to only include non-completed tasks
      const activeTasks = tasks.filter(task => task.status !== 'done' && task.status !== 'completed');

      // 1. Stalled Projects (no tasks/actions)
      const stalledProjects = projects.filter(project => 
        project.active && !activeTasks.some(task => task.project_id === project.id)
      );
      
      if (stalledProjects.length > 0) {
        newInsights.push({
          type: 'stalled_projects',
          title: t('productivity.stalledProjects', 'Stalled Projects'),
          description: t('productivity.stalledProjectsDesc', 'These projects have no tasks or actions'),
          items: stalledProjects,
          icon: FolderIcon,
          color: 'text-red-500'
        });
      }

      // 2. Projects with completed tasks but no next action
      const projectsNeedingNextAction = projects.filter(project => {
        const projectTasks = tasks.filter(task => task.project_id === project.id);
        const hasCompletedTasks = projectTasks.some(task => task.status === 'done' || task.status === 'completed');
        const hasNextAction = activeTasks.some(task => 
          task.project_id === project.id && (task.status === 'not_started' || task.status === 'in_progress')
        );
        return project.active && hasCompletedTasks && !hasNextAction;
      });

      if (projectsNeedingNextAction.length > 0) {
        newInsights.push({
          type: 'completed_no_next',
          title: t('productivity.needsNextAction', 'Projects Need Next Action'),
          description: t('productivity.needsNextActionDesc', 'These projects have completed tasks but no next action'),
          items: projectsNeedingNextAction,
          icon: ExclamationTriangleIcon,
          color: 'text-yellow-500'
        });
      }

      // 3. Tasks that are actually projects
      const tasksAreProjects = activeTasks.filter(task => {
        const taskName = task.name.toLowerCase();
        return PROJECT_VERBS.some(verb => taskName.includes(verb)) && 
               taskName.length > 30; // Longer tasks are more likely to be projects
      });

      if (tasksAreProjects.length > 0) {
        newInsights.push({
          type: 'tasks_are_projects',
          title: t('productivity.tasksAreProjects', 'Tasks That Look Like Projects'),
          description: t('productivity.tasksAreProjectsDesc', 'These tasks might need to be broken down'),
          items: tasksAreProjects,
          icon: AcademicCapIcon,
          color: 'text-blue-500'
        });
      }

      // 4. Tasks without clear verbs
      const vagueTasks = activeTasks.filter(task => {
        const taskName = task.name.toLowerCase().trim();
        
        // Skip if it's already a next action (contains →)
        if (taskName.includes('→')) return false;
        
        // More comprehensive action verb patterns
        const actionVerbPatterns = [
          // Direct action verbs at start
          /^(call|email|text|message|phone|contact)/,
          /^(write|draft|compose|type|create|make)/,
          /^(read|review|check|examine|study|analyze)/,
          /^(buy|purchase|order|get|obtain|acquire)/,
          /^(schedule|book|arrange|plan|set up|setup)/,
          /^(meet|discuss|talk|speak|chat)/,
          /^(send|deliver|ship|mail|forward)/,
          /^(update|edit|modify|change|fix|correct)/,
          /^(finish|complete|finalize|wrap up)/,
          /^(submit|file|upload|post|publish)/,
          /^(organize|sort|clean|tidy|arrange)/,
          /^(research|find|search|look up|investigate)/,
          /^(prepare|gather|collect|assemble)/,
          /^(install|download|set up|configure)/,
          /^(test|try|experiment|validate)/,
          /^(backup|save|export|archive)/,
          /^(delete|remove|uninstall|cancel)/,
          
          // Gerund forms (-ing verbs) which are often good actions
          /^(calling|emailing|writing|reading|buying|scheduling|meeting|sending|updating|finishing|submitting|organizing|researching|preparing|installing|testing|backing)/,
          
          // Question patterns (usually clear next actions)
          /^(what|how|when|where|why|which)/,
          /\?$/,
          
          // Imperative patterns with objects
          /^(add|remove|insert|attach|include|exclude)/,
          /^(start|begin|initiate|launch|kick off)/,
          /^(stop|end|terminate|close|shut)/,
          
          // Common task patterns
          /^(follow up|followup)/,
          /^(sign up|signup)/,
          /^(log in|login)/,
          /^(pick up|pickup)/,
          /^(drop off|dropoff)/,
          /^(set up|setup)/,
          /^(clean up|cleanup)/,
          /^(wrap up|wrapup)/
        ];
        
        // Check if task starts with any action verb pattern
        const hasActionVerb = actionVerbPatterns.some(pattern => pattern.test(taskName));
        if (hasActionVerb) return false;
        
        // Check for common non-actionable patterns (these are vague)
        const vaguePatterns = [
          // Single words without context
          /^[a-zA-Z]+$/,
          // Just names without action
          /^[A-Z][a-z]+ [A-Z][a-z]+$/,
          // Just project/area names
          /^(project|website|app|system|process|issue|problem|bug|feature)$/i,
          // Very short tasks without clear action (less than 3 words)
          /^(\w+\s+\w+|^\w+)$/
        ];
        
        // Only flag as vague if it matches vague patterns AND is not clearly actionable
        const isVague = vaguePatterns.some(pattern => pattern.test(taskName));
        
        // Additional checks for good tasks that shouldn't be flagged
        const hasGoodStructure = (
          taskName.length > 15 || // Longer tasks are usually more specific
          taskName.split(' ').length > 3 || // More than 3 words usually means more specific
          /\b(for|with|to|from|about|regarding|re:|fwd:)\b/.test(taskName) || // Prepositions indicate context
          /\b(tomorrow|today|monday|tuesday|wednesday|thursday|friday|saturday|sunday|next week|this week)\b/.test(taskName) || // Time references
          /\b(project|meeting|appointment|deadline|due|urgent|important)\b/.test(taskName) // Context indicators
        );
        
        return isVague && !hasGoodStructure;
      });

      if (vagueTasks.length > 0) {
        newInsights.push({
          type: 'vague_tasks',
          title: t('productivity.vagueTasks', 'Tasks Without Clear Action'),
          description: t('productivity.vagueTasksDesc', 'These tasks need clearer action verbs'),
          items: vagueTasks,
          icon: ExclamationTriangleIcon,
          color: 'text-orange-500'
        });
      }

      // 5. Overdue or stale tasks
      const now = new Date();
      const thresholdDate = new Date(now.getTime() - (OVERDUE_THRESHOLD_DAYS * 24 * 60 * 60 * 1000));
      
      const staleTasks = activeTasks.filter(task => {
        const taskDate = task.updated_at ? new Date(task.updated_at) : 
                        task.created_at ? new Date(task.created_at) : null;
        
        return taskDate && taskDate < thresholdDate;
      });

      if (staleTasks.length > 0) {
        newInsights.push({
          type: 'overdue_tasks',
          title: t('productivity.staleTasks', 'Stale Tasks'),
          description: t('productivity.staleTasksDesc', 'Tasks not updated in {{days}} days', { days: OVERDUE_THRESHOLD_DAYS }),
          items: staleTasks,
          icon: ClockIcon,
          color: 'text-gray-500'
        });
      }

      // 6. Stuck projects (not updated in a month)
      const stuckProjects = projects.filter(project => {
        if (!project.active) return false;
        
        const projectDate = project.updated_at ? new Date(project.updated_at) : 
                           project.created_at ? new Date(project.created_at) : null;
        
        return projectDate && projectDate < thresholdDate;
      });

      if (stuckProjects.length > 0) {
        newInsights.push({
          type: 'stuck_projects',
          title: t('productivity.stuckProjects', 'Stuck Projects'),
          description: t('productivity.stuckProjectsDesc', 'Projects not updated recently'),
          items: stuckProjects,
          icon: FolderIcon,
          color: 'text-purple-500'
        });
      }

      setInsights(newInsights);
    };

    generateInsights();
  }, [tasks, projects, t]);

  const totalIssues = insights.reduce((sum, insight) => sum + insight.items.length, 0);

  const toggleInsightExpansion = (index: number) => {
    const newExpanded = new Set(expandedInsights);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedInsights(newExpanded);
  };

  const handleItemClick = async (item: Task | Project) => {
    const isTask = 'status' in item;
    
    if (isTask) {
      // Handle task click - open task modal
      try {
        setLoading(true);
        const fullTask = await fetchTaskById(item.id!);
        setSelectedTask(fullTask);
        setIsTaskModalOpen(true);
      } catch (error) {
        console.error('Failed to fetch task:', error);
        showErrorToast(t('errors.failedToLoadTask', 'Failed to load task'));
      } finally {
        setLoading(false);
      }
    } else {
      // Handle project click - navigate to project page
      navigate(`/project/${item.id}`);
    }
  };

  const handleTaskSave = async (updatedTask: Task) => {
    try {
      if (updatedTask.id) {
        await updateTask(updatedTask.id, updatedTask);
        setIsTaskModalOpen(false);
        setSelectedTask(null);
        showSuccessToast(t('task.updateSuccess', 'Task updated successfully'));
        // Optionally refresh the parent component data
      }
    } catch (error) {
      console.error('Failed to update task:', error);
      showErrorToast(t('task.updateError', 'Failed to update task'));
    }
  };

  const handleTaskDelete = async () => {
    try {
      if (selectedTask?.id) {
        await deleteTask(selectedTask.id);
        setIsTaskModalOpen(false);
        setSelectedTask(null);
        showSuccessToast(t('task.deleteSuccess', 'Task deleted successfully'));
        // Optionally refresh the parent component data
      }
    } catch (error) {
      console.error('Failed to delete task:', error);
      showErrorToast(t('task.deleteError', 'Failed to delete task'));
    }
  };

  const handleCreateProject = async (name: string): Promise<Project> => {
    try {
      const project = await createProject({ name, active: true });
      setAllProjects(prev => [...prev, project]);
      return project;
    } catch (error) {
      console.error('Failed to create project:', error);
      throw error;
    }
  };

  // Load projects when component mounts
  useEffect(() => {
    const loadProjects = async () => {
      try {
        const projectsData = await fetchProjects();
        setAllProjects(Array.isArray(projectsData) ? projectsData : []);
      } catch (error) {
        console.error('Failed to load projects:', error);
      }
    };
    
    if (projects.length === 0) {
      loadProjects();
    } else {
      setAllProjects(projects);
    }
  }, [projects]);

  if (totalIssues === 0) {
    return null;
  }

  return (
    <div className="mb-6 p-4 bg-white dark:bg-gray-900 border-l-4 border-yellow-500 rounded-lg shadow">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center w-full"
      >
        <ExclamationTriangleIcon className="h-6 w-6 text-yellow-500 dark:text-yellow-400 mr-3" />
        <div className="flex-1 text-left">
          <p className="text-gray-700 dark:text-gray-300 font-medium">
            {t('productivity.issuesFound', 'Found {{count}} productivity issue(s) that need attention', { count: totalIssues })}
          </p>
          <p className="text-yellow-600 dark:text-yellow-400 text-sm">
            {t('productivity.reviewItems', 'Click to review and improve your workflow')}
          </p>
        </div>
        {isExpanded ? (
          <ChevronDownIcon className="h-5 w-5 text-yellow-500" />
        ) : (
          <ChevronRightIcon className="h-5 w-5 text-yellow-500" />
        )}
      </button>

      {isExpanded && (
        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
          <div className="space-y-4">
            {insights.map((insight, index) => (
              <div key={index} className="border-l-4 border-gray-200 dark:border-gray-600 pl-4">
                <div className="flex items-start space-x-3">
                  <insight.icon className={`h-5 w-5 mt-0.5 ${insight.color}`} />
                  <div className="flex-1">
                    <h4 className="font-medium text-gray-900 dark:text-gray-100">
                      {insight.title} ({insight.items.length})
                    </h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                      {insight.description}
                    </p>
                    <div className="space-y-1">
                      {(expandedInsights.has(index) ? insight.items : insight.items.slice(0, 3)).map((item, itemIndex) => {
                        return (
                          <div key={itemIndex} className="text-sm">
                            <button 
                              onClick={() => handleItemClick(item)}
                              className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 underline text-left"
                              disabled={loading}
                            >
                              • {item.name}
                            </button>
                          </div>
                        );
                      })}
                      {insight.items.length > 3 && (
                        <button
                          onClick={() => toggleInsightExpansion(index)}
                          className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 underline cursor-pointer"
                        >
                          {expandedInsights.has(index) 
                            ? '... show less' 
                            : `... and ${insight.items.length - 3} more items`
                          }
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
          
          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {t('productivity.suggestion', 'Click on any item above to open it and make improvements.')}
            </p>
          </div>
        </div>
      )}
      
      {/* Task Modal */}
      {selectedTask && (
        <TaskModal
          isOpen={isTaskModalOpen}
          onClose={() => {
            setIsTaskModalOpen(false);
            setSelectedTask(null);
          }}
          task={selectedTask}
          onSave={handleTaskSave}
          onDelete={handleTaskDelete}
          projects={allProjects}
          onCreateProject={handleCreateProject}
        />
      )}
    </div>
  );
};

export default ProductivityAssistant;