import React from 'react';
import { render, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import ProductivityPage from '../components/Insights/ProductivityPage';

jest.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, fallback?: string) => fallback ?? key,
    }),
}));

jest.mock('../components/Productivity/ProductivityAssistant', () => ({
    __esModule: true,
    default: () => <div data-testid="productivity-assistant" />,
}));

jest.mock('../utils/projectsService', () => ({
    fetchProjects: jest.fn().mockResolvedValue([]),
}));

let storeState: any;

jest.mock('../store/useStore', () => {
    const mockUseStore: any = (selector: any) => selector(storeState);
    return { useStore: mockUseStore };
});

describe('ProductivityPage', () => {
    it('does not call loadTasks again once tasksStore has already loaded (even with zero tasks)', async () => {
        const loadTasks = jest.fn();
        storeState = {
            tasksStore: {
                tasks: [],
                isLoading: false,
                hasLoaded: true,
                loadTasks,
            },
        };

        await act(async () => {
            render(<ProductivityPage />);
        });

        // Regression guard for #1410: once tasksStore has loaded, mounting
        // ProductivityPage again (e.g. after Layout's loading gate remounts
        // it) must not refire loadTasks(), which would loop forever when the
        // user has zero tasks.
        expect(loadTasks).not.toHaveBeenCalled();
    });

    it('calls loadTasks once when tasksStore has not loaded yet', async () => {
        const loadTasks = jest.fn();
        storeState = {
            tasksStore: {
                tasks: [],
                isLoading: false,
                hasLoaded: false,
                loadTasks,
            },
        };

        await act(async () => {
            render(<ProductivityPage />);
        });

        expect(loadTasks).toHaveBeenCalledTimes(1);
    });
});
