import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { CommandLineIcon, ArrowPathIcon } from '@heroicons/react/24/outline';
import {
    KeyboardShortcut,
    KeyboardShortcutsConfig,
    ShortcutAction,
    SHORTCUT_LABELS,
    formatShortcutDisplay,
    validateShortcuts,
    getDefaultShortcuts,
    getDefaultConfig,
    shortcutToString,
} from '../../../utils/keyboardShortcutsService';

interface KeyboardShortcutsTabProps {
    isActive: boolean;
    config: KeyboardShortcutsConfig | null | undefined;
    onChange: (config: KeyboardShortcutsConfig) => void;
}

const SHORTCUT_ACTIONS: ShortcutAction[] = [
    'inbox',
    'task',
    'project',
    'note',
    'area',
    'tag',
];

const KeyboardShortcutsTab: React.FC<KeyboardShortcutsTabProps> = ({
    isActive,
    config,
    onChange,
}) => {
    const { t } = useTranslation();
    const [editingAction, setEditingAction] = useState<ShortcutAction | null>(null);
    const [isRecording, setIsRecording] = useState(false);
    const [tempShortcut, setTempShortcut] = useState<KeyboardShortcut | null>(null);

    // Ensure we always have a valid config
    const activeConfig = config || getDefaultConfig();
    const shortcuts = activeConfig.shortcuts || getDefaultShortcuts();

    // Validation
    const validation = validateShortcuts(shortcuts);

    const handleEditClick = (action: ShortcutAction) => {
        const current = shortcuts.find(s => s.action === action);
        setEditingAction(action);
        setTempShortcut(current || null);
        setIsRecording(false);
    };

    const handleCancelEdit = () => {
        setEditingAction(null);
        setTempShortcut(null);
        setIsRecording(false);
    };

    const handleSaveEdit = () => {
        if (!editingAction || !tempShortcut) return;

        const newShortcuts = shortcuts.map(s =>
            s.action === editingAction ? tempShortcut : s
        );

        onChange({
            ...activeConfig,
            shortcuts: newShortcuts,
        });

        setEditingAction(null);
        setTempShortcut(null);
        setIsRecording(false);
    };

    const handleStartRecording = () => {
        setIsRecording(true);
    };

    // Handle keyboard recording
    useEffect(() => {
        if (!isRecording || !editingAction) return;

        const handleKeyDown = (event: KeyboardEvent) => {
            event.preventDefault();
            event.stopPropagation();

            // Ignore if only modifier keys are pressed
            const key = event.key.toLowerCase();
            if (['control', 'alt', 'shift', 'meta'].includes(key)) {
                return;
            }

            // Require at least one modifier
            if (!event.ctrlKey && !event.altKey && !event.shiftKey && !event.metaKey) {
                return;
            }

            const newShortcut: KeyboardShortcut = {
                action: editingAction,
                key: key.length === 1 ? key : key,
                modifiers: {
                    ctrl: event.ctrlKey,
                    alt: event.altKey,
                    shift: event.shiftKey,
                    meta: event.metaKey,
                },
            };

            setTempShortcut(newShortcut);
            setIsRecording(false);
        };

        document.addEventListener('keydown', handleKeyDown, true);
        return () => {
            document.removeEventListener('keydown', handleKeyDown, true);
        };
    }, [isRecording, editingAction]);

    const handleResetToDefaults = () => {
        onChange(getDefaultConfig());
    };

    const handleToggleEnabled = () => {
        onChange({
            ...activeConfig,
            enabled: !activeConfig.enabled,
        });
    };

    const getShortcutForAction = (action: ShortcutAction): KeyboardShortcut | undefined => {
        return shortcuts.find(s => s.action === action);
    };

    // Check if a shortcut would create a duplicate
    const wouldCreateDuplicate = (newShortcut: KeyboardShortcut): string | null => {
        const newKey = shortcutToString(newShortcut);
        for (const existing of shortcuts) {
            if (existing.action !== newShortcut.action && shortcutToString(existing) === newKey) {
                return existing.action;
            }
        }
        return null;
    };

    if (!isActive) return null;

    return (
        <div>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-6 flex items-center">
                <CommandLineIcon className="w-6 h-6 mr-3 text-purple-500" />
                {t('profile.keyboardShortcuts', 'Keyboard Shortcuts')}
            </h3>

            {/* Enable/Disable Toggle */}
            <div className="flex items-center justify-between py-4 border-b border-gray-200 dark:border-gray-700 mb-6">
                <div>
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        {t('profile.shortcuts.enableShortcuts', 'Enable Keyboard Shortcuts')}
                    </label>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {t(
                            'profile.shortcuts.enableDescription',
                            'Turn keyboard shortcuts on or off globally.'
                        )}
                    </p>
                </div>
                <div
                    className={`relative inline-block w-12 h-6 transition-colors duration-200 ease-in-out rounded-full cursor-pointer ${
                        activeConfig.enabled
                            ? 'bg-blue-500'
                            : 'bg-gray-300 dark:bg-gray-600'
                    }`}
                    onClick={handleToggleEnabled}
                >
                    <span
                        className={`absolute left-0 top-0 bottom-0 m-1 w-4 h-4 transition-transform duration-200 ease-in-out transform bg-white rounded-full ${
                            activeConfig.enabled ? 'translate-x-6' : 'translate-x-0'
                        }`}
                    ></span>
                </div>
            </div>

            {/* Validation Warnings */}
            {!validation.valid && (
                <div className="mb-6 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                    <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                        {t('profile.shortcuts.duplicateWarning', 'Duplicate shortcuts detected:')}
                    </p>
                    <ul className="mt-2 text-xs text-yellow-700 dark:text-yellow-300 list-disc list-inside">
                        {validation.duplicates.map((dup, idx) => (
                            <li key={idx}>{dup}</li>
                        ))}
                    </ul>
                </div>
            )}

            {/* Shortcuts List */}
            <div className="space-y-3 mb-6">
                {SHORTCUT_ACTIONS.map((action) => {
                    const shortcut = getShortcutForAction(action);
                    const isEditing = editingAction === action;
                    const label = SHORTCUT_LABELS[action];

                    return (
                        <div
                            key={action}
                            className="flex items-center justify-between py-3 px-4 bg-gray-50 dark:bg-gray-800 rounded-lg"
                        >
                            <div className="flex-1">
                                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                    {t(label.labelKey, label.defaultLabel)}
                                </span>
                            </div>

                            {isEditing ? (
                                <div className="flex items-center space-x-2">
                                    {isRecording ? (
                                        <div className="px-3 py-1.5 bg-blue-100 dark:bg-blue-900/30 border-2 border-blue-400 dark:border-blue-600 rounded text-blue-700 dark:text-blue-300 text-sm font-mono animate-pulse">
                                            {t('profile.shortcuts.pressKeys', 'Press keys...')}
                                        </div>
                                    ) : tempShortcut ? (
                                        <div className="flex items-center space-x-2">
                                            <kbd className="px-3 py-1.5 text-sm font-mono bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded shadow-sm text-gray-700 dark:text-gray-300">
                                                {formatShortcutDisplay(tempShortcut)}
                                            </kbd>
                                            {wouldCreateDuplicate(tempShortcut) && (
                                                <span className="text-xs text-yellow-600 dark:text-yellow-400">
                                                    {t('profile.shortcuts.duplicateWith', 'Conflicts with {{action}}', {
                                                        action: wouldCreateDuplicate(tempShortcut),
                                                    })}
                                                </span>
                                            )}
                                        </div>
                                    ) : null}
                                    <button
                                        type="button"
                                        onClick={handleStartRecording}
                                        className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                                    >
                                        {t('profile.shortcuts.record', 'Record')}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleSaveEdit}
                                        disabled={!tempShortcut}
                                        className="px-3 py-1.5 text-xs bg-green-600 text-white rounded hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {t('common.save', 'Save')}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleCancelEdit}
                                        className="px-3 py-1.5 text-xs bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-200 rounded hover:bg-gray-400 dark:hover:bg-gray-500 transition-colors"
                                    >
                                        {t('common.cancel', 'Cancel')}
                                    </button>
                                </div>
                            ) : (
                                <div className="flex items-center space-x-3">
                                    {shortcut && (
                                        <kbd className="px-3 py-1.5 text-sm font-mono bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded shadow-sm text-gray-700 dark:text-gray-300">
                                            {formatShortcutDisplay(shortcut)}
                                        </kbd>
                                    )}
                                    <button
                                        type="button"
                                        onClick={() => handleEditClick(action)}
                                        className="px-3 py-1.5 text-xs bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200 rounded hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors"
                                    >
                                        {t('common.edit', 'Edit')}
                                    </button>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Reset to Defaults */}
            <div className="flex justify-end pt-4 border-t border-gray-200 dark:border-gray-700">
                <button
                    type="button"
                    onClick={handleResetToDefaults}
                    className="flex items-center px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                    <ArrowPathIcon className="w-4 h-4 mr-2" />
                    {t('profile.shortcuts.resetToDefaults', 'Reset to Defaults')}
                </button>
            </div>

            {/* Info Box */}
            <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <p className="text-xs text-blue-700 dark:text-blue-300">
                    {t(
                        'profile.shortcuts.info',
                        'Keyboard shortcuts help you navigate quickly. Changes are saved when you click "Save Changes" at the bottom of the page. Shortcuts are disabled when typing in text fields.'
                    )}
                </p>
            </div>
        </div>
    );
};

export default KeyboardShortcutsTab;
