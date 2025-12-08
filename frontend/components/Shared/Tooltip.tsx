import React, { useEffect, useRef, useState } from 'react';

interface TooltipProps {
    content: React.ReactNode;
    children: React.ReactNode;
    className?: string;
    position?: 'top' | 'bottom';
}

const Tooltip: React.FC<TooltipProps> = ({
    content,
    children,
    className = '',
    position = 'top',
}) => {
    const [isVisible, setIsVisible] = useState(false);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const delay = 300;

    if (!content) {
        return <span className={className}>{children}</span>;
    }

    const positionClasses =
        position === 'top'
            ? 'bottom-full mb-2 origin-bottom'
            : 'top-full mt-2 origin-top';

    const visibilityClasses = isVisible
        ? 'opacity-100 scale-100'
        : 'pointer-events-none opacity-0 scale-95';

    const showWithDelay = () => {
        timerRef.current = setTimeout(() => {
            setIsVisible(true);
        }, delay);
    };

    const hideTooltip = () => {
        if (timerRef.current) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
        }
        setIsVisible(false);
    };

    useEffect(
        () => () => {
            if (timerRef.current) {
                clearTimeout(timerRef.current);
            }
        },
        []
    );

    return (
        <span
            className={`relative inline-flex ${className}`}
            onMouseEnter={showWithDelay}
            onMouseLeave={hideTooltip}
            onFocus={showWithDelay}
            onBlur={hideTooltip}
        >
            {children}
            <span
                role="tooltip"
                className={`absolute left-1/2 z-20 -translate-x-1/2 whitespace-pre-line rounded-md bg-gray-900 px-3 py-2 text-xs font-medium text-white shadow-2xl transition-all duration-150 ease-out dark:bg-gray-800 ${positionClasses} ${visibilityClasses}`}
            >
                {content}
            </span>
        </span>
    );
};

export default Tooltip;
