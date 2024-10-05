// src/components/Sidebar.tsx

import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Bars3Icon, XMarkIcon } from '@heroicons/react/24/outline';
import SidebarAreas from './components/Sidebar/SidebarAreas';
import SidebarFooter from './components/Sidebar/SidebarFooter';
import SidebarHeader from './components/Sidebar/SidebarHeader';
import SidebarNav from './components/Sidebar/SidebarNav';
import SidebarProjects from './components/Sidebar/SidebarProjects';
import SidebarTags from './components/Sidebar/SidebarTags';
import SidebarNotes from './components/Sidebar/SidebarNotes';
import { Note } from './entities/Note';
import { Area } from './entities/Area';
import { Tag } from './entities/Tag';

interface SidebarProps {
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
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();

  const handleNavClick = (path: string, title: string, icon: string) => {
    navigate(path, { state: { title, icon } });
    setIsSidebarOpen(false);
  };

  const toggleDropdown = () => {
    setIsDropdownOpen(!isDropdownOpen);
  };

  return (
    <>
      <div className="lg:hidden p-4 bg-white dark:bg-gray-900 text-gray-900 dark:text-white">
        <button
          className="flex items-center focus:outline-none"
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
        >
          {isSidebarOpen ? (
            <XMarkIcon className="h-6 w-6" />
          ) : (
            <Bars3Icon className="h-6 w-6" />
          )}
        </button>
      </div>

      <div
        className={`fixed lg:static z-50 h-screen w-72 bg-white dark:bg-gray-900 text-gray-900 dark:text-white lg:translate-x-0 transform transition-transform duration-300 ease-in-out ${
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } lg:flex lg:flex-col flex-shrink-0`}
      >
        <div className="flex flex-col h-full overflow-y-auto p-3">
          <SidebarHeader />
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
          <SidebarFooter
            currentUser={currentUser}
            isDarkMode={isDarkMode}
            toggleDarkMode={toggleDarkMode}
            isDropdownOpen={isDropdownOpen}
            toggleDropdown={toggleDropdown}
          />
        </div>
      </div>
    </>
  );
};

export default Sidebar;
