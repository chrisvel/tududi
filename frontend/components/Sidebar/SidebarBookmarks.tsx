import React, { useState } from 'react';
import { Location } from 'react-router-dom';
import {
    BookmarkIcon,
    FolderIcon,
    BookOpenIcon,
    TagIcon,
    ChevronDownIcon,
    ChevronRightIcon,
    XMarkIcon,
} from '@heroicons/react/24/outline';
import { useTranslation } from 'react-i18next';
import { useStore } from '../../store/useStore';
import { updateProject } from '../../utils/projectsService';
import { updateNote } from '../../utils/notesService';
import { updateTag } from '../../utils/tagsService';
import { createNoteUrl, createTagUrl } from '../../utils/slugUtils';
import { Project } from '../../entities/Project';
import { Note } from '../../entities/Note';
import { Tag } from '../../entities/Tag';

interface SidebarBookmarksProps {
    handleNavClick: (path: string, title: string, icon: JSX.Element) => void;
    location: Location;
}

const getProjectPath = (project: Project) => {
    const slug = project.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
    return `/project/${project.uid}-${slug}`;
};

const getNotePath = (note: Note) => {
    try {
        return createNoteUrl(note);
    } catch {
        return '/notes';
    }
};

const getTagPath = (tag: Tag) => {
    try {
        return createTagUrl(tag);
    } catch {
        return '/tags';
    }
};

