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
import SidebarNotes from './components/Sidebar/SidebarNotes'; // Add this import
import { Note } from './entities/Note';

interface SidebarProps {
  currentUser: { email: string };
  isDarkMode: boolean;
  toggleDarkMode: () => void;
  openProjectModal: () => void; // Add this prop
  openNoteModal: (note: Note | null) => void;
  notes: Note[];
}

const Sidebar: React.FC<SidebarProps> = ({
  currentUser,
  isDarkMode,
  toggleDarkMode,
  openProjectModal,
  openNoteModal,
  notes,
}) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false); // State for dropdown

  const navigate = useNavigate();
  const location = useLocation();

  const handleNavClick = (path: string, title: string, icon: string) => {
    navigate(path, { state: { title, icon } });
    setIsSidebarOpen(false); // Close sidebar on navigation for mobile
  };

  const toggleDropdown = () => {
    setIsDropdownOpen(!isDropdownOpen); // Toggles dropdown visibility
  };

  return (
    <>
      {/* Sidebar Toggle Button for small screens */}
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

      {/* Sidebar */}
      <div
        className={`fixed lg:static z-50 h-screen w-72 bg-white dark:bg-gray-900 text-gray-900 dark:text-white lg:translate-x-0 transform transition-transform duration-300 ease-in-out ${
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } lg:flex lg:flex-col flex-shrink-0`}
      >
        {/* Scrollable content */}
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
            openProjectModal={openProjectModal} // Pass down the function
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
            location={location}
            isDarkMode={isDarkMode}
          />
          <SidebarTags
            handleNavClick={handleNavClick}
            location={location}
            isDarkMode={isDarkMode}
          />
          <SidebarFooter
            currentUser={currentUser}
            isDarkMode={isDarkMode}
            toggleDarkMode={toggleDarkMode}
            isDropdownOpen={isDropdownOpen} // Pass isDropdownOpen
            toggleDropdown={toggleDropdown} // Pass toggleDropdown
          />
        </div>
      </div>
    </>
  );
};

export default Sidebar;
