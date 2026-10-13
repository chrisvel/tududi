import React from 'react';
import { Link } from 'react-router-dom';
import { InformationCircleIcon } from '@heroicons/react/24/outline';

// The empty state for an entity list page: a title, a short hint and a row
// of actions. The first action is the main one and gets the solid blue
// button, the rest get a light blue one.
export interface BlankSlateAction {
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    onClick?: () => void;
    to?: string;
    testId?: string;
}

// One-click starters under the actions, for a page where most people
// begin with the same few things ("Most people start with: Home, Work").
export interface BlankSlatePreset {
    label: string;
    onClick: () => void;
    testId?: string;
}

interface BlankSlateProps {
    title: string;
    hint: string;
    actions?: BlankSlateAction[];
    presetsLabel?: string;
    presets?: BlankSlatePreset[];
}

const BUTTON =
    'flex items-center justify-center gap-2 h-10 px-4 text-sm font-medium rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400';
const PRIMARY = `${BUTTON} bg-blue-600 text-white shadow-sm hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600`;
const SECONDARY = `${BUTTON} bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-300 dark:hover:bg-blue-900/50`;
const PRESET =
    'inline-flex items-center gap-1 rounded-full bg-gray-100 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400';

const BlankSlate: React.FC<BlankSlateProps> = ({
    title,
    hint,
    actions = [],
    presetsLabel,
    presets = [],
}) => (
    <div className="flex justify-center items-center mt-4">
        <div className="w-full max-w bg-black/2 dark:bg-gray-900/25 rounded-l px-6 py-12 sm:px-10 sm:py-24 flex flex-col items-center opacity-95">
            <InformationCircleIcon className="h-20 w-20 text-gray-400 opacity-30 mb-6" />
            <p className="text-2xl font-light text-center text-gray-600 dark:text-gray-300 mb-2">
                {title}
            </p>
            <p
                className={`text-base text-center text-gray-400 dark:text-gray-400 max-w-md ${
                    actions.length > 0 ? 'mb-8' : ''
                }`}
            >
                {hint}
            </p>
            {actions.length > 0 && (
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3 w-full sm:w-auto">
                    {actions.map(
                        ({ label, icon: Icon, onClick, to, testId }, index) => {
                            const className = index === 0 ? PRIMARY : SECONDARY;
                            const content = (
                                <>
                                    <Icon className="h-4 w-4" />
                                    {label}
                                </>
                            );
                            return to ? (
                                <Link
                                    key={label}
                                    to={to}
                                    className={className}
                                    data-testid={testId}
                                >
                                    {content}
                                </Link>
                            ) : (
                                <button
                                    key={label}
                                    type="button"
                                    onClick={onClick}
                                    className={className}
                                    data-testid={testId}
                                >
                                    {content}
                                </button>
                            );
                        }
                    )}
                </div>
            )}
            {presets.length > 0 && (
                <div
                    className="mt-8 flex flex-col items-center gap-3"
                    data-testid="blank-slate-presets"
                >
                    {presetsLabel && (
                        <p className="text-sm text-gray-400 dark:text-gray-500">
                            {presetsLabel}
                        </p>
                    )}
                    <div className="flex flex-wrap justify-center gap-2">
                        {presets.map(({ label, onClick, testId }) => (
                            <button
                                key={label}
                                type="button"
                                onClick={onClick}
                                className={PRESET}
                                data-testid={testId}
                            >
                                {label}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    </div>
);

export default BlankSlate;
