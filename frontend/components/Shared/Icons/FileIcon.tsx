import React from 'react';
import {
    PhotoIcon,
    DocumentTextIcon,
    DocumentIcon,
    TableCellsIcon,
    ArchiveBoxIcon,
    PaperClipIcon,
} from '@heroicons/react/24/outline';
import { getAttachmentType } from '../../../utils/attachmentsService';

interface FileIconProps {
    mimeType: string;
    className?: string;
}

const FileIcon: React.FC<FileIconProps> = ({
    mimeType,
    className = 'h-5 w-5',
}) => {
    const type = getAttachmentType(mimeType);

    switch (type) {
        case 'image':
            return <PhotoIcon className={className} />;
        case 'pdf':
            return <DocumentTextIcon className={className} />;
        case 'text':
            return <DocumentIcon className={className} />;
        case 'spreadsheet':
            return <TableCellsIcon className={className} />;
        case 'archive':
            return <ArchiveBoxIcon className={className} />;
        default:
            return <PaperClipIcon className={className} />;
    }
};

export default FileIcon;
