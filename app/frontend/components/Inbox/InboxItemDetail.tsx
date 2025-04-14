import React, { useState, useEffect, useRef } from 'react';
import { InboxItem } from '../../entities/InboxItem';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { TrashIcon, PencilIcon, DocumentIcon, ListBulletIcon, CheckIcon, XMarkIcon, DocumentTextIcon } from '@heroicons/react/24/outline';
import { Task } from '../../entities/Task';
import { Project } from '../../entities/Project';
import { Note } from '../../entities/Note';
import { createTask } from '../../utils/tasksService';
import { createProject, fetchProjects } from '../../utils/projectsService';
import { createNote } from '../../utils/notesService';
import { useToast } from '../Shared/ToastContext';
import { useStore } from '../../store/useStore';

interface InboxItemDetailProps {
  item: InboxItem;
  onProcess: (id: number) => void;
  onDelete: (id: number) => void;
  onUpdate?: (id: number, content: string) => Promise<void>;
}

const InboxItemDetail: React.FC<InboxItemDetailProps> = ({ 
  item, 
  onProcess, 
  onDelete, 
  onUpdate 
}) => {
  const { t } = useTranslation();
  const { showSuccessToast, showErrorToast } = useToast();
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [showProjectForm, setShowProjectForm] = useState(false);
  const [showNoteForm, setShowNoteForm] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState(item.content);
  const [taskName, setTaskName] = useState(item.content);
  const [projectName, setProjectName] = useState(item.content);
  const [noteTitle, setNoteTitle] = useState('');
  const [noteContent, setNoteContent] = useState(item.content);
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const { areasStore } = useStore();
  const editInputRef = useRef<HTMLInputElement>(null);
  
  // Load projects for the task and note forms
  useEffect(() => {
    const loadProjects = async () => {
      try {
        const projectsData = await fetchProjects();
        setProjects(projectsData);
      } catch (error) {
        console.error('Error fetching projects:', error);
      }
    };
    
    if (showTaskForm || showNoteForm) {
      loadProjects();
    }
  }, [showTaskForm, showNoteForm]);
  
  // Focus on the edit input when entering edit mode
  useEffect(() => {
    if (isEditing && editInputRef.current) {
      editInputRef.current.focus();
    }
  }, [isEditing]);
  
  const handleCreateTask = async (taskData: Task) => {
    try {
      await createTask(taskData);
      showSuccessToast(t('task.createSuccess'));
      // Mark inbox item as processed
      if (item.id !== undefined) {
        onProcess(item.id);
      }
    } catch (error) {
      console.error('Failed to create task:', error);
      showErrorToast(t('task.createError'));
    }
  };
  
  const handleCreateProject = async (projectData: Project) => {
    try {
      await createProject(projectData);
      showSuccessToast(t('project.createSuccess'));
      // Mark inbox item as processed
      if (item.id !== undefined) {
        onProcess(item.id);
      }
    } catch (error) {
      console.error('Failed to create project:', error);
      showErrorToast(t('project.createError'));
    }
  };
  
  const handleCreateNote = async (noteData: Note) => {
    try {
      await createNote(noteData);
      showSuccessToast(t('note.createSuccess', 'Note created successfully'));
      // Mark inbox item as processed
      if (item.id !== undefined) {
        onProcess(item.id);
      }
    } catch (error) {
      console.error('Failed to create note:', error);
      showErrorToast(t('note.createError', 'Failed to create note'));
    }
  };
  
  const handleEditSave = async () => {
    if (!editedContent.trim()) {
      showErrorToast(t('inbox.contentRequired'));
      return;
    }
    
    try {
      if (onUpdate && item.id !== undefined) {
        await onUpdate(item.id, editedContent);
        showSuccessToast(t('inbox.itemUpdated'));
      }
      setIsEditing(false);
    } catch (error) {
      console.error('Failed to update inbox item:', error);
      showErrorToast(t('inbox.updateError'));
    }
  };
  
  const formattedDate = item.created_at 
    ? format(new Date(item.created_at), 'MMM dd, yyyy HH:mm')
    : '';
    
  const handleDelete = () => {
    if (item.id !== undefined) {
      onDelete(item.id);
    }
  };
    
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 hover:shadow-lg transition-shadow">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          {isEditing ? (
            <div className="flex items-center space-x-2">
              <input
                ref={editInputRef}
                type="text"
                value={editedContent}
                onChange={(e) => setEditedContent(e.target.value)}
                className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded dark:bg-gray-700 dark:text-white text-lg"
              />
              <button
                onClick={handleEditSave}
                className="p-2 text-green-600 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900 rounded-full"
                title={t('common.save')}
              >
                <CheckIcon className="h-5 w-5" />
              </button>
              <button
                onClick={() => {
                  setIsEditing(false);
                  setEditedContent(item.content); // Reset to original content
                }}
                className="p-2 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900 rounded-full"
                title={t('common.cancel')}
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>
          ) : (
            <p className="text-lg font-medium text-gray-900 dark:text-white break-words">
              {item.content}
            </p>
          )}
          <div className="flex items-center mt-2 text-sm text-gray-500 dark:text-gray-400">
            <span className="mr-2">{formattedDate}</span>
            <span className="capitalize px-2 py-1 rounded bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-100 text-xs">
              {item.source}
            </span>
          </div>
        </div>
        
        <div className="flex space-x-2">
          {!isEditing && (
            <>
              <button
                onClick={() => setIsEditing(true)}
                className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full"
                title={t('common.edit')}
              >
                <PencilIcon className="h-5 w-5" />
              </button>
              
              <button
                onClick={() => setShowTaskForm(true)}
                className="p-2 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900 rounded-full"
                title={t('inbox.createTask')}
              >
                <ListBulletIcon className="h-5 w-5" />
              </button>
              
              <button
                onClick={() => setShowProjectForm(true)}
                className="p-2 text-purple-600 dark:text-purple-400 hover:bg-purple-100 dark:hover:bg-purple-900 rounded-full"
                title={t('inbox.createProject')}
              >
                <DocumentIcon className="h-5 w-5" />
              </button>
              
              <button
                onClick={() => setShowNoteForm(true)}
                className="p-2 text-green-600 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900 rounded-full"
                title={t('inbox.createNote', 'Create Note')}
              >
                <DocumentTextIcon className="h-5 w-5" />
              </button>
              
              <button
                onClick={handleDelete}
                className="p-2 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900 rounded-full"
                title={t('common.delete')}
              >
                <TrashIcon className="h-5 w-5" />
              </button>
            </>
          )}
        </div>
      </div>
      
      {/* Task Creation Form */}
      {showTaskForm && (
        <div className="mt-4 p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
          <h3 className="text-lg font-medium mb-3">{t('inbox.createTask')}</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('task.labels.name')}
              </label>
              <input 
                type="text" 
                value={taskName}
                onChange={(e) => setTaskName(e.target.value)}
                className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded dark:bg-gray-700 dark:text-white"
                placeholder={t('task.labels.name')}
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('task.labels.project')}
              </label>
              <select 
                className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded dark:bg-gray-700 dark:text-white"
              >
                <option value="">{t('common.none')}</option>
                {projects.map(project => (
                  <option key={project.id} value={project.id}>{project.name}</option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('task.labels.priority')}
              </label>
              <select 
                className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded dark:bg-gray-700 dark:text-white"
                defaultValue="medium"
              >
                <option value="low">{t('priority.low')}</option>
                <option value="medium">{t('priority.medium')}</option>
                <option value="high">{t('priority.high')}</option>
              </select>
            </div>
            
            <div className="flex space-x-3">
              <button
                onClick={() => {
                  handleCreateTask({
                    name: taskName,
                    status: 'not_started',
                    priority: 'medium'
                  });
                  setShowTaskForm(false);
                }}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded"
              >
                {t('common.save')}
              </button>
              <button
                onClick={() => setShowTaskForm(false)}
                className="bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 px-4 py-2 rounded"
              >
                {t('common.cancel')}
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Project Creation Form */}
      {showProjectForm && (
        <div className="mt-4 p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
          <h3 className="text-lg font-medium mb-3">{t('inbox.createProject')}</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('project.name')}
              </label>
              <input 
                type="text" 
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded dark:bg-gray-700 dark:text-white"
                placeholder={t('project.name')}
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('forms.description')}
              </label>
              <textarea 
                className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded dark:bg-gray-700 dark:text-white"
                rows={3}
                placeholder={t('forms.description')}
              ></textarea>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('forms.priority')}
              </label>
              <select 
                className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded dark:bg-gray-700 dark:text-white"
                defaultValue="medium"
              >
                <option value="low">{t('priority.low')}</option>
                <option value="medium">{t('priority.medium')}</option>
                <option value="high">{t('priority.high')}</option>
              </select>
            </div>
            
            <div className="flex space-x-3">
              <button
                onClick={() => {
                  handleCreateProject({
                    name: projectName,
                    active: true
                  });
                  setShowProjectForm(false);
                }}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded"
              >
                {t('common.save')}
              </button>
              <button
                onClick={() => setShowProjectForm(false)}
                className="bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 px-4 py-2 rounded"
              >
                {t('common.cancel')}
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Note Creation Form */}
      {showNoteForm && (
        <div className="mt-4 p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
          <h3 className="text-lg font-medium mb-3">{t('inbox.createNote', 'Create Note')}</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('note.title', 'Title')}
              </label>
              <input 
                type="text" 
                value={noteTitle}
                onChange={(e) => setNoteTitle(e.target.value)}
                className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded dark:bg-gray-700 dark:text-white"
                placeholder={t('note.titlePlaceholder', 'Enter note title')}
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('note.content', 'Content')}
              </label>
              <textarea 
                value={noteContent}
                onChange={(e) => setNoteContent(e.target.value)}
                className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded dark:bg-gray-700 dark:text-white"
                rows={5}
                placeholder={t('note.contentPlaceholder', 'Enter note content')}
              ></textarea>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('note.project', 'Related Project (Optional)')}
              </label>
              <select 
                className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded dark:bg-gray-700 dark:text-white"
                value={selectedProjectId || ''}
                onChange={(e) => setSelectedProjectId(e.target.value ? parseInt(e.target.value) : null)}
              >
                <option value="">{t('common.none')}</option>
                {projects.map(project => (
                  <option key={project.id} value={project.id}>{project.name}</option>
                ))}
              </select>
            </div>
            
            <div className="flex space-x-3">
              <button
                onClick={() => {
                  const noteData: Note = {
                    title: noteTitle || item.content.substring(0, 50),
                    content: noteContent
                  };
                  
                  // Add project reference if a project was selected
                  if (selectedProjectId) {
                    const selectedProject = projects.find(p => p.id === selectedProjectId);
                    if (selectedProject) {
                      noteData.project = {
                        id: selectedProjectId,
                        name: selectedProject.name
                      };
                    }
                  }
                  
                  handleCreateNote(noteData);
                  setShowNoteForm(false);
                }}
                className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded"
              >
                {t('common.save')}
              </button>
              <button
                onClick={() => setShowNoteForm(false)}
                className="bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 px-4 py-2 rounded"
              >
                {t('common.cancel')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InboxItemDetail;