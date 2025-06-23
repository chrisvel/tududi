import React, { useState, useEffect, useRef, useCallback } from "react";
import { PriorityType, StatusType, Task, RecurrenceType } from "../../entities/Task";
import TaskActions from "./TaskActions";
import PriorityDropdown from "../Shared/PriorityDropdown";
import StatusDropdown from "../Shared/StatusDropdown";
import ConfirmDialog from "../Shared/ConfirmDialog";
import { useToast } from "../Shared/ToastContext";
import TagInput from "../Tag/TagInput";
import RecurrenceInput from "./RecurrenceInput";
import TaskTimeline from "./TaskTimeline";
import { Project } from "../../entities/Project";
import { useStore } from "../../store/useStore";
import { fetchTags } from '../../utils/tagsService';
import { fetchTaskById } from '../../utils/tasksService';
import { getTaskIntelligenceEnabled } from '../../utils/profileService';
import { analyzeTaskName, TaskAnalysis } from '../../utils/taskIntelligenceService';
import { useTranslation } from "react-i18next";

interface TaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  task: Task;
  onSave: (task: Task) => void;
  onDelete: (taskId: number) => void;
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
  const { showSuccessToast, showErrorToast } = useToast();
  const { t } = useTranslation();

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
        showSuccessToast("Project created successfully!");
      } catch (error) {
        showErrorToast("Failed to create project.");
        console.error("Error creating project:", error);
      } finally {
        setIsCreatingProject(false);
      }
    }
  };

  const handleSubmit = () => {
    onSave({ ...formData, tags: tags.map((tag) => ({ name: tag })) });
    showSuccessToast("Task updated successfully!");
    handleClose();
  };

  const handleDeleteClick = () => {
    setShowConfirmDialog(true);
  };

  const handleDeleteConfirm = () => {
    if (formData.id) {
      onDelete(formData.id);
      showSuccessToast("Task deleted successfully!");
      setShowConfirmDialog(false);
      handleClose();
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
            <div className="flex flex-col lg:flex-row h-[calc(100vh-8rem)] max-h-[630px]">
              {/* Main Form Section */}
              <div className="flex-1 p-4 space-y-3 text-sm overflow-y-auto">
                <form>
                  <fieldset>
                  <div className="py-4">
                    <input
                      type="text"
                      id={`task_name_${task.id}`}
                      name="name"
                      value={formData.name}
                      onChange={handleChange}
                      required
                      className="block w-full text-xl font-semibold dark:bg-gray-800 text-black dark:text-white border-b-2 border-gray-200 dark:border-gray-900 focus:outline-none shadow-sm py-2"
                      placeholder={t('forms.task.namePlaceholder', 'Add Task Name')}
                    />
                    {taskAnalysis && taskAnalysis.isVague && taskIntelligenceEnabled && (
                      <div className={`mt-2 p-3 rounded-md border ${
                        taskAnalysis.severity === 'high' 
                          ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-700'
                          : taskAnalysis.severity === 'medium'
                            ? 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-700'
                            : 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-700'
                      }`}>
                        <div className="flex items-start">
                          <div className="flex-shrink-0">
                            <svg className={`h-4 w-4 mt-0.5 ${
                              taskAnalysis.severity === 'high' 
                                ? 'text-red-400'
                                : taskAnalysis.severity === 'medium'
                                  ? 'text-yellow-400'
                                  : 'text-blue-400'
                            }`} fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                            </svg>
                          </div>
                          <div className="ml-2">
                            <p className={`text-sm ${
                              taskAnalysis.severity === 'high' 
                                ? 'text-red-800 dark:text-red-200'
                                : taskAnalysis.severity === 'medium'
                                  ? 'text-yellow-800 dark:text-yellow-200'
                                  : 'text-blue-800 dark:text-blue-200'
                            }`}>
                              <strong>
                                {taskAnalysis.reason === 'short' && t('task.nameHelper.short', 'Make it more descriptive!')}
                                {taskAnalysis.reason === 'no_verb' && t('task.nameHelper.noVerb', 'Add an action verb!')}
                                {taskAnalysis.reason === 'vague_pattern' && t('task.nameHelper.vague', 'Be more specific!')}
                              </strong>
                            </p>
                            {taskAnalysis.suggestion && (
                              <p className={`text-xs mt-1 ${
                                taskAnalysis.severity === 'high' 
                                  ? 'text-red-700 dark:text-red-300'
                                  : taskAnalysis.severity === 'medium'
                                    ? 'text-yellow-700 dark:text-yellow-300'
                                    : 'text-blue-700 dark:text-blue-300'
                              }`}>
                                {t(taskAnalysis.suggestion, taskAnalysis.suggestion)}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="pb-3">
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
                      {t('forms.task.labels.tags', 'Tags')}
                    </label>
                    <div className="w-full">
                      <TagInput
                        onTagsChange={handleTagsChange}
                        initialTags={formData.tags?.map((tag) => tag.name) || []}
                        availableTags={localAvailableTags}
                      />
                    </div>
                  </div>
                  <div className="pb-3 relative">
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-3">
                      {t('forms.task.labels.project', 'Project')}
                    </label>
                    <input
                      type="text"
                      placeholder={t('forms.task.projectSearchPlaceholder', 'Search or create a project...')}
                      value={newProjectName}
                      onChange={handleProjectSearch}
                      className="block w-full border border-gray-300 dark:border-gray-900 rounded-md focus:outline-none shadow-sm px-2 py-2 text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
                    />
                    {dropdownOpen && newProjectName && (
                      <div className="absolute mt-1 bg-white dark:bg-gray-900 shadow-md rounded-md w-full z-10">
                        {filteredProjects.length > 0 ? (
                          filteredProjects.map((project) => (
                            <button
                              key={project.id}
                              type="button"
                              onClick={() => handleProjectSelection(project)}
                              className="block w-full text-gray-500 dark:text-gray-300 text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-600"
                            >
                              {project.name}
                            </button>
                          ))
                        ) : (
                          <div className="px-4 py-2 text-gray-500 dark:text-gray-300">
                            {t('forms.task.noMatchingProjects', 'No matching projects')}
                          </div>
                        )}
                        {newProjectName && (
                          <button
                            type="button"
                            onClick={handleCreateProject}
                            disabled={isCreatingProject}
                            className="block w-full text-left px-4 py-2 bg-blue-500 text-white hover:bg-blue-600"
                          >
                            {isCreatingProject
                              ? t('forms.task.creatingProject', 'Creating...')
                              : t('forms.task.createProject', '+ Create') + ` "${newProjectName}"`}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 pb-3 sm:grid-flow-col">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-3">
                        {t('forms.task.labels.status', 'Status')}
                      </label>
                      <StatusDropdown
                        value={getStatusString(formData.status)}
                        onChange={(value: StatusType) =>
                          setFormData({ ...formData, status: value })
                        }
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-3">
                        {t('forms.task.labels.priority', 'Priority')}
                      </label>
                      <PriorityDropdown
                        value={getPriorityString(formData.priority)}
                        onChange={(value: PriorityType) =>
                          setFormData({ ...formData, priority: value })
                        }
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-3">
                        {t('forms.task.labels.dueDate', 'Due Date')}
                      </label>
                      <input
                        type="date"
                        id={`task_due_date_${task.id}`}
                        name="due_date"
                        value={formData.due_date || ""}
                        onChange={handleChange}
                        className="block w-full focus:outline-none shadow-sm px-2 py-2 text-sm bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-900 rounded-md text-gray-900 dark:text-gray-100"
                      />
                    </div>
                  </div>
                  <div className="pb-3">
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-3">
                      {t('forms.noteContent')}
                    </label>
                    <textarea
                      id={`task_note_${task.id}`}
                      name="note"
                      rows={3}
                      value={formData.note || ""}
                      onChange={handleChange}
                      className="block w-full border border-gray-300 dark:border-gray-900 rounded-md focus:outline-none shadow-sm p-3 text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
                      placeholder={t('forms.noteContentPlaceholder')}
                    ></textarea>
                  </div>
                  <RecurrenceInput
                    recurrenceType={parentTask ? (parentTask.recurrence_type || 'none') : (formData.recurrence_type || 'none')}
                    recurrenceInterval={parentTask ? (parentTask.recurrence_interval || 1) : (formData.recurrence_interval || 1)}
                    recurrenceEndDate={parentTask ? parentTask.recurrence_end_date : formData.recurrence_end_date}
                    recurrenceWeekday={parentTask ? parentTask.recurrence_weekday : formData.recurrence_weekday}
                    recurrenceMonthDay={parentTask ? parentTask.recurrence_month_day : formData.recurrence_month_day}
                    recurrenceWeekOfMonth={parentTask ? parentTask.recurrence_week_of_month : formData.recurrence_week_of_month}
                    completionBased={parentTask ? (parentTask.completion_based || false) : (formData.completion_based || false)}
                    onChange={handleRecurrenceChange}
                    disabled={!!parentTask}
                    isChildTask={!!parentTask}
                    parentTaskLoading={parentTaskLoading}
                    onEditParent={parentTask ? handleEditParent : undefined}
                    onParentRecurrenceChange={parentTask ? handleParentRecurrenceChange : undefined}
                  />
                </fieldset>
              </form>
              <div className="p-3 border-t border-gray-200 dark:border-gray-700">
                <TaskActions
                  taskId={task.id}
                  onDelete={handleDeleteClick}
                  onSave={handleSubmit}
                  onCancel={handleClose}
                />
              </div>
            </div>
            
            {/* Timeline Section */}
            <div className="w-full lg:w-80 border-t lg:border-t-0 lg:border-l border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 flex flex-col">
              <div className="p-3 lg:p-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
                <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 flex items-center">
                  <svg className="h-4 w-4 mr-2 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {t('Activity Timeline', 'Activity Timeline')}
                </h3>
              </div>
              <div className="p-3 lg:p-4 flex-1 overflow-hidden">
                <TaskTimeline taskId={task.id} />
              </div>
            </div>
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