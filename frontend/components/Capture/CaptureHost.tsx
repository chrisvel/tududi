import React, { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { PlusIcon } from '@heroicons/react/24/outline';
import QuickCaptureInput, {
    QuickCaptureInputHandle,
} from '../Inbox/QuickCaptureInput';
import { closeCapture, openCapture, useCaptureUi } from '../../utils/captureUi';
import { useStore } from '../../store/useStore';

// The Inbox page has this same box inline, and the editors need the screen
// for typing, so the phone button stays out of their way.
const PHONE_BUTTON_HIDDEN_ON = ['/inbox', '/task/', '/note/'];

const NAVBAR_BUTTON = '[data-testid="capture-navbar-button"]';

const DOCK_WIDTH = '640px';
const SIDEBAR_WIDTH = 'var(--sidebar-width, 22rem)';

interface CaptureHostProps {
    sidebarOpen?: boolean;
}

// The one box for adding anything: at the top center of the page content,
// just under the navbar, on wide screens, and a sheet at the bottom on phones.
// It stays mounted once opened, so half-typed text survives closing it.
const CaptureHost: React.FC<CaptureHostProps> = ({ sidebarOpen = false }) => {
    const { t } = useTranslation();
    const { open, target, openCount } = useCaptureUi();
    const location = useLocation();
    const projects = useStore((state) => state.projectsStore.projects);
    const inputRef = useRef<QuickCaptureInputHandle>(null);
    const dialogRef = useRef<HTMLDivElement>(null);
    const returnFocusRef = useRef<HTMLElement | null>(null);
    const [everOpened, setEverOpened] = useState(false);
    // A click or tap anywhere outside closes it. The navbar button toggles
    // on its own, so it is left out.
    useEffect(() => {
        if (!open) return undefined;
        const onPointerDown = (event: PointerEvent) => {
            const node = event.target as Node | null;
            if (!node || dialogRef.current?.contains(node)) return;
            if (node instanceof Element && node.closest(NAVBAR_BUTTON)) return;
            closeCapture();
        };
        document.addEventListener('pointerdown', onPointerDown);
        return () => document.removeEventListener('pointerdown', onPointerDown);
    }, [open]);

    useEffect(() => {
        if (open) {
            returnFocusRef.current =
                document.activeElement instanceof HTMLElement
                    ? document.activeElement
                    : null;
            setEverOpened(true);
            return undefined;
        }
        const previous = returnFocusRef.current;
        returnFocusRef.current = null;
        if (previous && document.contains(previous)) {
            previous.focus();
        }
        return undefined;
    }, [open, openCount]);

    // Centered over the page content, not the whole window, so it lines up
    // with the list instead of shifting toward the sidebar. No transform
    // here: it would break the fixed suggestion lists inside the box.
    const contentLeft = sidebarOpen ? SIDEBAR_WIDTH : '0px';
    const dockLeft = `calc(${contentLeft} + (100% - ${contentLeft} - ${DOCK_WIDTH}) / 2)`;

    // Focus the field on every open. This waits for everOpened: on the first
    // open the box is not in the page yet when the effect above runs.
    useEffect(() => {
        if (!open || !everOpened) return undefined;
        const frame = requestAnimationFrame(() => inputRef.current?.focus());
        return () => cancelAnimationFrame(frame);
    }, [open, openCount, everOpened]);

    const phoneButtonVisible =
        !open &&
        !PHONE_BUTTON_HIDDEN_ON.some((path) =>
            location.pathname.startsWith(path)
        );

    return (
        <>
            {/* Always on top: task rows lift themselves to z-[10000] on
                hover or tap, and pickers open at z-[10050]. */}
            {phoneButtonVisible && (
                <button
                    type="button"
                    data-testid="capture-phone-button"
                    onClick={() => openCapture('inbox')}
                    className="lg:hidden fixed right-4 bottom-[max(1.25rem,env(safe-area-inset-bottom))] z-[10100] flex items-center gap-2 rounded-full bg-blue-600 hover:bg-blue-700 text-white text-[15px] font-semibold pl-3.5 pr-5 h-12 shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2"
                >
                    <PlusIcon className="h-5 w-5" aria-hidden="true" />
                    {t('capture.add', 'Add')}
                </button>
            )}
            {open && (
                // Dims the page so the box reads as the one thing in front.
                // A click on it closes the box through the outside-click
                // handler above.
                <div
                    aria-hidden="true"
                    data-testid="capture-scrim"
                    className="fixed inset-0 z-50 bg-gray-900/20 dark:bg-black/50"
                />
            )}
            {everOpened && (
                <div
                    ref={dialogRef}
                    role="dialog"
                    aria-label={t('capture.dialogLabel', 'Add')}
                    data-testid="capture-dialog"
                    hidden={!open}
                    style={
                        {
                            '--capture-dock-left': dockLeft,
                        } as React.CSSProperties
                    }
                    className="fixed z-50 inset-x-0 bottom-0 pb-[env(safe-area-inset-bottom)] bg-white dark:bg-gray-800 rounded-t-2xl shadow-[0_-10px_30px_-10px_rgba(0,0,0,0.3)] max-h-[85vh] lg:inset-x-auto lg:left-[var(--capture-dock-left)] lg:top-[4.5rem] lg:bottom-auto lg:w-[640px] lg:pb-0 lg:rounded-2xl lg:shadow-[0_18px_40px_-12px_rgba(23,32,43,0.4),0_0_0_1px_theme(colors.gray.300)] dark:lg:shadow-[0_18px_40px_-12px_rgba(0,0,0,0.85),0_0_0_1px_theme(colors.gray.600)]"
                >
                    <div className="max-h-[85vh] overflow-y-auto rounded-t-2xl lg:rounded-2xl">
                        <QuickCaptureInput
                            ref={inputRef}
                            unified
                            compact
                            defaultTarget={target}
                            resetKey={openCount}
                            projects={projects}
                            onClose={closeCapture}
                            cardClassName="rounded-none shadow-none !bg-transparent"
                        />
                    </div>
                </div>
            )}
        </>
    );
};

export default CaptureHost;
