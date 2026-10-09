import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { TrashIcon, XMarkIcon } from '@heroicons/react/24/outline';
import DiscardChangesDialog from '../Shared/DiscardChangesDialog';

export const SIDE_PANEL_SLIDE_MS = 200;

export interface EntitySidePanelProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    eyebrow?: string;
    submitLabel: string;
    submitTestId?: string;
    isSubmitting?: boolean;
    isDirty?: boolean;
    error?: string | null;
    onSubmit: () => void;
    onDelete?: () => void;
    deleteLabel?: string;
    testId?: string;
    // Set while a confirmation dialog is open, so Escape and the scrim leave it alone
    closeLocked?: boolean;
    children: React.ReactNode;
}

// One right-side panel for create and edit forms. It slides in over the
// page, keeps the page visible behind a scrim, and asks before discarding
// unsaved changes. Every entity form renders its fields as children.
const EntitySidePanel: React.FC<EntitySidePanelProps> = ({
    isOpen,
    onClose,
    title,
    eyebrow,
    submitLabel,
    submitTestId = 'side-panel-submit',
    isSubmitting = false,
    isDirty = false,
    error,
    onSubmit,
    onDelete,
    deleteLabel,
    testId,
    closeLocked = false,
    children,
}) => {
    const { t } = useTranslation();
    const [shown, setShown] = useState(false);
    const [showDiscard, setShowDiscard] = useState(false);
    const panelRef = useRef<HTMLElement>(null);
    const closingRef = useRef(false);
    const dirtyRef = useRef(isDirty);
    const lockedRef = useRef(closeLocked);
    const onCloseRef = useRef(onClose);
    dirtyRef.current = isDirty;
    lockedRef.current = closeLocked;
    onCloseRef.current = onClose;

    useEffect(() => {
        if (!isOpen) return;
        const previouslyFocused = document.activeElement as HTMLElement | null;
        const frame = requestAnimationFrame(() => setShown(true));
        const focusTimer = window.setTimeout(() => {
            panelRef.current
                ?.querySelector<HTMLElement>('input, textarea, select')
                ?.focus();
        }, SIDE_PANEL_SLIDE_MS / 2);
        return () => {
            cancelAnimationFrame(frame);
            window.clearTimeout(focusTimer);
            previouslyFocused?.focus?.();
        };
    }, [isOpen]);

    const close = () => {
        if (closingRef.current) return;
        closingRef.current = true;
        setShown(false);
        setShowDiscard(false);
        window.setTimeout(() => {
            closingRef.current = false;
            onCloseRef.current();
        }, SIDE_PANEL_SLIDE_MS);
    };

    const requestClose = () => {
        if (closingRef.current || lockedRef.current) return;
        if (dirtyRef.current) {
            setShowDiscard(true);
        } else {
            close();
        }
    };

    useEffect(() => {
        if (!isOpen) return;
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key !== 'Escape' || showDiscard) return;
            event.preventDefault();
            requestClose();
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
        // requestClose reads refs, so re-registering on these two is enough
    }, [isOpen, showDiscard]);

    if (!isOpen) return null;

    return createPortal(
        <>
            <div
                aria-hidden="true"
                onMouseDown={requestClose}
                className={`fixed inset-0 z-[55] bg-gray-900/20 transition-opacity duration-200 motion-reduce:transition-none dark:bg-black/40 ${
                    shown ? 'opacity-100' : 'opacity-0'
                }`}
            />
            <aside
                ref={panelRef}
                role="dialog"
                aria-modal="true"
                aria-label={title}
                data-testid={testId}
                className={`fixed inset-y-0 right-0 z-[60] flex w-full flex-col bg-white shadow-2xl transition-transform duration-200 ease-out motion-reduce:transition-none dark:bg-gray-800 sm:w-[32rem] ${
                    shown ? 'translate-x-0' : 'translate-x-full'
                }`}
            >
                <header className="flex flex-shrink-0 items-start justify-between gap-4 px-5 pb-3 pt-5">
                    <div className="min-w-0">
                        {eyebrow && (
                            <p className="text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                                {eyebrow}
                            </p>
                        )}
                        <h2 className="truncate text-lg font-semibold text-gray-900 dark:text-white">
                            {title}
                        </h2>
                    </div>
                    <button
                        type="button"
                        onClick={requestClose}
                        aria-label={t('common.close', 'Close')}
                        className="flex-shrink-0 rounded-md p-1.5 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-200"
                    >
                        <XMarkIcon className="h-5 w-5" />
                    </button>
                </header>

                <form
                    className="flex min-h-0 flex-1 flex-col"
                    onSubmit={(event) => {
                        event.preventDefault();
                        if (!isSubmitting) onSubmit();
                    }}
                >
                    <div className="min-h-0 flex-1 space-y-6 overflow-y-auto overflow-x-hidden px-5 pb-6">
                        {children}
                        {error && (
                            <p
                                role="alert"
                                className="text-sm text-red-600 dark:text-red-400"
                            >
                                {error}
                            </p>
                        )}
                    </div>

                    <footer className="flex flex-shrink-0 items-center justify-between gap-3 bg-gray-50 px-5 py-3 dark:bg-gray-900/40">
                        <div>
                            {onDelete && (
                                <button
                                    type="button"
                                    onClick={onDelete}
                                    className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm text-red-600 transition-colors hover:bg-red-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 dark:text-red-400 dark:hover:bg-red-900/20"
                                >
                                    <TrashIcon className="h-4 w-4" />
                                    {deleteLabel ??
                                        t('common.delete', 'Delete')}
                                </button>
                            )}
                        </div>
                        <div className="flex items-center gap-3">
                            <button
                                type="button"
                                onClick={requestClose}
                                className="rounded-md px-3 py-2 text-sm text-gray-600 transition-colors hover:text-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:text-gray-400 dark:hover:text-gray-100"
                            >
                                {t('common.cancel', 'Cancel')}
                            </button>
                            <button
                                type="submit"
                                disabled={isSubmitting}
                                data-testid={submitTestId}
                                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-blue-500 dark:hover:bg-blue-600"
                            >
                                {isSubmitting
                                    ? t('modals.submitting')
                                    : submitLabel}
                            </button>
                        </div>
                    </footer>
                </form>
            </aside>

            {showDiscard && (
                <DiscardChangesDialog
                    onDiscard={close}
                    onCancel={() => setShowDiscard(false)}
                />
            )}
        </>,
        document.body
    );
};

export default EntitySidePanel;
