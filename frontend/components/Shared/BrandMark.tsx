import React from 'react';

// LTD-PATCH(T-301): Render docs/ltd/brand/mark.svg unchanged in currentColor.
const BrandMark: React.FC = () => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 160 160"
        fill="none"
        className="h-7 w-7 shrink-0"
        aria-hidden="true"
        focusable="false"
    >
        <path
            d="M14 98C30 98 38 78 46 78"
            stroke="currentColor"
            strokeWidth="8"
            strokeLinecap="round"
        />
        <path
            d="M146 98C130 98 122 78 114 78"
            stroke="currentColor"
            strokeWidth="8"
            strokeLinecap="round"
        />
        <circle cx="80" cy="78" r="24" fill="currentColor" />
    </svg>
);
export default BrandMark;
