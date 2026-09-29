import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter } from 'react-router-dom';
import { PlusIcon, FolderIcon } from '@heroicons/react/24/outline';
import BlankSlate from '../BlankSlate';

describe('BlankSlate', () => {
    it('renders the title, hint and actions, with the first one as the main action', () => {
        const onCreate = jest.fn();
        render(
            <MemoryRouter>
                <BlankSlate
                    title="No things yet."
                    hint="Things help you do stuff."
                    actions={[
                        {
                            label: 'Create a thing',
                            icon: PlusIcon,
                            onClick: onCreate,
                        },
                        {
                            label: 'Go elsewhere',
                            icon: FolderIcon,
                            to: '/elsewhere',
                        },
                    ]}
                />
            </MemoryRouter>
        );

        expect(screen.getByText('No things yet.')).toBeInTheDocument();
        expect(
            screen.getByText('Things help you do stuff.')
        ).toBeInTheDocument();

        const create = screen.getByRole('button', { name: 'Create a thing' });
        expect(create).toHaveClass('bg-blue-600');
        fireEvent.click(create);
        expect(onCreate).toHaveBeenCalledTimes(1);

        const link = screen.getByRole('link', { name: 'Go elsewhere' });
        expect(link).toHaveAttribute('href', '/elsewhere');
        expect(link).toHaveClass('bg-blue-50');
    });

    it('renders without actions', () => {
        render(<BlankSlate title="Empty" hint="Nothing here." />);

        expect(screen.getByText('Empty')).toBeInTheDocument();
        expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });
});
