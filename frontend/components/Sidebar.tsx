import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Area } from '../entities/Area';
import { Note } from '../entities/Note';
import { Tag } from '../entities/Tag';
import { Person } from '../entities/Person';
import SidebarAreas from './Sidebar/SidebarAreas';
import SidebarFooter from './Sidebar/SidebarFooter';
import SidebarNav from './Sidebar/SidebarNav';
import SidebarNotes from './Sidebar/SidebarNotes';
import SidebarHabits from './Sidebar/SidebarHabits';
import SidebarProjects from './Sidebar/SidebarProjects';
import SidebarTags from './Sidebar/SidebarTags';
import SidebarGoals from './Sidebar/SidebarGoals';
import SidebarViews from './Sidebar/SidebarViews';
import SidebarPeople from './Sidebar/SidebarPeople';
import SidebarBoards from './Sidebar/SidebarBoards';
import SidebarInsights from './Sidebar/SidebarInsights';
import SidebarAdmin from './Sidebar/SidebarAdmin';
import SidebarBookmarks from './Sidebar/SidebarBookmarks';
import SidebarResizeHandle from './Sidebar/SidebarResizeHandle';
import { KeyboardShortcutsConfig } from '../utils/keyboardShortcutsService';
import { useStore } from '../store/useStore';
import type { SidebarVisibleSections } from './Profile/types';
import { sidebarPercentToRem } from '../utils/sidebarWidth';
import type { SidebarSectionId } from '../utils/sidebarLayout';

interface SidebarProps {
    isSidebarOpen: boolean;
    setIsSidebarOpen: React.Dispatch<React.SetStateAction<boolean>>;
    currentUser: { email: string; is_admin?: boolean; avatar_image?: string };
    isDarkMode: boolean;
    toggleDarkMode: () => void;
    openTaskModal: () => void;
    openProjectModal: () => void;
    onCreateNote: () => void;
    openAreaModal: (area: Area | null) => void;
    openTagModal: (tag: Tag | null) => void;
    openPersonModal: (person: Person | null) => void;
    openNewHabit: () => void;
    notes: Note[];
    areas: Area[];
    tags: Tag[];
    keyboardShortcuts?: KeyboardShortcutsConfig | null;
}

