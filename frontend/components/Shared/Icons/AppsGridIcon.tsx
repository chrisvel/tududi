import React from 'react';

interface AppsGridIconProps {
    className?: string;
}

const dots = [4, 12, 20];

const AppsGridIcon: React.FC<AppsGridIconProps> = ({
    className = 'h-4 w-4',
}) => (
    <svg
        className={className}
        viewBox="0 0 24 24"
        fill="currentColor"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
    >
        {dots.flatMap((cy) =>
            dots.map((cx) => (
                <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={2} />
            ))
        )}
    </svg>
);

export default AppsGridIcon;
