import React, { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { CloudArrowUpIcon } from '@heroicons/react/24/outline';
import { Attachment } from '../../../entities/Attachment';
import {
    uploadAttachment,
    deleteAttachment,
    downloadAttachment,
    validateFile,
} from '../../../utils/attachmentsService';
import { useToast } from '../../Shared/ToastContext';
import AttachmentListItem from '../../Shared/AttachmentListItem';
import AttachmentPreview from '../../Shared/AttachmentPreview';

interface TaskAttachmentsSectionProps {
    taskUid: string;
    attachments: Attachment[];
    onAttachmentsChange: (attachments: Attachment[]) => void;
    disabled?: boolean;
}

const TaskAttachmentsSection: React.FC<TaskAttachmentsSectionProps> = ({
    taskUid,
    attachments,
    onAttachmentsChange,
    disabled = false,
}) => {
    const { t } = useTranslation();
    const { showSuccessToast, showErrorToast } = useToast();
    const [uploading, setUploading] = useState(false);
    const [previewAttachment, setPreviewAttachment] =
        useState<Attachment | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

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
            onAttachmentsChange([...attachments, newAttachment]);
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

    const handleDelete = async (attachment: Attachment) => {
        try {
            await deleteAttachment(taskUid, attachment.uid);
            onAttachmentsChange(
                attachments.filter((a) => a.uid !== attachment.uid)
            );
            showSuccessToast(
                t(
                    'task.attachments.deleteSuccess',
                    'Attachment deleted successfully'
                )
            );
            if (previewAttachment?.uid === attachment.uid) {
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

    return (
        <div className="space-y-3">
            {/* Upload Area */}
            <div
                className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
                    disabled
                        ? 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800'
                        : 'border-gray-300 dark:border-gray-600 hover:border-blue-400 dark:hover:border-blue-500 cursor-pointer'
                }`}
                onClick={() => !disabled && fileInputRef.current?.click()}
            >
                <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    onChange={handleFileSelect}
                    disabled={disabled || uploading}
                    accept=".pdf,.doc,.docx,.txt,.md,.png,.jpg,.jpeg,.gif,.svg,.webp,.xls,.xlsx,.csv,.zip"
                />
                <CloudArrowUpIcon className="h-10 w-10 mx-auto mb-2 text-gray-400 dark:text-gray-500" />
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {uploading
                        ? t('task.attachments.uploading', 'Uploading...')
                        : t(
                              'task.attachments.clickToUpload',
                              'Click to upload or drag and drop'
                          )}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                    {t(
                        'task.attachments.allowedTypes',
                        'PDF, DOC, DOCX, TXT, MD, Images, XLS, XLSX, CSV, ZIP (max 10MB)'
                    )}
                </p>
            </div>

            {/* Attachments List */}
            {attachments.length > 0 && (
                <div className="space-y-2">
                    {attachments.map((attachment) => (
                        <div key={attachment.uid}>
                            <AttachmentListItem
                                attachment={attachment}
                                onDelete={handleDelete}
                                onDownload={handleDownload}
                                onPreview={handlePreview}
                                showPreview={true}
                            />
                            {previewAttachment?.uid === attachment.uid && (
                                <div className="mt-2">
                                    <AttachmentPreview
                                        attachment={attachment}
                                        maxHeight="300px"
                                    />
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {/* Counter */}
            <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
                {t('task.attachments.count', '{{count}} / 20 files', {
                    count: attachments.length,
                })}
            </p>
        </div>
    );
};

export default TaskAttachmentsSection;
