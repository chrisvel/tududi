import React, { useState, useEffect } from 'react';
import { Attachment } from '../../entities/Attachment';
import { getAttachmentType } from '../../utils/attachmentsService';

interface AttachmentPreviewProps {
    attachment: Attachment;
    maxHeight?: string;
    className?: string;
}

const AttachmentPreview: React.FC<AttachmentPreviewProps> = ({
    attachment,
    maxHeight = '400px',
    className = '',
}) => {
    const [textContent, setTextContent] = useState<string>('');
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);

    const type = getAttachmentType(attachment.mime_type);
    const fileUrl = attachment.file_url;

    useEffect(() => {
        if (type === 'text' && fileUrl) {
            setLoading(true);
            fetch(fileUrl, { credentials: 'include' })
                .then((res) => res.text())
                .then((text) => {
                    setTextContent(text);
                    setLoading(false);
                })
                .catch((err) => {
                    console.error('Failed to load text file:', err);
                    setError('Failed to load file content');
                    setLoading(false);
                });
        }
    }, [fileUrl, type]);

    if (!fileUrl) {
        console.warn('No file URL available for attachment:', attachment);
        return (
            <div className="text-sm text-gray-500 dark:text-gray-400 p-4">
                Preview not available
            </div>
        );
    }

    if (type === 'image') {
        return (
            <div className={`rounded-lg overflow-hidden ${className}`}>
                <img
                    src={fileUrl}
                    alt={attachment.original_filename}
                    className="max-w-full h-auto"
                    style={{ maxHeight }}
                />
            </div>
        );
    }

    if (type === 'pdf') {
        return (
            <div
                className={`rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 ${className}`}
            >
                <iframe
                    src={fileUrl}
                    title={attachment.original_filename}
                    className="w-full"
                    style={{ height: maxHeight }}
                />
            </div>
        );
    }

    if (type === 'text') {
        if (loading) {
            return (
                <div className="text-sm text-gray-500 dark:text-gray-400">
                    Loading...
                </div>
            );
        }

        if (error) {
            return (
                <div className="text-sm text-red-600 dark:text-red-400">
                    {error}
                </div>
            );
        }

        return (
            <div
                className={`rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 p-4 overflow-auto ${className}`}
                style={{ maxHeight }}
            >
                <pre className="text-sm text-gray-900 dark:text-gray-100 whitespace-pre-wrap font-mono">
                    {textContent}
                </pre>
            </div>
        );
    }

    // Fallback for non-previewable types
    return null;
};

export default AttachmentPreview;
