import React, { createContext, useContext, useState, ReactNode } from 'react';

interface ModalContextType {
  isAnyModalOpen: boolean;
  openModal: () => void;
  closeModal: () => void;
  modalCount: number;
}

const ModalContext = createContext<ModalContextType | undefined>(undefined);

export const useModal = () => {
  const context = useContext(ModalContext);
  if (context === undefined) {
    throw new Error('useModal must be used within a ModalProvider');
  }
  return context;
};

interface ModalProviderProps {
  children: ReactNode;
}

export const ModalProvider: React.FC<ModalProviderProps> = ({ children }) => {
  const [modalCount, setModalCount] = useState(0);

  const openModal = () => {
    setModalCount(prev => prev + 1);
  };

  const closeModal = () => {
    setModalCount(prev => Math.max(0, prev - 1));
  };

  const isAnyModalOpen = modalCount > 0;

  return (
    <ModalContext.Provider value={{ isAnyModalOpen, openModal, closeModal, modalCount }}>
      {children}
    </ModalContext.Provider>
  );
};