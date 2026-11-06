import React from 'react';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter } from 'react-router-dom';
import SearchMenu from '../components/UniversalSearch/SearchMenu';

jest.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, fallback?: string) => fallback ?? key,
    }),
}));

jest.mock('../components/Shared/ToastContext', () => ({
    useToast: () => ({
        showSuccessToast: jest.fn(),
        showErrorToast: jest.fn(),
    }),
}));

jest.mock('../components/UniversalSearch/SearchResults', () => ({
    __esModule: true,
    default: ({ selectedDue, selectedExtras }: any) => (
        <div>
            <span data-testid="due">{selectedDue ?? ''}</span>
            <span data-testid="extras">{selectedExtras.join(',')}</span>
        </div>
    ),
}));

const NO_DUE_DATE = 'search.extrasFilter.hasNoDueDate';
const OVERDUE = 'search.extrasFilter.isOverdue';
const TODAY = 'dateIndicators.today';

const renderMenu = async () => {
    await act(async () => {
        render(
            <MemoryRouter>
                <SearchMenu
                    searchQuery=""
                    selectedFilters={['Task']}
                    onFilterToggle={jest.fn()}
                    onClose={jest.fn()}
                />
            </MemoryRouter>
        );
    });
    fireEvent.click(screen.getByText('search.criteria'));
};

const selectedDue = () => screen.getByTestId('due').textContent;
const selectedExtras = () => screen.getByTestId('extras').textContent;

describe('SearchMenu no due date filter', () => {
    beforeEach(() => {
        global.fetch = jest.fn().mockResolvedValue({
            ok: true,
            json: async () => [],
        }) as jest.Mock;
    });

    it('shows the filter in the Due row, not under Extras', async () => {
        await renderMenu();

        const dueRow = screen.getByText('search.dueFilter').parentElement!;
        expect(within(dueRow).getByText(NO_DUE_DATE)).toBeInTheDocument();
        expect(screen.getAllByText(NO_DUE_DATE)).toHaveLength(1);
    });

    it('sends no_due_date as an extra and names it in the description', async () => {
        await renderMenu();

        fireEvent.click(screen.getByText(NO_DUE_DATE));

        expect(selectedExtras()).toBe('no_due_date');
        expect(screen.getAllByText(NO_DUE_DATE)).toHaveLength(2);
    });

    it('clears a chosen due date when picked', async () => {
        await renderMenu();
        const dueRow = screen.getByText('search.dueFilter').parentElement!;

        fireEvent.click(within(dueRow).getByText(TODAY));
        expect(selectedDue()).toBe('today');

        fireEvent.click(within(dueRow).getByText(NO_DUE_DATE));
        expect(selectedDue()).toBe('');
        expect(selectedExtras()).toBe('no_due_date');
    });

    it('is cleared by choosing a due date', async () => {
        await renderMenu();
        const dueRow = screen.getByText('search.dueFilter').parentElement!;

        fireEvent.click(within(dueRow).getByText(NO_DUE_DATE));
        fireEvent.click(within(dueRow).getByText(TODAY));

        expect(selectedDue()).toBe('today');
        expect(selectedExtras()).toBe('');
    });

    it('cannot be combined with is Overdue', async () => {
        await renderMenu();
        const dueRow = screen.getByText('search.dueFilter').parentElement!;

        fireEvent.click(screen.getByText(OVERDUE));
        fireEvent.click(within(dueRow).getByText(NO_DUE_DATE));
        expect(selectedExtras()).toBe('no_due_date');

        fireEvent.click(screen.getByText(OVERDUE));
        expect(selectedExtras()).toBe('overdue');
    });
});
