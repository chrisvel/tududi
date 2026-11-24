import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
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
            location={location}
            handleNavClick={jest.fn()}
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

describe('SidebarNotesTree sections', () => {
    beforeEach(() => localStorage.clear());

    const manyNotes: Note[] = Array.from({ length: 6 }, (_, i) => ({
        uid: `n${i}`,
        title: `Note ${i}`,
        content: '',
        updated_at: `2026-01-0${i + 1}`,
        tags: i === 0 ? [{ name: 'ideas' }] : [],
    }));

    it('lists the three most recent notes', () => {
        renderTree(manyNotes);

        expect(screen.getByText('Recent')).toBeInTheDocument();
        expect(screen.getByText('Note 5')).toBeInTheDocument();
        expect(screen.getByText('Note 3')).toBeInTheDocument();
        expect(screen.queryByText('Note 2')).not.toBeInTheDocument();
    });

    it('shows Recent with only a few notes too', () => {
        renderTree(manyNotes.slice(0, 2));

        expect(screen.getByText('Recent')).toBeInTheDocument();
        expect(screen.getByText('Note 0')).toBeInTheDocument();
    });

    it('has no project folders', () => {
        renderTree([
            {
                uid: 'p1',
                title: 'In project',
                content: '',
                project_uid: 'proj',
                project: { id: 1, uid: 'proj', name: 'Blog' },
            },
        ]);

        expect(screen.queryByText('Blog')).not.toBeInTheDocument();
        expect(screen.queryByText('Projects')).not.toBeInTheDocument();
        expect(screen.getByText('In project')).toBeInTheDocument();
    });

    it('filters the list by a tag chip and clears it on a second click', () => {
        renderTree(manyNotes);

        const chip = screen.getByRole('button', { name: '#ideas' });
        fireEvent.click(chip);

        expect(chip).toHaveAttribute('aria-pressed', 'true');
        expect(screen.queryByText('Recent')).not.toBeInTheDocument();
        expect(screen.getByText('Note 0')).toBeInTheDocument();
        expect(screen.queryByText('Note 5')).not.toBeInTheDocument();

        fireEvent.click(chip);
        expect(screen.getByText('Note 5')).toBeInTheDocument();
    });
});
