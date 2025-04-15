import React, { useState, useEffect, useRef, useCallback } from "react";
import { Task } from "../../entities/Task";
import { InboxItem } from "../../entities/InboxItem";
import { useToast } from "../Shared/ToastContext";
import { useTranslation } from "react-i18next";
import { createInboxItemWithStore } from "../../utils/inboxService";

interface SimplifiedTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (task: Task) => void;
  initialText?: string;
  editMode?: boolean;
  onEdit?: (text: string) => Promise<void>;
}

const SimplifiedTaskModal: React.FC<SimplifiedTaskModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialText = "",
  editMode = false,
  onEdit,
}) => {
  const { t } = useTranslation();
  const [inputText, setInputText] = useState<string>(initialText);
  const modalRef = useRef<HTMLDivElement>(null);
  const [isClosing, setIsClosing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const { showSuccessToast, showErrorToast } = useToast();
  const nameInputRef = useRef<HTMLInputElement>(null);
  // Default to inbox mode, where we create an inbox item rather than a task directly
  const [saveMode, setSaveMode] = useState<'task' | 'inbox'>('inbox');

  useEffect(() => {
    if (isOpen && nameInputRef.current) {
      // Focus the input field when modal is opened
      nameInputRef.current.focus();
    }
  }, [isOpen]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputText(e.target.value);
  };

  const handleSubmit = useCallback(async () => {
    // Guard conditions to prevent duplicate submissions
    if (!inputText.trim() || isSaving) return;
    
    setIsSaving(true);
    
    try {
      if (editMode && onEdit) {
        // Edit existing inbox item
        await onEdit(inputText.trim());
        // Don't clear input text when editing - just close the modal
        setIsClosing(true);
        setTimeout(() => {
          onClose();
          setIsClosing(false);
        }, 300);
        return; // Exit early to prevent creating duplicates
      }
      
      if (saveMode === 'task') {
        // Create a new task
        const newTask: Task = {
          name: inputText.trim(),
          status: "not_started",
        };
        
        onSave(newTask);
        showSuccessToast(t('task.createSuccess'));
        setInputText(''); // Clear input text for new entries
      } else {
        try {
          // Create a new inbox item (using store)
          const newItem = await createInboxItemWithStore(inputText.trim());
          
          // Show success toast
          showSuccessToast(t('inbox.itemAdded'));
          
          // Close the modal immediately after adding the item
          handleClose();
        } catch (error) {
          console.error('Failed to create inbox item:', error);
          showErrorToast(t('inbox.addError'));
          setIsSaving(false);
        }
      }
    } catch (error) {
      console.error('Failed to save:', error);
      if (editMode) {
        showErrorToast(t('inbox.updateError'));
      } else {
        showErrorToast(saveMode === 'task' ? t('task.createError') : t('inbox.addError'));
      }
      setIsSaving(false);
    }
  }, [inputText, isSaving, editMode, onEdit, saveMode, onSave, showSuccessToast, showErrorToast, t, onClose]);

  const handleClose = useCallback(() => {
    setIsClosing(true);
    setTimeout(() => {
      onClose();
      // Only clear input if not in edit mode
      if (!editMode) {
        setInputText("");
        setSaveMode('inbox'); // Reset to default
      }
      setIsClosing(false);
    }, 300);
  }, [onClose, editMode]);

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
      // Removed Enter key handling here - now handled directly on the input element
    };
    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, handleClose]); // Only depend on isOpen and handleClose

  if (!isOpen) return null;

  return (
    <div
      className={`fixed top-16 left-0 right-0 bottom-0 flex items-start sm:items-center justify-center bg-gray-900 bg-opacity-80 z-40 transition-opacity duration-300 ${
        isClosing ? "opacity-0" : "opacity-100"
      }`}
    >
      <div
        ref={modalRef}
        className={`bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-800 sm:rounded-lg sm:shadow-2xl w-full sm:max-w-lg overflow-hidden transform transition-transform duration-300 ${
          isClosing ? "scale-95" : "scale-100"
        } flex flex-col`}
      >
        <div className="p-4 flex items-center">
          <input
            ref={nameInputRef}
            type="text"
            name="text"
            value={inputText}
            onChange={handleChange}
            required
            className="flex-1 text-xl font-semibold dark:bg-gray-800 text-black dark:text-white border-b-2 border-gray-200 dark:border-gray-900 focus:outline-none shadow-sm py-2"
            placeholder={t('inbox.captureThought')}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && !isSaving) {
                e.preventDefault();
                handleSubmit();
              }
            }}
          />
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!inputText.trim() || isSaving}
            className={`ml-4 inline-flex justify-center px-4 py-2 text-sm font-medium text-white rounded-md shadow-sm focus:outline-none ${
              inputText.trim() && !isSaving
                ? "bg-blue-600 hover:bg-blue-700"
                : "bg-blue-400 cursor-not-allowed"
            }`}
          >
            {isSaving ? t('common.saving') : t('common.save')}
          </button>
          <button
            type="button"
            onClick={handleClose}
            className="ml-2 inline-flex justify-center px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none"
          >
            {t('common.cancel')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SimplifiedTaskModal;

