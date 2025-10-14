import React from 'react';

interface BannerBadgeProps {
    children: React.ReactNode;
}

const BannerBadge: React.FC<BannerBadgeProps> = ({ children }) => {
    return (
        <div className="flex items-center space-x-2 bg-black bg-opacity-40 backdrop-blur-sm rounded px-2 py-2">
            {children}
        </div>
    );
};

export default BannerBadge;
