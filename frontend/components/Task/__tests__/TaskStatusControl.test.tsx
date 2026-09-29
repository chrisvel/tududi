import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import TaskStatusControl from '../TaskStatusControl';
import { Task } from '../../../entities/Task';

jest.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (_key: string, fallback?: string) => fallback ?? _key,
    }),
}));

const task: Task = {
    id: 1,
    uid: 'task-1',
    name: 'Buy tickets',
    status: 'not_started',
    completed_at: null,
};

const setViewport = (phone: boolean) => {
    window.matchMedia = jest.fn().mockImplementation((query: string) => ({
        matches: phone && query === '(max-width: 639px)',
        media: query,
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
    })) as any;
};

const statusButton = () => screen.getByTitle('Not Started');
const menuButton = () =>
    screen
        .getAllByRole('button')
        .find((b) => b.getAttribute('aria-haspopup') === 'menu');

describe('TaskStatusControl on phones (#1669)', () => {
    const originalMatchMedia = window.matchMedia;
    afterEach(() => {
        window.matchMedia = originalMatchMedia;
    });

    it('opens the status menu when the status button is tapped on a phone', () => {
        setViewport(true);
        render(<TaskStatusControl task={task} showMobileVariant={false} />);

        expect(menuButton()).toHaveAttribute('aria-expanded', 'false');
        fireEvent.click(statusButton());
        expect(menuButton()).toHaveAttribute('aria-expanded', 'true');
    });

    it('leaves the status button inert on larger screens', () => {
        setViewport(false);
        render(<TaskStatusControl task={task} showMobileVariant={false} />);

        fireEvent.click(statusButton());
        expect(menuButton()).toHaveAttribute('aria-expanded', 'false');
    });

    it('gives both buttons a thumb-sized tap target on phones', () => {
        setViewport(true);
        render(<TaskStatusControl task={task} showMobileVariant={false} />);
        expect(statusButton().className).toContain('max-sm:min-h-9');
        expect(menuButton()?.className).toContain('max-sm:min-h-9');
    });
});
