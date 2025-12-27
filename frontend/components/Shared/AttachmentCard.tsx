import React from 'react';
import {
    TrashIcon,
    ArrowDownTrayIcon,
    EyeIcon,
} from '@heroicons/react/24/outline';
import { Attachment } from '../../entities/Attachment';
import FileIcon from './Icons/FileIcon';

interface AttachmentCardProps {
    attachment: Attachment;
    taskUid: string;
    onDelete: (attachment: Attachment) => void;
    onDownload: (attachment: Attachment) => void;
    onPreview: (attachment: Attachment) => void;
    isPreviewOpen: boolean;
}

const AttachmentCard: React.FC<AttachmentCardProps> = ({
    attachment,
    onDelete,
    onDownload,
    onPreview,
}) => {
    const isImage = attachment.mime_type.startsWith('image/');
    const isPdf = attachment.mime_type === 'application/pdf';
    const canPreview = isImage || isPdf;

    const formatFileSize = (bytes: number): string => {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    };

    return (
        <div
            className="bg-gray-50 dark:bg-gray-900 rounded-lg shadow-md relative flex flex-col group"
            style={{ minHeight: '250px', maxHeight: '250px' }}
        >
            {/* Preview/Icon Area */}
            <div
                className="bg-gray-200 dark:bg-gray-700 flex items-center justify-center overflow-hidden rounded-t-lg relative cursor-pointer hover:opacity-90 transition-opacity"
                style={{ height: '140px' }}
                onClick={() => canPreview && onPreview(attachment)}
            >
                {isImage && attachment.file_url ? (
                    <img
                        src={attachment.file_url}
                        alt={attachment.original_filename}
                        className="w-full h-full object-cover"
                    />
                ) : isPdf ? (
                    <div className="flex flex-col items-center justify-center">
                        <FileIcon
                            mimeType={attachment.mime_type}
                            className="h-16 w-16 mb-2"
                        />
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                            PDF
                        </span>
                    </div>
                ) : (
                    <FileIcon
                        mimeType={attachment.mime_type}
                        className="h-16 w-16"
                    />
                )}

                {/* Action buttons overlay - visible on hover */}
                <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100">
                    <div className="flex space-x-2">
                        {canPreview && (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onPreview(attachment);
                                }}
                                className="p-2 bg-white dark:bg-gray-800 rounded-full shadow-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                                title="Preview"
                            >
                                <EyeIcon className="h-5 w-5 text-gray-700 dark:text-gray-300" />
                            </button>
                        )}
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onDownload(attachment);
                            }}
                            className="p-2 bg-white dark:bg-gray-800 rounded-full shadow-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                            title="Download"
                        >
                            <ArrowDownTrayIcon className="h-5 w-5 text-gray-700 dark:text-gray-300" />
                        </button>
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onDelete(attachment);
                            }}
                            className="p-2 bg-white dark:bg-gray-800 rounded-full shadow-lg hover:bg-red-100 dark:hover:bg-red-900 transition-colors"
                            title="Delete"
                        >
                            <TrashIcon className="h-5 w-5 text-red-600 dark:text-red-400" />
                        </button>
                    </div>
                </div>
            </div>

            {/* File Info Area */}
            <div className="p-4 flex-1 flex flex-col justify-between">
                <div>
                    <h3
                        className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate"
                        title={attachment.original_filename}
                    >
                        {attachment.original_filename}
                    </h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {formatFileSize(attachment.file_size)}
                    </p>
                </div>

                {/* Date */}
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
                    {new Date(attachment.created_at).toLocaleDateString()}
                </p>
            </div>
        </div>
    );
};

export default AttachmentCard;
