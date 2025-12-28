import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Area } from '../entities/Area';
import { Note } from '../entities/Note';
import { Tag } from '../entities/Tag';
import SidebarAreas from './Sidebar/SidebarAreas';
import SidebarFooter from './Sidebar/SidebarFooter';
import SidebarNav from './Sidebar/SidebarNav';
import SidebarNotes from './Sidebar/SidebarNotes';
import SidebarHabits from './Sidebar/SidebarHabits';
import SidebarProjects from './Sidebar/SidebarProjects';
import SidebarTags from './Sidebar/SidebarTags';
import SidebarViews from './Sidebar/SidebarViews';
import { getFeatureFlags, FeatureFlags } from '../utils/featureFlags';
import { KeyboardShortcutsConfig } from '../utils/keyboardShortcutsService';

interface SidebarProps {
    isSidebarOpen: boolean;
    setIsSidebarOpen: React.Dispatch<React.SetStateAction<boolean>>;
    currentUser: { email: string };
    isDarkMode: boolean;
    toggleDarkMode: () => void;
    openTaskModal: () => void;
    openProjectModal: () => void;
    openNoteModal: (note: Note | null) => void;
    openAreaModal: (area: Area | null) => void;
    openTagModal: (tag: Tag | null) => void;
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
    openNoteModal,
    openAreaModal,
    openTagModal,
    openNewHabit,
    notes,
    areas,
    tags,
    keyboardShortcuts,
}) => {
    const navigate = useNavigate();
    const location = useLocation();

    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [featureFlags, setFeatureFlags] = useState<FeatureFlags>({
        backups: false,
        calendar: false,
        habits: false,
    });

    const toggleDropdown = () => {
        setIsDropdownOpen(!isDropdownOpen);
    };

    const handleNavClick = (path: string, title: string) => {
        navigate(path, { state: { title } });
        if (window.innerWidth < 1024) {
            setIsSidebarOpen(false);
        }
    };

    useEffect(() => {
        const fetchFlags = async () => {
            const flags = await getFeatureFlags();
            setFeatureFlags(flags);
        };

        fetchFlags();
    }, []);

    return (
        <div
            className={`fixed top-16 left-0 ${isSidebarOpen ? 'w-full sm:w-72' : 'w-0'} h-[calc(100vh-4rem)] bg-white dark:bg-gray-900 text-gray-900 dark:text-white transition-width duration-300 ease-in-out z-40`}
            style={{
                visibility: isSidebarOpen ? 'visible' : 'hidden',
                overflow: 'hidden',
            }}
        >
            {isSidebarOpen && (
                <div className="flex flex-col h-full overflow-y-auto">
                    <div className="px-3 pb-3 pt-8">
                        {/* Sidebar Contents */}
                        <SidebarNav
                            handleNavClick={handleNavClick}
                            location={location}
                            isDarkMode={isDarkMode}
                            openTaskModal={openTaskModal}
                        />
                        <SidebarProjects
                            handleNavClick={handleNavClick}
                            location={location}
                            isDarkMode={isDarkMode}
                            openProjectModal={openProjectModal}
                        />
                        <SidebarNotes
                            handleNavClick={handleNavClick}
                            openNoteModal={openNoteModal}
                            notes={notes}
                            location={location}
                            isDarkMode={isDarkMode}
                        />
                        {featureFlags.habits && (
                            <SidebarHabits
                                handleNavClick={handleNavClick}
                                location={location}
                                isDarkMode={isDarkMode}
                                openNewHabit={openNewHabit}
                            />
                        )}
                        <SidebarAreas
                            handleNavClick={handleNavClick}
                            areas={areas}
                            location={location}
                            isDarkMode={isDarkMode}
                            openAreaModal={openAreaModal}
                        />
                        <SidebarTags
                            handleNavClick={handleNavClick}
                            location={location}
                            isDarkMode={isDarkMode}
                            openTagModal={openTagModal}
                            tags={tags}
                        />
                        <SidebarViews
                            handleNavClick={handleNavClick}
                            location={location}
                            isDarkMode={isDarkMode}
                        />
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
                        openNoteModal={openNoteModal}
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
