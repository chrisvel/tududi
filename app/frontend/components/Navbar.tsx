// src/components/Navbar.tsx

import React, { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';

interface NavbarProps {
  isDarkMode: boolean;
  toggleDarkMode: () => void;
  currentUser: {
    email: string;
    avatarUrl?: string;
  };
}

const Navbar: React.FC<NavbarProps> = ({
  isDarkMode,
  toggleDarkMode,
  currentUser,
}) => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const toggleDropdown = () => {
    setIsDropdownOpen(!isDropdownOpen);
  };

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-md h-16">
      <div className="px-4 sm:px-6 lg:px-8 h-full flex items-center justify-between">
        {/* Left side */}
        <div className="flex items-center">
          {/* Logo */}
          <Link
            to="/"
            className="flex items-center no-underline text-gray-900 dark:text-white"
          >
            <span className="text-2xl font-bold mt-1">tududi</span>
          </Link>
        </div>

        {/* Right side */}
        <div className="flex items-center space-x-4">
          {/* User Avatar and Dropdown */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={toggleDropdown}
              className="flex items-center focus:outline-none"
              aria-label="User Menu"
            >
              <img
                src={
                  currentUser?.avatarUrl ||
                  'https://www.gravatar.com/avatar/placeholder?d=mp'
                }
                alt="User Avatar"
                className="h-8 w-8 rounded-full object-cover border-2 border-green-500"
              />
            </button>

            {/* Dropdown Menu */}
            {isDropdownOpen && (
              <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg py-1 z-50">
                <Link
                  to="/profile"
                  className="block px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  Profile
                </Link>
                <button
                  onClick={() => {
                    // Handle logout logic here
                    console.log('Logout clicked');
                  }}
                  className="w-full text-left block px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  Logout
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
