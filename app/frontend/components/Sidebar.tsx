import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Bars3Icon, SunIcon, MoonIcon } from '@heroicons/react/24/outline';
import { Area } from '../entities/Area';
import { Note } from '../entities/Note';
import { Tag } from '../entities/Tag';
import SidebarAreas from './Sidebar/SidebarAreas';
import SidebarFooter from './Sidebar/SidebarFooter';
import SidebarNav from './Sidebar/SidebarNav';
import SidebarNotes from './Sidebar/SidebarNotes';
import SidebarProjects from './Sidebar/SidebarProjects';
import SidebarTags from './Sidebar/SidebarTags';


interface SidebarProps {
  isSidebarOpen: boolean;
  setIsSidebarOpen: React.Dispatch<React.SetStateAction<boolean>>;
  currentUser: { email: string };
  isDarkMode: boolean;
  toggleDarkMode: () => void;
  openProjectModal: () => void;
  openNoteModal: (note: Note | null) => void;
  openAreaModal: (area: Area | null) => void;
  openTagModal: (tag: Tag | null) => void;
  notes: Note[];
  areas: Area[];
  tags: Tag[];
}

const Sidebar: React.FC<SidebarProps> = ({
  isSidebarOpen,
  setIsSidebarOpen,
  currentUser,
  isDarkMode,
  toggleDarkMode,
  openProjectModal,
  openNoteModal,
  openAreaModal,
  openTagModal,
  notes,
  areas,
  tags,
}) => {
  const navigate = useNavigate();
  const location = useLocation();

  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const toggleDropdown = () => {
    setIsDropdownOpen(!isDropdownOpen);
  };

  const handleNavClick = (path: string, title: string, icon: JSX.Element) => {
    navigate(path, { state: { title } });
    if (window.innerWidth < 1024) {
      setIsSidebarOpen(false);
    }
  };

  return (
    <div
      className={`fixed top-16 left-0 h-[calc(100vh-4rem)] bg-white dark:bg-gray-900 text-gray-900 dark:text-white transition-all duration-300 ease-in-out ${
        isSidebarOpen ? 'w-64' : 'w-16'
      }`}
    >
      <div className="flex flex-col h-full overflow-y-auto">
        {isSidebarOpen ? (
          <>
            <div className="px-3 pb-3 pt-6">
              {/* Sidebar Content */}
              <SidebarNav
                handleNavClick={handleNavClick}
                location={location}
                isDarkMode={isDarkMode}
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
            </div>

            {/* Sidebar Footer */}
            <SidebarFooter
              currentUser={currentUser}
              isDarkMode={isDarkMode}
              toggleDarkMode={toggleDarkMode}
              isSidebarOpen={isSidebarOpen}
              setIsSidebarOpen={setIsSidebarOpen}
              isDropdownOpen={isDropdownOpen}
              toggleDropdown={toggleDropdown}
            />
          </>
        ) : (
          <div className="flex flex-col items-center justify-between h-full py-4">
            {/* Expand Sidebar Button */}
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="focus:outline-none text-gray-700 dark:text-gray-300"
              aria-label="Expand Sidebar"
            >
              <Bars3Icon className="h-6 w-6" />
            </button>

            {/* Dark Mode Toggle */}
            <button
              onClick={toggleDarkMode}
              className="focus:outline-none text-gray-700 dark:text-gray-300"
              aria-label="Toggle Dark Mode"
            >
              {isDarkMode ? (
                <SunIcon className="h-6 w-6 text-yellow-500" />
              ) : (
                <MoonIcon className="h-6 w-6 text-gray-500" />
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Sidebar;
