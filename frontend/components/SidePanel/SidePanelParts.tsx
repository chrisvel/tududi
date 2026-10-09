import React from 'react';

// Tinted fields rather than outlined ones, to match the rest of the app.
export const sidePanelInputClass =
    'block w-full rounded-md bg-gray-100 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 transition-shadow focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-900 dark:text-gray-100 dark:placeholder-gray-500';

interface SidePanelSectionProps {
    title: string;
    children: React.ReactNode;
}

export const SidePanelSection: React.FC<SidePanelSectionProps> = ({
    title,
    children,
}) => (
    <section className="space-y-3">
        <h3 className="text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
            {title}
        </h3>
        {children}
    </section>
);

interface SidePanelFieldProps {
    label: string;
    htmlFor?: string;
    error?: string | null;
    children: React.ReactNode;
}

export const SidePanelField: React.FC<SidePanelFieldProps> = ({
    label,
    htmlFor,
    error,
    children,
}) => (
    <div className="space-y-1.5">
        <label
            htmlFor={htmlFor}
            className="block text-sm font-medium text-gray-700 dark:text-gray-300"
        >
            {label}
        </label>
        {children}
        {error && (
            <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
        )}
    </div>
);
