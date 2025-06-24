import React, { createContext, useContext, useState, useCallback } from 'react';

interface ToastContextProps {
  showSuccessToast: (message: string | React.ReactNode) => void;
  showErrorToast: (message: string | React.ReactNode) => void;
}

const ToastContext = createContext<ToastContextProps | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toastMessage, setToastMessage] = useState<string | React.ReactNode | null>(null);
  const [toastType, setToastType] = useState<'success' | 'error'>('success');

  const showSuccessToast = useCallback((message: string | React.ReactNode) => {
    setToastMessage(message);
    setToastType('success');
    setTimeout(() => setToastMessage(null), 4000); 
  }, []);

  const showErrorToast = useCallback((message: string | React.ReactNode) => {
    setToastMessage(message);
    setToastType('error');
    setTimeout(() => setToastMessage(null), 4000); 
  }, []);

  return (
    <ToastContext.Provider value={{ showSuccessToast, showErrorToast }}>
      {children}
      {toastMessage && <Toast message={toastMessage} type={toastType} onClose={() => setToastMessage(null)} />}
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

const Toast: React.FC<{ message: string | React.ReactNode; type: 'success' | 'error'; onClose: () => void }> = ({ message, type, onClose }) => {
  return (
    <div
      className={`fixed top-20 right-4 z-50 px-4 py-3 rounded-lg shadow-md text-white ${
        type === 'success' ? 'bg-green-500' : 'bg-red-500'
      }`}
    >
      <div className="flex items-center">
        <div className="flex-1">{message}</div>
        <button onClick={onClose} className="ml-4 text-xl leading-none hover:opacity-75">
          &times;
        </button>
      </div>
    </div>
  );
};
