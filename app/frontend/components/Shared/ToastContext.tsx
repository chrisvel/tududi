import React, { createContext, useContext, useState, useCallback } from 'react';

interface ToastContextProps {
  showSuccessToast: (message: string) => void;
  showErrorToast: (message: string) => void;
}

const ToastContext = createContext<ToastContextProps | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastType, setToastType] = useState<'success' | 'error'>('success');

  const showSuccessToast = useCallback((message: string) => {
    setToastMessage(message);
    setToastType('success');
    setTimeout(() => setToastMessage(null), 3000); 
  }, []);

  const showErrorToast = useCallback((message: string) => {
    setToastMessage(message);
    setToastType('error');
    setTimeout(() => setToastMessage(null), 3000); 
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

const Toast: React.FC<{ message: string; type: 'success' | 'error'; onClose: () => void }> = ({ message, type, onClose }) => {
  return (
    <div
      className={`fixed bottom-4 right-4 z-50 px-4 py-3 rounded-lg shadow-md text-white ${
        type === 'success' ? 'bg-green-500' : 'bg-red-500'
      }`}
    >
      <span>{message}</span>
      <button onClick={onClose} className="ml-4">
        &times;
      </button>
    </div>
  );
};
