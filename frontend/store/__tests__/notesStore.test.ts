import { useStore } from '../useStore';
import { Note } from '../../entities/Note';

describe('notesStore.addNote', () => {
    beforeEach(() => {
        useStore.getState().notesStore.setNotes([]);
    });

    it('puts a new note first', () => {
        const { notesStore } = useStore.getState();
        notesStore.setNotes([{ uid: 'a', title: 'Old' } as Note]);

        useStore
            .getState()
            .notesStore.addNote({ uid: 'b', title: 'New' } as Note);

        expect(
            useStore.getState().notesStore.notes.map((note) => note.uid)
        ).toEqual(['b', 'a']);
    });

    it('replaces a note that is already listed', () => {
        const { notesStore } = useStore.getState();
        notesStore.setNotes([{ uid: 'a', title: 'Old' } as Note]);

        useStore
            .getState()
            .notesStore.addNote({ uid: 'a', title: 'Renamed' } as Note);

        const notes = useStore.getState().notesStore.notes;
        expect(notes).toHaveLength(1);
        expect(notes[0].title).toBe('Renamed');
    });
});
