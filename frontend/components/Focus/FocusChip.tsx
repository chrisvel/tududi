// LTD-PATCH(T-302): physical Tailwind classes rewritten to logical utilities for RTL
import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ViewfinderCircleIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { useStore } from '../../store/useStore';
import { applyFocus, describeFocus, useFocus } from '../../utils/focus';
import FocusPopover from './FocusPopover';
import type { Area } from '../../entities/Area';
import type { Project } from '../../entities/Project';

// Stable fallbacks keep the selectors referentially equal when a store
// slice is absent (page tests stub the store with only what they need).
const NO_AREAS: Area[] = [];
const NO_PROJECTS: Project[] = [];

// The always-visible Focus control in the top bar: shows the active scope
// ("Work › Launch · #urgent") and opens the picker. Below sm only the icon
// shows, with a dot while a focus is set.
const FocusChip: React.FC = () => {
    const { t } = useTranslation();
    const focus = useFocus();
    const areas = useStore((state) => state.areasStore?.areas ?? NO_AREAS);
    const projects = useStore(
        (state) => state.projectsStore?.projects ?? NO_PROJECTS
    );
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!open) return;
        const onMouseDown = (event: MouseEvent) => {
            if (ref.current && !ref.current.contains(event.target as Node)) {
                setOpen(false);
            }
        };
        document.addEventListener('mousedown', onMouseDown);
        return () => document.removeEventListener('mousedown', onMouseDown);
    }, [open]);

    const active = !!focus;
    const label = active
        ? describeFocus(focus, areas, projects)
        : t('focus.chip', 'Focus');

    return (
        <div ref={ref} className="relative flex items-center">
            <button
                type="button"
                onClick={() => setOpen((value) => !value)}
                aria-haspopup="dialog"
                aria-expanded={open}
                title={
                    active
                        ? t('focus.activeTitle', 'Focus: {{label}}', { label })
                        : t('focus.title', 'Focus on')
                }
                className={`inline-flex h-9 max-w-[16rem] items-center gap-1.5 rounded-lg px-2.5 text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                    active
                        ? 'bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-300 dark:hover:bg-blue-900/50'
                        : 'text-gray-600 hover:bg-gray-200 dark:text-gray-300 dark:hover:bg-gray-700'
                }`}
                data-testid="focus-chip"
            >
                <span className="relative shrink-0">
                    <ViewfinderCircleIcon className="h-5 w-5" />
                    {active && (
                        <span className="absolute -end-0.5 -top-0.5 h-2 w-2 rounded-full bg-blue-500 sm:hidden" />
                    )}
                </span>
                <span className="hidden truncate sm:inline">{label}</span>
            </button>
            {active && (
                <button
                    type="button"
                    onClick={() => void applyFocus(null).catch(() => undefined)}
                    aria-label={t('focus.clearFocus', 'Clear focus')}
                    title={t('focus.clearFocus', 'Clear focus')}
                    className="ms-0.5 hidden h-7 w-7 items-center justify-center rounded-md text-blue-600 hover:bg-blue-100 dark:text-blue-300 dark:hover:bg-blue-900/50 sm:inline-flex"
                    data-testid="focus-chip-clear"
                >
                    <XMarkIcon className="h-4 w-4" />
                </button>
            )}
            {open && (
                <FocusPopover focus={focus} onClose={() => setOpen(false)} />
            )}
        </div>
    );
};

export default FocusChip;
