import React from 'react';

interface LoadingSpinnerProps {
    message?: string;
    size?: 'sm' | 'md' | 'lg';
    overlay?: boolean;
    className?: string;
}

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
    message = 'Loading...',
    size = 'md',
    overlay = true,
    className = '',
}) => {
    const sizeClasses = {
        sm: 'h-4 w-4',
        md: 'h-6 w-6',
        lg: 'h-8 w-8',
    };

    const textSizeClasses = {
        sm: 'text-sm',
        md: 'text-lg',
        lg: 'text-xl',
    };

    const spinnerContent = (
        <div className={`flex items-center space-x-3 ${className}`}>
            <div
                className={`animate-spin rounded-full ${sizeClasses[size]} border-b-2 border-blue-600`}
            ></div>
            <div
                className={`font-medium text-gray-700 dark:text-gray-200 ${textSizeClasses[size]}`}
            >
                {message}
            </div>
        </div>
    );

    if (overlay) {
        return (
            <div className="fixed inset-0 flex items-center justify-center z-50">
                {spinnerContent}
            </div>
        );
    }

    return spinnerContent;
};

export default LoadingSpinner;
