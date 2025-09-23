import { useState, useEffect, useRef } from 'react';

interface PersistedModalState {
    isOpen: boolean;
    projectId?: number;
    timestamp?: number;
}

const MODAL_STATE_KEY = 'project-modal-state';
const MODAL_TIMEOUT = 5000; // 5 seconds timeout to prevent stale states

export const usePersistedModal = (projectId?: number) => {
    const [isOpen, setIsOpen] = useState(false);
    const timeoutRef = useRef<NodeJS.Timeout>();

    // Load persisted state on mount
    useEffect(() => {
        const savedState = sessionStorage.getItem(MODAL_STATE_KEY);
        if (savedState) {
            try {
                const state: PersistedModalState = JSON.parse(savedState);
                const now = Date.now();

                // Check if state is recent and for the same project
                if (
                    state.timestamp &&
                    now - state.timestamp < MODAL_TIMEOUT &&
                    state.projectId === projectId &&
                    state.isOpen
                ) {
                    setIsOpen(true);
                }
            } catch (error) {
                console.error('Error parsing modal state:', error);
            }
        }
    }, [projectId]);

    // Clear timeout on unmount
    useEffect(() => {
        return () => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
        };
    }, []);

    const openModal = () => {
        const state: PersistedModalState = {
            isOpen: true,
            projectId,
            timestamp: Date.now(),
        };

        sessionStorage.setItem(MODAL_STATE_KEY, JSON.stringify(state));
        setIsOpen(true);

        // Clear the persisted state after timeout
        timeoutRef.current = setTimeout(() => {
            sessionStorage.removeItem(MODAL_STATE_KEY);
        }, MODAL_TIMEOUT);
    };

    const closeModal = () => {
        sessionStorage.removeItem(MODAL_STATE_KEY);
        setIsOpen(false);

        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
        }
    };

    return {
        isOpen,
        openModal,
        closeModal,
    };
};
