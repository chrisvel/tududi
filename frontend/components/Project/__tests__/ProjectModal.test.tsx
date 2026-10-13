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

const flush = async (ms = 500) => {
    await act(async () => {
        jest.advanceTimersByTime(ms);
    });
};

// The scrim is the full-screen layer behind the panel
const getScrim = () =>
    document.querySelector<HTMLElement>('.fixed.inset-0.z-\\[55\\]')!;

const renderModal = (
    props: Partial<React.ComponentProps<typeof ProjectModal>> = {}
) => {
    const onClose = jest.fn();
    const onSave = jest.fn();
    render(
        <ProjectModal
            isOpen
            onClose={onClose}
            onSave={onSave}
            areas={[]}
            {...props}
        />
    );
    return { onClose, onSave };
};

describe('ProjectModal side panel', () => {
    beforeEach(() => {
        jest.useFakeTimers();
        Element.prototype.scrollTo = jest.fn();
    });
    afterEach(() => jest.useRealTimers());

    it('shows every field without expanding sections first', () => {
        renderModal();
        expect(screen.getByTestId('project-name-input')).toBeInTheDocument();
        expect(screen.getByTestId('datepicker')).toBeInTheDocument();
        expect(screen.getByTestId('priority-dropdown')).toBeInTheDocument();
    });

    it('saves the entered name', async () => {
        const { onSave, onClose } = renderModal();
        fireEvent.change(screen.getByTestId('project-name-input'), {
            target: { value: 'Garden shed' },
        });
        fireEvent.click(screen.getByTestId('project-save-button'));
        await flush();
        expect(onSave).toHaveBeenCalledWith(
            expect.objectContaining({ name: 'Garden shed' })
        );
        expect(onClose).toHaveBeenCalled();
    });

    it('stays open when clicking inside the due date calendar (#1620)', async () => {
        const { onClose } = renderModal();

        fireEvent.click(
            screen.getByTestId('datepicker').querySelector('button')!
        );
        const calendar = document.querySelector('[data-portal-menu]');
        expect(calendar).toBeInTheDocument();
        fireEvent.mouseDown(calendar!);

        await flush();
        expect(onClose).not.toHaveBeenCalled();
    });

    it('stays open when clicking inside the priority menu (#1620)', async () => {
        const { onClose } = renderModal();

        fireEvent.click(
            screen.getByTestId('priority-dropdown').querySelector('button')!
        );
        const menu = document.querySelector('[data-portal-menu]');
        expect(menu).toBeInTheDocument();
        fireEvent.mouseDown(menu!);

        await flush();
        expect(onClose).not.toHaveBeenCalled();
    });

    it('closes when the scrim is clicked', async () => {
        const { onClose } = renderModal();
        fireEvent.mouseDown(getScrim());
        await flush();
        expect(onClose).toHaveBeenCalled();
    });

    it('keeps the panel open while the delete confirmation is showing', async () => {
        const onDelete = jest.fn().mockResolvedValue(undefined);
        const { onClose } = renderModal({
            project: { id: 1, uid: 'p-1', name: 'Shed' } as any,
            onDelete,
        });

        fireEvent.click(screen.getByRole('button', { name: /delete/i }));
        expect(screen.getByText('Delete Project')).toBeInTheDocument();

        fireEvent.keyDown(document, { key: 'Escape' });
        fireEvent.mouseDown(getScrim());
        await flush();
        expect(onClose).not.toHaveBeenCalled();
        expect(onDelete).not.toHaveBeenCalled();
    });
});
