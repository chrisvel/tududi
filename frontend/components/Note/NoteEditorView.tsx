import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    PencilIcon,
    TrashIcon,
    FolderIcon,
    TagIcon as TagIconOutline,
    ClockIcon,
    EllipsisVerticalIcon,
    XMarkIcon,
    ArrowsPointingOutIcon,
    GlobeAltIcon,
} from '@heroicons/react/24/outline';
import PushPinIcon from '../Shared/Icons/PushPinIcon';
import TagInput from '../Tag/TagInput';
import { Note } from '../../entities/Note';
import { useStore } from '../../store/useStore';
import { COLORS } from '../Shared/ColorPicker';
import NoteBackgroundPicker from './NoteBackgroundPicker';
import MarkdownEditor from './MarkdownEditor';
import { FORM } from '../../constants/formClasses';

export const shouldUseLightText = (hexColor: string | undefined): boolean => {
    if (!hexColor) return false;
    const hex = hexColor.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance < 0.5;
};

interface NoteEditorViewProps {
    note: Note;
    saveStatus: 'saved' | 'saving' | 'unsaved';
    onChange: (updates: Partial<Note>) => void;
    onLookChange: (changes: Pick<Note, 'color' | 'background'>) => void;
    onSaveNow: () => void;
    onTogglePin: () => void;
    onDelete: () => void;
    onShare: () => void;
    onOpenFocusMode: () => void;
    // Extra buttons after the note options, e.g. close in a side panel
    headerActions?: React.ReactNode;
}

