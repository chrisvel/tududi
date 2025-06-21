import React, { useState, useEffect, useCallback } from 'react';
import { Task } from '../../entities/Task';
import { Project } from '../../entities/Project';
import { Note } from '../../entities/Note';
import { 
  loadInboxItemsToStore, 
  processInboxItemWithStore, 
  deleteInboxItemWithStore, 
  updateInboxItemWithStore 
} from '../../utils/inboxService';
import InboxItemDetail from './InboxItemDetail';
import { useToast } from '../Shared/ToastContext';
import { useTranslation } from 'react-i18next';
import { InboxIcon } from '@heroicons/react/24/outline';
import LoadingScreen from '../Shared/LoadingScreen';
import TaskModal from '../Task/TaskModal';
import ProjectModal from '../Project/ProjectModal';
import NoteModal from '../Note/NoteModal';
import SimplifiedTaskModal from '../Task/SimplifiedTaskModal';
import { fetchProjects } from '../../utils/projectsService';
import { createTask } from '../../utils/tasksService';
import { createProject } from '../../utils/projectsService';
import { createNote } from '../../utils/notesService';
import { isUrl } from '../../utils/urlService';
import { useStore } from '../../store/useStore';

const InboxItems: React.FC = () => {
  const { t } = useTranslation();
  const { showSuccessToast, showErrorToast } = useToast();
  
  // Access store data
  const { inboxItems, isLoading } = useStore(state => state.inboxStore);
  
  // Modal states
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [isNoteModalOpen, setIsNoteModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  
  // Data for modals
  const [taskToEdit, setTaskToEdit] = useState<Task | null>(null);
  const [projectToEdit, setProjectToEdit] = useState<Project | null>(null);
  const [noteToEdit, setNoteToEdit] = useState<Note | null>(null);
  
  // Track the current inbox item ID being converted (for task/project/note conversion)
  const [currentConversionItemId, setCurrentConversionItemId] = useState<number | null>(null);
  
  // Track the current inbox item being edited
  const [itemToEdit, setItemToEdit] = useState<number | null>(null);
  
  // Fetch projects for modals
  const [projects, setProjects] = useState<Project[]>([]);
  
  // Wrapped in useCallback to prevent dependency issues in useEffect
  const refreshInboxItems = useCallback(() => {
    loadInboxItemsToStore();
  }, []);

  useEffect(() => {
    // Initial data loading
    refreshInboxItems();
    
    // Set up an event listener for force reload
    const handleForceReload = () => {
      // Wait a short time to ensure the backend has processed the new item
      setTimeout(() => {
        refreshInboxItems();
      }, 500);
    };
    
    // Handler for the inboxItemsUpdated custom event
    const handleInboxItemsUpdated = (event: CustomEvent<{count: number, firstItemContent: string}>) => {      
      // Show toast notifications for new items
      if (event.detail.count > 0) {
        // Show notification for the first new item
        showSuccessToast(t('inbox.newTelegramItem', 'New item from Telegram: {{content}}', { 
          content: event.detail.firstItemContent
        }));
        
        // If multiple new items, show a summary notification as well
        if (event.detail.count > 1) {
          showSuccessToast(t('inbox.multipleNewItems', '{{count}} more new items added', { 
            count: event.detail.count - 1 
          }));
        }
      }
    };
    
    // Set up polling for new inbox items (especially from Telegram)
    // This ensures real-time updates when items are added externally
    const pollInterval = setInterval(() => {
      refreshInboxItems();
    }, 5000); // Check for new items every 5 seconds
    
    // Add event listeners
    window.addEventListener('forceInboxReload', handleForceReload);
    window.addEventListener('inboxItemsUpdated', handleInboxItemsUpdated as EventListener);
    
    return () => {
      clearInterval(pollInterval);
      window.removeEventListener('forceInboxReload', handleForceReload);
      window.removeEventListener('inboxItemsUpdated', handleInboxItemsUpdated as EventListener);
    };
  }, [refreshInboxItems, showSuccessToast, t]);
  
  const handleProcessItem = async (id: number) => {
    try {
      await processInboxItemWithStore(id);
      showSuccessToast(t('inbox.itemProcessed'));
    } catch (error) {
      console.error('Failed to process inbox item:', error);
      showErrorToast(t('inbox.processError'));
    }
  };
  
  const handleUpdateItem = async (id: number): Promise<void> => {
    // When edit button is clicked, we open the SimplifiedTaskModal instead of doing inline editing
    setItemToEdit(id);
    setIsEditModalOpen(true);
  };
  
  const handleSaveEditedItem = async (text: string) => {
    try {
      if (itemToEdit !== null) {
        await updateInboxItemWithStore(itemToEdit, text);
        showSuccessToast(t('inbox.itemUpdated'));
      }
      setIsEditModalOpen(false);
      setItemToEdit(null);
    } catch (error) {
      console.error('Failed to update inbox item:', error);
      showErrorToast(t('inbox.updateError'));
    }
  };
  
  const handleDeleteItem = async (id: number) => {
    try {
      await deleteInboxItemWithStore(id);
      showSuccessToast(t('inbox.itemDeleted'));
    } catch (error) {
      console.error('Failed to delete inbox item:', error);
      showErrorToast(t('inbox.deleteError'));
    }
  };
  
  // Modal handlers
  const handleOpenTaskModal = async (task: Task, inboxItemId?: number) => {
    // Load projects first before opening the modal
    try {
      const projectData = await fetchProjects();
      // Make sure we always set an array
      setProjects(Array.isArray(projectData) ? projectData : []);
    } catch (error) {
      console.error('Failed to load projects:', error);
      showErrorToast(t('project.loadError', 'Failed to load projects'));
      setProjects([]); // Ensure we have an empty array even on error
    }
    
    setTaskToEdit(task);
    
    if (inboxItemId) {
      setCurrentConversionItemId(inboxItemId);
    }
    
    setIsTaskModalOpen(true);
  };
  
  const handleOpenProjectModal = (project: Project | null, inboxItemId?: number) => {
    setProjectToEdit(project);
    
    if (inboxItemId) {
      setCurrentConversionItemId(inboxItemId);
    }
    
    setIsProjectModalOpen(true);
  };
  
  const handleOpenNoteModal = (note: Note | null, inboxItemId?: number) => {
    // If note has content that's a URL, ensure it has a bookmark tag
    if (note && note.content && isUrl(note.content.trim())) {
      if (!note.tags) {
        note.tags = [{ name: 'bookmark' }];
      } else if (!note.tags.some(tag => tag.name === 'bookmark')) {
        note.tags.push({ name: 'bookmark' });
      }
    }
    
    setNoteToEdit(note);
    
    if (inboxItemId) {
      setCurrentConversionItemId(inboxItemId);
    }
    
    setIsNoteModalOpen(true);
  };
  
  const handleSaveTask = async (task: Task) => {
    try {
      await createTask(task);
      showSuccessToast(t('task.createSuccess'));
      
      // Process the inbox item after successful task creation
      if (currentConversionItemId !== null) {
        await handleProcessItem(currentConversionItemId);
        setCurrentConversionItemId(null);
      }
      
      setIsTaskModalOpen(false);
    } catch (error) {
      console.error('Failed to create task:', error);
      showErrorToast(t('task.createError'));
    }
  };
  
  const handleSaveProject = async (project: Project) => {
    try {
      await createProject(project);
      showSuccessToast(t('project.createSuccess'));
      
      // Process the inbox item after successful project creation
      if (currentConversionItemId !== null) {
        await handleProcessItem(currentConversionItemId);
        setCurrentConversionItemId(null);
      }
      
      setIsProjectModalOpen(false);
    } catch (error) {
      console.error('Failed to create project:', error);
      showErrorToast(t('project.createError'));
    }
  };

  
  const handleSaveNote = async (note: Note) => {
    try {
      // Check if the content appears to be a URL and add the bookmark tag
      const noteContent = note.content || '';
      const isBookmarkContent = isUrl(noteContent.trim());
      
      // Ensure tags property exists
      if (!note.tags) {
        note.tags = [];
      }
      
      // Add a bookmark tag if content is a URL and doesn't already have the tag
      if (isBookmarkContent && !note.tags.some(tag => tag.name === 'bookmark')) {
        // Use spread operator to create a new array with the bookmark tag added
        note.tags = [...note.tags, { name: 'bookmark' }];
      }
            
      // Create the note with proper tags
      await createNote(note);
      showSuccessToast(t('note.createSuccess', 'Note created successfully'));
      
      // Process the inbox item after successful note creation
      if (currentConversionItemId !== null) {
        await handleProcessItem(currentConversionItemId);
        setCurrentConversionItemId(null);
      }
      
      setIsNoteModalOpen(false);
    } catch (error) {
      console.error('Failed to create note:', error);
      showErrorToast(t('note.createError', 'Failed to create note'));
    }
  };
  
  const handleCreateProject = async (name: string): Promise<Project> => {
    try {
      const project = await createProject({ name, active: true });
      showSuccessToast(t('project.createSuccess'));
      return project;
    } catch (error) {
      console.error('Failed to create project:', error);
      showErrorToast(t('project.createError'));
      throw error;
    }
  };
  
  if (isLoading) {
    return <LoadingScreen />;
  }
  
  if (inboxItems.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 space-y-4 text-center text-gray-600 dark:text-gray-300">
        <InboxIcon className="h-16 w-16" />
        <h3 className="text-xl font-semibold">{t('inbox.empty')}</h3>
        <p>{t('inbox.emptyDescription')}</p>
      </div>
    );
  }
  
  return (
    <div className="container mx-auto p-4">
      <div className="flex items-center mb-8">
        <InboxIcon className="h-6 w-6 mr-2" />
        <h1 className="text-2xl font-light">{t('inbox.title')}</h1>
      </div>
      
      <p className="mb-6 text-sm text-gray-500 dark:text-gray-400">
        {t('taskViews.inbox', 'Inbox is where all uncategorized tasks are located. Tasks that have not been assigned to a project or don\'t have a due date will appear here. This is your \'brain dump\' area where you can quickly note down tasks and organize them later.')}
      </p>
      
      <div className="space-y-2">
        {inboxItems.map((item) => (
          <InboxItemDetail 
            key={item.id} 
            item={item} 
            onProcess={handleProcessItem}
            onDelete={handleDeleteItem}
            onUpdate={handleUpdateItem}
            openTaskModal={handleOpenTaskModal}
            openProjectModal={handleOpenProjectModal}
            openNoteModal={handleOpenNoteModal}
          />
        ))}
      </div>
      
      {/* Task Modal - Always render it but control visibility with isOpen */}
      <TaskModal
        isOpen={isTaskModalOpen}
        onClose={() => {
          setIsTaskModalOpen(false);
          setTaskToEdit(null);
        }}
        task={taskToEdit || { name: '', status: 'not_started', priority: 'medium' }}
        onSave={handleSaveTask}
        onDelete={() => {}} // No need to delete since it's a new task
        projects={Array.isArray(projects) ? projects : []}
        onCreateProject={handleCreateProject}
      />
      
      {/* Project Modal - Always render it but control visibility with isOpen */}
      <ProjectModal
        isOpen={isProjectModalOpen}
        onClose={() => {
          setIsProjectModalOpen(false);
          setProjectToEdit(null);
        }}
        onSave={handleSaveProject}
        project={projectToEdit || undefined}
        areas={[]}
      />
      
      {/* Note Modal - Always render it but control visibility with isOpen */}
      <NoteModal
        isOpen={isNoteModalOpen}
        onClose={() => {
          setIsNoteModalOpen(false);
          setNoteToEdit(null);
        }}
        onSave={handleSaveNote}
        note={noteToEdit || { title: '', content: '' }}
      />
      
      {/* Edit Inbox Item Modal */}
      {isEditModalOpen && itemToEdit !== null && (
        <SimplifiedTaskModal
          isOpen={isEditModalOpen}
          onClose={() => {
            setIsEditModalOpen(false);
            setItemToEdit(null);
          }}
          onSave={async () => {}} // Not used in edit mode
          initialText={inboxItems.find(item => item.id === itemToEdit)?.content || ""}
          editMode={true}
          onEdit={handleSaveEditedItem}
        />
      )}
    </div>
  );
};

export default InboxItems;
