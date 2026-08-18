import React from 'react';
import { render } from '@testing-library/react';
import '@testing-library/jest-dom';
import Areas from '../Areas';

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
        selector({ areasStore: { areas: [], loadAreas } });
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
    it('forces a fresh reload of areas on mount so card counts do not go stale', () => {
        render(<Areas />);

        expect(loadAreas).toHaveBeenCalledWith(true);
    });
});
