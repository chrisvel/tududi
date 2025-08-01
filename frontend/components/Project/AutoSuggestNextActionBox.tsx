import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

interface AutoSuggestNextActionBoxProps {
    onAddAction: (actionDescription: string) => void;
    onDismiss: () => void;
}

const AutoSuggestNextActionBox: React.FC<AutoSuggestNextActionBoxProps> = ({
    onAddAction,
    onDismiss,
}) => {
    const [actionDescription, setActionDescription] = useState('');
    const [isFocused, setIsFocused] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    const { t } = useTranslation();

    useEffect(() => {
        // Focus the input when component mounts
        setTimeout(() => {
            inputRef.current?.focus();
        }, 100);
    }, []);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (actionDescription.trim()) {
            onAddAction(actionDescription.trim());
            setActionDescription('');
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Escape') {
            onDismiss();
        }
    };

    return (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-6 mb-6">
            <div className="flex items-start justify-between mb-4">
                <div className="flex items-center">
                    <div className="bg-blue-100 dark:bg-blue-800 p-2 rounded-lg mr-3">
                        <svg
                            className="w-6 h-6 text-blue-600 dark:text-blue-300"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M9 5l7 7-7 7"
                            />
                        </svg>
                    </div>
                    <div>
                        <h3 className="text-lg font-semibold text-blue-800 dark:text-blue-200 mb-1">
                            {t(
                                'profile.nextActionPrompt',
                                "What's the very next physical action for this project?"
                            )}
                        </h3>
                    </div>
                </div>
                <button
                    onClick={onDismiss}
                    className="text-blue-400 hover:text-blue-600 dark:text-blue-500 dark:hover:text-blue-300 transition-colors"
                    aria-label="Dismiss"
                >
                    <svg
                        className="w-5 h-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M6 18L18 6M6 6l12 12"
                        />
                    </svg>
                </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="relative">
                    <input
                        ref={inputRef}
                        type="text"
                        value={actionDescription}
                        onChange={(e) => setActionDescription(e.target.value)}
                        onFocus={() => setIsFocused(true)}
                        onBlur={() => setIsFocused(false)}
                        onKeyDown={handleKeyDown}
                        placeholder={t(
                            'profile.nextActionPlaceholder',
                            'e.g., Call John to schedule meeting, Research competitors online, Create project folder...'
                        )}
                        className={`w-full px-4 py-3 border rounded-lg shadow-sm transition-all duration-200 focus:outline-none bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 ${
                            isFocused
                                ? 'border-blue-400 ring-2 ring-blue-100 dark:ring-blue-900/50'
                                : 'border-blue-200 dark:border-blue-700 hover:border-blue-300 dark:hover:border-blue-600'
                        }`}
                    />
                    {actionDescription && (
                        <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                            <kbd className="px-2 py-1 text-xs bg-blue-100 dark:bg-blue-800 text-blue-600 dark:text-blue-300 rounded border border-blue-200 dark:border-blue-700">
                                Enter
                            </kbd>
                        </div>
                    )}
                </div>

                <div className="flex justify-between items-center">
                    <button
                        type="button"
                        onClick={onDismiss}
                        className="px-4 py-2 text-sm font-medium text-blue-600 dark:text-blue-400 bg-transparent hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded-lg transition-colors"
                    >
                        {t('profile.skipNextAction', 'Skip for now')}
                    </button>
                    <button
                        type="submit"
                        disabled={!actionDescription.trim()}
                        className="px-6 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-800 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        {t('profile.addNextAction', 'Add Next Action')}
                    </button>
                </div>
            </form>

            <div className="mt-4 p-3 bg-blue-100/50 dark:bg-blue-900/30 rounded-lg border border-blue-200 dark:border-blue-700">
                <p className="text-xs text-blue-700 dark:text-blue-300 flex items-center">
                    <svg
                        className="w-4 h-4 mr-2 flex-shrink-0"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                    </svg>
                    <span>
                        {t(
                            'profile.nextActionHint',
                            'Think of the smallest, most concrete step you can take right now to move this project forward.'
                        )}
                    </span>
                </p>
            </div>
        </div>
    );
};

export default AutoSuggestNextActionBox;
