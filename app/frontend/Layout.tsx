import React from 'react';
import Sidebar from './Sidebar'; // Assume you have a Sidebar component
import './styles/tailwind.css'; // Tailwind CSS import

interface LayoutProps {
  currentUser: {
    email: string;
  };
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ currentUser, children }) => {
  return (
    <div className="min-h-screen flex bg-gray-100">
      {/* Sidebar */}
      <Sidebar currentUser={currentUser} />

      {/* Main content area */}
      <div className="flex-1 flex flex-col">
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
