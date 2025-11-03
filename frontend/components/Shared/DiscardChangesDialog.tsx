import React, { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

interface DiscardChangesDialogProps {
    onDiscard: () => void;
    onCancel: () => void;
}

const DiscardChangesDialog: React.FC<DiscardChangesDialogProps> = ({
    onDiscard,
    onCancel,
}) => {
    const { t } = useTranslation();
    const cancelButtonRef = useRef<HTMLButtonElement>(null);

    // Focus the "No" (Cancel) button when the dialog opens
    useEffect(() => {
        if (cancelButtonRef.current) {
            cancelButtonRef.current.focus();
        }
    }, []);

    // Handle Escape key to close the dialog (keeping changes)
    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                e.stopPropagation();
                onCancel();
            }
        };

        document.addEventListener('keydown', handleEscape);
        return () => document.removeEventListener('keydown', handleEscape);
    }, [onCancel]);

    return (
        <div
            className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-[60]"
            onClick={onCancel}
        >
            <div
                className="bg-white dark:bg-gray-800 p-8 rounded-lg shadow-xl w-full max-w-lg mx-4"
                onClick={(e) => e.stopPropagation()}
            >
                <h3 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">
                    {t('common.discardChanges', 'Discard changes?')}
                </h3>
                <p className="text-gray-700 dark:text-gray-300 mb-8">
                    {t(
                        'common.discardChangesMessage',
                        'You have unsaved changes. Are you sure you want to discard them?'
                    )}
                </p>
                <div className="flex justify-end space-x-4">
                    <button
                        ref={cancelButtonRef}
                        onClick={onCancel}
                        className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                        data-testid="discard-dialog-cancel"
                    >
                        {t('common.no', 'No, keep editing')}
                    </button>
                    <button
                        onClick={onDiscard}
                        className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
                        data-testid="discard-dialog-confirm"
                    >
                        {t('common.yesDiscard', 'Yes, discard')}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default DiscardChangesDialog;
