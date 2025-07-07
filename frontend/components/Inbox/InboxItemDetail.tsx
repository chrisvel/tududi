import React, { useState } from 'react';
import { InboxItem } from '../../entities/InboxItem';
import { useTranslation } from 'react-i18next';
import { TrashIcon, PencilIcon, DocumentTextIcon, FolderIcon, ClipboardDocumentListIcon, TagIcon } from '@heroicons/react/24/outline';
import { Task } from '../../entities/Task';
import { Project } from '../../entities/Project';
import { Note } from '../../entities/Note';
import { useToast } from '../Shared/ToastContext';
import ConfirmDialog from '../Shared/ConfirmDialog';
import { useStore } from '../../store/useStore';

interface InboxItemDetailProps {
  item: InboxItem;
  onProcess: (id: number) => void;
  onDelete: (id: number) => void;
  onUpdate?: (id: number, content: string) => Promise<void>;
  openTaskModal: (task: Task, inboxItemId?: number) => void;
  openProjectModal: (project: Project | null, inboxItemId?: number) => void;
  openNoteModal: (note: Note | null, inboxItemId?: number) => void;
}

const InboxItemDetail: React.FC<InboxItemDetailProps> = ({ 
  item, 
  onProcess, 
  onDelete, 
  onUpdate,
  openTaskModal,
  openProjectModal,
  openNoteModal
}) => {
  const { t } = useTranslation();
  const { showSuccessToast, showErrorToast } = useToast();
  const { tagsStore: { tags } } = useStore();
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  
  // Helper function to parse hashtags from text
  const parseHashtags = (text: string): string[] => {
    const hashtagRegex = /#([a-zA-Z0-9_]+)/g;
    const matches = text.match(hashtagRegex);
    return matches ? matches.map(tag => tag.substring(1)) : [];
  };
  
  const hashtags = parseHashtags(item.content);
  
  const handleConvertToTask = () => {
    // Convert hashtags to Tag objects
    const taskTags = hashtags.map(hashtagName => {
      // Find existing tag or create a placeholder for new tag
      const existingTag = tags.find(tag => tag.name.toLowerCase() === hashtagName.toLowerCase());
      return existingTag || { name: hashtagName };
    });

    const newTask: Task = {
      name: item.content,
      status: 'not_started',
      priority: 'medium',
      tags: taskTags
    };

    if (item.id !== undefined) {
      openTaskModal(newTask, item.id);
    } else {
      openTaskModal(newTask);
    }
  };
  
  const handleConvertToProject = () => {
    // Convert hashtags to Tag objects
    const projectTags = hashtags.map(hashtagName => {
      // Find existing tag or create a placeholder for new tag
      const existingTag = tags.find(tag => tag.name.toLowerCase() === hashtagName.toLowerCase());
      return existingTag || { name: hashtagName };
    });

    const newProject: Project = {
      name: item.content,
      description: '',
      active: true,
      tags: projectTags
    };

    if (item.id !== undefined) {
      openProjectModal(newProject, item.id);
    } else {
      openProjectModal(newProject);
    }
  };
  
  const handleConvertToNote = async () => {
    let title = item.content.split('\n')[0] || item.content.substring(0, 50);
    let content = item.content;
    let isBookmark = false;
    
    try {
      const { isUrl, extractUrlTitle } = await import("../../utils/urlService");
      
      if (isUrl(item.content.trim())) {
        setLoading(true);
        try {
          // Add a timeout to prevent infinite loading
          const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Timeout')), 10000) // 10 second timeout
          );
          
          const result = await Promise.race([
            extractUrlTitle(item.content.trim()),
            timeoutPromise
          ]) as any;
          
          if (result && result.title) {
            title = result.title;
            content = item.content;
            isBookmark = true;
          }
        } catch (titleError) {
          console.error("Error extracting URL title:", titleError);
          // Continue with default title if URL title extraction fails
          // Still mark as bookmark if it's a URL
          isBookmark = true;
        } finally {
          setLoading(false);
        }
      }
    } catch (error) {
      console.error("Error checking URL or extracting title:", error);
      setLoading(false);
    }

    // Convert hashtags to Tag objects and include bookmark tag if needed
    const hashtagTags = hashtags.map(hashtagName => {
      // Find existing tag or create a placeholder for new tag
      const existingTag = tags.find(tag => tag.name.toLowerCase() === hashtagName.toLowerCase());
      return existingTag || { name: hashtagName };
    });
    
    // Combine hashtag tags with bookmark tag if it's a URL
    const bookmarkTag = isBookmark ? [{ name: "bookmark" }] : [];
    const tagObjects = [...hashtagTags, ...bookmarkTag];
        
    const newNote: Note = {
      title: title,
      content: content,
      tags: tagObjects
    };

    if (item.id !== undefined) {
      openNoteModal(newNote, item.id);
    } else {
      openNoteModal(newNote);
    }
  };
  
    
  const handleDelete = () => {
    setShowConfirmDialog(true);
  };
  
  const confirmDelete = () => {
    if (item.id !== undefined) {
      onDelete(item.id);
    }
    setShowConfirmDialog(false);
  };
    
  return (
    <div 
      className="rounded-lg shadow-sm bg-white dark:bg-gray-900 mt-1"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between px-4 py-2 gap-2">
        <div className="flex-1">
          <p className="text-base font-medium text-gray-900 dark:text-gray-300 break-words">
            {item.content}
          </p>
          
          {/* Tags display */}
          {hashtags.length > 0 && (
            <div className="flex items-center text-xs text-gray-500 dark:text-gray-400 mt-1">
              <TagIcon className="h-3 w-3 mr-1" />
              <span>{hashtags.join(', ')}</span>
            </div>
          )}
        </div>

        <div className="flex items-center justify-start space-x-1 shrink-0">
          {loading && <div className="spinner" />}
          
          {/* Edit Button */}
          <button
            onClick={() => {
              if (onUpdate && item.id !== undefined) {
                onUpdate(item.id, item.content);
              }
            }}
            className={`p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-opacity ${isHovered ? 'opacity-100' : 'opacity-0'}`}
            title={t('common.edit')}
          >
            <PencilIcon className="h-4 w-4" />
          </button>
          
          {/* Convert to Task Button */}
          <button
            onClick={handleConvertToTask}
            className={`p-2 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900 rounded-full transition-opacity ${isHovered ? 'opacity-100' : 'opacity-0'}`}
            title={t('inbox.createTask')}
          >
            <ClipboardDocumentListIcon className="h-4 w-4" />
          </button>
          
          {/* Convert to Project Button */}
          <button
            onClick={handleConvertToProject}
            className={`p-2 text-green-600 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900 rounded-full transition-opacity ${isHovered ? 'opacity-100' : 'opacity-0'}`}
            title={t('inbox.createProject')}
          >
            <FolderIcon className="h-4 w-4" />
          </button>
          
          {/* Convert to Note Button */}
          <button
            onClick={handleConvertToNote}
            className={`p-2 text-purple-600 dark:text-purple-400 hover:bg-purple-100 dark:hover:bg-purple-900 rounded-full transition-opacity ${isHovered ? 'opacity-100' : 'opacity-0'}`}
            title={t('inbox.createNote', 'Create Note')}
          >
            <DocumentTextIcon className="h-4 w-4" />
          </button>

          {/* Delete Button */}
          <button
            onClick={handleDelete}
            className={`p-2 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900 rounded-full transition-opacity ${isHovered ? 'opacity-100' : 'opacity-0'}`}
            title={t('common.delete')}
          >
            <TrashIcon className="h-4 w-4" />
          </button>
        </div>
      </div>
      {showConfirmDialog && (
        <ConfirmDialog
          title={t('inbox.deleteConfirmTitle', 'Delete Item')}
          message={t('inbox.deleteConfirmMessage', 'Are you sure you want to delete this inbox item? This action cannot be undone.')}
          onConfirm={confirmDelete}
          onCancel={() => setShowConfirmDialog(false)}
        />
      )}
    </div>
  );
};

export default InboxItemDetail;
