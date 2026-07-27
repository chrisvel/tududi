import React from 'react';

interface PushPinIconProps {
    className?: string;
    filled?: boolean;
}

const PushPinIcon: React.FC<PushPinIconProps> = ({ className, filled = false }) => {
    if (filled) {
        return (
            <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="currentColor"
                className={className}
            >
                <path d="M16 3H8a1 1 0 0 0 0 2h1v5.76a3 3 0 0 1-1.66 2.68L5.55 14.4A3 3 0 0 0 4 17.06V18h7v4h2v-4h7v-.94a3 3 0 0 0-1.55-2.66l-1.79-.96A3 3 0 0 1 15 10.76V5h1a1 1 0 0 0 0-2Z" />
            </svg>
        );
    }

    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={className}
        >
            <line x1="12" y1="17" x2="12" y2="22" />
            <path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V5h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v5.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V17z" />
        </svg>
    );
};

export default PushPinIcon;
