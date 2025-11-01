import React from 'react';

interface SidebarHeaderProps {
    isDarkMode: boolean;
}

const SidebarHeader: React.FC<SidebarHeaderProps> = ({ isDarkMode }) => {
    return (
        <div className="flex justify-center mb-6 mt-2">
            <a
                href="/"
                className="flex justify-center items-center mb-2 no-underline"
            >
                <img
                    src={isDarkMode ? '/wide-logo-light.png' : '/wide-logo-dark.png'}
                    alt="tududi"
                    className="h-12 w-auto"
                />
            </a>
        </div>
    );
};

export default SidebarHeader;
