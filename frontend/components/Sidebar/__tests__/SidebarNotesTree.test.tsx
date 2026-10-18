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

const renderTree = (notes: Note[], projects: any[] = []) =>
    render(
        <SidebarNotesTree
            notes={notes}
            projects={projects}
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

describe('SidebarNotesTree sections', () => {
    beforeEach(() => localStorage.clear());

    const manyNotes: Note[] = Array.from({ length: 6 }, (_, i) => ({
        uid: `n${i}`,
        title: `Note ${i}`,
        content: '',
        updated_at: `2026-01-0${i + 1}`,
        tags: i === 0 ? [{ name: 'ideas' }] : [],
    }));

    it('shows Recent once there are enough notes', () => {
        renderTree(manyNotes);

        expect(screen.getByText('Recent')).toBeInTheDocument();
        // Newest note sits in Recent and in the full list below it.
        expect(screen.getAllByText('Note 5')).toHaveLength(2);
    });

    it('hides Recent with only a few notes', () => {
        renderTree(manyNotes.slice(0, 2));

        expect(screen.queryByText('Recent')).not.toBeInTheDocument();
    });

    it('filters the list by a tag chip and clears it on a second click', () => {
        renderTree(manyNotes);

        const chip = screen.getByRole('button', { name: '#ideas' });
        fireEvent.click(chip);

        expect(chip).toHaveAttribute('aria-pressed', 'true');
        expect(screen.queryByText('Recent')).not.toBeInTheDocument();
        expect(screen.getByText('Note 0')).toBeInTheDocument();
        expect(screen.queryByText('Note 3')).not.toBeInTheDocument();

        fireEvent.click(chip);
        expect(screen.getByText('Note 2')).toBeInTheDocument();
    });

    it('gives notes without a project their own folder next to projects', () => {
        renderTree(
            [
                {
                    uid: 'p1',
                    title: 'In project',
                    content: '',
                    project_uid: 'proj',
                },
                { uid: 'l1', title: 'Loose', content: '' },
            ],
            [{ uid: 'proj', name: 'Blog' }]
        );

        expect(screen.getByText('Blog')).toBeInTheDocument();
        expect(screen.getByText('No project')).toBeInTheDocument();
        expect(screen.queryByText('Loose')).not.toBeInTheDocument();
    });
});
