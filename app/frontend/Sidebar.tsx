// Sidebar.tsx
import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import SidebarFooter from './components/Sidebar/SidebarFooter';
import SidebarHeader from './components/Sidebar/SidebarHeader';
import SidebarNav from './components/Sidebar/SidebarNav';
import SidebarProjects from './components/Sidebar/SidebarProjects';

interface SidebarProps {
  currentUser: { email: string };
}

const Sidebar: React.FC<SidebarProps> = ({ currentUser }) => {
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();

  const handleNavClick = (path: string, title: string, icon: string) => {
    navigate(path, { state: { title, icon } });
    setIsSidebarOpen(false);
  };

  const toggleDarkMode = () => {
    setIsDarkMode(!isDarkMode);
    document.body.classList.toggle('dark-mode', !isDarkMode);
  };

  const toggleDropdown = () => {
    setIsDropdownOpen(!isDropdownOpen);
  };

  return (
    <>
      {/* Sidebar Toggle Button for small screens */}
      <div className="lg:hidden p-4 bg-gray-800 text-white">
        <button
          className="flex items-center focus:outline-none"
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
        >
          <i className={`bi ${isSidebarOpen ? 'bi-x-lg' : 'bi-list'} mr-2`}></i>
        </button>
      </div>

      {/* Sidebar */}
      <div
        className={`fixed lg:static z-50 h-screen w-72 bg-gray-800 text-white lg:translate-x-0 transform transition-transform duration-300 ease-in-out ${
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } lg:flex lg:flex-col flex-shrink-0`}
      >
        {/* Scrollable content */}
        <div className="flex flex-col h-full overflow-y-auto p-3">
          <SidebarHeader />
          <SidebarNav handleNavClick={handleNavClick} location={location} />
          <SidebarProjects handleNavClick={handleNavClick} location={location} />
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
