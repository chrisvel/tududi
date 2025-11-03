import React, { useState, useEffect, useRef } from 'react';
import { Area } from '../../entities/Area';
import { useToast } from '../Shared/ToastContext';
import { useTranslation } from 'react-i18next';
import DiscardChangesDialog from '../Shared/DiscardChangesDialog';
import { TrashIcon } from '@heroicons/react/24/outline';

interface AreaModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (areaData: Partial<Area>) => Promise<void>;
    onDelete?: (areaUid: string) => Promise<void>;
    area?: Area | null;
}

const AreaModal: React.FC<AreaModalProps> = ({
    isOpen,
    onClose,
    area,
    onSave,
    onDelete,
}) => {
    const { t } = useTranslation();
    const [formData, setFormData] = useState<Area>({
        id: area?.id || 0,
        uid: area?.uid || '',
        name: area?.name || '',
        description: area?.description || '',
    });

    const [error, setError] = useState<string | null>(null);
    const modalRef = useRef<HTMLDivElement>(null);
    const nameInputRef = useRef<HTMLInputElement>(null);
    const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
    const [isClosing, setIsClosing] = useState(false);
    const [showDiscardDialog, setShowDiscardDialog] = useState(false);

    const { showSuccessToast, showErrorToast } = useToast();

    useEffect(() => {
        if (isOpen) {
            setFormData({
                id: area?.id || 0,
                uid: area?.uid || '',
                name: area?.name || '',
                description: area?.description || '',
            });
            setError(null);

            // Auto-focus on the name input when modal opens
            setTimeout(() => {
                nameInputRef.current?.focus();
            }, 100);
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
                // Don't show discard dialog if already showing
                if (showDiscardDialog) {
                    // Let the dialog handle its own Escape
                    return;
                }

                event.preventDefault();
                event.stopPropagation();

                // Check for unsaved changes using ref to get current value
                if (hasUnsavedChangesRef.current()) {
                    setShowDiscardDialog(true);
                } else {
                    handleClose();
                }
            }
        };

        if (isOpen) {
            document.addEventListener('keydown', handleKeyDown);
        }
        return () => {
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [isOpen, showDiscardDialog]);

    const handleChange = (
        e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
    ) => {
        const { name, value } = e.target;
        setFormData((prev) => ({
            ...prev,
            [name]: value,
        }));
    };

    const handleSubmit = async (e?: React.FormEvent) => {
        if (e) {
            e.preventDefault();
        }

        if (!formData.name.trim()) {
            setError(t('errors.areaNameRequired'));
            return;
        }

        setIsSubmitting(true);
        setError(null);

        try {
            await onSave(formData);
            showSuccessToast(
                formData.uid
                    ? t('success.areaUpdated')
                    : t('success.areaCreated')
            );
            handleClose();
        } catch (err) {
            setError((err as Error).message);
            showErrorToast(t('errors.failedToSaveArea'));
        } finally {
            setIsSubmitting(false);
        }
    };

    // Check if there are unsaved changes
    const hasUnsavedChanges = () => {
        if (!area) {
            // New area - check if any field has been filled
            return (
                formData.name.trim() !== '' ||
                formData.description?.trim() !== ''
            );
        }

        // Existing area - compare with original
        return (
            formData.name !== area.name ||
            formData.description !== area.description
        );
    };

    // Use ref to store hasUnsavedChanges so it's always current in the event handler
    const hasUnsavedChangesRef = useRef(hasUnsavedChanges);
    useEffect(() => {
        hasUnsavedChangesRef.current = hasUnsavedChanges;
    });

    const handleClose = () => {
        setIsClosing(true);
        setTimeout(() => {
            onClose();
            setIsClosing(false);
            setShowDiscardDialog(false);
        }, 300);
    };

    const handleDiscardChanges = () => {
        setShowDiscardDialog(false);
        handleClose();
    };

    const handleCancelDiscard = () => {
        setShowDiscardDialog(false);
    };

    const handleDeleteArea = async () => {
        if (formData.uid && onDelete) {
            try {
                await onDelete(formData.uid);
                showSuccessToast(
                    t('success.areaDeleted', 'Area deleted successfully!')
                );
                handleClose();
            } catch (err) {
                setError((err as Error).message);
                showErrorToast(
                    t('errors.failedToDeleteArea', 'Failed to delete area.')
                );
            }
        }
    };

    if (!isOpen) return null;

    return (
        <>
            <div
                className={`fixed top-16 left-0 right-0 bottom-0 bg-gray-900 bg-opacity-80 z-40 transition-opacity duration-300 overflow-hidden sm:overflow-y-auto ${
                    isClosing ? 'opacity-0' : 'opacity-100'
                }`}
            >
                <div className="h-full flex items-center justify-center sm:px-4 sm:py-4">
                    <div
                        ref={modalRef}
                        className={`bg-white dark:bg-gray-800 border-0 sm:border sm:border-gray-200 sm:dark:border-gray-800 sm:rounded-lg sm:shadow-2xl w-full sm:max-w-md transform transition-transform duration-300 ${
                            isClosing ? 'scale-95' : 'scale-100'
                        } h-full sm:h-auto sm:my-4`}
                    >
                        <div className="flex flex-col h-full sm:min-h-[400px] sm:max-h-[90vh]">
                            {/* Main Form Section */}
                            <div className="flex-1 flex flex-col transition-all duration-300 bg-white dark:bg-gray-800 sm:rounded-lg">
                                <div className="flex-1 relative">
                                    <div
                                        className="absolute inset-0 overflow-y-auto overflow-x-hidden"
                                        style={{
                                            WebkitOverflowScrolling: 'touch',
                                        }}
                                    >
                                        <form
                                            className="h-full"
                                            onSubmit={handleSubmit}
                                        >
                                            <fieldset className="h-full flex flex-col">
                                                {/* Area Title Section - Always Visible */}
                                                <div className="border-b border-gray-200 dark:border-gray-700 pb-4 mb-4 px-4 pt-4 sm:rounded-t-lg">
                                                    <input
                                                        ref={nameInputRef}
                                                        type="text"
                                                        id="areaName"
                                                        name="name"
                                                        value={formData.name}
                                                        onChange={handleChange}
                                                        required
                                                        className="block w-full text-xl font-semibold bg-transparent text-black dark:text-white border-none focus:outline-none shadow-sm py-2"
                                                        placeholder={t(
                                                            'forms.areaNamePlaceholder'
                                                        )}
                                                        data-testid="area-name-input"
                                                    />
                                                </div>

                                                {/* Description Section - Always Visible */}
                                                <div className="flex-1 pb-4 sm:px-4">
                                                    <textarea
                                                        id="areaDescription"
                                                        name="description"
                                                        value={
                                                            formData.description
                                                        }
                                                        onChange={handleChange}
                                                        className="block w-full h-full sm:border sm:border-gray-300 sm:dark:border-gray-600 sm:rounded-md shadow-sm py-2 px-3 sm:py-3 sm:px-3 text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 sm:focus:ring-2 sm:focus:ring-blue-500 transition duration-150 ease-in-out resize-none"
                                                        placeholder={t(
                                                            'forms.areaDescriptionPlaceholder'
                                                        )}
                                                        style={{
                                                            minHeight: '150px',
                                                        }}
                                                    />
                                                </div>

                                                {/* Error Message */}
                                                {error && (
                                                    <div className="text-red-500 px-4 mb-4">
                                                        {error}
                                                    </div>
                                                )}
                                            </fieldset>
                                        </form>
                                    </div>
                                </div>

                                {/* Action Buttons - Below border with custom layout */}
                                <div className="flex-shrink-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 px-3 py-2 flex items-center justify-between sm:rounded-b-lg">
                                    {/* Left side: Delete and Cancel */}
                                    <div className="flex items-center space-x-3">
                                        {area && area.uid && onDelete && (
                                            <button
                                                type="button"
                                                onClick={handleDeleteArea}
                                                className="p-2 border border-red-300 dark:border-red-600 text-red-600 dark:text-red-400 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20 focus:outline-none transition duration-150 ease-in-out"
                                                title={t(
                                                    'common.delete',
                                                    'Delete'
                                                )}
                                            >
                                                <TrashIcon className="h-4 w-4" />
                                            </button>
                                        )}
                                        <button
                                            type="button"
                                            onClick={handleClose}
                                            className="text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 focus:outline-none transition duration-150 ease-in-out text-sm"
                                        >
                                            {t('common.cancel')}
                                        </button>
                                    </div>

                                    {/* Right side: Save */}
                                    <button
                                        type="button"
                                        onClick={() => handleSubmit()}
                                        disabled={isSubmitting}
                                        className={`px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 focus:outline-none transition duration-150 ease-in-out text-sm ${
                                            isSubmitting
                                                ? 'opacity-50 cursor-not-allowed'
                                                : ''
                                        }`}
                                        data-testid="area-save-button"
                                    >
                                        {isSubmitting
                                            ? t('modals.submitting')
                                            : formData.id && formData.id !== 0
                                              ? t('modals.updateArea')
                                              : t('modals.createArea')}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            {showDiscardDialog && (
                <DiscardChangesDialog
                    onDiscard={handleDiscardChanges}
                    onCancel={handleCancelDiscard}
                />
            )}
        </>
    );
};

export default AreaModal;
