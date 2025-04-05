import React, { useState, useEffect, useRef } from 'react';
import { Area } from '../../entities/Area';
import { useToast } from '../Shared/ToastContext';
import { useTranslation } from 'react-i18next';

interface AreaModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (areaData: Partial<Area>) => Promise<void>; 
  area?: Area | null;
}

const AreaModal: React.FC<AreaModalProps> = ({ isOpen, onClose, area, onSave }) => {
  const { t } = useTranslation();
  const [formData, setFormData] = useState<Area>({
    id: area?.id || 0,
    name: area?.name || '',
    description: area?.description || '',
  });

  const [error, setError] = useState<string | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isClosing, setIsClosing] = useState(false);

  const { showSuccessToast, showErrorToast } = useToast(); 

  useEffect(() => {
    if (isOpen) {
      setFormData({
        id: area?.id || 0,
        name: area?.name || '',
        description: area?.description || '',
      });
      setError(null);
    }
  }, [isOpen, area]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        modalRef.current &&
        !modalRef.current.contains(event.target as Node)
      ) {
        handleClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        handleClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      setError(t('errors.areaNameRequired'));
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await onSave(formData);
      showSuccessToast(formData.id ? t('success.areaUpdated') : t('success.areaCreated'));
      handleClose();
    } catch (err) {
      setError((err as Error).message);
      showErrorToast(t('errors.failedToSaveArea'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      onClose();
      setIsClosing(false);
    }, 300);
  };

  if (!isOpen) return null;

  return (
    <div
      className={`fixed top-16 left-0 right-0 bottom-0 flex items-start sm:items-center justify-center bg-gray-900 bg-opacity-80 z-40 transition-opacity duration-300 ${isClosing ? 'opacity-0' : 'opacity-100'}`}
    >
      <div
        ref={modalRef}
        className={`bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-800 sm:rounded-lg sm:shadow-2xl w-full sm:max-w-md overflow-hidden transform transition-transform duration-300 ${isClosing ? 'scale-95' : 'scale-100'} h-screen sm:h-auto flex flex-col`}
        style={{
          maxHeight: 'calc(100vh - 4rem)',
        }}
      >
        <form className="flex flex-col flex-1">
          <fieldset className="flex flex-col flex-1">
            <div className="p-4 space-y-3 flex-1 text-sm overflow-y-auto">
              {/* Area Name */}
              <div className="py-4">
                <input
                  type="text"
                  id="areaName"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  required
                  className="block w-full text-xl font-semibold dark:bg-gray-800 text-black dark:text-white border-b-2 border-gray-200 dark:border-gray-900 focus:outline-none shadow-sm py-2"
                  placeholder={t('forms.areaNamePlaceholder')}
                />
              </div>

              {/* Area Description */}
              <div className="pb-3">
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {t('forms.areaDescription')}
                </label>
                <textarea
                  id="areaDescription"
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  rows={4}
                  className="block w-full rounded-md shadow-sm p-3 text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 transition duration-150 ease-in-out"
                  placeholder={t('forms.areaDescriptionPlaceholder')}
                />
              </div>

              {/* Error Message */}
              {error && <div className="text-red-500">{error}</div>}
            </div>

            {/* Action Buttons */}
            <div className="p-3 flex-shrink-0 border-t border-gray-200 dark:border-gray-700 flex justify-end space-x-2">
              <button
                type="button"
                onClick={handleClose}
                className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 focus:outline-none transition duration-150 ease-in-out"
              >
                {t('common.cancel')}
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={isSubmitting}
                className={`px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 focus:outline-none transition duration-150 ease-in-out ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {isSubmitting
                  ? t('modals.submitting')
                  : formData.id && formData.id !== 0
                  ? t('modals.updateArea')
                  : t('modals.createArea')}
              </button>
            </div>
          </fieldset>
        </form>
      </div>
    </div>
  );
};

export default AreaModal;