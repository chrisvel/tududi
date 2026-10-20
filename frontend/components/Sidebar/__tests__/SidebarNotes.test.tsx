import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import SidebarNotes from '../SidebarNotes';
import { Note } from '../../../entities/Note';

jest.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, fallback?: any) =>
            typeof fallback === 'string' ? fallback : key,
    }),
}));

let mockNotes: Note[] = [];
jest.mock('../../../store/useStore', () => ({
    useStore: (selector: (state: any) => unknown) =>
        selector({
            notesStore: {
                notes: mockNotes,
                hasLoaded: true,
                loadNotes: jest.fn(),
            },
            projectsStore: {
                projects: [],
                hasLoaded: true,
                loadProjects: jest.fn(),
            },
        }),
}));

const location = {
    pathname: '/today',
    search: '',
    hash: '',
    state: null,
    key: 'k',
} as any;

const renderNotes = () =>
    render(
        <SidebarNotes
            handleNavClick={jest.fn()}
            location={location}
            isDarkMode={false}
            onCreateNote={jest.fn()}
            notes={[]}
        />
    );

describe('SidebarNotes', () => {
    beforeEach(() => {
        localStorage.setItem('sidebarSectionExpanded:notes', 'true');
    });

    afterEach(() => {
        localStorage.clear();
    });

    it('shows no empty panel when the section was left open and there are no notes', () => {
        mockNotes = [];
        renderNotes();

        expect(
            screen.queryByPlaceholderText('Search notes...')
        ).not.toBeInTheDocument();
        expect(
            document.querySelector('.rounded-xl.bg-gray-50')
        ).not.toBeInTheDocument();
    });

    it('shows the notes panel when there are notes', () => {
        mockNotes = [{ uid: 'a1', title: 'First note', content: '' }];
        renderNotes();

        expect(
            screen.getByPlaceholderText('Search notes...')
        ).toBeInTheDocument();
        expect(screen.getByText('First note')).toBeInTheDocument();
    });
});
