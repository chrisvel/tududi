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

// The one box for adding anything: a popover under the navbar button on wide
// screens, a sheet at the bottom on phones. It stays mounted once opened, so
// half-typed text survives closing it.
const CaptureHost: React.FC = () => {
    const { t } = useTranslation();
    const { open, target, openCount } = useCaptureUi();
    const location = useLocation();
    const projects = useStore((state) => state.projectsStore.projects);
    const inputRef = useRef<QuickCaptureInputHandle>(null);
    const returnFocusRef = useRef<HTMLElement | null>(null);
    const [everOpened, setEverOpened] = useState(false);

    useEffect(() => {
        if (open) {
            returnFocusRef.current =
                document.activeElement instanceof HTMLElement
                    ? document.activeElement
                    : null;
            setEverOpened(true);
            const frame = requestAnimationFrame(() =>
                inputRef.current?.focus()
            );
            return () => cancelAnimationFrame(frame);
        }
        const previous = returnFocusRef.current;
        returnFocusRef.current = null;
        if (previous && document.contains(previous)) {
            previous.focus();
        }
        return undefined;
    }, [open, openCount]);

    const phoneButtonVisible =
        !open &&
        !PHONE_BUTTON_HIDDEN_ON.some((path) =>
            location.pathname.startsWith(path)
        );

    return (
        <>
            {phoneButtonVisible && (
                <button
                    type="button"
                    data-testid="capture-phone-button"
                    onClick={() => openCapture('inbox')}
                    className="lg:hidden fixed right-4 bottom-[max(1.25rem,env(safe-area-inset-bottom))] z-40 flex items-center gap-2 rounded-full bg-blue-600 hover:bg-blue-700 text-white text-[15px] font-semibold pl-3.5 pr-5 h-12 shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2"
                >
                    <PlusIcon className="h-5 w-5" aria-hidden="true" />
                    {t('capture.add', 'Add')}
                </button>
            )}
            {everOpened && (
                <div
                    role="dialog"
                    aria-label={t('capture.dialogLabel', 'Add')}
                    data-testid="capture-dialog"
                    hidden={!open}
                    className="fixed z-40 inset-x-0 bottom-0 pb-[env(safe-area-inset-bottom)] bg-white dark:bg-gray-900 rounded-t-2xl shadow-[0_-8px_30px_rgba(0,0,0,0.18)] max-h-[85vh] overflow-y-auto lg:inset-x-auto lg:bottom-auto lg:top-[4.25rem] lg:right-4 lg:w-[460px] lg:pb-0 lg:rounded-2xl lg:shadow-2xl"
                >
                    <QuickCaptureInput
                        ref={inputRef}
                        unified
                        compact
                        defaultTarget={target}
                        resetKey={openCount}
                        projects={projects}
                        onClose={closeCapture}
                        cardClassName="rounded-none shadow-none"
                    />
                </div>
            )}
        </>
    );
};

export default CaptureHost;
