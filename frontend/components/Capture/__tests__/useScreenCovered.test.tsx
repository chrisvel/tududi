import React from 'react';
import { act, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { useScreenCovered } from '../useScreenCovered';

const Probe: React.FC<{ enabled?: boolean }> = ({ enabled = true }) => {
    const covered = useScreenCovered(enabled, '[data-ignore]');
    return <span data-testid="probe">{covered ? 'covered' : 'clear'}</span>;
};

const rect = (width: number, height: number, top = 0) =>
    ({
        top,
        left: 0,
        right: width,
        bottom: top + height,
        width,
        height,
        x: 0,
        y: top,
        toJSON: () => ({}),
    }) as DOMRect;

// jsdom has no layout, so each overlay reports the size it is given.
const addFixed = (size: DOMRect, attrs: Record<string, string> = {}) => {
    const el = document.createElement('div');
    el.className = 'fixed';
    el.style.position = 'fixed';
    Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
    el.getBoundingClientRect = () => size;
    document.body.appendChild(el);
    return el;
};

const flush = async () => {
    await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
    });
};

describe('useScreenCovered', () => {
    beforeEach(() => {
        Object.defineProperty(window, 'innerWidth', {
            value: 390,
            configurable: true,
        });
        Object.defineProperty(window, 'innerHeight', {
            value: 800,
            configurable: true,
        });
    });

    afterEach(() => {
        document.querySelectorAll('.fixed').forEach((el) => el.remove());
    });

    it('turns on while a modal backdrop covers the screen and off when it closes', async () => {
        render(<Probe />);
        await flush();
        expect(screen.getByTestId('probe')).toHaveTextContent('clear');

        const backdrop = addFixed(rect(390, 742, 58));
        await flush();
        expect(screen.getByTestId('probe')).toHaveTextContent('covered');

        backdrop.remove();
        await flush();
        expect(screen.getByTestId('probe')).toHaveTextContent('clear');
    });

    it('ignores small fixed elements like the navbar', async () => {
        render(<Probe />);
        addFixed(rect(390, 59));
        await flush();
        expect(screen.getByTestId('probe')).toHaveTextContent('clear');
    });

    it('ignores hidden overlays and the ignored element', async () => {
        render(<Probe />);
        const hidden = addFixed(rect(390, 800));
        hidden.style.opacity = '0';
        addFixed(rect(390, 800), { 'data-ignore': '' });
        await flush();
        expect(screen.getByTestId('probe')).toHaveTextContent('clear');
    });

    it('stays off when disabled', async () => {
        addFixed(rect(390, 800));
        render(<Probe enabled={false} />);
        await flush();
        expect(screen.getByTestId('probe')).toHaveTextContent('clear');
    });
});
