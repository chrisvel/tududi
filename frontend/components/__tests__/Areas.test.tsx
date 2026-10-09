import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter } from 'react-router-dom';
import Areas from '../Areas';

import { ToastProvider } from '../Shared/ToastContext';

jest.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, fallback?: string) => fallback ?? key,
    }),
}));

jest.mock('../Area/AreaModal', () => ({
    __esModule: true,
    default: () => null,
}));

jest.mock('../Shared/ConfirmDialog', () => ({
    __esModule: true,
    default: () => null,
}));

const loadAreas = jest.fn();

jest.mock('../../store/useStore', () => {
    const mockUseStore: any = (selector: any) =>
        selector({
            areasStore: { areas: [], loadAreas },
            userSettingsStore: { capabilities: null },
        });
    mockUseStore.getState = () => ({
        areasStore: {
            areas: [],
            setAreas: jest.fn(),
            setLoading: jest.fn(),
            setError: jest.fn(),
            loadAreas,
        },
    });
    return { useStore: mockUseStore };
});

describe('Areas overview page', () => {
    const renderAreas = () =>
        render(
            <ToastProvider>
                <MemoryRouter>
                    <Areas />
                </MemoryRouter>
            </ToastProvider>
        );

    it('forces a fresh reload of areas on mount so card counts do not go stale', () => {
        renderAreas();

        expect(loadAreas).toHaveBeenCalledWith(true);
    });

    it('shows the blank slate with create actions when there are no areas', () => {
        renderAreas();

        expect(screen.getByText('No areas yet.')).toBeInTheDocument();
        expect(screen.getByText('Create your first area')).toBeInTheDocument();
        expect(screen.getByText('Go to projects')).toBeInTheDocument();
        expect(screen.getByTestId('new-area-button')).toBeInTheDocument();
    });
});
