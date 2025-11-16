import React from 'react';
import { Link } from 'react-router-dom';
import { getAssetPath } from '../../config/paths';

interface SidebarHeaderProps {
    isDarkMode: boolean;
}

const SidebarHeader: React.FC<SidebarHeaderProps> = ({ isDarkMode }) => {
    return (
        <div className="flex justify-center mb-6 mt-2">
            <Link
                to="/"
                className="flex justify-center items-center mb-2 no-underline"
            >
                <img
                    src={getAssetPath(
                        isDarkMode
                            ? 'wide-logo-light.png'
                            : 'wide-logo-dark.png'
                    )}
                    alt="tududi"
                    className="h-12 w-auto"
                />
            </Link>
        </div>
    );
};

export default SidebarHeader;
