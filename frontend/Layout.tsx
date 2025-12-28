import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useToast } from './components/Shared/ToastContext';
import { SidebarProvider } from './contexts/SidebarContext';
import Navbar from './components/Navbar';
import Sidebar from './components/Sidebar';
import './styles/tailwind.css';
import ProjectModal from './components/Project/ProjectModal';
import NoteModal from './components/Note/NoteModal';
import AreaModal from './components/Area/AreaModal';
import TagModal from './components/Tag/TagModal';
import { Note } from './entities/Note';
import { Area } from './entities/Area';
import { Tag } from './entities/Tag';
import { Project } from './entities/Project';
import { User } from './entities/User';
import { useStore } from './store/useStore';
import { createNote, updateNote } from './utils/notesService';
import { createArea, updateArea } from './utils/areasService';
import { createTag, updateTag } from './utils/tagsService';
import {
    fetchProjects,
    createProject,
    updateProject,
} from './utils/projectsService';
import { isAuthError } from './utils/authUtils';
import { useLocation, useNavigate } from 'react-router-dom';
import { getApiPath } from './config/paths';
import { KeyboardShortcutsConfig } from './utils/keyboardShortcutsService';

interface LayoutProps {
    currentUser: User;
    isDarkMode: boolean;
    setCurrentUser: React.Dispatch<React.SetStateAction<User | null>>;
    toggleDarkMode: () => void;
    children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({
    currentUser,
    setCurrentUser,
    isDarkMode,
    toggleDarkMode,
    children,
}) => {
    const { t } = useTranslation();
    const { showSuccessToast, showErrorToast } = useToast();
    const navigate = useNavigate();
    const location = useLocation();
    const isUpcomingView = location.pathname === '/upcoming';
    const [isSidebarOpen, setIsSidebarOpen] = useState(
        window.innerWidth >= 1024
    );
    const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);
    const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
    const [isNoteModalOpen, setIsNoteModalOpen] = useState(false);
    const [isAreaModalOpen, setIsAreaModalOpen] = useState(false);
    const [isTagModalOpen, setIsTagModalOpen] = useState(false);

    const [selectedNote, setSelectedNote] = useState<Note | null>(null);
    const [selectedArea, setSelectedArea] = useState<Area | null>(null);
    const [selectedTag, setSelectedTag] = useState<Tag | null>(null);
    const [keyboardShortcuts, setKeyboardShortcuts] = useState<KeyboardShortcutsConfig | null>(null);

    // Fetch keyboard shortcuts from profile
    useEffect(() => {
        const fetchKeyboardShortcuts = async () => {
            try {
                const response = await fetch(getApiPath('profile'));
                if (response.ok) {
                    const data = await response.json();
                    if (data.keyboard_shortcuts) {
                        setKeyboardShortcuts(data.keyboard_shortcuts);
                    }
                }
            } catch (error) {
                console.error('Error fetching keyboard shortcuts:', error);
            }
        };
        fetchKeyboardShortcuts();
    }, []);

    const {
        notesStore: { notes, isLoading: isNotesLoading, isError: isNotesError },
        areasStore: { areas, isLoading: isAreasLoading, isError: isAreasError },
        tasksStore: {
            isLoading: isTasksLoading,
            isError: isTasksError,
            createTask: createTaskInStore,
        },
        projectsStore: {
            projects,
            setProjects,
            isLoading: isProjectsLoading,
            isError: isProjectsError,
        },
        tagsStore: { tags, isLoading: isTagsLoading, isError: isTagsError },
    } = useStore();

    const createAndOpenTaskDetails = async () => {
        try {
            const newTask = await createTaskInStore({
                name: t('task.newTaskPlaceholder', 'New Task'),
                status: 'not_started',
                completed_at: null,
            });

            if (newTask?.uid) {
                navigate(`/task/${newTask.uid}`);
            } else {
                throw new Error('New task missing UID');
            }
        } catch (error) {
            console.error('Error creating task from Layout:', error);
            showErrorToast(t('task.createError', 'Failed to create task.'));
        }
    };

    const openTaskModal = () => {
        void createAndOpenTaskDetails();
    };

