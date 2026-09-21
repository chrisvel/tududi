import React, { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useStore } from '../../store/useStore';
import { saveSidebarWidthPercent } from '../../utils/sidebarSettingsService';
import {
    SIDEBAR_DEFAULT_PERCENT,
    SIDEBAR_MAX_PERCENT,
    SIDEBAR_MIN_PERCENT,
    clampSidebarPercent,
    sidebarPxToPercent,
} from '../../utils/sidebarWidth';

const KEY_STEP_PERCENT = 1;
const RESIZING_CLASS = 'sidebar-resizing';

const SidebarResizeHandle: React.FC = () => {
    const { t } = useTranslation();
    const percent = useStore(
        (state) => state.userSettingsStore.sidebarWidthPercent
    );
    const setPercent = useStore(
        (state) => state.userSettingsStore.setSidebarWidthPercent
    );
    const savedPercent = useRef(percent);
    const isChanging = useRef(false);
    const isDragging = useRef(false);

    const beginChange = () => {
        if (isChanging.current) return;
        isChanging.current = true;
        savedPercent.current =
            useStore.getState().userSettingsStore.sidebarWidthPercent;
    };

    const persist = async () => {
        isChanging.current = false;
        const next = useStore.getState().userSettingsStore.sidebarWidthPercent;
        if (next === savedPercent.current) return;
        try {
            await saveSidebarWidthPercent(next);
            savedPercent.current = next;
        } catch (error) {
            console.error('Error saving sidebar width:', error);
            setPercent(savedPercent.current);
        }
    };

    const endDrag = () => {
        if (!isDragging.current) return;
        isDragging.current = false;
        document.documentElement.classList.remove(RESIZING_CLASS);
        persist();
    };

    const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
        event.preventDefault();
        event.currentTarget.setPointerCapture?.(event.pointerId);
        beginChange();
        isDragging.current = true;
        document.documentElement.classList.add(RESIZING_CLASS);
    };

    const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
        if (!isDragging.current) return;
        const rootFontSize =
            parseFloat(
                getComputedStyle(document.documentElement).fontSize || '16'
            ) || 16;
        setPercent(sidebarPxToPercent(event.clientX, rootFontSize));
    };

    const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
        const current = percent;
        let next: number | null = null;
        if (event.key === 'ArrowLeft') next = current - KEY_STEP_PERCENT;
        if (event.key === 'ArrowRight') next = current + KEY_STEP_PERCENT;
        if (event.key === 'Home') next = SIDEBAR_MIN_PERCENT;
        if (event.key === 'End') next = SIDEBAR_MAX_PERCENT;
        if (next === null) return;
        event.preventDefault();
        beginChange();
        setPercent(clampSidebarPercent(next));
    };

    const handleKeyUp = (event: React.KeyboardEvent<HTMLDivElement>) => {
        if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
            persist();
        }
    };

    const handleDoubleClick = () => {
        beginChange();
        setPercent(SIDEBAR_DEFAULT_PERCENT);
        persist();
    };

    return (
        <div
            role="separator"
            aria-orientation="vertical"
            aria-label={t('sidebar.resize', 'Resize sidebar')}
            aria-valuemin={SIDEBAR_MIN_PERCENT}
            aria-valuemax={SIDEBAR_MAX_PERCENT}
            aria-valuenow={percent}
            tabIndex={0}
            data-testid="sidebar-resize-handle"
            className="hidden sm:block absolute top-0 right-0 h-full w-1.5 cursor-col-resize touch-none z-10 transition-colors duration-150 hover:bg-blue-500/30 focus-visible:bg-blue-500/40 active:bg-blue-500/50 focus:outline-none"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            onKeyDown={handleKeyDown}
            onKeyUp={handleKeyUp}
            onDoubleClick={handleDoubleClick}
        />
    );
};

export default SidebarResizeHandle;
