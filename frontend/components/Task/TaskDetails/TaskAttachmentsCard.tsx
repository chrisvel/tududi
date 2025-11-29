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
} from '../../../utils/attachmentsService';
import { useToast } from '../../Shared/ToastContext';
import AttachmentListItem from '../../Shared/AttachmentListItem';
import AttachmentPreview from '../../Shared/AttachmentPreview';

interface TaskAttachmentsCardProps {
    taskUid: string;
}

const TaskAttachmentsCard: React.FC<TaskAttachmentsCardProps> = ({
    taskUid,
}) => {
    const { t } = useTranslation();
    const { showSuccessToast, showErrorToast } = useToast();
    const [attachments, setAttachments] = useState<Attachment[]>([]);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [previewAttachment, setPreviewAttachment] =
        useState<Attachment | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Load attachments on mount
    useEffect(() => {
        loadAttachments();
    }, [taskUid]);

    const loadAttachments = async () => {
        try {
            setLoading(true);
            const data = await fetchAttachments(taskUid);
            setAttachments(data);
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
            setAttachments([...attachments, newAttachment]);
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
            setAttachments(attachments.filter((a) => a.uid !== attachment.uid));
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
            <div className="rounded-lg shadow-sm bg-white dark:bg-gray-900 border-2 border-gray-50 dark:border-gray-800 p-6">
                {/* Upload Area */}
                <div
                    className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-4 text-center hover:border-blue-400 dark:hover:border-blue-500 cursor-pointer transition-colors mb-4"
                    onClick={() => fileInputRef.current?.click()}
                >
                    <input
                        ref={fileInputRef}
                        type="file"
                        className="hidden"
                        onChange={handleFileSelect}
                        disabled={uploading}
                        accept=".pdf,.doc,.docx,.txt,.md,.png,.jpg,.jpeg,.gif,.svg,.webp,.xls,.xlsx,.csv,.zip"
                    />
                    <CloudArrowUpIcon className="h-8 w-8 mx-auto mb-2 text-gray-400 dark:text-gray-500" />
                    <p className="text-xs font-medium text-gray-700 dark:text-gray-300">
                        {uploading
                            ? t('task.attachments.uploading', 'Uploading...')
                            : t(
                                  'task.attachments.clickToUpload',
                                  'Click to upload'
                              )}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {t('task.attachments.maxSize', 'Max 10MB')}
                    </p>
                </div>

                {/* Attachments List */}
                {attachments.length > 0 ? (
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
                                            maxHeight="400px"
                                        />
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                ) : (
                    <p className="text-sm text-gray-500 dark:text-gray-400 text-center">
                        {t(
                            'task.attachments.noAttachments',
                            'No attachments yet'
                        )}
                    </p>
                )}
            </div>
        </div>
    );
};

export default TaskAttachmentsCard;
