import React, { useState, useEffect, useRef } from 'react';
import { Tag } from '../../entities/Tag';
import { TrashIcon } from '@heroicons/react/24/outline';
import { useToast } from '../Shared/ToastContext';
import { useTranslation } from 'react-i18next';

interface TagModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (tag: Tag) => void;
    onDelete?: (tagId: number) => void;
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
    const [isClosing, setIsClosing] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
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
    }, [tag]);

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
        } catch {
            showErrorToast(t('errors.failedToSaveTag', 'Failed to save tag.'));
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

    const handleDeleteTag = async () => {
        if (formData.id && onDelete) {
            try {
                await onDelete(formData.id);
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
                        <div className="bg-white dark:bg-gray-800">
                            <form>
                                <fieldset>
                                    {/* Tag Title Section - Always Visible */}
                                    <div className="px-4 pt-4 pb-4">
                                        <input
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
                                        />
                                    </div>
                                </fieldset>
                            </form>
                        </div>

                        {/* Action Buttons - Below border with custom layout */}
                        <div className="flex-shrink-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 px-3 py-2 flex items-center justify-between">
                            {/* Left side: Delete and Cancel */}
                            <div className="flex items-center space-x-3">
                                {tag && tag.id && onDelete && (
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
        </>
    );
};

export default TagModal;
