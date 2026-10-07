import React from 'react';
import { useTranslation } from 'react-i18next';
import MarkdownRenderer, { PublicNoteLink } from '../Shared/MarkdownRenderer';
import PhotoCredit from '../Shared/PhotoCredit';
import {
    CONTENT_BACKGROUND_OVERLAY,
    contentBackgroundUrl,
    findContentBackground,
} from '../../constants/contentBackgrounds';

interface PublicNoteArticleProps {
    title: string;
    content: string;
    color?: string | null;
    updatedAt?: string | null;
    linkedNotes: PublicNoteLink[];
    // Where a linked note opens; its public link page by default.
    linkHref?: (link: PublicNoteLink) => string;
}

// A publicly readable note: title, last change and content, in the note's
// own color when it has one. Shared by the public link page and the blog.
const PublicNoteArticle: React.FC<PublicNoteArticleProps> = ({
    title,
    content,
    color,
    updatedAt,
    linkedNotes,
    linkHref,
}) => {
    const { t, i18n } = useTranslation();

    const updated =
        updatedAt &&
        new Date(updatedAt).toLocaleDateString(i18n.language, {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
        });
    const noteColor =
        color && /^#[0-9a-f]{6}$/i.test(color) ? color : undefined;
    // Light text on dark note colors, as in the notes editor.
    const lightText =
        !!noteColor &&
        (0.299 * parseInt(noteColor.slice(1, 3), 16) +
            0.587 * parseInt(noteColor.slice(3, 5), 16) +
            0.114 * parseInt(noteColor.slice(5, 7), 16)) /
            255 <
            0.4;

    return (
        <article
            data-testid="public-note"
            className={`shadow-md rounded-lg px-6 md:px-8 py-6 break-words backdrop-blur-sm ${noteColor ? '' : 'bg-white/90 dark:bg-gray-800/90'}`}
            style={
                noteColor
                    ? {
                          backgroundColor: `${noteColor}e6`,
                          color: lightText ? '#ffffff' : '#333333',
                      }
                    : undefined
            }
        >
            <header className="mb-6">
                <h1
                    className={`text-[2rem] leading-[2rem] font-medium break-words ${noteColor ? '' : 'text-gray-900 dark:text-gray-100'}`}
                >
                    {title || t('notes.untitled', 'Untitled Note')}
                </h1>
                {updated && (
                    <p
                        className={`mt-1 text-sm ${noteColor ? 'opacity-70' : 'text-gray-500 dark:text-gray-400'}`}
                    >
                        {t('publicNote.updated', 'Last updated {{date}}', {
                            date: updated,
                        })}
                    </p>
                )}
            </header>
            <MarkdownRenderer
                content={content}
                noteColor={noteColor}
                publicNoteLinks={linkedNotes}
                publicNoteHref={linkHref}
            />
        </article>
    );
};

// The note's background photo behind the whole page, when it has one. Pages
// with a footer pass showCredit={false} and place the credit themselves, so
// the pinned credit does not sit on top of the footer.
export const PublicNoteBackground: React.FC<{
    background?: string | null;
    showCredit?: boolean;
}> = ({ background, showCredit = true }) => {
    const photo = findContentBackground(background);
    if (!photo) return null;
    return (
        <>
            <div
                aria-hidden="true"
                className="fixed inset-0 bg-cover bg-center"
                style={{
                    backgroundImage: `url(${contentBackgroundUrl(photo)})`,
                }}
                data-testid="public-note-background"
            />
            <div
                aria-hidden="true"
                className={`fixed inset-0 ${CONTENT_BACKGROUND_OVERLAY}`}
            />
            {showCredit && (
                <PhotoCredit
                    background={photo}
                    className="fixed bottom-3 left-3 z-10"
                />
            )}
        </>
    );
};

export default PublicNoteArticle;
