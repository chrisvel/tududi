import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { CloudArrowUpIcon, PaperClipIcon } from '@heroicons/react/24/outline';
import { Attachment } from '../../../entities/Attachment';
import {
    uploadAttachment,
    deleteAttachment,
    downloadAttachment,
    fetchAttachments,
    validateFile,
    getAttachmentType,
} from '../../../utils/attachmentsService';
import { useToast } from '../../Shared/ToastContext';
import ConfirmDialog from '../../Shared/ConfirmDialog';
import AttachmentCard from '../../Shared/AttachmentCard';
import AttachmentPreview from '../../Shared/AttachmentPreview';

interface TaskAttachmentsCardProps {
    taskUid: string;
    onAttachmentsCountChange?: (count: number) => void;
}

const TaskAttachmentsCard: React.FC<TaskAttachmentsCardProps> = ({
    taskUid,
    onAttachmentsCountChange,
}) => {
    const { t } = useTranslation();
    const { showSuccessToast, showErrorToast } = useToast();
    const [attachments, setAttachments] = useState<Attachment[]>([]);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [previewAttachment, setPreviewAttachment] =
        useState<Attachment | null>(null);
    const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false);
    const [attachmentToDelete, setAttachmentToDelete] =
        useState<Attachment | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Load attachments on mount
    useEffect(() => {
        loadAttachments();
    }, [taskUid]);

    // Handle Escape key to close preview modal
    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && previewAttachment) {
                setPreviewAttachment(null);
            }
        };

        document.addEventListener('keydown', handleEscape);
        return () => {
            document.removeEventListener('keydown', handleEscape);
        };
    }, [previewAttachment]);

    const loadAttachments = async () => {
        try {
            setLoading(true);
            const data = await fetchAttachments(taskUid);
            setAttachments(data);
            onAttachmentsCountChange?.(data.length);
        } catch (error) {
            console.error('Error loading attachments:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Validate file
        const validation = validateFile(file);
        if (!validation.valid) {
            showErrorToast(validation.error || 'Invalid file');
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
            return;
        }

        // Check attachment limit
        if (attachments.length >= 20) {
            showErrorToast(
                t(
                    'task.attachments.limitReached',
                    'Maximum 20 attachments allowed per task'
                )
            );
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
            return;
        }

        // Upload file
        setUploading(true);
        try {
            const newAttachment = await uploadAttachment(taskUid, file);
            const updatedAttachments = [...attachments, newAttachment];
            setAttachments(updatedAttachments);
            onAttachmentsCountChange?.(updatedAttachments.length);
            showSuccessToast(
                t(
                    'task.attachments.uploadSuccess',
                    'File uploaded successfully'
                )
            );
        } catch (error: any) {
            showErrorToast(
                error.message ||
                    t('task.attachments.uploadError', 'Failed to upload file')
            );
        } finally {
            setUploading(false);
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        }
    };

    const handleDelete = (attachment: Attachment) => {
        setAttachmentToDelete(attachment);
        setIsConfirmDialogOpen(true);
    };

    const handleDeleteConfirm = async () => {
        if (!attachmentToDelete) return;

        try {
            await deleteAttachment(taskUid, attachmentToDelete.uid);
            const updatedAttachments = attachments.filter(
                (a) => a.uid !== attachmentToDelete.uid
            );
            setAttachments(updatedAttachments);
            onAttachmentsCountChange?.(updatedAttachments.length);
            showSuccessToast(
                t(
                    'task.attachments.deleteSuccess',
                    'Attachment deleted successfully'
                )
            );
            if (previewAttachment?.uid === attachmentToDelete.uid) {
                setPreviewAttachment(null);
            }
        } catch (error: any) {
            showErrorToast(
                error.message ||
                    t(
                        'task.attachments.deleteError',
                        'Failed to delete attachment'
                    )
            );
        } finally {
            setIsConfirmDialogOpen(false);
            setAttachmentToDelete(null);
        }
    };

    const handleDownload = (attachment: Attachment) => {
        downloadAttachment(attachment.uid);
    };

    const handlePreview = (attachment: Attachment) => {
        setPreviewAttachment(
            previewAttachment?.uid === attachment.uid ? null : attachment
        );
    };

    if (loading) {
        return (
            <div>
                <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center">
                    <PaperClipIcon className="h-4 w-4 mr-2" />
                    {t('task.attachments.title', 'Attachments')}
                </h4>
                <div className="rounded-lg shadow-sm bg-white dark:bg-gray-900 border-2 border-gray-50 dark:border-gray-800 p-6">
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                        {t('common.loading', 'Loading...')}
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div>
            <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center">
                <PaperClipIcon className="h-4 w-4 mr-2" />
                {t('task.attachments.title', 'Attachments')} (
                {attachments.length})
            </h4>

            {/* Grid Layout for Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {/* Upload Card */}
                <div
                    className="bg-gray-50 dark:bg-gray-900 rounded-lg shadow-md relative flex flex-col cursor-pointer hover:shadow-lg transition-shadow"
                    style={{ minHeight: '250px', maxHeight: '250px' }}
                    onClick={() => !uploading && fileInputRef.current?.click()}
                >
                    <input
                        ref={fileInputRef}
                        type="file"
                        className="hidden"
                        onChange={handleFileSelect}
                        disabled={uploading}
                        accept=".pdf,.doc,.docx,.txt,.md,.png,.jpg,.jpeg,.gif,.svg,.webp,.xls,.xlsx,.csv,.zip"
                    />
                    <div
                        className="bg-gray-200 dark:bg-gray-700 flex flex-col items-center justify-center rounded-t-lg border-2 border-dashed border-gray-300 dark:border-gray-600 hover:border-blue-400 dark:hover:border-blue-500 transition-colors"
                        style={{ height: '140px' }}
                    >
                        <CloudArrowUpIcon className="h-12 w-12 text-gray-400 dark:text-gray-500 mb-2" />
                        <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                            {uploading
                                ? t(
                                      'task.attachments.uploading',
                                      'Uploading...'
                                  )
                                : t(
                                      'task.attachments.clickToUpload',
                                      'Click to upload'
                                  )}
                        </p>
                    </div>
                    <div className="p-4 flex-1 flex flex-col justify-center">
                        <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
                            {t('task.attachments.maxSize', 'Max 10MB')}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 text-center mt-1">
                            {t(
                                'task.attachments.supportedFormats',
                                'PDF, images, docs & more'
                            )}
                        </p>
                    </div>
                </div>

                {/* Attachment Cards */}
                {attachments.map((attachment) => (
                    <AttachmentCard
                        key={attachment.uid}
                        attachment={attachment}
                        taskUid={taskUid}
                        onDelete={handleDelete}
                        onDownload={handleDownload}
                        onPreview={handlePreview}
                        isPreviewOpen={
                            previewAttachment?.uid === attachment.uid
                        }
                    />
                ))}
            </div>

            {/* Full Preview Modal */}
            {previewAttachment && (
                <div
                    className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4"
                    onClick={() => setPreviewAttachment(null)}
                >
                    <div
                        className={`bg-white dark:bg-gray-800 rounded-lg ${
                            getAttachmentType(previewAttachment.mime_type) ===
                            'pdf'
                                ? 'w-full max-w-[95vw] h-[95vh]'
                                : 'max-w-4xl max-h-[90vh]'
                        } overflow-auto`}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                                {previewAttachment.original_filename}
                            </h3>
                            <button
                                onClick={() => setPreviewAttachment(null)}
                                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                            >
                                ✕
                            </button>
                        </div>
                        <div className="p-1">
                            <AttachmentPreview
                                attachment={previewAttachment}
                                maxHeight={
                                    getAttachmentType(
                                        previewAttachment.mime_type
                                    ) === 'pdf'
                                        ? 'calc(95vh - 80px)'
                                        : '70vh'
                                }
                            />
                        </div>
                    </div>
                </div>
            )}

            {/* Confirm Delete Dialog */}
            {isConfirmDialogOpen && attachmentToDelete && (
                <ConfirmDialog
                    title={t(
                        'task.attachments.deleteConfirmTitle',
                        'Delete Attachment'
                    )}
                    message={t(
                        'task.attachments.deleteConfirmMessage',
                        'Are you sure you want to delete this attachment? This action cannot be undone.'
                    )}
                    onConfirm={handleDeleteConfirm}
                    onCancel={() => {
                        setIsConfirmDialogOpen(false);
                        setAttachmentToDelete(null);
                    }}
                />
            )}
        </div>
    );
};

export default TaskAttachmentsCard;
