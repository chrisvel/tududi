import React from 'react';
import { useTranslation } from 'react-i18next';
import { useStore } from '../../store/useStore';
import { applyFocus, describeFocus, useFocus } from '../../utils/focus';
import type { Area } from '../../entities/Area';
import type { Project } from '../../entities/Project';

// Stable fallbacks keep the selectors referentially equal when a store
// slice is absent (page tests stub the store with only what they need).
const NO_AREAS: Area[] = [];
const NO_PROJECTS: Project[] = [];

// Shown under an empty list while a Focus is set, so an empty page reads
// as "nothing here in this focus" rather than "nothing at all".
const FocusEmptyHint: React.FC<{ className?: string }> = ({
    className = '',
}) => {
    const { t } = useTranslation();
    const focus = useFocus();
    const areas = useStore((state) => state.areasStore?.areas ?? NO_AREAS);
    const projects = useStore(
        (state) => state.projectsStore?.projects ?? NO_PROJECTS
    );
    if (!focus) return null;
    const label = describeFocus(focus, areas, projects);
    return (
        <div
            className={`flex flex-wrap items-center justify-center gap-x-2 gap-y-1 rounded-lg bg-blue-50 px-3 py-2 text-sm text-blue-800 dark:bg-blue-900/30 dark:text-blue-200 ${className}`}
            data-testid="focus-empty-hint"
        >
            <span>
                {t('focus.emptyHint', 'Showing {{label}} only', { label })}
            </span>
            <button
                type="button"
                onClick={() => void applyFocus(null).catch(() => undefined)}
                className="font-medium underline-offset-2 hover:underline"
            >
                {t('focus.clearFocus', 'Clear focus')}
            </button>
        </div>
    );
};

export default FocusEmptyHint;