    useEffect(() => {
        const handleResize = () => {
            setIsSidebarOpen(window.innerWidth >= 1024);
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    useEffect(() => {
        // Listen for mobile search toggle events from Navbar
        const handleMobileSearchToggle = (event: CustomEvent) => {
            setIsMobileSearchOpen(event.detail.isOpen);
        };

        window.addEventListener(
            'mobileSearchToggle',
            handleMobileSearchToggle as EventListener
        );
        return () =>
            window.removeEventListener(
                'mobileSearchToggle',
                handleMobileSearchToggle as EventListener
            );
    }, []);

    useEffect(() => {
        // Load projects into global store if not already loaded
        const loadProjects = async () => {
            if (projects.length === 0 && !isProjectsLoading) {
                try {
                    const projectsData = await fetchProjects();
                    setProjects(projectsData);
                } catch (error) {
                    console.error('Failed to load projects in Layout:', error);
                }
            }
        };

        loadProjects();
    }, [projects.length, isProjectsLoading, setProjects]);

    const openNoteModal = (note: Note | null = null) => {
        setSelectedNote(note);
        setIsNoteModalOpen(true);
    };

    const closeNoteModal = () => {
        setIsNoteModalOpen(false);
        setSelectedNote(null);
    };

    const openProjectModal = () => {
        setIsProjectModalOpen(true);
    };

    const closeProjectModal = () => {
        setIsProjectModalOpen(false);
    };

    const openNewHabit = () => {
        navigate('/habit/new');
    };

    const openAreaModal = (area: Area | null = null) => {
        setSelectedArea(area);
        setIsAreaModalOpen(true);
    };

    const closeAreaModal = () => {
        setIsAreaModalOpen(false);
        setSelectedArea(null);
    };

    const openTagModal = (tag: Tag | null = null) => {
        setSelectedTag(tag);
        setIsTagModalOpen(true);
    };

    const closeTagModal = () => {
        setIsTagModalOpen(false);
        setSelectedTag(null);
    };

    const handleSaveNote = async (noteData: Note) => {
        try {
            let result: Note;
            if (noteData.uid) {
                result = await updateNote(noteData.uid, noteData);
                // Update existing note in global store
                const currentNotes = useStore.getState().notesStore.notes;
                useStore
                    .getState()
                    .notesStore.setNotes(
                        currentNotes.map((note) =>
                            note.uid === result.uid ? result : note
                        )
                    );
            } else {
                result = await createNote(noteData);
                // Add new note to global store
                const currentNotes = useStore.getState().notesStore.notes;
                useStore
                    .getState()
                    .notesStore.setNotes([result, ...currentNotes]);
            }
            closeNoteModal();
        } catch (error: any) {
            console.error('Error saving note:', error);
            // Don't close modal if there's an auth error (user will be redirected)
            if (isAuthError(error)) {
                return;
            }
            closeNoteModal();
        }
    };

    const handleCreateProject = async (name: string): Promise<Project> => {
        try {
            const newProject = await createProject({
                name,
                status: 'planned',
            });
            return newProject;
        } catch (error) {
            console.error('Error creating project:', error);
            throw error;
        }
    };

    const handleSaveProject = async (projectData: Project) => {
        try {
            if (projectData.uid) {
                await updateProject(projectData.uid, projectData);
            } else {
                await createProject(projectData);
            }
            const projectsData = await fetchProjects();
            setProjects(projectsData);
            closeProjectModal();
        } catch (error: any) {
            console.error('Error saving project:', error);
            // Don't close modal if there's an auth error (user will be redirected)
            if (isAuthError(error)) {
                return;
            }
            closeProjectModal();
        }
    };

    const handleSaveArea = async (areaData: Partial<Area>) => {
        try {
            let result: Area;
            if (areaData.uid) {
                result = await updateArea(areaData.uid, areaData);
                // Update existing area in global store
                const currentAreas = useStore.getState().areasStore.areas;
                useStore
                    .getState()
                    .areasStore.setAreas(
                        currentAreas.map((area) =>
                            area.uid === result.uid ? result : area
                        )
                    );
            } else {
                result = await createArea(areaData);
                // Add new area to global store
                const currentAreas = useStore.getState().areasStore.areas;
                useStore
                    .getState()
                    .areasStore.setAreas([...currentAreas, result]);
            }
            closeAreaModal();
        } catch (error: any) {
            console.error('Error saving area:', error);
            // Don't close modal if there's an auth error (user will be redirected)
            if (isAuthError(error)) {
                return;
            }
            closeAreaModal();
        }
    };

    const handleSaveTag = async (tagData: Tag) => {
        try {
            let result: Tag;
            if (tagData.uid) {
                result = await updateTag(tagData.uid, tagData);
                // Update existing tag in global store
                const currentTags = useStore.getState().tagsStore.tags;
                useStore
                    .getState()
                    .tagsStore.setTags(
                        currentTags.map((tag) =>
                            tag.uid === result.uid ? result : tag
                        )
                    );
            } else {
                result = await createTag(tagData);
                // Add new tag to global store
                const currentTags = useStore.getState().tagsStore.tags;
                useStore.getState().tagsStore.setTags([...currentTags, result]);
            }
            closeTagModal();
        } catch (error: any) {
            console.error('Error saving tag:', error);
            // Don't close modal if there's an auth error (user will be redirected)
            if (isAuthError(error)) {
                return;
            }
            // Re-throw error so TagModal can handle it
            throw error;
        }
    };

    const mainContentMarginLeft = isSidebarOpen ? 'ml-72' : 'ml-0';

    const isLoading =
        isNotesLoading ||
        isAreasLoading ||
        isTasksLoading ||
        isProjectsLoading ||
        isTagsLoading;
    const isError =
        isNotesError ||
        isAreasError ||
        isTasksError ||
        isProjectsError ||
        isTagsError;

    if (isLoading) {
        return (
            <div className={`min-h-screen ${isDarkMode ? 'dark' : ''}`}>
                <Navbar
                    isDarkMode={isDarkMode}
                    toggleDarkMode={toggleDarkMode}
                    currentUser={currentUser}
                    setCurrentUser={setCurrentUser}
                    isSidebarOpen={isSidebarOpen}
                    setIsSidebarOpen={setIsSidebarOpen}
                />
                <Sidebar
                    isSidebarOpen={isSidebarOpen}
                    setIsSidebarOpen={setIsSidebarOpen}
                    currentUser={currentUser}
                    isDarkMode={isDarkMode}
                    toggleDarkMode={toggleDarkMode}
                    openTaskModal={openTaskModal}
                    openProjectModal={openProjectModal}
                    openNoteModal={openNoteModal}
                    openAreaModal={openAreaModal}
                    openTagModal={openTagModal}
                    openNewHabit={openNewHabit}
                    notes={notes}
                    areas={areas}
                    tags={tags}
                    keyboardShortcuts={keyboardShortcuts}
                />
                <div
                    className={`flex-1 flex items-center justify-center bg-gray-100 dark:bg-gray-800 transition-all duration-300 ease-in-out ${mainContentMarginLeft}`}
                >
                    <div className="text-xl text-gray-700 dark:text-gray-200">
                        {t('common.loading')}
                    </div>
                </div>
            </div>
        );
    }

    if (isError) {
        return (
            <div className={`min-h-screen ${isDarkMode ? 'dark' : ''}`}>
                <Navbar
                    isDarkMode={isDarkMode}
                    toggleDarkMode={toggleDarkMode}
                    currentUser={currentUser}
                    setCurrentUser={setCurrentUser}
                    isSidebarOpen={isSidebarOpen}
                    setIsSidebarOpen={setIsSidebarOpen}
                />
                <Sidebar
                    isSidebarOpen={isSidebarOpen}
                    setIsSidebarOpen={setIsSidebarOpen}
                    currentUser={currentUser}
                    isDarkMode={isDarkMode}
                    toggleDarkMode={toggleDarkMode}
                    openTaskModal={openTaskModal}
                    openProjectModal={openProjectModal}
                    openNoteModal={openNoteModal}
                    openAreaModal={openAreaModal}
                    openTagModal={openTagModal}
                    openNewHabit={openNewHabit}
                    notes={notes}
                    areas={areas}
                    tags={tags}
                    keyboardShortcuts={keyboardShortcuts}
                />
                <div
                    className={`flex-1 flex flex-col items-center justify-center bg-gray-100 dark:bg-gray-800 transition-all duration-300 ease-in-out ${mainContentMarginLeft}`}
                >
                    <div className="text-xl text-red-500">
                        {t('errors.somethingWentWrong')}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <SidebarProvider isSidebarOpen={isSidebarOpen}>
            <div className={`min-h-screen ${isDarkMode ? 'dark' : ''}`}>
                <Navbar
                    isDarkMode={isDarkMode}
                    toggleDarkMode={toggleDarkMode}
                    currentUser={currentUser}
                    setCurrentUser={setCurrentUser}
                    isSidebarOpen={isSidebarOpen}
                    setIsSidebarOpen={setIsSidebarOpen}
                />
                <Sidebar
                    isSidebarOpen={isSidebarOpen}
                    setIsSidebarOpen={setIsSidebarOpen}
                    currentUser={currentUser}
                    isDarkMode={isDarkMode}
                    toggleDarkMode={toggleDarkMode}
                    openTaskModal={openTaskModal}
                    openProjectModal={openProjectModal}
                    openNoteModal={openNoteModal}
                    openAreaModal={openAreaModal}
                    openTagModal={openTagModal}
                    openNewHabit={openNewHabit}
                    notes={notes}
                    areas={areas}
                    tags={tags}
                    keyboardShortcuts={keyboardShortcuts}
                />

                <div
                    className={`transition-all duration-300 ease-in-out ${mainContentMarginLeft} h-screen flex flex-col`}
                >
                    <div className="flex flex-col bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 flex-1 overflow-hidden">
                        <div
                            className={`flex-1 flex flex-col py-0 px-0 transition-all duration-300 ${
                                isMobileSearchOpen ? 'pt-32' : 'pt-20'
                            } md:pt-20 ${isUpcomingView ? '' : 'md:px-4'} overflow-hidden`}
                        >
                            <div className="w-full h-full overflow-auto">
                                {children}
                            </div>
                        </div>
                    </div>
                </div>

                {isProjectModalOpen && (
                    <ProjectModal
                        isOpen={isProjectModalOpen}
                        onClose={closeProjectModal}
                        onSave={handleSaveProject}
                        onDelete={async (projectUid) => {
                            try {
                                const { deleteProject } = await import(
                                    './utils/projectsService'
                                );
                                await deleteProject(projectUid);

                                // Update global projects store
                                const currentProjects =
                                    useStore.getState().projectsStore.projects;
                                useStore
                                    .getState()
                                    .projectsStore.setProjects(
                                        currentProjects.filter(
                                            (p) => p.uid !== projectUid
                                        )
                                    );

                                closeProjectModal();
                            } catch (error) {
                                console.error('Error deleting project:', error);
                            }
                        }}
                        areas={areas}
                    />
                )}

                {isNoteModalOpen && (
                    <NoteModal
                        isOpen={isNoteModalOpen}
                        onClose={closeNoteModal}
                        onSave={handleSaveNote}
                        onDelete={async (noteId) => {
                            try {
                                const { deleteNoteWithStoreUpdate } =
                                    await import('./utils/noteDeleteUtils');
                                await deleteNoteWithStoreUpdate(
                                    noteId,
                                    showSuccessToast,
                                    t
                                );
                                closeNoteModal();
                            } catch (error) {
                                console.error('Error deleting note:', error);
                            }
                        }}
                        note={selectedNote}
                        projects={projects}
                        onCreateProject={handleCreateProject}
                    />
                )}

                {isAreaModalOpen && (
                    <AreaModal
                        isOpen={isAreaModalOpen}
                        onClose={closeAreaModal}
                        onSave={handleSaveArea}
                        area={selectedArea}
                    />
                )}

                {isTagModalOpen && (
                    <TagModal
                        isOpen={isTagModalOpen}
                        onClose={closeTagModal}
                        onSave={handleSaveTag}
                        tag={selectedTag}
                    />
                )}
            </div>
        </SidebarProvider>
    );
};

export default Layout;
