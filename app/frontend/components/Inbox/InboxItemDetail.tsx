import React, { useState, useEffect, useRef } from 'react';
import { InboxItem } from '../../entities/InboxItem';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { TrashIcon, PencilIcon, EllipsisVerticalIcon } from '@heroicons/react/24/outline';
import { Task } from '../../entities/Task';
import { Project } from '../../entities/Project';
import { Note } from '../../entities/Note';
import { useToast } from '../Shared/ToastContext';
import ConfirmDialog from '../Shared/ConfirmDialog';

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
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  // Handle click outside of dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    };
    
    if (dropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [dropdownOpen]);
  
  const handleConvertToTask = () => {
    const newTask: Task = {
      name: item.content,
      status: 'not_started',
      priority: 'medium'
    };

    if (item.id !== undefined) {
      openTaskModal(newTask, item.id);
    } else {
      openTaskModal(newTask);
    }
    
    setDropdownOpen(false);
  };
  
  const handleConvertToProject = () => {
    const newProject: Project = {
      name: item.content,
      description: '',
      active: true
    };

    if (item.id !== undefined) {
      openProjectModal(newProject, item.id);
    } else {
      openProjectModal(newProject);
    }
    
    setDropdownOpen(false);
  };
  
  const handleConvertToNote = () => {
    const newNote: Note = {
      title: item.content.split('\n')[0] || item.content.substring(0, 50),
      content: item.content
    };

    if (item.id !== undefined) {
      openNoteModal(newNote, item.id);
    } else {
      openNoteModal(newNote);
    }
    
    setDropdownOpen(false);
  };
  
  const formattedDate = item.created_at 
    ? format(new Date(item.created_at), 'MMM dd, yyyy HH:mm')
    : '';
    
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
    <div className="rounded-lg shadow-sm bg-white dark:bg-gray-900 mt-1">
      <div className="flex items-center justify-between px-4 py-2">
        {/* Content section */}
        <div className="flex-1 mr-4">
          <p className="text-base font-medium text-gray-900 dark:text-gray-300 break-words">
            {item.content}
            <span className="ml-3 text-xs text-gray-500 dark:text-gray-600">
              {formattedDate}
            </span>
            <span className="ml-2 text-xs bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-100 rounded p-1">
              {item.source}
            </span>
          </p>
        </div>

        {/* Action buttons */}
        <div className="flex items-center space-x-0">
          <button
            onClick={() => {
              if (onUpdate && item.id !== undefined) {
                onUpdate(item.id, item.content);
              }
            }}
            className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full"
            title={t('common.edit')}
          >
            <PencilIcon className="h-5 w-5" />
          </button>
          
          {/* Convert dropdown */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="p-2 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900 rounded-full"
              title={t('inbox.convertTo', 'Convert to')}
            >
              <EllipsisVerticalIcon className="h-5 w-5" />
            </button>
            
            {dropdownOpen && (
              <div className="absolute right-0 mt-2 w-40 bg-white dark:bg-gray-700 shadow-md rounded-md z-10">
                <ul className="py-1" role="menu" aria-orientation="vertical">
                  <li
                    className="px-4 py-1 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600 cursor-pointer"
                    onClick={handleConvertToTask}
                    role="menuitem"
                  >
                    {t('inbox.createTask')}
                  </li>
                  <li
                    className="px-4 py-1 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600 cursor-pointer"
                    onClick={handleConvertToProject}
                    role="menuitem"
                  >
                    {t('inbox.createProject')}
                  </li>
                  <li
                    className="px-4 py-1 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600 cursor-pointer"
                    onClick={handleConvertToNote}
                    role="menuitem"
                  >
                    {t('inbox.createNote', 'Create Note')}
                  </li>
                </ul>
              </div>
            )}
          </div>

          <button
            onClick={handleDelete}
            className="p-2 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900 rounded-full"
            title={t('common.delete')}
          >
            <TrashIcon className="h-5 w-5" />
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