const Sidebar: React.FC<SidebarProps> = ({
    isSidebarOpen,
    setIsSidebarOpen,
    currentUser,
    isDarkMode,
    toggleDarkMode,
    openTaskModal,
    openProjectModal,
    onCreateNote,
    openAreaModal,
    openTagModal,
    openPersonModal,
    openNewHabit,
    notes,
    areas,
    tags,
    keyboardShortcuts,
}) => {
    const navigate = useNavigate();
    const location = useLocation();
    const habitsEnabled = useStore((state) => state.userSettingsStore.habitsEnabled);
    const visibleSections = useStore(
        (state) => state.userSettingsStore.sidebarVisibleSections
    );
    const widthPercent = useStore(
        (state) => state.userSettingsStore.sidebarWidthPercent
    );

    useEffect(() => {
        document.documentElement.style.setProperty(
            '--sidebar-width',
            `${sidebarPercentToRem(widthPercent)}rem`
        );
    }, [widthPercent]);

    const sectionOrder = useStore(
        (state) => state.userSettingsStore.sidebarSectionOrder
    );
    const isSectionVisible = (key: keyof SidebarVisibleSections) =>
        visibleSections[key] !== false;

    const [isDropdownOpen, setIsDropdownOpen] = useState(false);

    const toggleDropdown = () => {
        setIsDropdownOpen(!isDropdownOpen);
    };

    const handleNavClick = (path: string, title: string) => {
        navigate(path, { state: { title } });
        if (window.innerWidth < 1024) {
            setIsSidebarOpen(false);
        }
    };

    const sectionElements: Record<SidebarSectionId, JSX.Element> = {
        favorites: (
            <SidebarBookmarks
                handleNavClick={handleNavClick}
                location={location}
            />
        ),
        projects: (
            <SidebarProjects
                handleNavClick={handleNavClick}
                location={location}
                isDarkMode={isDarkMode}
                openProjectModal={openProjectModal}
            />
        ),
        areas: (
            <SidebarAreas
                handleNavClick={handleNavClick}
                areas={areas}
                location={location}
                isDarkMode={isDarkMode}
                openAreaModal={openAreaModal}
            />
        ),
        goals: (
            <SidebarGoals handleNavClick={handleNavClick} location={location} />
        ),
        notes: (
            <SidebarNotes
                handleNavClick={handleNavClick}
                onCreateNote={onCreateNote}
                notes={notes}
                location={location}
                isDarkMode={isDarkMode}
            />
        ),
        tags: (
            <SidebarTags
                handleNavClick={handleNavClick}
                location={location}
                isDarkMode={isDarkMode}
                openTagModal={openTagModal}
                tags={tags}
            />
        ),
        people: (
            <SidebarPeople
                handleNavClick={handleNavClick}
                location={location}
                openPersonModal={openPersonModal}
            />
        ),
        habits: (
            <SidebarHabits
                handleNavClick={handleNavClick}
                location={location}
                isDarkMode={isDarkMode}
                openNewHabit={openNewHabit}
            />
        ),
        views: (
            <SidebarViews
                handleNavClick={handleNavClick}
                location={location}
                isDarkMode={isDarkMode}
            />
        ),
        boards: (
            <SidebarBoards
                handleNavClick={handleNavClick}
                location={location}
            />
        ),
        insights: (
            <SidebarInsights
                handleNavClick={handleNavClick}
                location={location}
            />
        ),
    };

    return (
        <div
            className={`fixed top-16 left-0 ${isSidebarOpen ? 'w-full sm:w-sidebar' : 'w-0'} h-[calc(100vh-4rem)] bg-white dark:bg-gray-900 text-gray-900 dark:text-white transition-width duration-300 ease-in-out z-40`}
            style={{
                visibility: isSidebarOpen ? 'visible' : 'hidden',
                overflow: 'hidden',
            }}
        >
            {isSidebarOpen && (
                <div className="flex flex-col h-full">
                    <SidebarResizeHandle />
                    <div className="flex-1 min-h-0 overflow-y-auto px-2.5 py-4">
                        {/* Sidebar Contents */}
                        <div className="mb-[22px]">
                            <SidebarNav
                                handleNavClick={handleNavClick}
                                location={location}
                                isDarkMode={isDarkMode}
                                openTaskModal={openTaskModal}
                            />
                        </div>
                        {sectionOrder.map((id) => {
                            if (!isSectionVisible(id as SidebarSectionId)) {
                                return null;
                            }
                            if (id === 'habits' && !habitsEnabled) return null;
                            return (
                                <div key={id} className="mb-[6px]">
                                    {sectionElements[id as SidebarSectionId]}
                                </div>
                            );
                        })}
                        <div className="mb-[6px]">
                            <SidebarAdmin
                                handleNavClick={handleNavClick}
                                location={location}
                                currentUser={currentUser}
                            />
                        </div>
                    </div>

                    <SidebarFooter
                        currentUser={currentUser}
                        isDarkMode={isDarkMode}
                        toggleDarkMode={toggleDarkMode}
                        isSidebarOpen={isSidebarOpen}
                        setIsSidebarOpen={setIsSidebarOpen}
                        isDropdownOpen={isDropdownOpen}
                        toggleDropdown={toggleDropdown}
                        openTaskModal={openTaskModal}
                        openProjectModal={openProjectModal}
                        onCreateNote={onCreateNote}
                        openAreaModal={openAreaModal}
                        openTagModal={openTagModal}
                        keyboardShortcuts={keyboardShortcuts}
                    />
                </div>
            )}
        </div>
    );
};

export default Sidebar;
