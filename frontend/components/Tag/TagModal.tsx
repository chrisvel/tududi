import React, { useState, useEffect, useRef } from 'react';
import { Tag } from '../../entities/Tag';
import { TrashIcon } from '@heroicons/react/24/outline';
import { useToast } from '../Shared/ToastContext';
import { useTranslation } from 'react-i18next';
import DiscardChangesDialog from '../Shared/DiscardChangesDialog';

interface TagModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (tag: Tag) => void;
    onDelete?: (tagUid: string) => void;
    tag?: Tag | null;
}

const TagModal: React.FC<TagModalProps> = ({
    isOpen,
    onClose,
    onSave,
    onDelete,
    tag,
}) => {
    const [formData, setFormData] = useState<Tag>(
        tag || {
            name: '',
        }
    );

    const modalRef = useRef<HTMLDivElement>(null);
    const nameInputRef = useRef<HTMLInputElement>(null);
    const [isClosing, setIsClosing] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showDiscardDialog, setShowDiscardDialog] = useState(false);
    const { showSuccessToast, showErrorToast } = useToast();
    const { t } = useTranslation();

    useEffect(() => {
        if (tag) {
            setFormData(tag);
        } else {
            setFormData({
                name: '',
            });
        }

        // Auto-focus on the name input when modal opens
        if (isOpen) {
            setTimeout(() => {
                nameInputRef.current?.focus();
            }, 100);
        }
    }, [tag, isOpen]);

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

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData((prev) => ({
            ...prev,
            [name]: value,
        }));
    };

    const handleSubmit = async () => {
        if (!formData.name.trim()) {
            showErrorToast(
                t('errors.tagNameRequired', 'Tag name is required.')
            );
            return;
        }

        setIsSubmitting(true);

        try {
            await onSave(formData); // Wait for the save operation to complete
            if (tag) {
                showSuccessToast(
                    t('success.tagUpdated', 'Tag updated successfully!')
                );
            } else {
                showSuccessToast(
                    t('success.tagCreated', 'Tag created successfully!')
                );
            }
            handleClose();
        } catch (error: any) {
            // Extract error message from the API response if available
            let errorMessage = t(
                'errors.failedToSaveTag',
                'Failed to save tag.'
            );
            if (error?.message) {
                errorMessage = error.message;
            }
            showErrorToast(errorMessage);
        } finally {
            setIsSubmitting(false);
        }
    };

    // Check if there are unsaved changes
    const hasUnsavedChanges = () => {
        if (!tag) {
            // New tag - check if name has been filled
            return formData.name.trim() !== '';
        }

        // Existing tag - compare with original
        return formData.name !== tag.name;
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

    const handleDeleteTag = async () => {
        if (formData.uid && onDelete) {
            try {
                await onDelete(formData.uid);
                showSuccessToast(
                    t('success.tagDeleted', 'Tag deleted successfully!')
                );
                handleClose();
            } catch {
                showErrorToast(
                    t('errors.failedToDeleteTag', 'Failed to delete tag.')
                );
            }
        }
    };

    if (!isOpen) return null;

    return (
        <>
            <div
                className={`fixed top-16 left-0 right-0 bottom-0 flex items-start sm:items-center justify-center bg-gray-900 bg-opacity-80 z-40 transition-opacity duration-300 ${
                    isClosing ? 'opacity-0' : 'opacity-100'
                }`}
            >
                <div
                    ref={modalRef}
                    className={`bg-white dark:bg-gray-800 border-0 sm:border sm:border-gray-200 sm:dark:border-gray-800 sm:rounded-lg sm:shadow-2xl w-full sm:max-w-md transform transition-transform duration-300 ${
                        isClosing ? 'scale-95' : 'scale-100'
                    } h-full sm:h-auto sm:my-4`}
                >
                    <div className="flex flex-col h-auto">
                        {/* Main Form Section */}
                        <div className="bg-white dark:bg-gray-800 sm:rounded-t-lg">
                            <form
                                onSubmit={(e) => {
                                    e.preventDefault();
                                    handleSubmit();
                                }}
                            >
                                <fieldset>
                                    {/* Tag Title Section - Always Visible */}
                                    <div className="px-4 pt-4 pb-4">
                                        <input
                                            ref={nameInputRef}
                                            type="text"
                                            id="tagName"
                                            name="name"
                                            value={formData.name}
                                            onChange={handleChange}
                                            required
                                            className="block w-full text-xl font-semibold bg-transparent text-black dark:text-white border-none focus:outline-none shadow-sm py-2"
                                            placeholder={t(
                                                'forms.tagNamePlaceholder',
                                                'Enter tag name'
                                            )}
                                            data-testid="tag-name-input"
                                        />
                                    </div>
                                </fieldset>
                            </form>
                        </div>

                        {/* Action Buttons - Below border with custom layout */}
                        <div className="flex-shrink-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 px-3 py-2 flex items-center justify-between sm:rounded-b-lg">
                            {/* Left side: Delete and Cancel */}
                            <div className="flex items-center space-x-3">
                                {tag && tag.uid && onDelete && (
                                    <button
                                        type="button"
                                        onClick={handleDeleteTag}
                                        className="p-2 border border-red-300 dark:border-red-600 text-red-600 dark:text-red-400 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20 focus:outline-none transition duration-150 ease-in-out"
                                        title={t('common.delete', 'Delete')}
                                    >
                                        <TrashIcon className="h-4 w-4" />
                                    </button>
                                )}
                                <button
                                    type="button"
                                    onClick={handleClose}
                                    className="text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 focus:outline-none transition duration-150 ease-in-out text-sm"
                                >
                                    {t('common.cancel', 'Cancel')}
                                </button>
                            </div>

                            {/* Right side: Save */}
                            <button
                                type="button"
                                onClick={handleSubmit}
                                disabled={isSubmitting}
                                className={`px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 focus:outline-none transition duration-150 ease-in-out text-sm ${
                                    isSubmitting
                                        ? 'opacity-50 cursor-not-allowed'
                                        : ''
                                }`}
                                data-testid="tag-save-button"
                            >
                                {isSubmitting
                                    ? t('modals.submitting', 'Submitting...')
                                    : tag
                                      ? t('modals.updateTag', 'Update Tag')
                                      : t('modals.createTag', 'Create Tag')}
                            </button>
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

export default TagModal;
