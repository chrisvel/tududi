import React, { useState, useEffect, useRef, useCallback } from "react";
import { PriorityType, StatusType, Task } from "../../entities/Task";
import TaskActions from "./TaskActions";
import ConfirmDialog from "../Shared/ConfirmDialog";
import CollapsibleSection from "../Shared/CollapsibleSection";
import { useToast } from "../Shared/ToastContext";
import TimelinePanel from "./TimelinePanel";
import { Project } from "../../entities/Project";
import { useStore } from "../../store/useStore";
import { fetchTags } from '../../utils/tagsService';
import { fetchTaskById } from '../../utils/tasksService';
import { getTaskIntelligenceEnabled } from '../../utils/profileService';
import { analyzeTaskName, TaskAnalysis } from '../../utils/taskIntelligenceService';
import { useTranslation } from "react-i18next";
import { ClockIcon } from "@heroicons/react/24/outline";

// Import form sections
import TaskTitleSection from "./TaskForm/TaskTitleSection";
import TaskContentSection from "./TaskForm/TaskContentSection";
import TaskTagsSection from "./TaskForm/TaskTagsSection";
import TaskProjectSection from "./TaskForm/TaskProjectSection";
import TaskMetadataSection from "./TaskForm/TaskMetadataSection";
import TaskRecurrenceSection from "./TaskForm/TaskRecurrenceSection";

interface TaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  task: Task;
  onSave: (task: Task) => void;
  onDelete: (taskId: number) => Promise<void>;
  projects: Project[];
  onCreateProject: (name: string) => Promise<Project>;
  onEditParentTask?: (parentTask: Task) => void;
}

