import { deleteNote as apiDeleteNote } from './notesService';
import { useStore } from '../store/useStore';
import { Note } from '../entities/Note';

/**
 * Shared utility function to delete a note and update the global store
 * @param noteId - The ID of the note to delete
 * @param showSuccessToast - Function to show success toast
 * @param t - Translation function
 * @returns Promise<void>
 */
export const deleteNoteWithStoreUpdate = async (
    noteId: number,
    showSuccessToast: (message: string) => void,
    t: (key: string) => string
): Promise<void> => {
    await apiDeleteNote(noteId);

    // Remove note from global store
    const currentNotes = useStore.getState().notesStore.notes;
    useStore
        .getState()
        .notesStore.setNotes(
            currentNotes.filter((note: Note) => note.id !== noteId)
        );

    // Show success toast
    showSuccessToast(t('success.noteDeleted'));
};
