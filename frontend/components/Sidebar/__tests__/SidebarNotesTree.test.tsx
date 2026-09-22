import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import SidebarNotesTree from '../SidebarNotesTree';
import { Note } from '../../../entities/Note';

jest.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, fallback?: any) =>
            typeof fallback === 'string' ? fallback : key,
    }),
}));

const location = {
    pathname: '/notes',
    search: '',
    hash: '',
    state: null,
    key: 'k',
} as any;

const renderTree = (notes: Note[]) =>
    render(
        <SidebarNotesTree
            notes={notes}
            projects={[]}
            location={location}
            handleNavClick={jest.fn()}
            searchQuery=""
        />
    );

describe('SidebarNotesTree shared indicator', () => {
    it('marks notes shared with a public link', () => {
        renderTree([
            {
                uid: 'abc',
                title: 'Shared note',
                content: '',
                is_public: true,
            },
        ]);

        expect(screen.getByText('Shared note')).toBeInTheDocument();
        expect(
            screen.getByTestId('note-shared-indicator-abc')
        ).toBeInTheDocument();
    });

    it('does not mark private notes', () => {
        renderTree([
            {
                uid: 'def',
                title: 'Private note',
                content: '',
                is_public: false,
            },
        ]);

        expect(screen.getByText('Private note')).toBeInTheDocument();
        expect(
            screen.queryByTestId('note-shared-indicator-def')
        ).not.toBeInTheDocument();
    });
});
