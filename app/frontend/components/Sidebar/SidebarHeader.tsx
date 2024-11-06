import React from 'react';

const SidebarHeader: React.FC = () => {
  return (
    <div className="flex justify-center mb-6 mt-2">
      <a
        href="/"
        className="flex justify-center items-center mb-2 no-underline text-gray-900 dark:text-white"
      >
        <span className="text-2xl font-bold mt-1">tududi</span>
      </a>
    </div>
  );
};

export default SidebarHeader;