const SidebarBookmarks: React.FC<SidebarBookmarksProps> = ({
    handleNavClick,
    location,
}) => {
    const { t } = useTranslation();
    const [isExpanded, setIsExpanded] = useState(true);

    const projects = useStore((state) => state.projectsStore.projects);
    const setProjects = useStore((state) => state.projectsStore.setProjects);
    const notes = useStore((state) => state.notesStore.notes);
    const setNotes = useStore((state) => state.notesStore.setNotes);
    const tags = useStore((state) => state.tagsStore.tags);
    const setTags = useStore((state) => state.tagsStore.setTags);

    const pinnedProjects = projects.filter((p) => p.pin_to_sidebar);
    const pinnedNotes = notes.filter((n) => n.pin_to_sidebar);
    const pinnedTags = tags.filter((t) => t.pinned);

    const hasBookmarks =
        pinnedProjects.length > 0 ||
        pinnedNotes.length > 0 ||
        pinnedTags.length > 0;

    if (!hasBookmarks) return null;

    const isActive = (path: string) => location.pathname === path;

    const itemClass = (path: string) =>
        `group flex justify-between items-center rounded-md px-4 py-1.5 text-sm cursor-pointer hover:text-black dark:hover:text-white ${
            isActive(path)
                ? 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white'
                : 'text-gray-700 dark:text-gray-300'
        }`;

    const unpinProject = async (project: Project, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!project.uid) return;
        setProjects(
            projects.map((p) =>
                p.uid === project.uid ? { ...p, pin_to_sidebar: false } : p
            )
        );
        try {
            await updateProject(project.uid, { pin_to_sidebar: false });
        } catch {
            setProjects(
                projects.map((p) =>
                    p.uid === project.uid ? { ...p, pin_to_sidebar: true } : p
                )
            );
        }
    };

    const unpinNote = async (note: Note, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!note.uid) return;
        setNotes(
            notes.map((n) =>
                n.uid === note.uid ? { ...n, pin_to_sidebar: false } : n
            )
        );
        try {
            await updateNote(note.uid, { ...note, pin_to_sidebar: false });
        } catch {
            setNotes(
                notes.map((n) =>
                    n.uid === note.uid ? { ...n, pin_to_sidebar: true } : n
                )
            );
        }
    };

    const unpinTag = async (tag: Tag, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!tag.uid) return;
        setTags(tags.map((t) => (t.uid === tag.uid ? { ...t, pinned: false } : t)));
        try {
            await updateTag(tag.uid, { ...tag, pinned: false });
        } catch {
            setTags(tags.map((t) => (t.uid === tag.uid ? { ...t, pinned: true } : t)));
        }
    };

    return (
        <div className={`flex flex-col space-y-1${isExpanded ? ' pb-3' : ''}`}>
            <div
                className="group flex justify-between items-center px-4 py-2 uppercase rounded-md text-xs tracking-wider cursor-pointer hover:text-black dark:hover:text-white text-gray-700 dark:text-gray-300"
                onClick={() => setIsExpanded((v) => !v)}
            >
                <span className="flex items-center">
                    <BookmarkIcon className="h-5 w-5 mr-2" />
                    {t('sidebar.bookmarks', 'Bookmarks')}
                </span>
                <button
                    className="text-gray-700 dark:text-gray-300 hover:text-black dark:hover:text-white focus:outline-none"
                    aria-label={isExpanded ? 'Collapse bookmarks' : 'Expand bookmarks'}
                >
                    {isExpanded ? (
                        <ChevronDownIcon className="h-4 w-4" />
                    ) : (
                        <ChevronRightIcon className="h-4 w-4" />
                    )}
                </button>
            </div>

            {isExpanded && (
                <>
                    {pinnedProjects.map((project) => (
                        <div
                            key={project.uid}
                            className={itemClass(getProjectPath(project))}
                            onClick={() =>
                                handleNavClick(
                                    getProjectPath(project),
                                    project.name,
                                    <FolderIcon className="h-4 w-4 mr-2" />
                                )
                            }
                        >
                            <span className="flex items-center truncate">
                                <span className="w-5 mr-2 flex items-center justify-center flex-shrink-0">
                                    <FolderIcon
                                        className="h-4 w-4"
                                        style={project.color ? { color: project.color } : undefined}
                                    />
                                </span>
                                <span className="truncate">{project.name}</span>
                            </span>
                            <button
                                onClick={(e) => unpinProject(project, e)}
                                className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 focus:outline-none"
                                aria-label={`Unpin ${project.name}`}
                                title={`Unpin ${project.name}`}
                            >
                                <XMarkIcon className="h-3.5 w-3.5" />
                            </button>
                        </div>
                    ))}

                    {pinnedNotes.map((note) => (
                        <div
                            key={note.uid || note.id}
                            className={itemClass(getNotePath(note))}
                            onClick={() =>
                                handleNavClick(
                                    getNotePath(note),
                                    note.title,
                                    <BookOpenIcon className="h-4 w-4 mr-2" />
                                )
                            }
                        >
                            <span className="flex items-center truncate">
                                <span className="w-5 mr-2 flex items-center justify-center flex-shrink-0">
                                    <BookOpenIcon
                                        className="h-4 w-4"
                                        style={note.color ? { color: note.color } : undefined}
                                    />
                                </span>
                                <span className="truncate">{note.title}</span>
                            </span>
                            <button
                                onClick={(e) => unpinNote(note, e)}
                                className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 focus:outline-none"
                                aria-label={`Unpin ${note.title}`}
                                title={`Unpin ${note.title}`}
                            >
                                <XMarkIcon className="h-3.5 w-3.5" />
                            </button>
                        </div>
                    ))}

                    {pinnedTags.map((tag) => (
                        <div
                            key={tag.uid || tag.id}
                            className={itemClass(getTagPath(tag))}
                            onClick={() =>
                                handleNavClick(
                                    getTagPath(tag),
                                    tag.name,
                                    <TagIcon className="h-4 w-4 mr-2" />
                                )
                            }
                        >
                            <span className="flex items-center truncate">
                                <span className="w-5 mr-2 flex items-center justify-center flex-shrink-0">
                                    <TagIcon
                                        className="h-4 w-4"
                                        style={tag.color ? { color: tag.color } : undefined}
                                    />
                                </span>
                                <span className="truncate">{tag.name}</span>
                            </span>
                            <button
                                onClick={(e) => unpinTag(tag, e)}
                                className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 focus:outline-none"
                                aria-label={`Unpin ${tag.name}`}
                                title={`Unpin ${tag.name}`}
                            >
                                <XMarkIcon className="h-3.5 w-3.5" />
                            </button>
                        </div>
                    ))}
                </>
            )}
        </div>
    );
};

export default SidebarBookmarks;
