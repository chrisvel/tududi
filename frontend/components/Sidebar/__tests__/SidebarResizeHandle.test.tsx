import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import SidebarResizeHandle from '../SidebarResizeHandle';
import { useStore } from '../../../store/useStore';
import { saveSidebarWidthPercent } from '../../../utils/sidebarSettingsService';

jest.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, fallback?: any) =>
            typeof fallback === 'string' ? fallback : key,
    }),
}));

jest.mock('../../../utils/sidebarSettingsService', () => ({
    saveSidebarWidthPercent: jest.fn(),
}));

const mockSave = saveSidebarWidthPercent as jest.Mock;

const setPercent = (percent: number) =>
    act(() => {
        useStore.getState().userSettingsStore.setSidebarWidthPercent(percent);
    });

const currentPercent = () =>
    useStore.getState().userSettingsStore.sidebarWidthPercent;

const flush = () => act(async () => {});

const drag = (handle: HTMLElement, positions: number[]) => {
    fireEvent.pointerDown(handle, { pointerId: 1, clientX: 352 });
    for (const clientX of positions) {
        fireEvent.pointerMove(handle, { pointerId: 1, clientX });
    }
    fireEvent.pointerUp(handle, { pointerId: 1 });
};

describe('SidebarResizeHandle', () => {
    beforeAll(() => {
        if (typeof (window as any).PointerEvent === 'undefined') {
            (window as any).PointerEvent = MouseEvent;
        }
    });

    beforeEach(() => {
        mockSave.mockReset().mockResolvedValue(undefined);
        setPercent(100);
        jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        jest.restoreAllMocks();
        document.documentElement.classList.remove('sidebar-resizing');
    });

    it('exposes an accessible vertical separator with the allowed range', () => {
        render(<SidebarResizeHandle />);

        const handle = screen.getByRole('separator');

        expect(handle).toHaveAttribute('aria-orientation', 'vertical');
        expect(handle).toHaveAttribute('aria-valuemin', '90');
        expect(handle).toHaveAttribute('aria-valuemax', '110');
        expect(handle).toHaveAttribute('aria-valuenow', '100');
        expect(handle).toHaveAttribute('aria-label', 'Resize sidebar');
    });

    it('follows the pointer while dragging and saves once on release', async () => {
        render(<SidebarResizeHandle />);
        const handle = screen.getByTestId('sidebar-resize-handle');

        fireEvent.pointerDown(handle, { pointerId: 1, clientX: 352 });
        fireEvent.pointerMove(handle, { pointerId: 1, clientX: 340 });
        expect(currentPercent()).toBe(97);
        fireEvent.pointerMove(handle, { pointerId: 1, clientX: 330 });
        expect(currentPercent()).toBe(94);
        expect(mockSave).not.toHaveBeenCalled();

        fireEvent.pointerUp(handle, { pointerId: 1 });
        await flush();

        expect(mockSave).toHaveBeenCalledTimes(1);
        expect(mockSave).toHaveBeenCalledWith(94);
    });

    it('does not go narrower than 90% or wider than 110%', async () => {
        render(<SidebarResizeHandle />);
        const handle = screen.getByTestId('sidebar-resize-handle');

        drag(handle, [100]);
        await flush();
        expect(currentPercent()).toBe(90);

        drag(handle, [900]);
        await flush();
        expect(currentPercent()).toBe(110);
    });

    it('ignores pointer movement when no drag is in progress', () => {
        render(<SidebarResizeHandle />);

        fireEvent.pointerMove(screen.getByTestId('sidebar-resize-handle'), {
            pointerId: 1,
            clientX: 330,
        });

        expect(currentPercent()).toBe(100);
    });

    it('does not save when the width did not change', async () => {
        render(<SidebarResizeHandle />);

        drag(screen.getByTestId('sidebar-resize-handle'), [352]);
        await flush();

        expect(mockSave).not.toHaveBeenCalled();
    });

    it('marks the page as resizing only during the drag', () => {
        render(<SidebarResizeHandle />);
        const handle = screen.getByTestId('sidebar-resize-handle');

        fireEvent.pointerDown(handle, { pointerId: 1, clientX: 352 });
        expect(
            document.documentElement.classList.contains('sidebar-resizing')
        ).toBe(true);

        fireEvent.pointerUp(handle, { pointerId: 1 });
        expect(
            document.documentElement.classList.contains('sidebar-resizing')
        ).toBe(false);
    });

    it('goes back to the saved width when saving fails', async () => {
        mockSave.mockRejectedValue(new Error('offline'));
        render(<SidebarResizeHandle />);

        drag(screen.getByTestId('sidebar-resize-handle'), [330]);
        await flush();

        expect(mockSave).toHaveBeenCalledWith(94);
        expect(currentPercent()).toBe(100);
    });

    it('compares against the width saved on the profile, not the default', async () => {
        setPercent(94);
        render(<SidebarResizeHandle />);

        drag(screen.getByTestId('sidebar-resize-handle'), [352]);
        await flush();

        expect(mockSave).toHaveBeenCalledWith(100);
    });

    it('resizes with the arrow keys and saves when the key is released', async () => {
        render(<SidebarResizeHandle />);
        const handle = screen.getByTestId('sidebar-resize-handle');

        fireEvent.keyDown(handle, { key: 'ArrowLeft' });
        fireEvent.keyDown(handle, { key: 'ArrowLeft' });
        expect(currentPercent()).toBe(98);
        expect(mockSave).not.toHaveBeenCalled();

        fireEvent.keyUp(handle, { key: 'ArrowLeft' });
        await flush();

        expect(mockSave).toHaveBeenCalledTimes(1);
        expect(mockSave).toHaveBeenCalledWith(98);

        fireEvent.keyDown(handle, { key: 'ArrowRight' });
        fireEvent.keyUp(handle, { key: 'ArrowRight' });
        await flush();
        expect(mockSave).toHaveBeenLastCalledWith(99);
    });

    it('jumps to the narrowest and widest with Home and End', async () => {
        render(<SidebarResizeHandle />);
        const handle = screen.getByTestId('sidebar-resize-handle');

        fireEvent.keyDown(handle, { key: 'Home' });
        fireEvent.keyUp(handle, { key: 'Home' });
        await flush();
        expect(currentPercent()).toBe(90);

        fireEvent.keyDown(handle, { key: 'End' });
        fireEvent.keyUp(handle, { key: 'End' });
        await flush();
        expect(currentPercent()).toBe(110);
    });

    it('stays inside the range with the arrow keys', () => {
        setPercent(110);
        render(<SidebarResizeHandle />);
        const handle = screen.getByTestId('sidebar-resize-handle');

        fireEvent.keyDown(handle, { key: 'ArrowRight' });
        expect(currentPercent()).toBe(110);

        setPercent(90);
        fireEvent.keyDown(handle, { key: 'ArrowLeft' });
        expect(currentPercent()).toBe(90);
    });

    it('can grow past the default width', async () => {
        render(<SidebarResizeHandle />);
        const handle = screen.getByTestId('sidebar-resize-handle');

        drag(handle, [370]);
        await flush();

        expect(currentPercent()).toBe(105);
        expect(mockSave).toHaveBeenCalledWith(105);
    });

    it('ignores other keys', async () => {
        render(<SidebarResizeHandle />);
        const handle = screen.getByTestId('sidebar-resize-handle');

        fireEvent.keyDown(handle, { key: 'a' });
        fireEvent.keyUp(handle, { key: 'a' });
        await flush();

        expect(mockSave).not.toHaveBeenCalled();
    });

    it('resets to the default width on double click', async () => {
        setPercent(108);
        render(<SidebarResizeHandle />);

        fireEvent.doubleClick(screen.getByTestId('sidebar-resize-handle'));
        await flush();

        expect(currentPercent()).toBe(100);
        expect(mockSave).toHaveBeenCalledWith(100);
    });
});