const TaskModal: React.FC<TaskModalProps> = ({
  isOpen,
  onClose,
  task,
  onSave,
  onDelete,
  projects,
  onCreateProject,
  onEditParentTask,
}) => {
  const [formData, setFormData] = useState<Task>(task);
  const [tags, setTags] = useState<string[]>(task.tags?.map((tag) => tag.name) || []);
  const [filteredProjects, setFilteredProjects] = useState<Project[]>(projects || []);
  const [newProjectName, setNewProjectName] = useState<string>("");
  const [isCreatingProject, setIsCreatingProject] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);
  const [isClosing, setIsClosing] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [localAvailableTags, setLocalAvailableTags] = useState<Array<{name: string}>>([]);
  const [tagsLoaded, setTagsLoaded] = useState(false);
  const [tagsLoading, setTagsLoading] = useState(false);
  const [parentTask, setParentTask] = useState<Task | null>(null);
  const [parentTaskLoading, setParentTaskLoading] = useState(false);
  const [taskAnalysis, setTaskAnalysis] = useState<TaskAnalysis | null>(null);
  const [taskIntelligenceEnabled, setTaskIntelligenceEnabled] = useState(true);
  const [isTimelineExpanded, setIsTimelineExpanded] = useState(false);
  
  // Collapsible section states
  const [expandedSections, setExpandedSections] = useState({
    tags: false,
    project: false,
    metadata: false,
    recurrence: false
  });
  
  const { showSuccessToast, showErrorToast } = useToast();
  const { t } = useTranslation();

  const toggleSection = useCallback((section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  }, []);

  useEffect(() => {
    setFormData(task);
    setTags(task.tags?.map((tag) => tag.name) || []);
    
    // Analyze task name and show helper when modal opens (only if intelligence is enabled)
    if (isOpen && task.name && taskIntelligenceEnabled) {
      const analysis = analyzeTaskName(task.name);
      setTaskAnalysis(analysis);
    } else {
      setTaskAnalysis(null);
    }
    
    // Safely find the current project, handling the case where projects might be undefined
    const currentProject = projects?.find((project) => project.id === task.project_id);
    setNewProjectName(currentProject ? currentProject.name : '');
    
    // Fetch parent task if this is a child task
    const fetchParentTask = async () => {
      if (task.recurring_parent_id && isOpen) {
        setParentTaskLoading(true);
        try {
          const parent = await fetchTaskById(task.recurring_parent_id);
          setParentTask(parent);
        } catch (error) {
          console.error('Error fetching parent task:', error);
          setParentTask(null);
        } finally {
          setParentTaskLoading(false);
        }
      } else {
        setParentTask(null);
      }
    };

    fetchParentTask();
  }, [task, projects, isOpen, taskIntelligenceEnabled]);

  // Fetch task intelligence setting when modal opens
  useEffect(() => {
    const fetchTaskIntelligenceSetting = async () => {
      if (isOpen) {
        try {
          const enabled = await getTaskIntelligenceEnabled();
          setTaskIntelligenceEnabled(enabled);
        } catch (error) {
          console.error('Error fetching task intelligence setting:', error);
          setTaskIntelligenceEnabled(true); // Default to enabled
        }
      }
    };

    fetchTaskIntelligenceSetting();
  }, [isOpen]);

  const handleEditParent = () => {
    if (parentTask && onEditParentTask) {
      onEditParentTask(parentTask);
      onClose(); // Close current modal
    }
  };

  const handleParentRecurrenceChange = (field: string, value: any) => {
    // Update the parent task data in local state
    if (parentTask) {
      setParentTask({ ...parentTask, [field]: value });
    }
    // Also update the form data to reflect the change
    setFormData(prev => ({ ...prev, [field]: value, update_parent_recurrence: true }));
  };

  useEffect(() => {
    const loadTags = async () => {
      if (isOpen && !tagsLoaded) {
        setTagsLoading(true);
        try {
          const fetchedTags = await fetchTags();
          setLocalAvailableTags(fetchedTags);
          setTagsLoaded(true);
        } catch (error: any) {
          console.error("Error fetching tags:", error);
          setTagsLoaded(true); // Mark as loaded even on error to prevent retry loop
        } finally {
          setTagsLoading(false);
        }
      }
    };

    // Only load tags if modal is open
    if (isOpen) {
      loadTags();
    }
  }, [isOpen, tagsLoaded]);

  const getPriorityString = (priority: PriorityType | number | undefined): PriorityType => {
    if (typeof priority === 'number') {
      const priorityNames: PriorityType[] = ['low', 'medium', 'high'];
      return priorityNames[priority] || 'medium';
    }
    return priority || 'medium';
  };

  const getStatusString = (status: StatusType | number): StatusType => {
    if (typeof status === 'number') {
      const statusNames: StatusType[] = ['not_started', 'in_progress', 'done', 'archived'];
      return statusNames[status] || 'not_started';
    }
    return status;
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    
    // Analyze task name in real-time (only if intelligence is enabled)
    if (name === 'name' && taskIntelligenceEnabled) {
      const analysis = analyzeTaskName(value);
      setTaskAnalysis(analysis);
    }
  };

  const handleRecurrenceChange = (field: string, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleTagsChange = useCallback((newTags: string[]) => {
    setTags(newTags);
    setFormData((prev) => ({
      ...prev,
      tags: newTags.map((name) => ({ name })),
    }));
  }, []);

  const handleProjectSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value.toLowerCase();
    setNewProjectName(query);
    setDropdownOpen(true);
    setFilteredProjects(
      projects.filter((project) =>
        project.name.toLowerCase().includes(query)
      )
    );
  };

  const handleProjectSelection = (project: Project) => {
    setFormData({ ...formData, project_id: project.id });
    setNewProjectName(project.name);
    setDropdownOpen(false);
  };

  const handleCreateProject = async () => {
    if (newProjectName.trim() !== "") {
      setIsCreatingProject(true);
      try {
        const newProject = await onCreateProject(newProjectName);
        setFormData({ ...formData, project_id: newProject.id });
        setFilteredProjects([...filteredProjects, newProject]);
        setNewProjectName(newProject.name);
        setDropdownOpen(false);
        showSuccessToast(t('success.projectCreated'));
      } catch (error) {
        showErrorToast(t('errors.projectCreationFailed'));
        console.error("Error creating project:", error);
      } finally {
        setIsCreatingProject(false);
      }
    }
  };

  const handleSubmit = () => {
    onSave({ ...formData, tags: tags.map((tag) => ({ name: tag })) });
    const taskLink = (
      <span>
        {t('task.updated', 'Task')} <a href={`/task/${formData.uuid}`} className="text-green-200 underline hover:text-green-100">{formData.name}</a> {t('task.updatedSuccessfully', 'updated successfully!')}
      </span>
    );
    showSuccessToast(taskLink);
    handleClose();
  };

  const handleDeleteClick = () => {
    setShowConfirmDialog(true);
  };

  const handleDeleteConfirm = async () => {
    if (formData.id) {
      try {
        await onDelete(formData.id);
        const taskLink = (
          <span>
            {t('task.deleted', 'Task')} <a href={`/task/${formData.uuid}`} className="text-green-200 underline hover:text-green-100">{formData.name}</a> {t('task.deletedSuccessfully', 'deleted successfully!')}
          </span>
        );
        showSuccessToast(taskLink);
        setShowConfirmDialog(false);
        handleClose();
      } catch (error) {
        console.error('Failed to delete task:', error);
        showErrorToast(t('task.deleteError', 'Failed to delete task'));
      }
    }
  };

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      onClose();
      setIsClosing(false);
      setTagsLoaded(false); // Reset tags loaded state for next modal open
    }, 300);
  };

  useEffect(() => {
    setFilteredProjects(projects || []);
  }, [projects]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
        handleClose();
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        handleClose();
      }
    };
    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <>
      <div
        className={`fixed top-16 left-0 right-0 bottom-0 bg-gray-900 bg-opacity-80 z-40 transition-opacity duration-300 overflow-y-auto ${
          isClosing ? "opacity-0" : "opacity-100"
        }`}
      >
        <div className="min-h-full flex items-start justify-center px-4 py-4">
          <div
            ref={modalRef}
            className={`bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-800 sm:rounded-lg sm:shadow-2xl w-full sm:max-w-6xl transform transition-transform duration-300 ${
              isClosing ? "scale-95" : "scale-100"
            } my-4`}
          >
            <div className="flex flex-col lg:flex-row min-h-[400px] max-h-[90vh]">
              {/* Main Form Section */}
              <div className={`flex-1 flex flex-col transition-all duration-300 ${
                isTimelineExpanded ? 'lg:pr-2' : ''
              }`}>
                <div className="flex-1 overflow-y-auto">
                  <form>
                    <fieldset>
                      {/* Task Title Section - Always Visible */}
                      <TaskTitleSection
                        taskId={task.id}
                        value={formData.name}
                        onChange={handleChange}
                        taskAnalysis={taskAnalysis}
                        taskIntelligenceEnabled={taskIntelligenceEnabled}
                      />

                      {/* Content Section - Always Visible */}
                      <TaskContentSection
                        taskId={task.id}
                        value={formData.note || ""}
                        onChange={handleChange}
                      />

                      {/* Tags Section - Collapsible */}
                      <CollapsibleSection 
                        title={t('forms.task.labels.tags', 'Tags')} 
                        isExpanded={expandedSections.tags}
                        onToggle={() => toggleSection('tags')}
                      >
                        <TaskTagsSection
                          tags={formData.tags?.map((tag) => tag.name) || []}
                          onTagsChange={handleTagsChange}
                          availableTags={localAvailableTags}
                        />
                      </CollapsibleSection>

                      {/* Project Section - Collapsible */}
                      <CollapsibleSection 
                        title={t('forms.task.labels.project', 'Project')} 
                        isExpanded={expandedSections.project}
                        onToggle={() => toggleSection('project')}
                      >
                        <TaskProjectSection
                          newProjectName={newProjectName}
                          onProjectSearch={handleProjectSearch}
                          dropdownOpen={dropdownOpen}
                          filteredProjects={filteredProjects}
                          onProjectSelection={handleProjectSelection}
                          onCreateProject={handleCreateProject}
                          isCreatingProject={isCreatingProject}
                        />
                      </CollapsibleSection>

                      {/* Metadata/Options Section - Collapsible */}
                      <CollapsibleSection 
                        title={t('forms.task.statusAndOptions', 'Status & Options')} 
                        isExpanded={expandedSections.metadata}
                        onToggle={() => toggleSection('metadata')}
                      >
                        <TaskMetadataSection
                          status={getStatusString(formData.status)}
                          priority={getPriorityString(formData.priority)}
                          dueDate={formData.due_date || ""}
                          taskId={task.id}
                          onStatusChange={(value: StatusType) => {
                            // Universal rule: when setting status to in_progress, also add to today
                            const updatedData = { ...formData, status: value };
                            if (value === 'in_progress') {
                              updatedData.today = true;
                            }
                            setFormData(updatedData);
                          }}
                          onPriorityChange={(value: PriorityType) =>
                            setFormData({ ...formData, priority: value })
                          }
                          onDueDateChange={handleChange}
                        />
                      </CollapsibleSection>

                      {/* Recurrence Section - Collapsible */}
                      <CollapsibleSection 
                        title={t('forms.task.recurrence', 'Recurrence')} 
                        isExpanded={expandedSections.recurrence}
                        onToggle={() => toggleSection('recurrence')}
                      >
                        <TaskRecurrenceSection
                          formData={formData}
                          parentTask={parentTask}
                          parentTaskLoading={parentTaskLoading}
                          onRecurrenceChange={handleRecurrenceChange}
                          onEditParent={parentTask ? handleEditParent : undefined}
                          onParentRecurrenceChange={parentTask ? handleParentRecurrenceChange : undefined}
                        />
                      </CollapsibleSection>
                    </fieldset>
                  </form>
                </div>
                
                {/* Action Buttons - Fixed at bottom */}
                <div className="flex-shrink-0 p-3 flex items-center justify-between">
                <TaskActions
                  taskId={task.id}
                  onDelete={handleDeleteClick}
                  onSave={handleSubmit}
                  onCancel={handleClose}
                />
                
                {/* Timeline Toggle Button */}
                <button
                  onClick={() => setIsTimelineExpanded(!isTimelineExpanded)}
                  className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
                  title={isTimelineExpanded ? t('timeline.hideActivityTimeline') : t('timeline.showActivityTimeline')}
                >
                  <ClockIcon 
                    className={`h-5 w-5 transition-transform duration-200 ${isTimelineExpanded ? 'rotate-180' : ''}`} 
                  />
                </button>
                </div>
              </div>
              
              {/* Timeline Panel - Side Panel */}
              <TimelinePanel
                taskId={task.id}
                isExpanded={isTimelineExpanded}
                onToggle={() => setIsTimelineExpanded(!isTimelineExpanded)}
              />
            </div>
          </div>
        </div>
      </div>
      {showConfirmDialog && (
        <ConfirmDialog
          title={t('modals.deleteTask.title', 'Delete Task')}
          message={t('modals.deleteTask.confirmation', 'Are you sure you want to delete this task? This action cannot be undone.')}
          onConfirm={handleDeleteConfirm}
          onCancel={() => setShowConfirmDialog(false)}
        />
      )}
    </>
  );
};

export default TaskModal;