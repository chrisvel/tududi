import React from 'react';
import { useTranslation } from 'react-i18next';
import { XMarkIcon } from '@heroicons/react/24/outline';
import FileIcon from '../Shared/Icons/FileIcon';
import { formatFileSize } from '../../utils/attachmentsService';
import { CaptureFile } from './useCaptureFiles';

interface CaptureFilesProps {
    files: CaptureFile[];
    onRemove: (id: string) => void;
    disabled?: boolean;
}

// The files waiting to be saved with the text, each with a way to take it
// back out before saving.
const CaptureFiles: React.FC<CaptureFilesProps> = ({
    files,
    onRemove,
    disabled = false,
}) => {
    const { t } = useTranslation();
    if (files.length === 0) return null;

    return (
        <ul
            data-testid="capture-files"
            aria-label={t('capture.filesLabel', 'Files to attach')}
            className="flex flex-wrap gap-2 pt-1 pb-2"
        >
            {files.map(({ id, file, previewUrl }) => (
                <li
                    key={id}
                    data-testid="capture-file"
                    className="flex items-center gap-2 max-w-[15rem] rounded-lg bg-black/[0.05] dark:bg-white/[0.06] pl-1.5 pr-1 py-1 text-xs text-gray-700 dark:text-gray-200"
                >
                    {previewUrl ? (
                        <img
                            src={previewUrl}
                            alt=""
                            className="h-8 w-8 flex-shrink-0 rounded object-cover"
                        />
                    ) : (
                        <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded bg-black/[0.05] dark:bg-white/[0.08] text-gray-500 dark:text-gray-400">
                            <FileIcon
                                mimeType={file.type}
                                className="h-4 w-4"
                            />
                        </span>
                    )}
                    <span className="min-w-0">
                        <span className="block truncate font-medium">
                            {file.name}
                        </span>
                        <span className="block text-gray-500 dark:text-gray-400">
                            {formatFileSize(file.size)}
                        </span>
                    </span>
                    <button
                        type="button"
                        disabled={disabled}
                        onClick={() => onRemove(id)}
                        aria-label={t('capture.removeFile', 'Remove {{name}}', {
                            name: file.name,
                        })}
                        className="flex-shrink-0 rounded p-1 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-black/[0.06] dark:hover:bg-white/[0.08] focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                    >
                        <XMarkIcon className="h-4 w-4" aria-hidden="true" />
                    </button>
                </li>
            ))}
        </ul>
    );
};

export default CaptureFiles;
