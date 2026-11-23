import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter } from 'react-router-dom';
import Breadcrumbs from '../Breadcrumbs';

jest.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, fallback?: any) =>
            typeof fallback === 'string' ? fallback : key,
    }),
}));

const renderAt = (path: any) =>
    render(
        <MemoryRouter initialEntries={[path]}>
            <Breadcrumbs />
        </MemoryRouter>
    );

describe('Breadcrumbs', () => {
    it('links a group page back to Everyone', () => {
        renderAt('/groups/g1');
        expect(screen.getByRole('link', { name: 'Everyone' })).toHaveAttribute(
            'href',
            '/everyone'
        );
        expect(screen.getByText('Group')).toHaveAttribute(
            'aria-current',
            'page'
        );
    });

    it('shows Notes on the notes table', () => {
        renderAt('/notes');
        expect(screen.getByText('Notes')).toHaveAttribute(
            'aria-current',
            'page'
        );
    });

    it('keeps Notes as the way back from a note and a new note', () => {
        const { unmount } = renderAt('/notes/abc-groceries');
        expect(screen.getByRole('link', { name: 'Notes' })).toHaveAttribute(
            'href',
            '/notes'
        );
        expect(screen.getByText('Groceries')).toBeInTheDocument();
        unmount();

        renderAt({ pathname: '/notes', state: { blankNote: true } });
        expect(screen.getByRole('link', { name: 'Notes' })).toBeInTheDocument();
        expect(screen.getByText('New Note')).toBeInTheDocument();
    });

    it('renders nothing on the Everyone page itself', () => {
        const { container } = renderAt('/everyone');
        expect(container).toBeEmptyDOMElement();
    });
});
