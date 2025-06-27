import { useEffect } from 'react';
import { useModal } from '../contexts/ModalContext';

/**
 * Hook to automatically manage modal state with the global modal context
 * @param isOpen - Whether the modal is currently open
 * @returns Object with the modal context functions
 */
export const useModalManager = (isOpen: boolean) => {
  const modalContext = useModal();

  useEffect(() => {
    if (isOpen) {
      modalContext.openModal();
    } else {
      modalContext.closeModal();
    }

    // Cleanup function to ensure we close the modal if component unmounts while open
    return () => {
      if (isOpen) {
        modalContext.closeModal();
      }
    };
  }, [isOpen, modalContext]);

  return modalContext;
};