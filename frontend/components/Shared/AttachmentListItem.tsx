import React from 'react';
import {
    TrashIcon,
    ArrowDownTrayIcon,
    EyeIcon,
} from '@heroicons/react/24/outline';
import { Attachment } from '../../entities/Attachment';
import {
    formatFileSize,
    canPreviewInline,
} from '../../utils/attachmentsService';
import FileIcon from './Icons/FileIcon';

interface AttachmentListItemProps {
    attachment: Attachment;
    onDelete: (attachment: Attachment) => void;
    onDownload: (attachment: Attachment) => void;
    onPreview?: (attachment: Attachment) => void;
    showPreview?: boolean;
}

const AttachmentListItem: React.FC<AttachmentListItemProps> = ({
    attachment,
    onDelete,
    onDownload,
    onPreview,
    showPreview = true,
}) => {
    const canPreview = canPreviewInline(attachment.mime_type);

    return (
        <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-750 transition-colors">
            <div className="flex items-center space-x-3 flex-1 min-w-0">
                <FileIcon
                    mimeType={attachment.mime_type}
                    className="h-5 w-5 text-gray-500 dark:text-gray-400 flex-shrink-0"
                />
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                        {attachment.original_filename}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                        {formatFileSize(attachment.file_size)}
                    </p>
                </div>
            </div>
            <div className="flex items-center space-x-2 flex-shrink-0">
                {showPreview && canPreview && onPreview && (
                    <button
                        onClick={() => onPreview(attachment)}
                        className="p-1.5 text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
                        title="Preview"
                    >
                        <EyeIcon className="h-4 w-4" />
                    </button>
                )}
                <button
                    onClick={() => onDownload(attachment)}
                    className="p-1.5 text-gray-500 dark:text-gray-400 hover:text-green-600 dark:hover:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 rounded transition-colors"
                    title="Download"
                >
                    <ArrowDownTrayIcon className="h-4 w-4" />
                </button>
                <button
                    onClick={() => onDelete(attachment)}
                    className="p-1.5 text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                    title="Delete"
                >
                    <TrashIcon className="h-4 w-4" />
                </button>
            </div>
        </div>
    );
};

export default AttachmentListItem;
