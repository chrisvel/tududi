import React, { useState } from 'react';
import { Location } from 'react-router-dom';
import {
    FolderIcon,
    BookOpenIcon,
    TagIcon,
    ChevronRightIcon,
    XMarkIcon,
} from '@heroicons/react/24/outline';
import PushPinIcon from '../Shared/Icons/PushPinIcon';
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
    const [isExpanded, setIsExpanded] = useState(() => {
        return localStorage.getItem('bookmarksSidebarCollapsed') === 'false';
    });

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
        `group flex justify-between items-center rounded-[8px] px-[10px] py-1 text-[13.5px] cursor-pointer hover:bg-gray-100 dark:hover:bg-[oklch(24%_0.015_250)] ${
            isActive(path)
                ? 'bg-gray-100 dark:bg-[oklch(27%_0.02_250)] text-gray-900 dark:text-[oklch(88%_0.004_95)] font-medium'
                : 'text-gray-500 dark:text-[oklch(82%_0.006_95)]'
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
        <div className="flex flex-col">
            <div
                className="flex justify-between items-center px-2.5 py-1 rounded-md cursor-pointer"
                onClick={() => {
                    const next = !isExpanded;
                    setIsExpanded(next);
                    localStorage.setItem('bookmarksSidebarCollapsed', String(!next));
                }}
            >
                <span className="flex items-center gap-1.5 text-[10.5px] tracking-[0.01em] font-semibold uppercase text-gray-400 dark:text-[oklch(58%_0.006_95)] hover:text-gray-900 dark:hover:text-white">
                    <PushPinIcon className="h-3.5 w-3.5" />
                    {t('sidebar.bookmarks', 'Favorites')}
                </span>
                <button
                    className="text-gray-400 dark:text-gray-500 hover:text-black dark:hover:text-white focus:outline-none"
                    aria-label={isExpanded ? 'Collapse favorites' : 'Expand favorites'}
                >
                    <ChevronRightIcon
                        className="h-3 w-3 transition-transform duration-150"
                        style={{ transform: isExpanded ? 'rotate(90deg)' : 'none' }}
                    />
                </button>
            </div>

            {isExpanded && (
                <div className="max-h-[168px] overflow-y-auto overscroll-y-contain flex flex-col gap-0.5 mb-1.5">
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
                            <span className="flex items-center gap-2 min-w-0">
                                <span
                                    className="w-1.5 h-[14px] rounded-full flex-shrink-0"
                                    style={{ backgroundColor: project.color || '#9ca3af' }}
                                />
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
                            <span className="flex items-center gap-2 min-w-0">
                                <span
                                    className="w-1.5 h-[14px] rounded-full flex-shrink-0"
                                    style={{ backgroundColor: note.color || '#9ca3af' }}
                                />
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
                            <span className="flex items-center gap-2 min-w-0">
                                <span
                                    className="w-1.5 h-[14px] rounded-full flex-shrink-0"
                                    style={{ backgroundColor: tag.color || '#9ca3af' }}
                                />
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
                </div>
            )}
        </div>
    );
};

export default SidebarBookmarks;
