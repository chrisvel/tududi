import React from 'react';
import Sidebar from './Sidebar'; // Assume you have a Sidebar component
import './styles/tailwind.css'; // Tailwind CSS import

interface LayoutProps {
  currentUser: {
    email: string;
  };
  isDarkMode: boolean;
  toggleDarkMode: () => void;
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ currentUser, isDarkMode, toggleDarkMode, children }) => {
  return (
    <div className={`min-h-screen flex ${isDarkMode ? 'dark' : ''}`}>
      {/* Sidebar */}
      <Sidebar currentUser={currentUser} isDarkMode={isDarkMode} toggleDarkMode={toggleDarkMode} />

      {/* Main content area */}
      <div className="flex-1 flex flex-col bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
        {/* Content wrapper */}
        <div className="flex-grow p-6 pt-20">
          <div className="w-full max-w-5xl mx-auto">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Layout;