// The open note as the Notes page shows it: title, date, project and tags,
// note options and the editor. Shared by the Notes page and the note side
// panel on project pages.
const NoteEditorView: React.FC<NoteEditorViewProps> = ({
    note,
    saveStatus,
    onChange,
    onLookChange,
    onSaveNow,
    onTogglePin,
    onDelete,
    onShare,
    onOpenFocusMode,
    headerActions,
}) => {
    const { t } = useTranslation();
    const projects = useStore((state) => state.projectsStore.projects);
    const [showProjectPicker, setShowProjectPicker] = useState(false);
    const [showTagsInput, setShowTagsInput] = useState(false);
    const [showOptions, setShowOptions] = useState(false);
    const optionsRef = useRef<HTMLDivElement>(null);
    const noteColor = note.color;

    // Pickers belong to one note; switching notes closes them.
    useEffect(() => {
        setShowProjectPicker(false);
        setShowTagsInput(false);
        setShowOptions(false);
    }, [note.uid]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (
                optionsRef.current &&
                !optionsRef.current.contains(event.target as Node)
            ) {
                setShowOptions(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () =>
            document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const toggleProjectPicker = (e: React.MouseEvent<HTMLButtonElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setShowProjectPicker((prev) => !prev);
        setShowTagsInput(false);
    };

    const toggleTagsInput = (e: React.MouseEvent<HTMLButtonElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setShowTagsInput((prev) => !prev);
        setShowProjectPicker(false);
    };

    return (
        <div className="flex-1 flex flex-col overflow-hidden">
            <div className="flex items-start justify-between mb-3 flex-shrink-0 px-6 md:px-8 pt-5">
                <div className="flex-1">
                    <input
                        type="text"
                        value={note.title || ''}
                        onChange={(e) =>
                            onChange({
                                title: e.target.value,
                            })
                        }
                        onClick={(e) => e.stopPropagation()}
                        placeholder={t('notes.titlePlaceholder')}
                        className="w-full bg-transparent text-gray-900 dark:text-gray-100 border-none focus:outline-none focus:ring-0 pt-5 mb-4 block"
                        style={{
                            color: noteColor
                                ? shouldUseLightText(noteColor)
                                    ? '#ffffff'
                                    : '#333333'
                                : undefined,
                            fontSize: '2rem',
                            lineHeight: '2rem',
                            fontWeight: 500,
                            paddingLeft: 0,
                            paddingRight: 0,
                        }}
                        autoFocus={!note.uid}
                    />
                    <div
                        className="flex flex-col text-xs text-gray-500 dark:text-gray-400 space-y-1 mb-2"
                        style={{
                            color: noteColor
                                ? shouldUseLightText(noteColor)
                                    ? '#e0e0e0'
                                    : '#333333'
                                : undefined,
                        }}
                    >
                        <div className="flex flex-wrap items-center gap-3">
                            <div className="flex items-center">
                                <ClockIcon className="h-3 w-3 mr-1" />
                                <span>
                                    {note.updated_at
                                        ? new Date(
                                              note.updated_at
                                          ).toLocaleDateString()
                                        : 'New'}
                                </span>
                            </div>
                            <button
                                type="button"
                                onClick={toggleProjectPicker}
                                className="flex items-center hover:underline text-left"
                                title={
                                    note.project
                                        ? 'Change project'
                                        : 'Add project'
                                }
                            >
                                <FolderIcon className="h-3 w-3 mr-1" />
                                {note.project
                                    ? note.project.name
                                    : 'Add project'}
                            </button>
                            <button
                                type="button"
                                onClick={toggleTagsInput}
                                className="flex items-center hover:underline text-left"
                                title={
                                    note.tags && note.tags.length > 0
                                        ? 'Change tags'
                                        : 'Add tags'
                                }
                            >
                                <TagIconOutline className="h-3 w-3 mr-1" />
                                <span>
                                    {note.tags && note.tags.length > 0
                                        ? note.tags.map((tag, idx) => (
                                              <React.Fragment key={idx}>
                                                  {idx > 0 && ', '}
                                                  {tag.name}
                                              </React.Fragment>
                                          ))
                                        : 'Add tags'}
                                </span>
                            </button>
                        </div>
                        {note.title && (
                            <div className="flex items-center">
                                {saveStatus === 'saving' && (
                                    <span className="text-blue-500 dark:text-blue-400 italic">
                                        Saving...
                                    </span>
                                )}
                                {saveStatus === 'saved' && (
                                    <span className="text-green-600 dark:text-green-400">
                                        ✓ Saved
                                    </span>
                                )}
                                {saveStatus === 'unsaved' && (
                                    <span className="text-amber-600 dark:text-amber-400">
                                        • Unsaved changes
                                    </span>
                                )}
                            </div>
                        )}
                    </div>
                </div>
                <div className="flex items-center">
                    <button
                        onClick={onOpenFocusMode}
                        className="p-2 text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                        style={{
                            color: noteColor
                                ? shouldUseLightText(noteColor)
                                    ? '#e0e0e0'
                                    : '#333333'
                                : undefined,
                        }}
                        aria-label={t('notes.focusMode')}
                        title={t('notes.focusMode')}
                    >
                        <ArrowsPointingOutIcon className="h-5 w-5" />
                    </button>
                    {note.uid && (
                        <button
                            onClick={() => onShare()}
                            className={`p-2 transition ${
                                note.is_public
                                    ? 'text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300'
                                    : 'text-gray-400 dark:text-gray-500 opacity-60 hover:opacity-100'
                            }`}
                            style={{
                                color:
                                    noteColor && !note.is_public
                                        ? shouldUseLightText(noteColor)
                                            ? '#e0e0e0'
                                            : '#333333'
                                        : undefined,
                            }}
                            aria-label={t(
                                'notes.publicShare.open',
                                'Share note'
                            )}
                            title={
                                note.is_public
                                    ? t(
                                          'notes.publicShare.sharedTitle',
                                          'Shared with anyone who has the link'
                                      )
                                    : t('notes.publicShare.open', 'Share note')
                            }
                            data-testid="note-share-button"
                        >
                            <GlobeAltIcon className="h-5 w-5" />
                        </button>
                    )}
                    <div className="relative" ref={optionsRef}>
                        <button
                            onClick={() => setShowOptions(!showOptions)}
                            className="p-2 text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                            style={{
                                color: noteColor
                                    ? shouldUseLightText(noteColor)
                                        ? '#e0e0e0'
                                        : '#333333'
                                    : undefined,
                            }}
                            aria-label={t('notes.noteOptions')}
                        >
                            <EllipsisVerticalIcon className="h-5 w-5" />
                        </button>
                        {showOptions && (
                            <div className="absolute right-0 mt-1 w-56 bg-white dark:bg-gray-800 rounded-md shadow-lg border border-gray-200 dark:border-gray-700 z-50">
                                <div className="px-3 py-3 border-b border-gray-200 dark:border-gray-700">
                                    <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2">
                                        Background Color
                                    </div>
                                    <div className="grid grid-cols-5 gap-2">
                                        {COLORS.map((colorOption) => (
                                            <button
                                                key={colorOption.value}
                                                onClick={() =>
                                                    onLookChange({
                                                        color: colorOption.value,
                                                    })
                                                }
                                                className={`w-8 h-8 rounded-md border-2 transition-all hover:scale-110 flex items-center justify-center ${
                                                    note.color ===
                                                    colorOption.value
                                                        ? 'border-blue-500 dark:border-blue-400 ring-2 ring-blue-200 dark:ring-blue-800'
                                                        : 'border-gray-300 dark:border-gray-600'
                                                }`}
                                                style={{
                                                    backgroundColor:
                                                        colorOption.value ||
                                                        '#ffffff',
                                                }}
                                                title={colorOption.name}
                                                aria-label={`Set background to ${colorOption.name}`}
                                            >
                                                {!colorOption.value && (
                                                    <XMarkIcon className="h-5 w-5 text-gray-400" />
                                                )}
                                            </button>
                                        ))}
                                    </div>
                                    <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 mt-3 mb-2">
                                        {t(
                                            'notes.backgroundImage',
                                            'Background'
                                        )}
                                    </div>
                                    <NoteBackgroundPicker
                                        value={note.background}
                                        onChange={(bg) =>
                                            onLookChange({ background: bg })
                                        }
                                    />
                                </div>
                                <div className="py-1">
                                    <button
                                        onClick={() => {
                                            onSaveNow();
                                            setShowOptions(false);
                                        }}
                                        className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                                    >
                                        <PencilIcon className="h-4 w-4" />
                                        {t('notes.save', 'Save')}
                                    </button>
                                    {note.uid && (
                                        <button
                                            onClick={() => {
                                                onTogglePin();
                                                setShowOptions(false);
                                            }}
                                            className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                                        >
                                            <PushPinIcon className="h-4 w-4" />
                                            {note.pin_to_sidebar
                                                ? t(
                                                      'notes.unpinFromSidebar',
                                                      'Unpin from sidebar'
                                                  )
                                                : t(
                                                      'notes.pinToSidebar',
                                                      'Pin to sidebar'
                                                  )}
                                        </button>
                                    )}
                                    {note.uid && (
                                        <button
                                            onClick={() => {
                                                onDelete();
                                                setShowOptions(false);
                                            }}
                                            className="w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                                        >
                                            <TrashIcon className="h-4 w-4" />
                                            {t('notes.delete', 'Delete')}
                                        </button>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                    {headerActions}
                </div>
            </div>

            {showProjectPicker && (
                <div className="mb-3 mx-4 p-3 bg-gray-50 dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700 flex-shrink-0">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Select Project
                    </label>
                    <select
                        value={note.project_uid || ''}
                        onChange={(e) => {
                            const projectUid = e.target.value || null;
                            const selectedProject = projectUid
                                ? projects.find((p) => p.uid === projectUid)
                                : undefined;
                            onChange({
                                project_uid: projectUid,
                                project: selectedProject as any,
                            });
                            setShowProjectPicker(false);
                        }}
                        className={`${FORM.select} w-full`}
                    >
                        <option value="">No Project</option>
                        {projects.map((project) => (
                            <option key={project.uid} value={project.uid}>
                                {project.name}
                            </option>
                        ))}
                    </select>
                </div>
            )}

            {showTagsInput && (
                <div className="mb-3 mx-4 p-3 bg-gray-50 dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700 flex-shrink-0">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Tags
                    </label>
                    <TagInput
                        initialTags={(note.tags || note.Tags || []).map(
                            (t: any) => t.name
                        )}
                        onTagsChange={(tagNames: string[]) => {
                            onChange({
                                tags: tagNames.map((name: string) => ({
                                    name,
                                })),
                            });
                        }}
                        availableTags={useStore.getState().tagsStore.getTags()}
                    />
                </div>
            )}

            {/* The editor keeps a 24px gutter for the block
                handle, so its text lines up with the title. */}
            <div className="flex-1 overflow-y-auto pl-0 pr-6 md:pl-2 md:pr-8 py-4">
                <MarkdownEditor
                    noteUid={note.uid}
                    value={note.content || ''}
                    onChange={(val) => onChange({ content: val })}
                    onClick={(e) => e.stopPropagation()}
                    placeholder={t('notes.contentPlaceholder')}
                    noteColor={noteColor}
                    minHeight="300px"
                />
            </div>
        </div>
    );
};

export default NoteEditorView;
