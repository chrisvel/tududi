import React from 'react';
import { useTranslation } from 'react-i18next';
import { InboxAttachment } from '../../entities/Attachment';
import FileIcon from '../Shared/Icons/FileIcon';
import { canPreviewInline } from '../../utils/attachmentsService';
import { getInboxAttachmentDownloadUrl } from '../../utils/inboxService';

interface InboxItemAttachmentsProps {
    itemUid: string;
    attachments: InboxAttachment[];
}

// The files on an inbox item, under its text. Images show as thumbnails;
// everything opens or downloads in a new tab without opening the item.
const InboxItemAttachments: React.FC<InboxItemAttachmentsProps> = ({
    itemUid,
    attachments,
}) => {
    const { t } = useTranslation();
    if (attachments.length === 0) return null;

    return (
        <ul
            data-testid="inbox-item-attachments"
            aria-label={t('inbox.attachments', 'Attachments')}
            className="mt-1.5 flex flex-wrap gap-1.5"
        >
            {attachments.map((attachment) => {
                const isImage =
                    attachment.mime_type.startsWith('image/') &&
                    canPreviewInline(attachment.mime_type);
                return (
                    <li key={attachment.uid}>
                        <a
                            href={
                                canPreviewInline(attachment.mime_type)
                                    ? attachment.file_url
                                    : getInboxAttachmentDownloadUrl(
                                          itemUid,
                                          attachment.uid
                                      )
                            }
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            title={attachment.original_filename}
                            className="flex items-center gap-1.5 max-w-[14rem] rounded-md bg-gray-100 dark:bg-white/[0.06] hover:bg-gray-200/70 dark:hover:bg-white/[0.1] pl-1 pr-2 py-1 text-xs text-gray-600 dark:text-gray-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                        >
                            {isImage ? (
                                <img
                                    src={attachment.file_url}
                                    alt=""
                                    loading="lazy"
                                    className="h-6 w-6 flex-shrink-0 rounded object-cover"
                                />
                            ) : (
                                <FileIcon
                                    mimeType={attachment.mime_type}
                                    className="h-4 w-4 flex-shrink-0 ml-0.5"
                                />
                            )}
                            <span className="truncate">
                                {attachment.original_filename}
                            </span>
                        </a>
                    </li>
                );
            })}
        </ul>
    );
};

export default InboxItemAttachments;
