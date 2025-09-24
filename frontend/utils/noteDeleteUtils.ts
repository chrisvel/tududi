import { deleteNote as apiDeleteNote } from './notesService';
import { useStore } from '../store/useStore';
import { Note } from '../entities/Note';

/**
 * Shared utility function to delete a note and update the global store
 * @param noteOrUid - The note object or UID of the note to delete
 * @param showSuccessToast - Function to show success toast
 * @param t - Translation function
 * @returns Promise<void>
 */
export const deleteNoteWithStoreUpdate = async (
    noteOrUid: Note | string,
    showSuccessToast: (message: string) => void,
    t: (key: string) => string
): Promise<void> => {
    let noteUid: string;

    if (typeof noteOrUid === 'object') {
        // It's a Note object
        noteUid = noteOrUid.uid!;
    } else {
        // It's a UID string
        noteUid = noteOrUid;
    }

    await apiDeleteNote(noteUid);

    // Remove note from global store
    const currentNotes = useStore.getState().notesStore.notes;
    useStore
        .getState()
        .notesStore.setNotes(
            currentNotes.filter((note: Note) => note.uid !== noteUid)
        );

    // Show success toast
    showSuccessToast(t('success.noteDeleted'));
};
