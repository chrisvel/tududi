import React, { createContext, useContext, useState, useCallback } from 'react';
import {
    CheckCircleIcon,
    ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';

interface Toast {
    id: number;
    message: string | React.ReactNode;
    type: 'success' | 'error';
}

interface ToastContextProps {
    showSuccessToast: (message: string | React.ReactNode) => void;
    showErrorToast: (message: string | React.ReactNode) => void;
}

const ToastContext = createContext<ToastContextProps | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({
    children,
}) => {
    const [toasts, setToasts] = useState<Toast[]>([]);

    const removeToast = useCallback((id: number) => {
        setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, []);

    const showSuccessToast = useCallback(
        (message: string | React.ReactNode) => {
            const id = Date.now() + Math.random();
            const newToast: Toast = { id, message, type: 'success' };
            setToasts((prev) => [...prev, newToast]);
            setTimeout(() => removeToast(id), 4000);
        },
        [removeToast]
    );

    const showErrorToast = useCallback(
        (message: string | React.ReactNode) => {
            const id = Date.now() + Math.random();
            const newToast: Toast = { id, message, type: 'error' };
            setToasts((prev) => [...prev, newToast]);
            setTimeout(() => removeToast(id), 4000);
        },
        [removeToast]
    );

    return (
        <ToastContext.Provider value={{ showSuccessToast, showErrorToast }}>
            {children}
            <div className="fixed top-20 right-4 z-50 space-y-2">
                {toasts.map((toast, index) => (
                    <ToastComponent
                        key={toast.id}
                        message={toast.message}
                        type={toast.type}
                        onClose={() => removeToast(toast.id)}
                        style={{ transform: `translateY(${index * 4}px)` }}
                    />
                ))}
            </div>
        </ToastContext.Provider>
    );
};

export const useToast = () => {
    const context = useContext(ToastContext);
    if (context === undefined) {
        throw new Error('useToast must be used within a ToastProvider');
    }
    return context;
};

const ToastComponent: React.FC<{
    message: string | React.ReactNode;
    type: 'success' | 'error';
    onClose: () => void;
    style?: React.CSSProperties;
}> = ({ message, type, onClose, style }) => {
    return (
        <div
            className={`px-4 py-3 rounded-lg shadow-md text-white transition-all duration-300 ${
                type === 'success' ? 'bg-green-600' : 'bg-red-500'
            }`}
            style={style}
        >
            <div className="flex items-center">
                <div className="flex-shrink-0 mr-3">
                    {type === 'success' ? (
                        <CheckCircleIcon className="h-5 w-5" />
                    ) : (
                        <ExclamationTriangleIcon className="h-5 w-5" />
                    )}
                </div>
                <div className="flex-1">{message}</div>
                <button
                    onClick={onClose}
                    className="ml-4 text-xl leading-none hover:opacity-75 flex-shrink-0"
                >
                    &times;
                </button>
            </div>
        </div>
    );
};
