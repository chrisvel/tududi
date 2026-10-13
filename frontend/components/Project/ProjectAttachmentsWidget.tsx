import React, { useEffect, useRef, useState } from 'react';
import { TFunction } from 'i18next';
import { CloudArrowUpIcon, PlusIcon } from '@heroicons/react/24/outline';
import { FileAttachment } from '../../entities/Attachment';
import { AttachmentsApi, formatFileSize } from '../../utils/attachmentsService';
import FileIcon from '../Shared/Icons/FileIcon';
import { useToast } from '../Shared/ToastContext';
import AttachmentViewer from '../Shared/AttachmentViewer';

interface ProjectAttachmentsWidgetProps {
    // Keep it stable (useMemo): a new object reloads the list.
    api: AttachmentsApi;
    t: TFunction;
}

const VISIBLE_FILES = 5;
const MAX_FILES = 20;

// The project's files as a short list for the overview column. Files open
// in a preview, and can be added with + or by dropping them on the panel.
const ProjectAttachmentsWidget: React.FC<ProjectAttachmentsWidgetProps> = ({
    api,
    t,
}) => {
    const { showSuccessToast, showErrorToast } = useToast();
    const [files, setFiles] = useState<FileAttachment[]>([]);
    const [uploading, setUploading] = useState(false);
    const [viewing, setViewing] = useState<number | null>(null);
    const [dragging, setDragging] = useState(false);
    const [showAll, setShowAll] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        let cancelled = false;
        api.list()
            .then((list) => {
                if (!cancelled) setFiles(list);
            })
            .catch(() => {
                // The panel still offers uploads without the list.
            });
        return () => {
            cancelled = true;
        };
    }, [api]);

    // Uploads one after another so the 20-file limit is checked as it fills.
    const upload = async (picked: File[]) => {
        if (picked.length === 0) return;
        let current = files;
        setUploading(true);
        try {
            for (const file of picked) {
                if (current.length >= MAX_FILES) {
                    showErrorToast(
                        t(
                            'attachments.limitReached',
                            'Maximum 20 attachments allowed'
                        )
                    );
                    break;
                }
                try {
                    const added = await api.upload(file);
                    current = [...current, added];
                    setFiles(current);
                    showSuccessToast(
                        t(
                            'task.attachments.uploadSuccess',
                            'File uploaded successfully'
                        )
                    );
                } catch (error: any) {
                    showErrorToast(
                        error?.message ||
                            t(
                                'task.attachments.uploadError',
                                'Failed to upload file'
                            )
                    );
                }
            }
        } finally {
            setUploading(false);
            if (inputRef.current) inputRef.current.value = '';
        }
    };

    // Counts nested enter/leave events so moving over child elements does
    // not flicker the highlight.
    const dragDepth = useRef(0);
    const hasFiles = (event: React.DragEvent) =>
        Array.from(event.dataTransfer.types).includes('Files');

    return (
        <section
            className={`relative space-y-3 rounded-xl p-4 transition-colors ${
                dragging
                    ? 'bg-blue-50 ring-2 ring-inset ring-blue-400 dark:bg-blue-900/20 dark:ring-blue-500'
                    : 'bg-white dark:bg-gray-900'
            }`}
            onDragEnter={(e) => {
                if (!hasFiles(e)) return;
                e.preventDefault();
                dragDepth.current += 1;
                setDragging(true);
            }}
            onDragOver={(e) => {
                if (!hasFiles(e)) return;
                e.preventDefault();
                e.dataTransfer.dropEffect = 'copy';
            }}
            onDragLeave={(e) => {
                if (!hasFiles(e)) return;
                dragDepth.current = Math.max(0, dragDepth.current - 1);
                if (dragDepth.current === 0) setDragging(false);
            }}
            onDrop={(e) => {
                if (!hasFiles(e)) return;
                e.preventDefault();
                dragDepth.current = 0;
                setDragging(false);
                upload(Array.from(e.dataTransfer.files));
            }}
        >
            {dragging && (
                <div className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center gap-1 rounded-xl bg-blue-50/90 text-blue-600 dark:bg-blue-950/80 dark:text-blue-300">
                    <CloudArrowUpIcon className="h-8 w-8" />
                    <span className="text-sm font-medium">
                        {t('project.dropToUpload', 'Drop to upload')}
                    </span>
                </div>
            )}
            <div className="flex items-start justify-between gap-2">
                <div>
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                        {t('project.attachments', 'Attachments')}
                    </h3>
                    {files.length > 0 && (
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                            {t('project.fileCount', '{{count}} files', {
                                count: files.length,
                            })}
                        </p>
                    )}
                </div>
                <button
                    type="button"
                    onClick={() => inputRef.current?.click()}
                    disabled={uploading}
                    className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700 disabled:opacity-50 dark:hover:bg-gray-800 dark:hover:text-gray-200"
                    aria-label={t('project.addFile', 'Add file')}
                    title={t('project.addFile', 'Add file')}
                >
                    <PlusIcon className="h-4 w-4" />
                </button>
                <input
                    ref={inputRef}
                    type="file"
                    className="hidden"
                    multiple
                    onChange={(e) => upload(Array.from(e.target.files || []))}
                />
            </div>

            {files.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400">
                    {uploading
                        ? t('project.uploading', 'Uploading...')
                        : t(
                              'project.noFilesYet',
                              'No files yet. Drop files here or use +.'
                          )}
                </p>
            ) : (
                <ul className="space-y-0.5">
                    {files
                        .slice(0, showAll ? undefined : VISIBLE_FILES)
                        .map((file, index) => (
                            <li key={file.uid}>
                                <button
                                    type="button"
                                    onClick={() => setViewing(index)}
                                    className="-mx-2 flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-gray-100 dark:hover:bg-gray-800"
                                >
                                    {file.mime_type.startsWith('image/') &&
                                    file.file_url ? (
                                        <img
                                            src={file.file_url}
                                            alt=""
                                            className="h-8 w-8 flex-shrink-0 rounded-md object-cover"
                                        />
                                    ) : (
                                        <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md bg-gray-100 dark:bg-gray-800">
                                            <FileIcon
                                                mimeType={file.mime_type}
                                                className="h-4 w-4"
                                            />
                                        </span>
                                    )}
                                    <span className="min-w-0">
                                        <span className="block truncate text-sm text-gray-800 dark:text-gray-200">
                                            {file.title ||
                                                file.original_filename}
                                        </span>
                                        <span className="text-xs text-gray-400 dark:text-gray-500">
                                            {formatFileSize(file.file_size)}
                                        </span>
                                    </span>
                                </button>
                            </li>
                        ))}
                </ul>
            )}
            {files.length > VISIBLE_FILES && (
                <button
                    type="button"
                    onClick={() => setShowAll((v) => !v)}
                    className="text-xs font-medium text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
                >
                    {showAll
                        ? t('project.fewerFiles', 'Show fewer')
                        : t('project.allFiles', 'All files')}
                </button>
            )}
            {viewing !== null && (
                <AttachmentViewer
                    attachments={files}
                    startIndex={viewing}
                    api={api}
                    onClose={() => setViewing(null)}
                    onDeleted={(uid) =>
                        setFiles((current) =>
                            current.filter((f) => f.uid !== uid)
                        )
                    }
                    onRenamed={(saved) =>
                        setFiles((current) =>
                            current.map((f) =>
                                f.uid === saved.uid ? saved : f
                            )
                        )
                    }
                />
            )}
        </section>
    );
};

export default ProjectAttachmentsWidget;
