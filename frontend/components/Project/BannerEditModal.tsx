import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { getPresetBanners, PresetBanner } from '../../utils/bannersService';
import { getApiPath, getAssetPath } from '../../config/paths';

interface BannerEditModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (imageUrl: string) => Promise<void>;
    currentImageUrl?: string;
}

const BannerEditModal: React.FC<BannerEditModalProps> = ({
    isOpen,
    onClose,
    onSave,
    currentImageUrl = '',
}) => {
    const { t } = useTranslation();
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [imagePreview, setImagePreview] = useState<string>(currentImageUrl);
    const [isUploading, setIsUploading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [presetBanners] = useState<PresetBanner[]>(getPresetBanners());
    const fileInputRef = useRef<HTMLInputElement>(null);
    const modalRef = useRef<HTMLDivElement>(null);
    const [isClosing, setIsClosing] = useState(false);

    useEffect(() => {
        setImagePreview(currentImageUrl);
    }, [currentImageUrl, isOpen]);

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                handleClose();
            }
        };
        if (isOpen) {
            document.addEventListener('keydown', handleKeyDown);
            document.body.style.overflow = 'hidden';
        }
        return () => {
            document.removeEventListener('keydown', handleKeyDown);
            document.body.style.overflow = 'unset';
        };
    }, [isOpen]);

    const handlePresetBannerSelect = (banner: PresetBanner) => {
        setImageFile(null);
        setImagePreview(banner.url);
        setError(null);
    };

    const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const maxSizeBytes = 10 * 1024 * 1024;
        if (file.size > maxSizeBytes) {
            setError(
                t(
                    'errors.projectImageTooLarge',
                    'Image is too large. Please choose a file under 10MB.'
                )
            );
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
            return;
        }

        setImageFile(file);

        const reader = new FileReader();
        reader.onload = (ev) => {
            setImagePreview(ev.target?.result as string);
        };
        reader.readAsDataURL(file);
        setError(null);
    };

    const handleImageUpload = async (): Promise<string | null> => {
        if (!imageFile) return null;

        setIsUploading(true);
        try {
            const formData = new FormData();
            formData.append('image', imageFile);

            const response = await fetch(getApiPath('upload/project-image'), {
                method: 'POST',
                credentials: 'include',
                body: formData,
            });

            if (!response.ok) {
                let serverMessage = 'Failed to upload image';
                try {
                    const errData = await response.json();
                    if (errData?.error) serverMessage = errData.error;
                } catch {
                    // ignore parse errors
                }
                throw new Error(serverMessage);
            }

            const result = await response.json();
            if (result?.imageUrl) {
                return result.imageUrl;
            }

            throw new Error('Image URL missing from upload response');
        } catch (error) {
            console.error('Error uploading image:', error);
            setError(
                t(
                    'errors.projectImageUpload',
                    'Failed to upload image. Please try a smaller file or a different format.'
                )
            );
            return null;
        } finally {
            setIsUploading(false);
        }
    };

    const handleRemoveImage = () => {
        setImageFile(null);
        setImagePreview('');
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const handleSubmit = async () => {
        setIsSaving(true);
        setError(null);

        try {
            let imageUrl = imagePreview;

            // Upload image if a new one was selected
            if (imageFile) {
                const uploadedImageUrl = await handleImageUpload();
                if (uploadedImageUrl) {
                    imageUrl = uploadedImageUrl;
                } else {
                    setIsSaving(false);
                    return;
                }
            }

            await onSave(imageUrl);
            handleClose();
        } catch (error) {
            console.error('Error saving banner:', error);
            setError(t('errors.bannerSaveFailed', 'Failed to save banner'));
        } finally {
            setIsSaving(false);
        }
    };

    const handleClose = () => {
        setIsClosing(true);
        setTimeout(() => {
            onClose();
            setIsClosing(false);
            setImageFile(null);
            setError(null);
        }, 300);
    };

    if (!isOpen) return null;

    return createPortal(
        <div
            className={`fixed top-16 left-0 right-0 bottom-0 flex items-start sm:items-center justify-center bg-gray-900 bg-opacity-80 z-40 transition-opacity duration-300 ${
                isClosing ? 'opacity-0' : 'opacity-100'
            }`}
            onMouseDown={(e) => {
                if (e.target === e.currentTarget) {
                    handleClose();
                }
            }}
        >
            <div
                ref={modalRef}
                className={`bg-white dark:bg-gray-800 border-0 sm:border sm:border-gray-200 sm:dark:border-gray-800 sm:rounded-lg sm:shadow-2xl w-full sm:max-w-5xl transform transition-transform duration-300 ${
                    isClosing ? 'scale-95' : 'scale-100'
                } h-full sm:h-auto sm:my-4`}
            >
                <div className="flex flex-col h-full sm:min-h-[700px] sm:max-h-[90vh]">
                    <div className="flex-1 flex flex-col transition-all duration-300 bg-white dark:bg-gray-800 sm:rounded-lg">
                        <div className="flex-1 relative">
                            <div
                                className="absolute inset-0 overflow-y-auto overflow-x-hidden"
                                style={{ WebkitOverflowScrolling: 'touch' }}
                            >
                                <div className="p-6">
                                    <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-6">
                                        {t(
                                            'project.editBanner',
                                            'Edit Project Banner'
                                        )}
                                    </h2>

                                    {error && (
                                        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
                                            <p className="text-red-600 dark:text-red-400 text-sm">
                                                {error}
                                            </p>
                                        </div>
                                    )}

                                    {imagePreview && (
                                        <div className="mb-6">
                                            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                                {t(
                                                    'project.currentBanner',
                                                    'Current Banner'
                                                )}
                                            </h3>
                                            <div className="relative inline-block w-full">
                                                <img
                                                    src={
                                                        imagePreview.startsWith(
                                                            'data:'
                                                        )
                                                            ? imagePreview
                                                            : getAssetPath(
                                                                  imagePreview
                                                              )
                                                    }
                                                    alt="Banner preview"
                                                    className="w-full h-48 object-cover rounded-md border border-gray-300 dark:border-gray-600"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={handleRemoveImage}
                                                    className="absolute top-2 right-2 bg-red-500 text-white rounded-full w-8 h-8 flex items-center justify-center hover:bg-red-600 shadow-lg"
                                                >
                                                    ×
                                                </button>
                                            </div>
                                        </div>
                                    )}

                                    <div className="mb-6">
                                        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                                            {t(
                                                'project.choosePreset',
                                                'Choose a preset banner:'
                                            )}
                                        </h3>
                                        <div className="grid grid-cols-2 gap-3">
                                            {presetBanners.map((banner) => (
                                                <button
                                                    key={banner.filename}
                                                    type="button"
                                                    onClick={() =>
                                                        handlePresetBannerSelect(
                                                            banner
                                                        )
                                                    }
                                                    className={`relative rounded-md overflow-hidden border-2 transition-all ${
                                                        imagePreview ===
                                                        banner.url
                                                            ? 'border-blue-500 ring-2 ring-blue-300 dark:ring-blue-700'
                                                            : 'border-gray-300 dark:border-gray-600 hover:border-blue-400'
                                                    }`}
                                                >
                                                    <img
                                                        src={getAssetPath(
                                                            banner.url
                                                        )}
                                                        alt={`Banner by ${banner.creator}`}
                                                        className="w-full h-24 object-cover"
                                                    />
                                                    <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-60 text-white text-xs px-2 py-1 text-center">
                                                        {banner.creator}
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                                        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                                            {t(
                                                'project.orUploadOwn',
                                                'Or upload your own:'
                                            )}
                                        </h3>
                                        <input
                                            ref={fileInputRef}
                                            type="file"
                                            accept="image/*"
                                            onChange={handleImageSelect}
                                            className="hidden"
                                        />
                                        <button
                                            type="button"
                                            onClick={() =>
                                                fileInputRef.current?.click()
                                            }
                                            className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
                                        >
                                            <svg
                                                className="w-4 h-4 mr-2"
                                                fill="none"
                                                stroke="currentColor"
                                                viewBox="0 0 24 24"
                                            >
                                                <path
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                    strokeWidth={2}
                                                    d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                                                />
                                            </svg>
                                            {t(
                                                'project.browseImage',
                                                'Browse Image'
                                            )}
                                        </button>
                                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                                            {t(
                                                'project.uploadImageHint',
                                                'Upload an image for your project (max 10MB)'
                                            )}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="flex-shrink-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center justify-end space-x-3 sm:rounded-b-lg">
                            <button
                                type="button"
                                onClick={handleClose}
                                className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 focus:outline-none transition duration-150 ease-in-out"
                            >
                                {t('common.cancel', 'Cancel')}
                            </button>
                            <button
                                type="button"
                                onClick={handleSubmit}
                                disabled={isUploading || isSaving}
                                className={`px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 focus:outline-none transition duration-150 ease-in-out text-sm ${
                                    isUploading || isSaving
                                        ? 'opacity-50 cursor-not-allowed'
                                        : ''
                                }`}
                            >
                                {isUploading
                                    ? t('common.uploading', 'Uploading...')
                                    : isSaving
                                      ? t('common.saving', 'Saving...')
                                      : t('common.save', 'Save')}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default BannerEditModal;
