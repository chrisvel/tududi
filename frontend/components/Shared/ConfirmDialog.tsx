import React from 'react';
import { useTranslation } from 'react-i18next';

interface ConfirmDialogProps {
    title: string;
    message: string;
    onConfirm: () => void;
    onCancel: () => void;
}

const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
    title,
    message,
    onConfirm,
    onCancel,
}) => {
    const { t } = useTranslation();

    return (
        <div
            className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50"
            onClick={onCancel}
        >
            <div
                className="bg-white dark:bg-gray-800 p-8 rounded-lg shadow-xl w-full max-w-lg mx-4"
                onClick={(e) => e.stopPropagation()}
            >
                <h3 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">
                    {title}
                </h3>
                <p className="text-gray-700 dark:text-gray-300 mb-8">
                    {message}
                </p>
                <div className="flex justify-end space-x-4">
                    <button
                        onClick={onCancel}
                        className="px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400 focus:outline-none"
                        data-testid="confirm-dialog-cancel"
                    >
                        {t('common.cancel', 'Cancel')}
                    </button>
                    <button
                        onClick={onConfirm}
                        className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 focus:outline-none"
                        data-testid="confirm-dialog-confirm"
                    >
                        {t('common.delete', 'Delete')}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ConfirmDialog;
