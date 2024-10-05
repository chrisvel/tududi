// SidebarHeader.tsx
import React from 'react';

const SidebarHeader: React.FC = () => {
  return (
    <div className="flex justify-center">
      <a
        href="/"
        className="flex justify-center items-center mb-2 no-underline text-white"
      >
        <span className="text-2xl font-bold mt-1">tududi</span>
      </a>
    </div>
  );
};

export default SidebarHeader;
