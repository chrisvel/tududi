import React, { useState, useEffect, useRef } from "react";
import { Task } from "../../entities/Task";
import { InboxItem } from "../../entities/InboxItem";
import { useToast } from "../Shared/ToastContext";
import { useTranslation } from "react-i18next";
import { createInboxItem } from "../../utils/inboxService";

interface SimplifiedTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (task: Task) => void;
}

const SimplifiedTaskModal: React.FC<SimplifiedTaskModalProps> = ({
  isOpen,
  onClose,
  onSave,
}) => {
  const { t } = useTranslation();
  const [inputText, setInputText] = useState<string>("");
  const modalRef = useRef<HTMLDivElement>(null);
  const [isClosing, setIsClosing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const { showSuccessToast, showErrorToast } = useToast();
  const nameInputRef = useRef<HTMLInputElement>(null);
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

  const handleSubmit = async () => {
    if (!inputText.trim()) return;
    
    setIsSaving(true);
    
    try {
      if (saveMode === 'task') {
        // Create a new task
        const newTask: Task = {
          name: inputText.trim(),
          status: "not_started",
        };
        
        onSave(newTask);
        showSuccessToast(t('task.createSuccess'));
      } else {
        // Create a new inbox item
        await createInboxItem(inputText.trim());
        showSuccessToast(t('inbox.itemAdded'));
      }
      
      handleClose();
    } catch (error) {
      console.error('Failed to save:', error);
      showErrorToast(saveMode === 'task' ? t('task.createError') : t('inbox.addError'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      onClose();
      setInputText("");
      setIsClosing(false);
      setSaveMode('inbox'); // Reset to default
    }, 300);
  };

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
      } else if (event.key === "Enter" && !event.shiftKey) {
        handleSubmit();
        event.preventDefault();
      }
    };
    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, inputText, saveMode]);

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
        <div className="p-4">
          <input
            ref={nameInputRef}
            type="text"
            name="text"
            value={inputText}
            onChange={handleChange}
            required
            className="block w-full text-xl font-semibold dark:bg-gray-800 text-black dark:text-white border-b-2 border-gray-200 dark:border-gray-900 focus:outline-none shadow-sm py-2"
            placeholder={t('inbox.captureThought')}
          />
        </div>
        <div className="bg-gray-50 dark:bg-gray-700 px-4 py-3 sm:px-6 flex justify-between">
          <div className="flex space-x-2">
            <button
              type="button"
              onClick={() => setSaveMode('inbox')}
              className={`px-3 py-1 text-sm font-medium rounded-md ${
                saveMode === 'inbox'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300'
              }`}
            >
              {t('inbox.saveToInbox')}
            </button>
            <button
              type="button"
              onClick={() => setSaveMode('task')}
              className={`px-3 py-1 text-sm font-medium rounded-md ${
                saveMode === 'task'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300'
              }`}
            >
              {t('task.saveAsTask')}
            </button>
          </div>
          <div className="flex">
            <button
              type="button"
              onClick={handleClose}
              className="mr-2 inline-flex justify-center px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none"
            >
              {t('common.cancel')}
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!inputText.trim() || isSaving}
              className={`inline-flex justify-center px-4 py-2 text-sm font-medium text-white rounded-md shadow-sm focus:outline-none ${
                inputText.trim() && !isSaving
                  ? "bg-blue-600 hover:bg-blue-700"
                  : "bg-blue-400 cursor-not-allowed"
              }`}
            >
              {isSaving ? t('common.saving') : t('common.save')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SimplifiedTaskModal;

