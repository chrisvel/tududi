import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import IconSortDropdown from '../IconSortDropdown';

const sortOptions = [
    { value: 'name:asc', label: 'Name' },
    { value: 'created_at:desc', label: 'Created At' },
];

describe('IconSortDropdown sections', () => {
    it('renders each section with the chosen option checked and reports changes', () => {
        const onStatus = jest.fn();
        render(
            <IconSortDropdown
                options={sortOptions}
                value="name:asc"
                onChange={jest.fn()}
                ariaLabel="Sort"
                sections={[
                    {
                        key: 'status',
                        label: 'Status',
                        options: [
                            { value: 'all', label: 'All' },
                            { value: 'done', label: 'Completed' },
                        ],
                        value: 'all',
                        onChange: onStatus,
                    },
                ]}
            />
        );

        fireEvent.click(screen.getByRole('button', { name: 'Sort' }));

        expect(screen.getByText('Status')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'All' })).toHaveClass(
            'text-blue-600'
        );
        fireEvent.click(screen.getByRole('button', { name: 'Completed' }));
        expect(onStatus).toHaveBeenCalledWith('done');
        // Section picks keep the menu open so several filters can be set.
        expect(screen.getByText('Status')).toBeInTheDocument();
    });

    it('shows a dot only while a filter is active', () => {
        const { rerender } = render(
            <IconSortDropdown
                options={sortOptions}
                value="name:asc"
                onChange={jest.fn()}
            />
        );
        expect(
            screen.queryByTestId('icon-sort-active')
        ).not.toBeInTheDocument();

        rerender(
            <IconSortDropdown
                options={sortOptions}
                value="name:asc"
                onChange={jest.fn()}
                active
            />
        );
        expect(screen.getByTestId('icon-sort-active')).toBeInTheDocument();
    });
});
