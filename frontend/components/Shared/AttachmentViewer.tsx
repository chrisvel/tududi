import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import {
    ArrowDownTrayIcon,
    TrashIcon,
    ChevronLeftIcon,
    ChevronRightIcon,
    XMarkIcon,
} from '@heroicons/react/24/outline';
import { FileAttachment } from '../../entities/Attachment';
import {
    AttachmentsApi,
    formatFileSize,
    getAttachmentType,
} from '../../utils/attachmentsService';
import FileIcon from './Icons/FileIcon';
import { useToast } from './ToastContext';

interface AttachmentViewerProps {
    attachments: FileAttachment[];
    startIndex: number;
    api: AttachmentsApi;
    onClose: () => void;
    onRenamed?: (attachment: FileAttachment) => void;
    // Called after a file is deleted; the viewer closes itself when it
    // was the last one.
    onDeleted?: (attachmentUid: string) => void;
}

// A file opened full size over the page: images and PDFs show inline, other
// files offer a download. The title can be set here, and the arrows (or the
// arrow keys) step through the other files.
const AttachmentViewer: React.FC<AttachmentViewerProps> = ({
    attachments,
    startIndex,
    api,
    onClose,
    onRenamed,
    onDeleted,
}) => {
    const { t } = useTranslation();
    const { showErrorToast } = useToast();
    const [index, setIndex] = useState(startIndex);
    const attachment = attachments[index];
    const [title, setTitle] = useState(attachment?.title || '');
    const canStep = attachments.length > 1;

    const [confirmingDelete, setConfirmingDelete] = useState(false);
    const [deleting, setDeleting] = useState(false);

    useEffect(() => {
        setTitle(attachments[index]?.title || '');
        setConfirmingDelete(false);
    }, [index, attachments]);

    useEffect(() => {
        const handleKey = (event: KeyboardEvent) => {
            const typing =
                event.target instanceof HTMLInputElement ||
                event.target instanceof HTMLTextAreaElement;
            if (event.key === 'Escape') {
                onClose();
            } else if (!typing && canStep && event.key === 'ArrowRight') {
                setIndex((i) => (i + 1) % attachments.length);
            } else if (!typing && canStep && event.key === 'ArrowLeft') {
                setIndex(
                    (i) => (i - 1 + attachments.length) % attachments.length
                );
            }
        };
        document.addEventListener('keydown', handleKey);
        return () => document.removeEventListener('keydown', handleKey);
    }, [attachments.length, canStep, onClose]);

    if (!attachment) return null;

    const type = getAttachmentType(attachment.mime_type);

    const saveTitle = async () => {
        const next = title.trim();
        if (!api.rename || next === (attachment.title || '')) return;
        try {
            const saved = await api.rename(attachment.uid, next);
            onRenamed?.(saved);
        } catch (error: any) {
            setTitle(attachment.title || '');
            showErrorToast(
                error?.message ||
                    t('attachments.renameError', 'Could not save the title')
            );
        }
    };

    const remove = async () => {
        setDeleting(true);
        try {
            await api.remove(attachment.uid);
            onDeleted?.(attachment.uid);
            if (attachments.length <= 1) {
                onClose();
            } else if (index >= attachments.length - 1) {
                setIndex(index - 1);
            }
        } catch (error: any) {
            showErrorToast(
                error?.message ||
                    t('task.attachments.deleteError', 'Failed to delete file')
            );
        } finally {
            setDeleting(false);
            setConfirmingDelete(false);
        }
    };

    const step = (delta: number) =>
        setIndex((i) => (i + delta + attachments.length) % attachments.length);

    const navButton =
        'absolute top-1/2 -translate-y-1/2 rounded-full bg-black/40 p-2 text-white transition-colors hover:bg-black/60';

    return createPortal(
        <div
            className="fixed inset-0 z-[70] flex flex-col bg-black/80"
            onMouseDown={(event) => {
                if (event.target === event.currentTarget) onClose();
            }}
            role="dialog"
            aria-modal="true"
            aria-label={attachment.title || attachment.original_filename}
        >
            <div className="flex items-center gap-3 bg-gray-900/90 px-4 py-3 text-white sm:px-6">
                <FileIcon
                    mimeType={attachment.mime_type}
                    className="h-5 w-5 flex-shrink-0"
                />
                <div className="min-w-0 flex-1">
                    {api.rename ? (
                        <input
                            type="text"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            onBlur={saveTitle}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    e.currentTarget.blur();
                                }
                            }}
                            placeholder={t(
                                'attachments.addTitle',
                                'Add a title'
                            )}
                            maxLength={255}
                            className="w-full rounded-md border-none bg-transparent px-1 py-0.5 text-sm font-medium text-white placeholder-gray-400 hover:bg-white/10 focus:bg-white/10 focus:outline-none focus:ring-0"
                            aria-label={t('attachments.title', 'Title')}
                        />
                    ) : (
                        <p className="truncate px-1 text-sm font-medium">
                            {attachment.title || attachment.original_filename}
                        </p>
                    )}
                    <p className="truncate px-1 text-xs text-gray-400">
                        {attachment.original_filename} ·{' '}
                        {formatFileSize(attachment.file_size)}
                        {canStep && ` · ${index + 1} / ${attachments.length}`}
                    </p>
                </div>
                <a
                    href={api.downloadUrl(attachment.uid)}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-sm font-medium transition-colors hover:bg-white/20"
                >
                    <ArrowDownTrayIcon className="h-4 w-4" />
                    <span className="hidden sm:inline">
                        {t('attachments.download', 'Download')}
                    </span>
                </a>
                {onDeleted &&
                    (confirmingDelete ? (
                        <button
                            type="button"
                            onClick={remove}
                            disabled={deleting}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-60"
                        >
                            <TrashIcon className="h-4 w-4" />
                            {t('attachments.confirmDelete', 'Delete file?')}
                        </button>
                    ) : (
                        <button
                            type="button"
                            onClick={() => setConfirmingDelete(true)}
                            className="rounded-lg p-1.5 text-gray-300 transition-colors hover:bg-white/10 hover:text-red-400"
                            aria-label={t('common.delete', 'Delete')}
                            title={t('common.delete', 'Delete')}
                        >
                            <TrashIcon className="h-5 w-5" />
                        </button>
                    ))}
                <button
                    type="button"
                    onClick={onClose}
                    className="rounded-lg p-1.5 text-gray-300 transition-colors hover:bg-white/10 hover:text-white"
                    aria-label={t('common.close', 'Close')}
                >
                    <XMarkIcon className="h-5 w-5" />
                </button>
            </div>

            <div
                className="relative flex min-h-0 flex-1 items-center justify-center p-4 sm:p-8"
                onMouseDown={(event) => {
                    if (event.target === event.currentTarget) onClose();
                }}
            >
                {type === 'image' && attachment.file_url ? (
                    <img
                        src={attachment.file_url}
                        alt={attachment.title || attachment.original_filename}
                        className="max-h-full max-w-full rounded-md object-contain shadow-2xl"
                    />
                ) : type === 'pdf' && attachment.file_url ? (
                    <iframe
                        src={attachment.file_url}
                        title={attachment.title || attachment.original_filename}
                        className="h-full w-full max-w-5xl rounded-md bg-white shadow-2xl"
                    />
                ) : (
                    <div className="flex flex-col items-center gap-4 rounded-xl bg-gray-900/90 px-10 py-8 text-center text-gray-200">
                        <FileIcon
                            mimeType={attachment.mime_type}
                            className="h-14 w-14"
                        />
                        <p className="text-sm">
                            {t(
                                'attachments.noPreview',
                                'No preview for this file type.'
                            )}
                        </p>
                        <a
                            href={api.downloadUrl(attachment.uid)}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
                        >
                            <ArrowDownTrayIcon className="h-4 w-4" />
                            {t('attachments.download', 'Download')}
                        </a>
                    </div>
                )}

                {canStep && (
                    <>
                        <button
                            type="button"
                            onClick={() => step(-1)}
                            className={`${navButton} left-3`}
                            aria-label={t(
                                'attachments.previous',
                                'Previous file'
                            )}
                        >
                            <ChevronLeftIcon className="h-6 w-6" />
                        </button>
                        <button
                            type="button"
                            onClick={() => step(1)}
                            className={`${navButton} right-3`}
                            aria-label={t('attachments.next', 'Next file')}
                        >
                            <ChevronRightIcon className="h-6 w-6" />
                        </button>
                    </>
                )}
            </div>
        </div>,
        document.body
    );
};

export default AttachmentViewer;
