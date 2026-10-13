import React from 'react';

// A window with its left panel marked: collapses or opens the sidebar.
const SidebarPanelIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        className={className}
        aria-hidden="true"
    >
        <rect x="3" y="4" width="18" height="16" rx="3" />
        <path d="M9 4v16" />
    </svg>
);

export default SidebarPanelIcon;
