import React from 'react';
import './focus.css';

// A directionless circle; dots elsewhere follow the text direction.
export default function FocusRing({
    fraction,
    size = 240,
    bell = false,
    enter = false,
}: {
    fraction: number;
    size?: number;
    bell?: boolean;
    enter?: boolean;
}) {
    const radius = 46;
    const circumference = 2 * Math.PI * radius;
    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 100 100"
            aria-hidden="true"
            data-testid="focus-ring"
            className={`ltd-focus-ring ${enter ? 'ltd-focus-enter' : ''} ${bell ? 'ltd-focus-bell' : ''}`}
        >
            <circle
                cx="50"
                cy="50"
                r={radius}
                fill="none"
                stroke="var(--ltd-separator)"
                strokeWidth="2"
            />
            <circle
                className="ltd-focus-progress"
                cx="50"
                cy="50"
                r={radius}
                fill="none"
                stroke="var(--ltd-primary)"
                strokeWidth="2.5"
                strokeLinecap="round"
                transform="rotate(-90 50 50)"
                strokeDasharray={circumference}
                strokeDashoffset={
                    circumference * (1 - Math.max(0, Math.min(1, fraction)))
                }
            />
        </svg>
    );
}
