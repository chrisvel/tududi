import { useEffect } from 'react';

/**
 * Hook to dispatch global modal events when local modal state changes
 * @param isOpen - Whether the modal is currently open
 */
export const useModalEvents = (isOpen: boolean) => {
  useEffect(() => {
    if (isOpen) {
      window.dispatchEvent(new CustomEvent('modalOpen'));
    } else {
      window.dispatchEvent(new CustomEvent('modalClose'));
    }
  }, [isOpen]);
};