import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import ProjectModal from '../ProjectModal';

jest.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, fallback?: any) =>
            typeof fallback === 'string' ? fallback : key,
        i18n: { language: 'en' },
    }),
    initReactI18next: { type: '3rdParty', init: () => {} },
}));

jest.mock('../../../i18n', () => ({
    __esModule: true,
    default: { language: 'en' },
}));

jest.mock('../../Shared/ToastContext', () => ({
    useToast: () => ({
        showSuccessToast: jest.fn(),
        showErrorToast: jest.fn(),
    }),
}));

jest.mock('../../../utils/goalsService', () => ({
    fetchGoals: jest.fn().mockResolvedValue([]),
}));

jest.mock('../../../store/useStore', () => ({
    useStore: () => ({
        tagsStore: {
            tags: [],
            hasLoaded: true,
            isLoading: false,
            loadTags: jest.fn(),
            addNewTags: jest.fn(),
        },
    }),
}));

const renderOpenModal = async () => {
    const onClose = jest.fn();
    render(
        <ProjectModal isOpen onClose={onClose} onSave={jest.fn()} areas={[]} />
    );
    await act(async () => {
        jest.advanceTimersByTime(250);
    });
    return onClose;
};

const expectStillOpen = async (onClose: jest.Mock) => {
    await act(async () => {
        jest.advanceTimersByTime(500);
    });
    expect(onClose).not.toHaveBeenCalled();
};

describe('ProjectModal outside clicks (#1620)', () => {
    beforeEach(() => {
        jest.useFakeTimers();
        Element.prototype.scrollTo = jest.fn();
    });
    afterEach(() => jest.useRealTimers());

    it('stays open when clicking inside the due date calendar', async () => {
        const onClose = await renderOpenModal();

        fireEvent.click(screen.getByTitle('Due Date'));
        const picker = screen.getByTestId('datepicker');
        fireEvent.click(picker.querySelector('button')!);

        const calendar = document.querySelector('[data-portal-menu]');
        expect(calendar).toBeInTheDocument();
        fireEvent.mouseDown(calendar!);

        await expectStillOpen(onClose);
    });

    it('stays open when clicking inside the priority menu', async () => {
        const onClose = await renderOpenModal();

        fireEvent.click(screen.getByTitle('Priority'));
        fireEvent.click(
            screen.getByTestId('priority-dropdown').querySelector('button')!
        );

        const menu = document.querySelector('[data-portal-menu]');
        expect(menu).toBeInTheDocument();
        fireEvent.mouseDown(menu!);

        await expectStillOpen(onClose);
    });

    it('still closes on a genuine outside click', async () => {
        const onClose = await renderOpenModal();

        fireEvent.mouseDown(document.body);

        await act(async () => {
            jest.advanceTimersByTime(500);
        });
        expect(onClose).toHaveBeenCalled();
    });
});
